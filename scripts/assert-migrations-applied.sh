#!/usr/bin/env bash
#
# PRE-DEPLOY GATE (CF-03 / D-05): refuse to ship code whose schema the remote database lacks.
#
# Usage: bash scripts/assert-migrations-applied.sh [D1 binding, default DB]
#
# The test suite cannot catch this: `pnpm test` runs against a LOCAL D1 with every migration
# applied, so only a remote read sees the local-vs-remote drift. `wrangler d1 migrations list`
# diffs ./migrations ON DISK against the remote d1_migrations table. Fail closed: an unreadable
# answer (network, auth, a placeholder database_id) or an unrecognised wrangler output format
# aborts too — a gate that treats "I could not tell" as "fine" silently stops gating.
#
# bash 3.2 compatible (macOS): here-strings only, no arrays.
set -euo pipefail

DB_BINDING="${1:-DB}"

if ! out="$(npx wrangler d1 migrations list "$DB_BINDING" --remote 2>&1)"; then
  echo "$out" >&2
  echo "ABORT: could not read the remote migration state for binding '$DB_BINDING'. Fix the read (login, network, database_id in wrangler.jsonc) — do not skip the gate." >&2
  exit 1
fi

if grep -q 'Migrations to be applied' <<<"$out"; then
  echo "$out" >&2
  cat >&2 <<'MSG'

ABORT: the remote database is MISSING migrations this build needs.
Deploying now ships code against a schema that does not exist yet.

Apply them first:  pnpm db:migrate:remote
then re-run:       pnpm run deploy

MSG
  exit 1
fi

# The success marker, asserted POSITIVELY: a future wrangler that renames its "to be applied"
# heading must not sail through the grep above and report a clean gate.
if ! grep -qi 'no migrations to apply' <<<"$out"; then
  echo "$out" >&2
  echo "ABORT: could not find either marker in wrangler's output — its format has changed and this gate can no longer tell applied from pending. Update the script; do not remove it." >&2
  exit 1
fi

echo "MIGRATIONS OK: remote '$DB_BINDING' has every migration in ./migrations"
