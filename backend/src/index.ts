import express from 'express'
import { collectDefaultMetrics, register } from 'prom-client'
import { Budget, Cache, imageOf, subgraphsOf } from './lib.js'

// The prod router, reached through the mesh. The Api file declares it in consumes.
const ROUTER_URL =
  process.env.ROUTER_URL ??
  'http://storefront-router.graph-prod.svc.cluster.local/'
const WORKSPACES = 'cujarrett/homelab-workspaces'
const GITHUB_API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const SUBGRAPHS = ['records', 'reviews'] as const
const LANES = ['test', 'prod'] as const

// Fixed queries. The public picks one by name and never sends GraphQL.
// touches: which subgraphs the plan will name. The router's own plan replaces it
// when the response carries one.
const QUERIES: Record<
  string,
  { title: string; query: string; touches: string[] }
> = {
  records: {
    title: 'One subgraph',
    query: '{ records { title artist } }',
    touches: ['records'],
  },
  federated: {
    title: 'Both subgraphs, one query',
    query: '{ records { title artist reviews { rating body } } }',
    touches: ['records', 'reviews'],
  },
}

// Every click reaches the router while the budget lasts, so the latency shown
// is real. Past 30 calls a minute per query the last answer is served instead.
// GitHub changes rarely, and the unauthenticated API allows 60 calls an hour,
// so the two repos are read every ten minutes.
const ROUTER_BUDGET = new Budget(30, 60_000)
const GITHUB_TTL_MS = 600_000
const cache = new Cache()
const lastAnswer = new Map<string, Awaited<ReturnType<typeof runQuery>>>()

const headers = {
  'user-agent': 'platform-graph-demo-backend',
  accept: 'application/json',
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': headers['user-agent'] },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.text()
}

interface RouterAnswer {
  data?: unknown
  errors?: unknown
  extensions?: { apolloQueryPlan?: { text?: string; object?: unknown } }
}

async function runQuery(name: string) {
  const q = QUERIES[name]
  const started = performance.now()
  const res = await fetch(ROUTER_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Router config turns the plugin on. The header asks for it per request.
      'apollo-expose-query-plan': 'true',
    },
    body: JSON.stringify({ query: q.query }),
    signal: AbortSignal.timeout(8_000),
  })
  const ms = Math.round(performance.now() - started)
  const body = (await res.json()) as RouterAnswer
  const plan = body.extensions?.apolloQueryPlan
  return {
    name,
    title: q.title,
    query: q.query,
    status: res.status,
    ms,
    data: body.data ?? null,
    errors: body.errors ?? null,
    plan: plan
      ? { text: plan.text ?? '', subgraphs: subgraphsOf(plan.object) }
      : { text: '', subgraphs: q.touches },
    ranAt: new Date().toISOString(),
  }
}

interface Commit {
  sha: string
  html_url: string
  commit: { message: string; committer: { date: string } }
}

/** What the page reads live: each subgraph's last schema commit in its own repo, and the digest in each lane. */
async function loadLane() {
  const subgraphs: Record<string, unknown> = {}
  for (const s of SUBGRAPHS) {
    const commits = (await getJson(
      `${GITHUB_API}/repos/cujarrett/storefront-${s}/commits?path=schema.graphql&per_page=1`,
    )) as Commit[]
    const c = commits[0]
    const lanes: Record<string, unknown> = {}
    for (const lane of LANES) {
      const file = `graph-${lane}/${s}.yaml`
      const yaml = await getText(`${RAW}/${WORKSPACES}/main/${file}`)
      lanes[lane] = {
        image: imageOf(yaml),
        file,
        url: `https://github.com/${WORKSPACES}/blob/main/${file}`,
      }
    }
    subgraphs[s] = {
      schemaCommit: c
        ? {
            sha: c.sha,
            url: c.html_url,
            date: c.commit.committer.date,
            message: c.commit.message.split('\n')[0],
          }
        : null,
      lanes,
    }
  }
  return {
    subgraphs,
    graph: 'storefront-homelab',
    fetchedAt: new Date().toISOString(),
  }
}

const app = express()
app.disable('x-powered-by')
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

app.get('/v1/queries', (_req, res) => {
  res.json(
    Object.entries(QUERIES).map(([name, q]) => ({
      name,
      title: q.title,
      query: q.query,
    })),
  )
})

app.get('/v1/queries/:name', async (req, res) => {
  const name = req.params.name
  if (!(name in QUERIES))
    return res.status(404).json({ error: 'no such query' })
  const last = lastAnswer.get(name)
  if (last && !ROUTER_BUDGET.take(name))
    return res.json({ ...last, cached: true })
  try {
    const answer = await runQuery(name)
    lastAnswer.set(name, answer)
    res.json(answer)
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

app.get('/v1/lane', async (_req, res) => {
  try {
    res.json(await cache.get('lane', GITHUB_TTL_MS, loadLane))
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

app.use((_req, res) => res.status(404).json({ error: 'not found' }))

const port = Number(process.env.PORT ?? 8080)
app.listen(port, () => console.log(`graph demo backend on :${port}`))

// Metrics on their own port. The platform scrapes it without mTLS, so it
// must never share a port with the API.
collectDefaultMetrics()
const metrics = express()
metrics.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType)
  res.send(await register.metrics())
})
metrics.listen(Number(process.env.METRICS_PORT ?? 9090))
