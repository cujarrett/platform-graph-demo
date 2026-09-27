import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { highlightJson } from './json-highlight'
import type { Lane } from './map'

interface QueryInfo {
  name: string
  title: string
  query: string
}

interface Answer {
  status: number
  ms: number
  data: unknown
  errors: unknown
  plan: { text: string; subgraphs: string[] } | null
  ranAt: string
  cached?: boolean
}

interface Run {
  state: 'idle' | 'running' | 'done' | 'failed'
  answer?: Answer
  error?: string
}

/** One card per fixed query. The backend holds the queries; the page only names one. */
@Component({
  selector: 'app-run-it',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="run" id="run-it">
      <h2>Run it</h2>
      <p class="run-lede">
        Each button sends one fixed query to the Apollo router running in
        <code>graph-prod</code> on this cluster. The plan shows which of the
        <span class="chip records">records</span> and
        <span class="chip reviews">reviews</span>
        pods answered each field.
      </p>
      <p class="run-path">
        this page → its backend → <b>storefront-router</b> → <b>records</b> ·
        <b>reviews</b>
      </p>

      <div class="run-grid">
        @for (q of queries(); track q.name) {
          <article
            class="run-card"
            [attr.data-state]="runs()[q.name]?.state ?? 'idle'"
          >
            <h3>{{ q.title }}</h3>
            <pre class="run-q"><code>{{ q.query }}</code></pre>
            <button
              class="run-btn"
              (click)="run(q.name)"
              [disabled]="runs()[q.name]?.state === 'running'"
            >
              {{
                runs()[q.name]?.state === 'idle' || !runs()[q.name]
                  ? '▶  Run'
                  : 'Run again'
              }}
            </button>

            @if (runs()[q.name]; as r) {
              @if (r.state === 'running') {
                <p class="run-status">calling the router…</p>
              }
              @if (r.state === 'failed') {
                <p class="run-status bad">{{ r.error }}</p>
              }
              @if (r.state === 'done' && r.answer; as a) {
                <p class="run-status">
                  <span [class.ok]="!a.errors" [class.bad]="!!a.errors"
                    >HTTP {{ a.status }}</span
                  >
                  <span class="ms">{{ a.ms }} ms at the router</span>
                  @if (a.cached) {
                    <span class="ms"
                      >last answer, the router is being spared</span
                    >
                  }
                </p>
                @if (a.plan) {
                  <div class="run-plan">
                    <div class="run-h">answered by</div>
                    <div class="chips">
                      @for (s of a.plan.subgraphs; track s) {
                        <span class="chip {{ s }}">{{ s }}</span>
                      }
                    </div>
                    @if (a.plan.text) {
                      <div class="run-h">query plan</div>
                      <pre class="run-out"><code>{{ a.plan.text }}</code></pre>
                    }
                  </div>
                }
                @if (a.errors) {
                  <div class="run-h">the router said</div>
                  <pre
                    class="run-out bad"
                  ><code [innerHTML]="pretty(a.errors)"></code></pre>
                }
                @if (a.data) {
                  <div class="run-h">data</div>
                  <pre
                    class="run-out"
                  ><code [innerHTML]="pretty(a.data)"></code></pre>
                }
              }
            }
          </article>
        }
      </div>

      <div class="proof">
        <h3>What answered</h3>
        <p class="run-lede">
          One card per thing your queries touched. Each subgraph runs the digest
          its prod file names, and that digest is what the operator published
          its schema from.
        </p>
        <div class="proof-grid">
          <article class="proof-card router" [class.hit]="served() > 0">
            <div class="proof-h">
              <span class="chip router">router</span>
              <span class="proof-count">{{ served() }} served</span>
            </div>
            <dl>
              <dt>service</dt>
              <dd>storefront-router.graph-prod</dd>
              <dt>variant</dt>
              <dd>
                <a
                  href="https://studio.apollographql.com/graph/storefront-homelab/variant/prod/launches"
                  target="_blank"
                  rel="noopener"
                  >storefront-homelab&#64;prod</a
                >
              </dd>
              <dt>rendered from</dt>
              <dd>
                <a
                  href="https://github.com/cujarrett/homelab-workspaces/blob/main/graph-prod/storefront.yaml"
                  target="_blank"
                  rel="noopener"
                  >graph-prod/storefront.yaml</a
                >
              </dd>
            </dl>
          </article>
          @for (s of subgraphNames(); track s) {
            <article class="proof-card {{ s }}" [class.hit]="answered(s) > 0">
              <div class="proof-h">
                <span class="chip {{ s }}">{{ s }}</span>
                <span class="proof-count">{{ answered(s) }} answered</span>
              </div>
              @if (lane(); as l) {
                <dl>
                  <dt>running</dt>
                  <dd>
                    <a
                      [href]="l.subgraphs[s].lanes['prod'].url"
                      target="_blank"
                      rel="noopener"
                      >{{ short(l.subgraphs[s].lanes['prod'].image) }}</a
                    >
                  </dd>
                  <dt>schema changed</dt>
                  <dd>
                    @if (l.subgraphs[s].schemaCommit; as c) {
                      <a [href]="c.url" target="_blank" rel="noopener">{{
                        c.sha.slice(0, 7)
                      }}</a>
                      · {{ c.date.slice(0, 10) }}
                    }
                  </dd>
                  <dt>pod</dt>
                  <dd>{{ s }}.graph-prod</dd>
                </dl>
              } @else {
                <p class="run-foot">{{ laneError() || 'reading GitHub…' }}</p>
              }
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class RunIt {
  readonly lane = input<Lane | null>(null)
  readonly laneError = input<string>('')

  // The same two the backend holds, so the cards render before, or without, its answer.
  readonly queries = signal<QueryInfo[]>([
    {
      name: 'records',
      title: 'One subgraph',
      query: '{ records { title artist } }',
    },
    {
      name: 'federated',
      title: 'Both subgraphs, one query',
      query: '{ records { title artist reviews { rating body } } }',
    },
  ])
  readonly runs = signal<Record<string, Run>>({})

  constructor() {
    fetch('/api/v1/queries')
      .then((r) => r.json())
      .then((qs: QueryInfo[]) => this.queries.set(qs))
      .catch(() => undefined)
  }

  subgraphNames(): string[] {
    const l = this.lane()
    return l ? Object.keys(l.subgraphs) : ['records', 'reviews']
  }

  /** Runs whose plan named this subgraph. Only the plan knows, so it is 0 until one arrives. */
  answered(name: string): number {
    return Object.values(this.runs()).filter(
      (r) => r.state === 'done' && r.answer?.plan?.subgraphs.includes(name),
    ).length
  }

  served(): number {
    return Object.values(this.runs()).filter((r) => r.state === 'done').length
  }

  short(image: string | null): string {
    if (!image) return 'unknown'
    const at = image.indexOf('@sha256:')
    return at === -1 ? image : image.slice(at + 8, at + 20)
  }

  private readonly sanitizer = inject(DomSanitizer)

  pretty(v: unknown): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      highlightJson(JSON.stringify(v, null, 2)),
    )
  }

  async run(name: string): Promise<void> {
    this.patch(name, { state: 'running' })
    try {
      const res = await fetch(`/api/v1/queries/${name}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) {
        this.patch(name, {
          state: 'failed',
          error: body.error ?? `HTTP ${res.status}`,
        })
        return
      }
      this.patch(name, { state: 'done', answer: body as Answer })
    } catch {
      this.patch(name, {
        state: 'failed',
        error: 'no response from the backend',
      })
    }
  }

  private patch(name: string, run: Run): void {
    this.runs.update((all) => ({ ...all, [name]: run }))
  }
}
