/** Every subgraph a query plan fetched from, in plan order, without repeats. */
export function subgraphsOf(plan: unknown): string[] {
  const found: string[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== 'object') return
    const rec = node as Record<string, unknown>
    if (
      typeof rec.serviceName === 'string' &&
      !found.includes(rec.serviceName)
    ) {
      found.push(rec.serviceName)
    }
    Object.values(rec).forEach(walk)
  }
  walk(plan)
  return found
}

/** The image reference in a GraphApi workspace file, or null when the file has none. */
export function imageOf(yaml: string): string | null {
  const m = yaml.match(/^\s*image:\s*(\S+)\s*$/m)
  return m ? m[1] : null
}

interface Entry<T> {
  value: T
  at: number
}

/**
 * One value per key, refreshed after ttlMs. Every public request reads from
 * here, so the router and GitHub see at most one call per key per window.
 */
export class Cache {
  private readonly entries = new Map<string, Entry<unknown>>()
  private readonly pending = new Map<string, Promise<unknown>>()

  async get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key) as Entry<T> | undefined
    if (hit && Date.now() - hit.at < ttlMs) return hit.value
    const inflight = this.pending.get(key) as Promise<T> | undefined
    if (inflight) return inflight
    const p = load()
      .then((value) => {
        this.entries.set(key, { value, at: Date.now() })
        return value
      })
      .finally(() => this.pending.delete(key))
    this.pending.set(key, p)
    return p
  }
}

/**
 * A budget of calls per window, per key. Every click reaches the router while
 * the budget lasts, so the latency shown is the latency measured. Past it the
 * caller serves its last answer instead.
 */
export class Budget {
  private readonly stamps = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  take(key: string, now = Date.now()): boolean {
    const recent = (this.stamps.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    )
    if (recent.length >= this.limit) {
      this.stamps.set(key, recent)
      return false
    }
    recent.push(now)
    this.stamps.set(key, recent)
    return true
  }
}
