# lint, test and build the backend, then lint and build the page
ci:
    #!/usr/bin/env bash
    set -euo pipefail
    (cd backend && go mod tidy -diff && golangci-lint run && go test -race ./... && go build -race -o backend .)
    (cd spa && npm run lint && npm run build)

install:
    #!/usr/bin/env bash
    set -euo pipefail
    npm install
    (cd spa && npm install)

# the page and backend from source, against the prod router. Nothing deployed.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    for port in 4200 14000 18080; do
        if lsof -ti:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            echo "port $port is already in use - run 'just stop' first" >&2
            exit 1
        fi
    done
    # A port-forward exits when its pod restarts or the link drops, so it runs in a loop.
    # || true, or set -e ends the loop on the first exit instead of retrying.
    (while true; do kubectl port-forward svc/storefront-router -n graph-prod 14000:80 >/dev/null 2>&1 || true; sleep 1; done) &
    forward=$!
    # Kill only what this recipe started, so a failure here cannot take out the shell.
    trap 'kill $forward $backend 2>/dev/null; pkill -f "port-forward svc/storefront-router" 2>/dev/null; true' EXIT
    until curl -s -o /dev/null localhost:14000/ 2>/dev/null; do sleep 1; done
    (cd backend && ROUTER_URL=http://localhost:14000/ PORT=18080 METRICS_PORT=19090 go run .) &
    backend=$!
    until curl -s -o /dev/null localhost:18080/healthz 2>/dev/null; do sleep 1; done
    (cd spa && npm start)

# stop anything left behind by a previous just dev
stop:
    -@pkill -f "ng serve" 2>/dev/null || true
    -@pkill -f "exe/backend" 2>/dev/null || true
    -@pkill -f "port-forward svc/storefront-router" 2>/dev/null || true
    @echo "stopped"
