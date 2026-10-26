#!/usr/bin/env bash
# gitleaks-selftest.sh — Plan 22-05 / CF-06.
#
# Proves .gitleaks.toml does what it claims, in throwaway temp dirs:
#   - a publishable pk_ key (incl. a padded one ending ==) passes in any path;
#   - an sk_ key is flagged in every path the old path allowlist used to skip;
#   - a line holding both a pk_ and an sk_ key is still flagged.
#
# The sk_ fixture is assembled at runtime from separate parts, so this file never
# holds a contiguous key (scripts/secret-grep.sh and CI's breadth scan would flag it).
# Its body is mixed-case: a low-entropy body is not flagged (RESEARCH Pitfall 7).
#
# Exit 0 = every verdict right, 1 = a wrong verdict or a gitleaks error, 2 = no gitleaks.
# Run by the CI secret-scan job after the breadth scan. Bash 3.2 compatible.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks not on PATH" >&2
  exit 2
fi

CONFIG="$PWD/.gitleaks.toml"
PK="pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk"
PK_PADDED="pk_test_cGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA=="
# Not named *key/*secret/*token: the generic-api-key rule keys off those words.
SKVAL="sk_""live_""aB3dE5fG7hJ9kL1mN2pQr4sT6"

TMPDIRS=""
cleanup() {
  for d in $TMPDIRS; do rm -rf "$d"; done
}
trap cleanup EXIT

CASES=0

# check <name> <expected-exit> <file>=<content>...
check() {
  local name="$1" expected="$2" d spec file rc out
  shift 2
  d="$(mktemp -d)"
  TMPDIRS="$TMPDIRS $d"
  for spec in "$@"; do
    file="${spec%%=*}"
    mkdir -p "$d/$(dirname "$file")"
    printf '%s\n' "${spec#*=}" >"$d/$file"
  done
  set +e
  out="$(gitleaks dir "$d" --config "$CONFIG" --exit-code 1 --no-banner 2>&1)"
  rc=$?
  set -e
  CASES=$((CASES + 1))
  # Fail closed: anything but 0/1 is a gitleaks error, never a verdict.
  if [ "$rc" -ne "$expected" ] || { [ "$rc" -ne 0 ] && [ "$rc" -ne 1 ]; }; then
    echo "$out" >&2
    echo "GITLEAKS SELFTEST FAIL: $name expected $expected got $rc" >&2
    exit 1
  fi
}

check "pk-only" 0 \
  "src/a.ts=CLERK_PUBLISHABLE_KEY=$PK" \
  "src/b.ts=publishableKey: '$PK_PADDED'," \
  "wrangler.jsonc={ \"vars\": { \"CLERK_PUBLISHABLE_KEY\": \"$PK\" } }" \
  ".dev.vars.example=CLERK_PUBLISHABLE_KEY=$PK" \
  "docs/a.md=CLERK_PUBLISHABLE_KEY=$PK"

for path in docs/a.md test/setup/x.test.mjs .planning/a.md src/c.ts \
  wrangler.jsonc worker-configuration.d.ts vitest.config.ts; do
  check "sk in $path" 1 "$path=CLERK_SECRET_KEY=$SKVAL"
done

check "mixed line" 1 "src/d.ts=CLERK_PUBLISHABLE_KEY=$PK CLERK_SECRET_KEY=$SKVAL"

echo "GITLEAKS SELFTEST OK: $CASES cases"
