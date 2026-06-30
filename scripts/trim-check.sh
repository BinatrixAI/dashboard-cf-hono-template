#!/usr/bin/env bash
# trim-check.sh — Plan 01-03 Task 1 gate.
# Verifies the mock Zustand auth-store and base demo pages are fully removed,
# the Clerk demo seam is preserved, and the project type-checks clean.
# Exits non-zero on any violation.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

# 1. No references to the deleted mock auth-store (SCAF-03).
if grep -rl "useAuthStore\|stores/auth-store" src/client >/dev/null 2>&1; then
  echo "FAIL: lingering references to the mock auth-store:"
  grep -rln "useAuthStore\|stores/auth-store" src/client
  fail=1
else
  echo "OK: no useAuthStore / stores/auth-store references"
fi

# 2. Deleted mock-auth + demo features/routes must be gone (SCAF-03, SCAF-04, D-05).
deleted=(
  "src/client/stores/auth-store.ts"
  "src/client/features/auth"
  "src/client/routes/(auth)"
  "src/client/features/users"
  "src/client/features/apps"
  "src/client/features/chats"
  "src/client/features/tasks"
  "src/client/routes/_authenticated/users"
  "src/client/routes/_authenticated/apps"
  "src/client/routes/_authenticated/chats"
  "src/client/routes/_authenticated/tasks"
  "src/client/routes/_authenticated/help-center"
)
for path in "${deleted[@]}"; do
  if [ -e "$path" ]; then
    echo "FAIL: expected deleted but still present: $path"
    fail=1
  fi
done
[ "$fail" -eq 0 ] && echo "OK: all mock-auth + demo paths deleted"

# 3. Clerk demo seam must be preserved for Phase 3.
if [ ! -d "src/client/routes/clerk" ]; then
  echo "FAIL: src/client/routes/clerk was removed (must stay for Phase 3)"
  fail=1
else
  echo "OK: src/client/routes/clerk preserved"
fi

# 4. No dangling imports — project type-checks clean.
if pnpm exec tsc -b >/tmp/trim-check-tsc.log 2>&1; then
  echo "OK: tsc -b clean"
else
  echo "FAIL: tsc -b reported errors:"
  cat /tmp/trim-check-tsc.log
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "trim-check: FAILED"
  exit 1
fi
echo "trim-check: PASSED"
