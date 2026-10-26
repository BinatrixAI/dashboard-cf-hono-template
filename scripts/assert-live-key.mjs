#!/usr/bin/env node
// LIVE-KEY GATE (CF-03 / D-04): prove the client bundle about to ship carries THIS project's
// Clerk publishable key, carries no other pk_ key, and is not a development (pk_test_) build
// unless the developer opted in with ALLOW_TEST_CLERK_KEY=1 for this run.
//
// The expected key is resolved exactly the way `vite build` inlines it: loadEnv('production')
// reads .env, .env.local, .env.production, .env.production.local, and the shell env wins.
//
// Exit codes: 0 pass · 1 refused · 2 measured nothing (no built bundle). Never prints a full key.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

// Keep in sync with setup.mjs PK_RE.
const PK_RE = /^pk_(test|live)_[A-Za-z0-9._-]+$/
// Clerk publishable keys are `pk_(test|live)_` + base64url of the FAPI domain.
const ANY_PK = /pk_(?:test|live)_[A-Za-z0-9+/=_-]{8,}/g

const short = (k) => `${k.slice(0, 20)}…`

export function assessKey(expected, allowTest) {
  if (!expected) {
    return {
      ok: false,
      reason:
        'no VITE_CLERK_PUBLISHABLE_KEY configured (.env.local / .env.production.local / shell env)',
    }
  }
  if (!PK_RE.test(expected)) {
    return { ok: false, reason: 'not a publishable key (placeholder or malformed)' }
  }
  if (expected.startsWith('pk_test_') && allowTest !== '1') {
    return {
      ok: false,
      reason:
        'a pk_test_ (development instance) key refuses to deploy; set ALLOW_TEST_CLERK_KEY=1 to deploy a test instance on purpose',
    }
  }
  return { ok: true, reason: '' }
}

/** Both directions over already-read file contents; empty result means pass. */
export function assessBundle(texts, expected) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('no bundle files were read — a run that measures nothing must not pass')
  }
  const haystack = texts.join('\n')
  const bad = []
  if (!haystack.includes(expected)) bad.push('bundle lacks the configured key')
  const others = new Set((haystack.match(ANY_PK) ?? []).filter((k) => k !== expected))
  for (const k of others) bad.push(`bundle carries another pk_ key: ${short(k)}`)
  return bad
}

/** Returns the exit code; never calls process.exit. */
export function run({ env = process.env, root = process.cwd(), dir = 'dist/client/assets' } = {}) {
  // Read the bundle first: with nothing built, "measured nothing" (2) is the answer, whatever the key.
  const abs = path.resolve(root, dir)
  let texts
  try {
    texts = readdirSync(abs, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => readFileSync(path.join(abs, e.name), 'utf8'))
  } catch (err) {
    console.error(`ABORT: could not read the bundle at ${dir} (${err.code ?? err.message}) — build first.`)
    return 2
  }
  if (texts.length === 0) {
    console.error(`ABORT: ${dir} holds no files — build first.`)
    return 2
  }

  const expected = loadEnv('production', root, 'VITE_').VITE_CLERK_PUBLISHABLE_KEY ?? ''
  const key = assessKey(expected, env.ALLOW_TEST_CLERK_KEY)
  if (!key.ok) {
    console.error(`ABORT: ${key.reason}`)
    return 1
  }

  const bad = assessBundle(texts, expected)
  if (bad.length > 0) {
    console.error(`ABORT: wrong Clerk publishable key in the bundle (expected ${short(expected)})`)
    for (const row of bad) console.error(`  · ${row}`)
    return 1
  }

  console.log(`LIVE KEY OK: ${short(expected)} | ${texts.length} bundle files`)
  return 0
}

// CLI entry only — importing this module runs nothing.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run())
}
