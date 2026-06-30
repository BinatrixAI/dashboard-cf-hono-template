#!/usr/bin/env bash
#
# A4 spike (RESEARCH Open Question 1): prove @cloudflare/vite-plugin discovers the
# Hono worker entry under the 3-dir single-package split, and that SPA/API routing
# precedence holds. Starts `pnpm dev`, runs four checks, stops the server, and exits
# non-zero on any failure.
#
#   1. /                     -> SPA shell (HTML containing id="root")
#   2. /api/items            -> Hono JSON { items: [...] } (real data leg, Plan 02)
#   3. /settings/appearance  -> SPA fallback (HTTP 200, deep link, not a 404)
#   4. /api/nope             -> terminal Hono JSON 404 (application/json + 404, never HTML)
#
set -uo pipefail

PORT="${PORT:-5173}"
HOST="localhost"
BASE="http://${HOST}:${PORT}"
LOG="$(mktemp)"
FAIL=0

cleanup() {
  if [[ -n "${DEV_PID:-}" ]]; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT

echo "==> starting pnpm dev (port ${PORT})"
PORT="$PORT" pnpm dev --port "$PORT" --strictPort >"$LOG" 2>&1 &
DEV_PID=$!

# Wait up to 60s for the dev server to answer.
ready=0
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "${BASE}/"; then ready=1; break; fi
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "!! dev server exited early; log:"; cat "$LOG"; exit 1
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "!! dev server did not become ready in 60s; log:"; cat "$LOG"; exit 1
fi

check() {
  local name="$1"; shift
  if "$@"; then echo "PASS: $name"; else echo "FAIL: $name"; FAIL=1; fi
}

# 1. SPA shell at /
check "GET / serves SPA shell (id=\"root\")" bash -c \
  "curl -s '${BASE}/' | grep -q 'id=\"root\"'"

# 2. Hono /api/items JSON (the real data leg replaced the throwaway /api/ping probe)
check "GET /api/items returns JSON items" bash -c \
  "curl -s '${BASE}/api/items' | grep -q '\"items\"'"

# 3. Deep link falls back to SPA (200)
code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/settings/appearance")
check "GET /settings/appearance -> 200 (SPA fallback) [got ${code}]" test "$code" = "200"

# 4. Unknown /api/* -> JSON 404 (never HTML)
read -r ctype acode < <(curl -s -o /dev/null -w '%{content_type} %{http_code}' "${BASE}/api/nope")
check "GET /api/nope -> application/json 404 [got ${ctype} ${acode}]" \
  bash -c "[[ '${ctype}' == application/json* && '${acode}' == 404 ]]"

if [[ "$FAIL" -ne 0 ]]; then
  echo "==> spike FAILED; dev log tail:"; tail -30 "$LOG"
  exit 1
fi
echo "==> spike PASSED (A4 worker discovery + ROUT-01/02/03 precedence proven)"
