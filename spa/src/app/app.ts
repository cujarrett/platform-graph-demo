import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { RunIt } from './run-it'
import { Topology } from './topology'
import type { Lane } from './map'

@Component({
  selector: 'app-root',
  imports: [Topology, RunIt],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-run-it [lane]="lane()" [laneError]="laneError()" />

      <section class="how" id="how-it-works">
        <h2>How it works</h2>
        <p class="how-lede">
          The path a schema change takes from a team's repo to the router you
          just queried.
        </p>
        <app-topology />
      </section>
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
