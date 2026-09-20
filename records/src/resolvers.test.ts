import { describe, expect, it } from 'vitest'
import { resolvers } from './resolvers.js'

describe('records resolvers', () => {
  it('lists all records', () => {
    expect(resolvers.Query.records()).toHaveLength(2)
  })

  it('resolves a reference by id', () => {
    const record = resolvers.Record.__resolveReference({ id: '1' })
    expect(record?.title).toBe('Kind of Blue')
  })
})
