import { readFileSync } from 'node:fs'
import express from 'express'
import cors from 'cors'
import { parse } from 'graphql'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@as-integrations/express5'
import { buildSubgraphSchema } from '@apollo/subgraph'
import { collectDefaultMetrics, register } from 'prom-client'
import { resolvers } from './resolvers.js'

// The image ships one copy at /schema.graphql, where the platform reads it
// to publish, so the running server and the registry cannot disagree.
const schemaPath =
  process.env.SCHEMA_PATH ?? new URL('../schema.graphql', import.meta.url)
const typeDefs = parse(readFileSync(schemaPath, 'utf-8'))
const server = new ApolloServer({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
})
await server.start()

const app = express()
app.get('/healthz', (_req, res) => res.status(200).send('ok'))
app.use('/graphql', cors(), express.json(), expressMiddleware(server))

const port = Number(process.env.PORT ?? 4002)
app.listen(port, () =>
  console.log(`reviews subgraph at http://localhost:${port}/graphql`),
)

// Metrics on their own port. The platform scrapes it without mTLS, so it
// must never share a port with GraphQL.
collectDefaultMetrics()
const metrics = express()
metrics.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType)
  res.send(await register.metrics())
})
metrics.listen(Number(process.env.METRICS_PORT ?? 9090))
