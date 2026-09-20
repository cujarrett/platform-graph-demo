const records = [
  { id: '1', title: 'Kind of Blue', artist: 'Miles Davis' },
  { id: '2', title: 'A Love Supreme', artist: 'John Coltrane' },
]

export const resolvers = {
  Query: {
    records: () => records,
  },
  Record: {
    __resolveReference: (ref: { id: string }) =>
      records.find((r) => r.id === ref.id),
  },
}
