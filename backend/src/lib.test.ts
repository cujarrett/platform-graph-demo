import { describe, expect, it } from 'vitest'
import { Budget, Cache, imageOf, subgraphsOf } from './lib.js'

describe('subgraphsOf', () => {
  it('lists each subgraph once, in plan order', () => {
    const plan = {
      kind: 'QueryPlan',
      node: {
        kind: 'Sequence',
        nodes: [
          { kind: 'Fetch', serviceName: 'records' },
          {
            kind: 'Flatten',
            node: { kind: 'Fetch', serviceName: 'reviews' },
          },
          { kind: 'Fetch', serviceName: 'records' },
        ],
      },
    }
    expect(subgraphsOf(plan)).toEqual(['records', 'reviews'])
  })
  it('is empty for no plan', () => {
    expect(subgraphsOf(undefined)).toEqual([])
  })
})

describe('imageOf', () => {
  it('reads the image line', () => {
    const yaml =
      'spec:\n  parameters:\n    graph: storefront\n    image: ghcr.io/x/y@sha256:abc\n'
    expect(imageOf(yaml)).toBe('ghcr.io/x/y@sha256:abc')
  })
  it('is null without one', () => {
    expect(imageOf('kind: Namespace\n')).toBeNull()
  })
})

describe('Cache', () => {
  it('loads once inside the window', async () => {
    const cache = new Cache()
    let calls = 0
    const load = async () => ++calls
    expect(await cache.get('k', 60_000, load)).toBe(1)
    expect(await cache.get('k', 60_000, load)).toBe(1)
    expect(calls).toBe(1)
  })
  it('does not remember a failure', async () => {
    const cache = new Cache()
    let calls = 0
    const load = async () => {
      calls++
      if (calls === 1) throw new Error('down')
      return calls
    }
    await expect(cache.get('k', 60_000, load)).rejects.toThrow('down')
    expect(await cache.get('k', 60_000, load)).toBe(2)
  })
})

describe('Budget', () => {
  it('allows the limit inside a window, then refuses until it slides', () => {
    const b = new Budget(2, 1000)
    expect(b.take('q', 0)).toBe(true)
    expect(b.take('q', 10)).toBe(true)
    expect(b.take('q', 20)).toBe(false)
    expect(b.take('other', 20)).toBe(true)
    expect(b.take('q', 1001)).toBe(true)
  })
})
