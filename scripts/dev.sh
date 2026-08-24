#!/usr/bin/env bash
# dev.sh — локално стартира boilaDB + backend + frontend, всеки на свой порт.
# Никакви мостове: boilaDB говори PostgreSQL v3 wire, backend HTTP/JSON, frontend HTTP.
set -euo pipefail

# Node 22 (nvm) за Next.js — чист shell без .bashrc вижда /usr/bin/node (18)
if [ -d "$HOME/.nvm/versions/node/v22.22.0/bin" ]; then
  export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
fi

# baga print-овете са буферизирани в C; stdbuf ги прави ред-базирани за лога
STDBUF="stdbuf -oL -eL"
command -v stdbuf >/dev/null 2>&1 || STDBUF=""

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BAGA_ROOT="$(cd "$ROOT/../.." && pwd)"

BOILA_PGPORT="${BOILA_PGPORT:-6575}"
PORT="${PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

pids=()
cleanup() {
  for p in "${pids[@]:-}"; do
    kill "$p" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_tcp() {
  local host="$1" port="$2"
  for _ in $(seq 1 60); do
    if (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null; then
      exec 3>&- 3<&- || true
      return 0
    fi
    sleep 0.5
  done
  return 1
}

echo "==> boilaDB serve_pg на :$BOILA_PGPORT"
(cd "$BAGA_ROOT" && BOILA_PGPORT="$BOILA_PGPORT" $STDBUF ./baga -I . -I app-product app-product/boilaDB/tools/serve_pg.baga) &
pids+=($!)

echo "    чакам boilaDB да отговори на TCP :$BOILA_PGPORT ..."
wait_tcp 127.0.0.1 "$BOILA_PGPORT"

echo "==> backend на :$PORT (ORM_BACKEND=boila)"
(
  cd "$BAGA_ROOT"
  export PORT ORM_BACKEND=boila BOILA_PGHOST=127.0.0.1 BOILA_PGPORT
  export BOILA_PGUSER="${BOILA_PGUSER:-boila}" BOILA_PGDATABASE="${BOILA_PGDATABASE:-boila}"
  export FMR_WORKERS="${FMR_WORKERS:-4}" FMR_LOG="${FMR_LOG:-1}" FMR_CORS="${FMR_CORS:-*}"
  export FMR_JWT_SECRET="${FMR_JWT_SECRET:-dev-secret}" FMR_TITLE=bagabuch FMR_VERSION=0.1.0
  $STDBUF ./baga -I . -I app-product app-product/bagabuch/backend/start.baga
) &
pids+=($!)

echo "==> frontend на :$FRONTEND_PORT"
(cd "$ROOT/frontend" && npm run dev -- --port "$FRONTEND_PORT") &
pids+=($!)

echo
echo "Стартирани (универсални приложения, само през портове):"
echo "  boilaDB  : PostgreSQL v3 wire на :$BOILA_PGPORT"
echo "  backend  : HTTP/JSON на :$PORT          (/health /ready /v1/meta /openapi.json)"
echo "  frontend : Next.js на :$FRONTEND_PORT"
echo "Ctrl+C спира всичко."
wait
