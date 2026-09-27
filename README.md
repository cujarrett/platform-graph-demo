# platform-graph-demo

The walkthrough at [graph.mattjarrett.dev](https://graph.mattjarrett.dev): how a schema change moves from a team's repo to a running federated graph, and two live queries against the prod router.

The subgraphs live in their own repos, one team each: [storefront-records](https://github.com/cujarrett/storefront-records) and [storefront-reviews](https://github.com/cujarrett/storefront-reviews). Full design: [Platform Graph](https://github.com/cujarrett/homelab/blob/main/platform/docs/graph.md) in the `homelab` repo.

## Layout

```
backend/    an Api: fixed queries against the prod router, GitHub reads for the live rows
spa/        the Angular page, in Launchpad's how-it-works shape
```

## Run it locally

```bash
just install
just dev          # page and backend from source, against the prod router
```

## Before opening a PR

```bash
just ci
```
