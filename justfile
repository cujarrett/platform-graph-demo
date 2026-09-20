both := "records reviews"

# lint -> test -> build, for every subgraph
ci: lint test build

lint:
    #!/usr/bin/env bash
    set -euo pipefail
    for s in {{both}}; do
        echo "== $s: lint =="
        (cd $s && npm run lint)
    done

test:
    #!/usr/bin/env bash
    set -euo pipefail
    for s in {{both}}; do
        echo "== $s: test =="
        (cd $s && npm run test)
    done

build:
    #!/usr/bin/env bash
    set -euo pipefail
    for s in {{both}}; do
        echo "== $s: build =="
        (cd $s && npm run build)
    done

install:
    #!/usr/bin/env bash
    set -euo pipefail
    npm install
    for s in {{both}}; do
        (cd $s && npm install)
    done

# every subgraph from source, composed locally by a local router
dev:
    APOLLO_ELV2_LICENSE=accept rover dev --supergraph-config supergraph-config.yaml

# this subgraph from source, every other schema pulled from preprod. The
# config file names the local one, plus a routing_url for any you port-forward
dev-preprod config="override.yaml":
    APOLLO_ELV2_LICENSE=accept rover dev --graph-ref storefront-homelab@preprod --supergraph-config {{config}}

# does this compose against the preprod variant, and does it break a real operation
check subgraph:
    rover subgraph check storefront-homelab@preprod --name {{subgraph}} --schema {{subgraph}}/schema.graphql

# check against prod, then open the PR moving the preprod digest into graph-prod
promote subgraph:
    rover subgraph check storefront-homelab@prod --name {{subgraph}} --schema {{subgraph}}/schema.graphql
    gh workflow run promote-{{subgraph}}.yml
