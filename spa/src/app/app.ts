import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { LaunchpadMark } from './launchpad-mark'
import { RunIt } from './run-it'
import { Topology } from './topology'
import type { Lane } from './map'

@Component({
  selector: 'app-root',
  imports: [LaunchpadMark, Topology, RunIt],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="fold">
        <header class="hero">
          <div class="hero-row">
            <h1>
              <app-launchpad-mark [animate]="true" />Platform Engineering: Graph
            </h1>
            <p>
              A working schema pipeline, end to end, on
              <a
                href="https://blog.mattjarrett.dev/homelab/"
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
          </div>
        </header>

        <app-topology />

        <a class="cta" href="#run-it">
          <span class="cta-live"></span>
          Everything on this map is running. Send two real queries through the
          router and see both subgraphs answer.
          <span class="cta-go">↓</span>
        </a>
      </div>

      <app-run-it [lane]="lane()" [laneError]="laneError()" />
    </div>
  `,
})
export class App {
  readonly lane = signal<Lane | null>(null)
  readonly laneError = signal('')

  constructor() {
    fetch('/api/v1/lane')
      .then(async (r) => {
        if (!r.ok) throw new Error(`backend answered ${r.status}`)
        this.lane.set((await r.json()) as Lane)
      })
      .catch((e: Error) => this.laneError.set(`not connected: ${e.message}`))
  }
}
