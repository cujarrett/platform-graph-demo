import { describe, expect, it } from 'vitest'
import { resolvers } from './resolvers.js'

describe('reviews resolvers', () => {
  it('filters reviews by recordId', () => {
    const result = resolvers.Record.reviews({ id: '1' })
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.recordId === '1')).toBe(true)
  })

  it('returns nothing for a record with no reviews', () => {
    expect(resolvers.Record.reviews({ id: 'missing' })).toHaveLength(0)
  })
})
