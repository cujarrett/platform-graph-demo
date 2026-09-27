# lint, test and build the backend, then lint and build the page
ci:
    #!/usr/bin/env bash
    set -euo pipefail
    (cd backend && npm run lint && npm run test && npm run build)
    (cd spa && npm run lint && npm run build)

install:
    #!/usr/bin/env bash
    set -euo pipefail
    npm install
    (cd backend && npm install)
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
    # A port-forward exits when its pod restarts, so it runs in a loop.
    (while true; do kubectl port-forward svc/storefront-router -n graph-prod 14000:80 >/dev/null 2>&1; sleep 1; done) &
    forward=$!
    # Kill only what this recipe started, so a failure here cannot take out the shell.
    trap 'kill $forward $backend 2>/dev/null; pkill -f "port-forward svc/storefront-router" 2>/dev/null; true' EXIT
    until curl -s -o /dev/null localhost:14000/ 2>/dev/null; do sleep 1; done
    (cd backend && ROUTER_URL=http://localhost:14000/ PORT=18080 METRICS_PORT=19090 npm run dev) &
    backend=$!
    until curl -s -o /dev/null localhost:18080/healthz 2>/dev/null; do sleep 1; done
    (cd spa && npm start)

# stop anything left behind by a previous just dev
stop:
    -@pkill -f "ng serve" 2>/dev/null || true
    -@pkill -f "tsx src/index.ts" 2>/dev/null || true
    -@pkill -f "port-forward svc/storefront-router" 2>/dev/null || true
    @echo "stopped"
