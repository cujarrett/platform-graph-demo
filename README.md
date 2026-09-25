# platform-graph-demo

Two GraphQL subgraphs, `records` and `reviews`, federated into one supergraph. `records` owns the `Record` type; `reviews` adds a `reviews` field to it and has never heard of `title` or `artist`. One client query reaches both.

Full design: [Platform Graph](https://github.com/cujarrett/homelab/blob/main/platform/docs/graph.md) in the `homelab` repo.

## Run it locally

```bash
just install
(cd records && npm run dev &)
(cd reviews && npm run dev &)
just dev
```

Then query `http://localhost:4000`:

```graphql
{
  records {
    title
    artist
    reviews {
      rating
      body
    }
  }
}
```

## Before opening a PR

```bash
just ci
just check records   # or reviews
```

## Promoting to prod

```bash
just promote records
```

Opens a PR in `homelab-workspaces` moving the digest running in test into `graph-prod`, after confirming the schema still composes against `storefront-homelab@prod`.
