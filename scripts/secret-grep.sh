#!/usr/bin/env bash
# secret-grep.sh — Plan 06-02 / CICD-05 (D-05 "suspenders" half).
#
# The auditable in-repo companion to gitleaks (.gitleaks.toml): a zero-dependency
# grep that matches the EXACT project key shapes. Bare `sk_` appears legitimately in
# setup.mjs, vitest.config.ts, scripts/shell-check.sh and test/setup/setup.test.mjs,
# so we match the FULL secret-key shape, never the bare `sk_` prefix (RESEARCH Pitfall 3
# / T-06-05). Mirrors scripts/shell-check.sh's real-key-shape guard (lines 59-65).
#
# Invoked by the 06-03 secret-scan job after `gitleaks dir .`. Exit 1 on any match.
set -euo pipefail
cd "$(dirname "$0")/.."

# FULL secret shapes only: Clerk secret key, a populated CLERK_SECRET_KEY=, Resend re_.
# Publishable pk_ keys are non-secret by design and are NOT matched here.
PATTERNS='sk_(test|live)_[A-Za-z0-9]{20,}|CLERK_SECRET_KEY=[A-Za-z0-9_-]{8,}|re_[A-Za-z0-9]{20,}'

# Scan the tracked tree, excluding narrative paths (planning docs / docs prose).
if git grep -nE "$PATTERNS" -- . ':!.planning' ':!docs' ; then
  echo "SECRET-GREP FAIL: a real-looking secret was found above." >&2
  exit 1
fi
echo "secret-grep: clean"
