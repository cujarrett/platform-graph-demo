import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { compactJson, highlightJson } from './json-highlight'
import { LaunchpadMark } from './launchpad-mark'
import type { Lane } from './map'

interface Answer {
  status: number
  ms: number
  data: unknown
  errors: unknown
  plan: { text: string; subgraphs: string[] } | null
  ranAt: string
  cached?: boolean
}

/** One fixed query, sent through the real router. The backend holds the query; the page only names it. */
@Component({
  selector: 'app-run-it',
  imports: [LaunchpadMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="run" id="run-it">
      <div class="live-grid">
        <div class="live-left">
          <h1 class="live-h">
            <app-launchpad-mark [animate]="true" />Working POC: Platform Graph
          </h1>
          <p class="live-sub">
            A federated GraphQL graph, live on
            <a
              href="https://blog.mattjarrett.dev/platform/"
              target="_blank"
              rel="noopener"
              >my bookshelf Kubernetes cluster</a
            >.
            <a
              href="https://github.com/cujarrett/homelab/blob/main/docs/nothing-novel.md"
              target="_blank"
              rel="noopener"
              >Nothing here is novel</a
            >.
          </p>

          <div class="send">
            <button
              class="run-btn"
              (click)="run()"
              [disabled]="state() === 'running'"
            >
              {{ state() === 'running' ? 'Sending…' : '▶  Send it again' }}
            </button>
          </div>

          <ol class="flow" [attr.data-state]="state()">
            <li [class.lit]="lit() >= 1">
              <span class="hop">your browser</span>
              <span class="facts">{{
                totalMs() ? totalMs() + ' ms round trip' : 'this page'
              }}</span>
            </li>
            <li [class.lit]="lit() >= 2">
              <span class="hop">demo backend</span>
              <span class="facts">sends one fixed query, nothing else</span>
            </li>
            <li [class.lit]="lit() >= 3">
              <span class="hop router">Apollo router</span>
              <span class="facts">
                <a
                  href="https://github.com/cujarrett/homelab-workspaces/blob/main/graph-prod/storefront.yaml"
                  target="_blank"
                  rel="noopener"
                  >storefront-router.graph-prod</a
                >
                <span>storefront-homelab&#64;prod</span>
              </span>
            </li>
            @for (s of subgraphNames(); track s) {
              <li [class.lit]="lit() >= 4 && answered(s)" class="sub">
                <a
                  class="hop {{ s }}"
                  [href]="'https://github.com/cujarrett/storefront-' + s"
                  target="_blank"
                  rel="noopener"
                  [title]="'storefront-' + s + ' on GitHub'"
                  >{{ s }} ↗</a
                >
                <span class="facts">
                  <span class="did {{ s }}">{{ did(s) }}</span>
                  <span>pod {{ s }}.graph-prod</span>
                  @if (lane(); as l) {
                    <a
                      [href]="l.subgraphs[s].lanes['prod'].url"
                      target="_blank"
                      rel="noopener"
                      >image {{ short(l.subgraphs[s].lanes['prod'].image) }}</a
                    >
                    @if (l.subgraphs[s].schemaCommit; as c) {
                      <a [href]="c.url" target="_blank" rel="noopener"
                        >schema {{ c.sha.slice(0, 7) }} ·
                        {{ c.date.slice(0, 10) }}</a
                      >
                    }
                  } @else if (laneError()) {
                    <span>{{ laneError() }}</span>
                  }
                </span>
              </li>
            }
          </ol>

          @if (error()) {
            <p class="run-status bad">{{ error() }}</p>
          }
        </div>

        <div class="response">
          @if (story(); as st) {
            <p class="story">{{ st }}</p>
          }
          <div class="rr">
            <div class="rr-col">
              <h4>request</h4>
              <pre class="gql"><code>{{ '{' }}
  <span class="q records">records</span> {{ '{' }}
    <span class="q records">title</span>
    <span class="q records">artist</span>
    <span class="q reviews">reviews</span> {{ '{' }}
      <span class="q reviews">rating</span>
      <span class="q reviews">body</span>
    {{ '}' }}
  {{ '}' }}
{{ '}' }}</code></pre>
            </div>
            <div class="rr-col">
              <h4>
                response
                @if (answer(); as a) {
                  <span class="status" [class.bad]="a.status !== 200"
                    >HTTP {{ a.status }} · {{ a.ranAt.slice(11, 19) }} UTC</span
                  >
                  @if (a.cached) {
                    <span class="status bad">rate limited, last answer</span>
                  }
                }
              </h4>
              @if (answer(); as a) {
                <pre
                  class="response-body"
                ><code [innerHTML]="pretty(a.errors ? { errors: a.errors } : { data: a.data })"></code></pre>
              } @else {
                <p class="response-empty">waiting for the router…</p>
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class RunIt {
  readonly lane = input<Lane | null>(null)
  readonly laneError = input<string>('')

  readonly state = signal<'idle' | 'running' | 'done'>('idle')
  readonly answer = signal<Answer | null>(null)
  readonly error = signal('')
  readonly totalMs = signal(0)
  // How many hops are lit. The reveal is paced for the eye; every number shown is measured.
  readonly lit = signal(0)

  // The page arrives with a real answer. Past the budget the backend serves its last one.
  constructor() {
    afterNextRender(() => void this.run())
  }

  /** The fixed query's shape. Title and artist come from records, reviews from reviews. */
  records(): {
    title: string
    artist: string
    reviews: { rating: number; body: string }[]
  }[] {
    const d = this.answer()?.data as { records?: unknown[] } | null
    return (d?.records ?? []) as {
      title: string
      artist: string
      reviews: { rating: number; body: string }[]
    }[]
  }

  /** One sentence from the real answer, so the visitor knows what just happened. */
  story(): string {
    const a = this.answer()
    if (!a || a.errors) return ''
    const recs = this.records()
    const reviews = recs.reduce((n, r) => n + (r.reviews?.length ?? 0), 0)
    const both = (a.plan?.subgraphs.length ?? 0) > 1
    return both
      ? `The router asked records for ${recs.length} albums, then reviews for their ${reviews} reviews, and joined them into one answer in ${a.ms} ms.`
      : `The router answered from records alone in ${a.ms} ms.`
  }

  /** What this subgraph contributed to the last answer, counted from the answer itself. */
  did(name: string): string {
    if (this.lit() < 4) return 'its own pod'
    if (!this.answered(name)) return 'not needed'
    const recs = this.records()
    if (name === 'records') return `answered ${recs.length} albums`
    const n = recs.reduce((t, r) => t + (r.reviews?.length ?? 0), 0)
    return `answered ${n} reviews`
  }

  subgraphNames(): string[] {
    const l = this.lane()
    return l ? Object.keys(l.subgraphs) : ['records', 'reviews']
  }

  answered(name: string): boolean {
    return !!this.answer()?.plan?.subgraphs.includes(name)
  }

  short(image: string | null): string {
    if (!image) return 'unknown'
    const at = image.indexOf('@sha256:')
    return at === -1 ? image : image.slice(at + 8, at + 20)
  }

  private readonly sanitizer = inject(DomSanitizer)

  pretty(v: unknown): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(highlightJson(compactJson(v)))
  }

  async run(): Promise<void> {
    this.state.set('running')
    this.error.set('')
    this.lit.set(1)
    const started = performance.now()
    try {
      const res = await fetch('/api/v1/queries/federated', {
        cache: 'no-store',
      })
      const body = await res.json()
      this.totalMs.set(Math.round(performance.now() - started))
      if (!res.ok) {
        // The backend's own error text is for logs, not visitors.
        this.error.set('The router did not answer. Try again in a moment.')
        this.state.set('done')
        return
      }
      this.answer.set(body as Answer)
      for (const step of [2, 3, 4]) {
        await new Promise((r) => setTimeout(r, 220))
        this.lit.set(step)
      }
    } catch {
      this.error.set('The demo backend did not answer. Try again in a moment.')
    }
    this.state.set('done')
  }
}
