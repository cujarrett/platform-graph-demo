# platform-graph-demo

The page at graph.mattjarrett.dev and the backend behind it. The subgraphs it describes live in their own repos, `storefront-records` and `storefront-reviews`. See [Platform Graph](https://github.com/cujarrett/homelab/blob/main/platform/docs/graph.md) in the `homelab` repo for the full design.

## Rules

- **Never run `git add`, `git commit`, `git push`, or any git command that writes to or modifies the index, repository history, or remotes.** Output the commands for the user to run - staging is part of their review, and running it for them removes the checkpoint.
- **Never add a `Co-Authored-By` trailer or a "Generated with Claude Code" line** to commit messages or PR descriptions, including in suggested commit messages. Commits are authored by the user alone.
- **Whenever a task requires a commit, always give a suggested commit message** - never leave the user to write it themselves.
- **Give `git add` and the commit as two separate steps, listing every file explicitly.** Never `git add .` or `git add -A`.
- **Never output a `git push` command.** The user pushes as a deliberate human step.
- **No semicolons in JS/TS.** Enforced by Prettier (`semi: false`, root `.prettierrc.json`) and ESLint (`semi: ["error", "never"]`, root `eslint.config.js`). Both subgraphs share these root configs rather than duplicating them.

### Pre-commit safety check

Before telling the user to commit, always run `/security-review`. Once it confirms the changes are safe, offer a suggested commit message - do not run `git commit` yourself.

## Philosophy: Grug-Brained Development

> "Complexity very, very bad." - [grugbrain.dev](https://grugbrain.dev/)

- **Say no.** No new feature, no new abstraction, until it earns its place.
- **Cheapest rung that works.** Before writing code go down the ladder and stop at the first rung that solves it - skip the feature, reuse code already here, standard library, native platform feature, a dependency already installed, one line, then build the minimum.
- **80/20 solutions.** Ugly but working beats elegant but over-engineered.
- **No FOLD** (Fear Of Looking Dumb). If something is too complex, say so.

## Layout

```
backend/    an Api: fixed queries against the prod router, GitHub reads for the live rows
spa/        the walkthrough page, an Angular app in Launchpad's shape
```

## Build tool: `just`, not `make`

`just --list` shows every recipe. `just ci` before pushing. `just dev` runs the page and backend from source against the prod router.

## Required secrets (GitHub → repo settings → Secrets)

| Secret | Used by | Scope needed |
|---|---|---|
| `APOLLO_KEY` | every workflow | a graph API key for `storefront-homelab`, not a personal key |
| `HOMELAB_WORKSPACES_PAT` | deploy + promote workflows | a PAT with push access to `cujarrett/homelab-workspaces` |

`GITHUB_TOKEN` (built in) covers the `ghcr.io` image push.
