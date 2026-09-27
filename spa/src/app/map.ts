// The map every scene is drawn on. Boxes and zones are fixed; a scene is an
// ordered list of hops across them, so the reader learns the territory once.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Zone extends Rect {
  label: string
}

export type Kind = 'declared' | 'built' | 'registry' | 'external'

export interface Box extends Rect {
  label: string
  sub?: string
  kind: Kind
}

export interface Step {
  from: string
  to: string
  // Boxes this step involves but has no arrow to, so they light with it.
  also?: string[]
  label: string
  kind: 'declared' | 'built' | 'registry' | 'gate'
  dashed?: boolean
  text: string
  who: string
  heading: string
  facts: [string, string][]
}

/** What the backend read live, keyed the way /v1/lane returns it. */
export interface Lane {
  subgraphs: Record<
    string,
    {
      schemaCommit: {
        sha: string
        url: string
        date: string
        message: string
      } | null
      lanes: Record<string, { image: string | null; file: string; url: string }>
    }
  >
  latestMergedPr: {
    number: number
    title: string
    url: string
    mergedAt: string
    author: string
  } | null
  graph: string
  fetchedAt: string
}

export interface Scenario {
  key: string
  name: string
  /** The one file the team touched in this scene, coloured line by line. */
  wroteTitle: string
  /** The real file on GitHub, so the reader can open what the team wrote. */
  wroteUrl: string
  yaml: [string, 'd' | 'c'][]
  /** The takeaway under it. <b> for what the team did, <em> for what the platform did. */
  take: string
  /** The pattern this scene is, in one line, with where it came from. */
  pattern: string
  steps: Step[]
}

const HOMELAB = 'https://github.com/cujarrett/homelab/blob/main'
const NOVEL = `${HOMELAB}/docs/nothing-novel.md`
const GRAPH_DOC = `${HOMELAB}/platform/docs/graph.md`

export const ZONES: Record<string, Zone> = {
  repo: { x: 16, y: 20, w: 372, h: 380, label: 'github' },
  cluster: { x: 412, y: 20, w: 470, h: 680, label: 'the cluster · graph-prod' },
  graphos: {
    x: 906,
    y: 20,
    w: 328,
    h: 680,
    label: 'graphos · storefront-homelab@prod',
  },
}

export const PODS: Record<string, Zone> = {
  podRecords: { x: 428, y: 226, w: 140, h: 200, label: 'records pod' },
  podReviews: { x: 584, y: 226, w: 140, h: 200, label: 'reviews pod' },
  podNext: { x: 740, y: 226, w: 126, h: 200, label: 'a third team' },
}

export const BOXES: Record<string, Box> = {
  schema: {
    x: 32,
    y: 60,
    w: 164,
    h: 46,
    label: 'schema.graphql',
    sub: 'beside its resolvers',
    kind: 'declared',
  },
  pr: {
    x: 212,
    y: 60,
    w: 160,
    h: 46,
    label: 'Pull request',
    sub: 'one file changed',
    kind: 'declared',
  },
  ci: {
    x: 32,
    y: 140,
    w: 164,
    h: 46,
    label: 'CI',
    sub: 'tests + schema check',
    kind: 'built',
  },
  codeowners: {
    x: 212,
    y: 140,
    w: 160,
    h: 46,
    label: 'CODEOWNERS',
    sub: 'the owning team',
    kind: 'declared',
  },
  ghcr: {
    x: 32,
    y: 220,
    w: 164,
    h: 46,
    label: 'GHCR image',
    sub: 'signed by digest',
    kind: 'built',
  },
  workspace: {
    x: 212,
    y: 220,
    w: 160,
    h: 46,
    label: 'homelab-workspaces',
    sub: 'graph-test/records.yaml',
    kind: 'declared',
  },
  promote: {
    x: 32,
    y: 300,
    w: 340,
    h: 46,
    label: 'Promote PR',
    sub: 'the test digest into graph-prod',
    kind: 'declared',
  },

  argocd: {
    x: 428,
    y: 60,
    w: 200,
    h: 44,
    label: 'ArgoCD',
    sub: 'applies what git says',
    kind: 'built',
  },
  xp: {
    x: 668,
    y: 60,
    w: 198,
    h: 44,
    label: 'Crossplane',
    sub: 'GraphApi → Api + Subgraph',
    kind: 'built',
  },
  kyverno: {
    x: 428,
    y: 130,
    w: 150,
    h: 44,
    label: 'Kyverno',
    sub: 'cosign signature',
    kind: 'built',
  },
  operator: {
    x: 700,
    y: 130,
    w: 166,
    h: 44,
    label: 'Apollo operator',
    sub: 'reads /schema.graphql',
    kind: 'built',
  },
  records: {
    x: 440,
    y: 260,
    w: 116,
    h: 40,
    label: 'records',
    sub: 'the image',
    kind: 'declared',
  },
  subRecords: {
    x: 440,
    y: 330,
    w: 116,
    h: 40,
    label: 'Subgraph CR',
    sub: 'same digest',
    kind: 'built',
  },
  reviews: {
    x: 596,
    y: 260,
    w: 116,
    h: 40,
    label: 'reviews',
    sub: 'the image',
    kind: 'declared',
  },
  subReviews: {
    x: 596,
    y: 330,
    w: 116,
    h: 40,
    label: 'Subgraph CR',
    sub: 'same digest',
    kind: 'built',
  },
  next: {
    x: 752,
    y: 260,
    w: 102,
    h: 40,
    label: '…',
    sub: 'one file away',
    kind: 'external',
  },
  subNext: {
    x: 752,
    y: 330,
    w: 102,
    h: 40,
    label: 'Subgraph CR',
    sub: '',
    kind: 'external',
  },
  router: {
    x: 428,
    y: 470,
    w: 420,
    h: 48,
    label: 'Router',
    sub: 'serves the composed supergraph',
    kind: 'built',
  },
  client: {
    x: 428,
    y: 560,
    w: 200,
    h: 44,
    label: 'A query',
    sub: 'from this page',
    kind: 'external',
  },

  check: {
    x: 922,
    y: 60,
    w: 296,
    h: 46,
    label: 'Schema check',
    sub: 'composes the proposal, replays traffic',
    kind: 'registry',
  },
  registry: {
    x: 922,
    y: 250,
    w: 296,
    h: 46,
    label: 'Registry',
    sub: 'every published subgraph',
    kind: 'registry',
  },
  launch: {
    x: 922,
    y: 440,
    w: 296,
    h: 46,
    label: 'Launch',
    sub: 'the composed supergraph, by digest',
    kind: 'registry',
  },
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'change',
    name: 'A schema change',
    wroteTitle: 'storefront-records/schema.graphql',
    wroteUrl:
      'https://github.com/cujarrett/storefront-records/blob/main/schema.graphql',
    yaml: [
      ['type Record @key(fields: "id") {', 'd'],
      ['  id: ID!', 'd'],
      ['  title: String!', 'd'],
      ['  artist: String!', 'd'],
      ['}', 'd'],
    ],
    take: '<b>The whole subgraph schema.</b> It lives in the team\u2019s repo, beside the resolvers, and reaches the registry only through the steps on this map.',
    pattern: `Schema lives with the code that serves it. <a href="${GRAPH_DOC}#1-where-the-schema-file-lives" target="_blank" rel="noopener">Decision 1</a> · <a href="${NOVEL}" target="_blank" rel="noopener">nothing novel</a>`,
    steps: [
      {
        from: 'schema',
        to: 'schema',
        label: 'edit',
        kind: 'declared',
        text: 'The team adds a field next to the resolver that serves it. Schema and code change in one commit.',
        who: 'By the <b>records team</b>, in the subgraph\u2019s own repo.',
        heading: 'The change',
        facts: [
          ['repo', 'storefront-records'],
          ['file', 'schema.graphql, beside src/resolvers.ts'],
          ['publish step', 'none'],
        ],
      },
      {
        from: 'schema',
        to: 'pr',
        label: 'git push',
        kind: 'declared',
        text: 'A pull request opens. Nothing has left GitHub yet.',
        who: 'By the <b>records team</b>.',
        heading: 'The pull request',
        facts: [
          ['changed', 'schema + resolver'],
          ['reviewers', 'from CODEOWNERS'],
          ['required checks', 'test, schema-check'],
        ],
      },
      {
        from: 'pr',
        to: 'ci',
        label: 'checks start',
        kind: 'built',
        text: 'CI runs the unit tests and sends the proposed schema to GraphOS for a check.',
        who: 'Built by <b>GitHub Actions</b>. Both jobs are required by branch protection.',
        heading: 'What runs',
        facts: [
          ['test', 'lint, test, build'],
          ['schema-check', 'rover subgraph check'],
          ['image built', 'not yet, only on main'],
        ],
      },
    ],
  },

  {
    key: 'check',
    name: 'The check',
    wroteTitle: 'storefront-records/.github/workflows/ci.yml',
    wroteUrl:
      'https://github.com/cujarrett/storefront-records/blob/main/.github/workflows/ci.yml',
    yaml: [
      ['schema-check:', 'c'],
      ['  steps:', 'c'],
      ['    - uses: apollographql/rover-actions/install-rover-cli@v1', 'd'],
      ['    - run: >', 'd'],
      ['        rover subgraph check storefront-homelab@test', 'd'],
      ['          --name records --schema schema.graphql', 'd'],
    ],
    take: '<b>One CI step.</b> <em>GraphOS</em> composes the proposal with every other subgraph and replays real traffic against it.',
    pattern: `Schema checks in CI, as Apollo documents them. <a href="${GRAPH_DOC}#protecting-the-graph" target="_blank" rel="noopener">Protecting the graph</a> · <a href="${NOVEL}" target="_blank" rel="noopener">nothing novel</a>`,
    steps: [
      {
        from: 'ci',
        to: 'check',
        label: 'rover subgraph check',
        kind: 'built',
        text: 'CI sends only the proposed schema file.',
        who: 'Run by <b>CI</b>, against the test variant.',
        heading: 'Sent to GraphOS',
        facts: [
          ['variant', 'storefront-homelab@test'],
          ['subgraph', 'records'],
          ['payload', 'schema.graphql only'],
        ],
      },
      {
        from: 'check',
        to: 'registry',
        label: 'compose with every other subgraph',
        kind: 'registry',
        text: 'GraphOS composes the proposal with every other published subgraph. The records team cannot break a field the reviews team relies on.',
        who: 'Done by <b>GraphOS</b>.',
        heading: 'Composition',
        facts: [
          ['other subgraphs', 'reviews'],
          ['fails when', 'the supergraph no longer composes'],
        ],
      },
      {
        from: 'check',
        to: 'check',
        label: 'replay operations',
        kind: 'registry',
        text: 'Every operation clients ran recently is replayed against the new schema. Removing a field somebody queries is a breaking change.',
        who: 'Done by <b>GraphOS</b>, from the router’s usage reports.',
        heading: 'Operation check',
        facts: [
          ['window', 'recent traffic'],
          ['breaking', 'a queried field is gone'],
          ['proven', 'a PR removing title was refused'],
        ],
      },
      {
        from: 'check',
        to: 'pr',
        label: 'verdict',
        kind: 'gate',
        text: 'The verdict lands on the PR as a required check. A breaking change cannot merge.',
        who: 'Enforced by <b>branch protection</b>.',
        heading: 'On the PR',
        facts: [
          ['check', 'schema-check'],
          ['required', 'yes, by branch protection'],
          ['details', 'linked from the PR to the check in Apollo Studio'],
        ],
      },
    ],
  },

  {
    key: 'merge',
    name: 'Review and merge',
    wroteTitle: 'storefront-records/.github/CODEOWNERS',
    wroteUrl:
      'https://github.com/cujarrett/storefront-records/blob/main/.github/CODEOWNERS',
    yaml: [['* @cujarrett', 'd']],
    take: '<b>One line, in the records repo.</b> GitHub asks its owner for review on every change. <em>CI</em> signs the image and writes its digest to git.',
    pattern: `CODEOWNERS, a signed image, and a digest written to git. <a href="${GRAPH_DOC}#2-how-the-schema-reaches-the-registry" target="_blank" rel="noopener">Decision 2</a> · <a href="${NOVEL}" target="_blank" rel="noopener">nothing novel</a>`,
    steps: [
      {
        from: 'codeowners',
        to: 'pr',
        label: 'review requested',
        kind: 'declared',
        text: 'Each subgraph is its own repo with its own CODEOWNERS. GitHub requests a review from the owners on every change.',
        who: 'By the <b>records team</b>, on its own directory.',
        heading: 'Ownership',
        facts: [
          ['file', '.github/CODEOWNERS'],
          ['repo', 'storefront-records'],
          ['owners', 'the records team'],
        ],
      },
      {
        from: 'pr',
        to: 'ci',
        label: 'merge to main',
        kind: 'declared',
        text: 'Merged. CI runs once more, now on main, where it may build an image.',
        who: 'By the <b>records team</b>.',
        heading: 'On main',
        facts: [
          ['tests', 'again'],
          ['build-and-push', 'only here'],
        ],
      },
      {
        from: 'ci',
        to: 'ghcr',
        label: 'build, push, sign',
        kind: 'built',
        text: 'The image is pushed and signed by digest with cosign. The signature proves CI on main built it.',
        who: 'Built by <b>GitHub Actions</b>. Nobody holds a signing key.',
        heading: 'The image',
        facts: [
          ['image', 'ghcr.io/cujarrett/storefront-records'],
          ['signed', 'by digest, keyless'],
          ['identity', 'storefront-records ci.yml on main'],
          ['ships', '/schema.graphql'],
        ],
      },
      {
        from: 'ci',
        to: 'workspace',
        label: 'write the digest',
        kind: 'built',
        text: 'CI writes the digest into the test lane’s GraphApi file. That commit is the deploy.',
        who: 'By <b>CI</b>, with a token scoped to that repo.',
        heading: 'The deploy',
        facts: [
          ['file', 'graph-test/records.yaml'],
          ['field', 'image'],
          ['edited by a person', 'no'],
        ],
      },
      {
        from: 'workspace',
        to: 'promote',
        label: 'promote PR',
        kind: 'built',
        text: 'CI checks the schema against prod\u2019s variant, then opens a pull request moving the same digest into prod.',
        who: 'Opened by <b>CI</b>. Merged by the <b>records team</b>.',
        heading: 'To prod',
        facts: [
          ['check', 'storefront-homelab@prod'],
          ['moves', 'graph-test → graph-prod'],
          ['human step', 'merging the PR'],
        ],
      },
    ],
  },

  {
    key: 'publish',
    name: 'Publish',
    wroteTitle: 'homelab-workspaces/graph-prod/records.yaml',
    wroteUrl:
      'https://github.com/cujarrett/homelab-workspaces/blob/main/graph-prod/records.yaml',
    yaml: [
      ['kind: GraphApi', 'c'],
      ['metadata:', 'c'],
      ['  name: records', 'c'],
      ['  namespace: graph-prod', 'c'],
      ['spec:', 'c'],
      ['  parameters:', 'c'],
      ['    graph: storefront', 'd'],
      ['    image: ghcr.io/…/records@sha256:…', 'd'],
    ],
    take: '<b>Two lines.</b> <em>The platform</em> renders the pod, its mesh policy and the Subgraph CR. <em>The operator</em> publishes.',
    pattern: `GitOps, then the Apollo operator publishing from the running image. <a href="${GRAPH_DOC}#what-gets-rendered" target="_blank" rel="noopener">What gets rendered</a> · <a href="${NOVEL}" target="_blank" rel="noopener">nothing novel</a>`,
    steps: [
      {
        from: 'workspace',
        to: 'argocd',
        label: 'git push',
        kind: 'declared',
        text: 'The promote PR merges. ArgoCD sees the new digest.',
        who: 'By the <b>records team</b>.',
        heading: 'In git',
        facts: [
          ['kind', 'GraphApi'],
          ['lines a team maintains', '2'],
        ],
      },
      {
        from: 'argocd',
        to: 'xp',
        label: 'applies GraphApi',
        kind: 'built',
        text: 'Applied to the cluster and kept there. Anything deleted by hand comes back.',
        who: 'By <b>ArgoCD</b>.',
        heading: 'Now in the cluster',
        facts: [
          ['prune', 'true'],
          ['selfHeal', 'true'],
        ],
      },
      {
        from: 'xp',
        to: 'kyverno',
        label: 'admission',
        kind: 'gate',
        text: 'Kyverno verifies the cosign signature before anything runs. An image CI on main did not build is refused, in the pod and in the Subgraph CR.',
        who: 'Enforced by <b>Kyverno</b>.',
        heading: 'Signature check',
        facts: [
          ['policy', 'platform-graph-image-signatures'],
          ['issuer', 'GitHub Actions OIDC'],
          ['subject', 'storefront-records ci.yml @ main'],
        ],
      },
      {
        from: 'xp',
        to: 'records',
        also: ['subRecords'],
        label: 'Api + Subgraph',
        kind: 'built',
        text: 'Crossplane renders an Api and an Apollo Subgraph CR from one digest, so the pod and the registry always match.',
        who: 'Built by <b>Crossplane</b>.',
        heading: 'Rendered',
        facts: [
          ['Api', 'Deployment, Service, mesh policy'],
          ['Subgraph', 'schema from the image, path /schema.graphql'],
          ['digest', 'the same in both'],
        ],
      },
      {
        from: 'operator',
        to: 'subRecords',
        label: 'reads the image',
        kind: 'built',
        text: 'The operator pulls /schema.graphql out of the image the pod is running.',
        who: 'By the <b>Apollo operator</b>.',
        heading: 'Loaded',
        facts: [
          ['from', 'the OCI image'],
          ['condition', 'SchemaLoaded'],
        ],
      },
      {
        from: 'operator',
        to: 'registry',
        label: 'publish',
        kind: 'registry',
        text: 'The operator publishes to the variant. Nobody runs rover subgraph publish.',
        who: 'By the <b>Apollo operator</b>, with the prod key.',
        heading: 'Published',
        facts: [
          ['variant', 'storefront-homelab@prod'],
          ['from', 'the running digest'],
          ['by hand', 'never'],
        ],
      },
    ],
  },

  {
    key: 'serve',
    name: 'Serve',
    wroteTitle: 'homelab-workspaces/graph-prod/storefront.yaml',
    wroteUrl:
      'https://github.com/cujarrett/homelab-workspaces/blob/main/graph-prod/storefront.yaml',
    yaml: [
      ['kind: FederatedGraph', 'c'],
      ['metadata:', 'c'],
      ['  name: storefront', 'c'],
      ['  namespace: graph-prod', 'c'],
      ['spec:', 'c'],
      ['  parameters:', 'c'],
      ['    graphRef: storefront-homelab@prod', 'd'],
      ['    host: graph-prod.local.lab', 'd'],
    ],
    take: '<b>Two lines.</b> The router, its config and its mesh policy, <em>the platform built</em>.',
    pattern: `A router the operator rolls to each launch, by digest. <a href="${GRAPH_DOC}#topology" target="_blank" rel="noopener">Topology</a> · <a href="${NOVEL}" target="_blank" rel="noopener">nothing novel</a>`,
    steps: [
      {
        from: 'registry',
        to: 'launch',
        label: 'compose',
        kind: 'registry',
        text: 'GraphOS composes every published subgraph into one supergraph. A launch records it.',
        who: 'Done by <b>GraphOS</b>.',
        heading: 'The launch',
        facts: [
          ['inputs', 'records, reviews'],
          ['output', 'one supergraph schema'],
        ],
      },
      {
        from: 'launch',
        to: 'operator',
        label: 'new launch',
        kind: 'registry',
        dashed: true,
        text: 'The operator watches the variant and sees the new launch and the digest of its supergraph.',
        who: 'By the <b>Apollo operator</b>.',
        heading: 'Seen',
        facts: [
          ['condition', 'SchemaLoaded'],
          ['artifact', 'artifact.api.apollographql.com/…@sha256:…'],
        ],
      },
      {
        from: 'operator',
        to: 'router',
        label: 'rolls the router',
        kind: 'built',
        text: 'The operator points the router Deployment at that digest and rolls it. The new pod is ready before the old one stops.',
        who: 'By the <b>Apollo operator</b>. The Deployment itself, the platform built from one file.',
        heading: 'Rolled',
        facts: [
          ['flag', '--graph-artifact-reference …@sha256:…'],
          ['egress allowed', 'the registry and this namespace only'],
        ],
      },
      {
        from: 'client',
        to: 'router',
        label: 'one query',
        kind: 'declared',
        text: 'A client sends one query for records and their reviews.',
        who: 'From <b>this page</b>, through a backend that only runs fixed queries.',
        heading: 'The request',
        facts: [['query', '{ records { title reviews { rating } } }']],
      },
      {
        from: 'router',
        to: 'records',
        also: ['reviews'],
        label: 'fan out',
        kind: 'built',
        text: 'The router plans the query across both subgraphs and joins the answer. Run it below.',
        who: 'By the <b>router</b>.',
        heading: 'The plan',
        facts: [
          ['records', 'title, artist and ids'],
          ['reviews', 'reviews for those ids'],
        ],
      },
    ],
  },
]
