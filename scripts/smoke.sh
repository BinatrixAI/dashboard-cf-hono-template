#!/usr/bin/env bash
#
# Wave-merge smoke matrix: proves SPA/API routing precedence against a RUNNING
# dev server (a real network round-trip, RESEARCH Pitfall 6). This is NOT the
# per-task unit gate — that is `pnpm test` (workers pool). Run this against a live
# `pnpm dev`:
#
#     pnpm dev &            # serves on http://localhost:5173
#     bash scripts/smoke.sh # or: bash scripts/smoke.sh http://localhost:5173
#
# Checks (exit non-zero on the first failure):
#   1. SPA `/`                      -> HTML shell containing id="root"
#   2. deep-link `/settings/appearance` -> 200 (SPA history fallback, ROUT-01)
#   3. `/api/items`                 -> JSON with an `items` field (ROUT-02)
#   4. `/api/nope`                  -> content-type application/json + 404 (ROUT-03)
set -euo pipefail

BASE="${1:-http://localhost:5173}"
fail() { echo "SMOKE FAIL: $1" >&2; exit 1; }
pass() { echo "SMOKE OK:   $1"; }

# 1. SPA shell at /
root_html="$(curl -fsS "$BASE/" || fail "GET / did not respond")"
echo "$root_html" | grep -q 'id="root"' || fail 'GET / missing <div id="root"> (SPA shell)'
pass 'GET / serves the SPA shell (id="root")'

# 2. Client deep-link falls back to index.html with 200 (not 404)
deep_status="$(curl -fsS -o /dev/null -w '%{http_code}' "$BASE/settings/appearance" || true)"
[ "$deep_status" = "200" ] || fail "GET /settings/appearance returned $deep_status (expected 200 SPA fallback)"
pass 'GET /settings/appearance -> 200 (SPA history fallback)'

# 3. /api/items reaches Hono and returns an items envelope
items_body="$(curl -fsS "$BASE/api/items" || fail "GET /api/items did not respond")"
echo "$items_body" | grep -q '"items"' || fail "GET /api/items missing the items field: $items_body"
pass 'GET /api/items -> JSON { items } (reaches Hono)'

# 4. Unknown /api/* returns a JSON 404, never HTML
nope_ct="$(curl -fsS -o /dev/null -w '%{content_type}' "$BASE/api/nope" || true)"
nope_status="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/nope")"
echo "$nope_ct" | grep -q 'application/json' || fail "GET /api/nope content-type was '$nope_ct' (expected application/json)"
[ "$nope_status" = "404" ] || fail "GET /api/nope returned status $nope_status (expected 404)"
pass 'GET /api/nope -> application/json 404 (terminal catch-all, never HTML)'

echo "SMOKE PASS: all 4 routing-precedence checks green against $BASE"
