#!/usr/bin/env bash
# shell-check.sh — Plan 01-03 Task 2 gate.
# Verifies the trimmed shell: __APP_NAME__ wordmark, no deleted-demo nav, the
# minimal Overview placeholder, static Phase-3 settings placeholders, and a
# secret-free .dev.vars.example. Exits non-zero on any violation.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

# 1. Sentinel wordmark present (D-08).
if grep -Fq "__APP_NAME__" src/client/components/layout/data/sidebar-data.ts; then
  echo "OK: __APP_NAME__ sentinel in sidebar-data.ts"
else
  echo "FAIL: __APP_NAME__ missing from sidebar-data.ts"
  fail=1
fi

# 2. No nav entries for deleted demos.
if grep -nE "'/tasks'|'/apps'|'/chats'|'/users'|help-center" src/client/components/layout/data/sidebar-data.ts; then
  echo "FAIL: sidebar-data.ts still references deleted demo routes"
  fail=1
else
  echo "OK: no deleted-demo nav entries"
fi

# 3. Overview placeholder copy present; no chart/analytics imports remain.
if grep -Fq "Template placeholder overview" src/client/features/dashboard/index.tsx; then
  echo "OK: Overview placeholder copy present"
else
  echo "FAIL: Overview placeholder copy missing"
  fail=1
fi
if grep -rnE "RecentSales|Analytics|dashboard/components" src/client/features/dashboard >/dev/null 2>&1; then
  echo "FAIL: dashboard still imports Analytics/RecentSales/chart components"
  fail=1
else
  echo "OK: no chart/analytics imports in dashboard"
fi

# 4. Settings profile/account are Phase-3 static placeholders.
for f in profile account; do
  if grep -Fq "TODO(Phase 3)" "src/client/features/settings/$f/index.tsx"; then
    echo "OK: settings/$f flagged TODO(Phase 3)"
  else
    echo "FAIL: settings/$f missing TODO(Phase 3) reconciliation flag"
    fail=1
  fi
done

# 5. .dev.vars.example exists, documents the client key, carries no real secret.
if [ ! -f .dev.vars.example ]; then
  echo "FAIL: .dev.vars.example missing"
  fail=1
else
  grep -Fq "VITE_CLERK_PUBLISHABLE_KEY" .dev.vars.example \
    && echo "OK: .dev.vars.example documents VITE_CLERK_PUBLISHABLE_KEY" \
    || { echo "FAIL: VITE_CLERK_PUBLISHABLE_KEY not documented"; fail=1; }
  # A populated key value would indicate a committed secret.
  if grep -E "(pk_(live|test)_|sk_(live|test)_)[A-Za-z0-9]+" .dev.vars.example; then
    echo "FAIL: .dev.vars.example contains a real-looking secret value"
    fail=1
  else
    echo "OK: .dev.vars.example carries no secret value"
  fi
fi

# 6. .dev.vars is gitignored.
if git check-ignore .dev.vars >/dev/null 2>&1; then
  echo "OK: .dev.vars is gitignored"
else
  echo "FAIL: .dev.vars is not gitignored"
  fail=1
fi

# 7. Type-check clean.
if pnpm exec tsc -b >/tmp/shell-check-tsc.log 2>&1; then
  echo "OK: tsc -b clean"
else
  echo "FAIL: tsc -b reported errors:"
  cat /tmp/shell-check-tsc.log
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "shell-check: FAILED"
  exit 1
fi
echo "shell-check: PASSED"
