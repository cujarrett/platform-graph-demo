const reviews = [
  { id: '1', recordId: '1', rating: 5, body: 'Essential.' },
  { id: '2', recordId: '1', rating: 4, body: 'Cool as it gets.' },
  { id: '3', recordId: '2', rating: 5, body: 'Spiritual.' },
]

export const resolvers = {
  Record: {
    reviews: (record: { id: string }) =>
      reviews.filter((r) => r.recordId === record.id),
  },
}
