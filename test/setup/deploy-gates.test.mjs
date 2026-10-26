// deploy-gates.test.mjs — CF-03 (D-04, D-05): the gated `pnpm run deploy` chain.
// Hermetic: the migrations gate gets a stub `npx` on PATH; nothing here touches Cloudflare and
// nothing here runs `pnpm run deploy` or `wrangler deploy`.
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { rmSync, mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Each case spawns node/bash; budget generously like ci-gates.test.mjs.
vi.setConfig({ testTimeout: 60_000 })

const templateRoot = fileURLToPath(new URL('../../', import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(templateRoot, 'package.json'), 'utf8'))

const sandboxes = []

function makeTmpDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-gates-'))
  sandboxes.push(dir)
  return dir
}

afterEach(() => {
  while (sandboxes.length) rmSync(sandboxes.pop(), { recursive: true, force: true })
})

describe('assert-run-deploy guard', () => {
  function runGuard(event) {
    const env = { ...process.env }
    // vitest runs under `pnpm test`, so the parent env carries npm_lifecycle_event=test.
    delete env.npm_lifecycle_event
    if (event !== undefined) env.npm_lifecycle_event = event
    return spawnSync('node', ['scripts/assert-run-deploy.mjs'], {
      cwd: templateRoot,
      env,
      encoding: 'utf8',
    })
  }

  it('exits 1 and names pnpm run deploy outside the deploy lifecycle', () => {
    const r = runGuard(undefined)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('pnpm run deploy')
  })

  it('exits 0 inside the deploy lifecycle', () => {
    const r = runGuard('deploy')
    expect(r.status).toBe(0)
  })
})

describe('assert-migrations-applied gate (stubbed npx)', () => {
  function runGate(stdoutText, code) {
    const bin = makeTmpDir()
    const log = path.join(bin, 'npx.log')
    const out = path.join(bin, 'npx.out')
    writeFileSync(out, stdoutText)
    writeFileSync(
      path.join(bin, 'npx'),
      `#!/bin/sh\nprintf '%s\\n' "$*" > '${log}'\ncat '${out}'\nexit ${code}\n`,
      { mode: 0o755 }
    )
    const r = spawnSync('bash', ['scripts/assert-migrations-applied.sh', 'DB'], {
      cwd: templateRoot,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
      encoding: 'utf8',
    })
    let args = ''
    try {
      args = readFileSync(log, 'utf8').trim()
    } catch {
      // the stub was never called
    }
    return { ...r, args }
  }

  it('aborts on pending migrations and names pnpm db:migrate:remote', () => {
    const r = runGate('Migrations to be applied:\n0007_x.sql\n', 0)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('pnpm db:migrate:remote')
  })

  it('passes on the positive marker and asks wrangler for the remote list', () => {
    const r = runGate('✅ No migrations to apply!\n', 0)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('MIGRATIONS OK')
    expect(r.args).toBe('wrangler d1 migrations list DB --remote')
  })

  it('aborts on unrecognised output even when wrangler exits 0', () => {
    const r = runGate('something else entirely\n', 0)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('ABORT')
  })

  it('aborts when the remote cannot be read', () => {
    const r = runGate('Authentication error\n', 1)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('could not read')
  })
})

describe('deploy chain order', () => {
  // Never hardcode the D1 binding: in a fork setup.mjs has replaced __D1_BINDING__.
  const links = pkg.scripts.deploy.split(' && ')
  const at = (needle) => links.findIndex((l) => l.startsWith(needle))

  it('enters through the guard and ends with deploy-verify', () => {
    expect(links[0]).toBe('node scripts/assert-run-deploy.mjs')
    expect(links.at(-1)).toBe('node scripts/deploy-verify.mjs')
  })

  it('runs every gate before wrangler deploy', () => {
    const mig = at('bash scripts/assert-migrations-applied.sh ')
    const gate = at('pnpm run gate')
    const build = at('pnpm build')
    const wd = at('wrangler deploy')
    expect(mig).toBeGreaterThan(0)
    expect(mig).toBeLessThan(gate)
    expect(gate).toBeLessThan(build)
    expect(build).toBeLessThan(wd)
  })

  it('checks the live key between build and wrangler deploy', () => {
    const build = at('pnpm build')
    const key = at('node scripts/assert-live-key.mjs')
    const wd = at('wrangler deploy')
    expect(build).toBeLessThan(key)
    expect(key).toBeLessThan(wd)
  })

  it('gate is the whole-tree quality gate', () => {
    for (const step of [
      'pnpm typecheck',
      'pnpm lint',
      'pnpm format:check',
      'bash scripts/secret-grep.sh',
      'pnpm test',
    ]) {
      expect(pkg.scripts.gate).toContain(step)
    }
  })
})

const PK_TEST = 'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk'
const PK_LIVE = 'pk_live_Y2xlcmsuZXhhbXBsZS5jb20k'

describe('assert-live-key gate', () => {
  let lk
  beforeAll(async () => {
    lk = await import('../../scripts/assert-live-key.mjs')
  })

  describe('assessKey', () => {
    it('refuses an empty key', () => {
      expect(lk.assessKey('', undefined).ok).toBe(false)
    })
    it('refuses the placeholder', () => {
      expect(lk.assessKey('REPLACE_WITH_YOUR_CLERK_PK', undefined).ok).toBe(false)
    })
    it('refuses a malformed key', () => {
      expect(lk.assessKey('pk_test_abc"x', undefined).ok).toBe(false)
    })
    it('refuses pk_test_ without ALLOW_TEST_CLERK_KEY=1', () => {
      for (const allow of [undefined, 'true']) {
        const r = lk.assessKey(PK_TEST, allow)
        expect(r.ok).toBe(false)
        expect(r.reason).toContain('ALLOW_TEST_CLERK_KEY=1')
      }
    })
    it('passes pk_test_ with ALLOW_TEST_CLERK_KEY=1', () => {
      expect(lk.assessKey(PK_TEST, '1').ok).toBe(true)
    })
    it('passes a pk_live_ key', () => {
      expect(lk.assessKey(PK_LIVE, undefined).ok).toBe(true)
    })
  })

  describe('assessBundle', () => {
    it('throws when nothing was read', () => {
      expect(() => lk.assessBundle([], PK_LIVE)).toThrow()
    })
    it('fails a bundle without the key', () => {
      expect(lk.assessBundle(['const a = 1'], PK_LIVE)).toHaveLength(1)
    })
    it('fails a bundle carrying another pk_ key, truncated', () => {
      const other = 'pk_test_b3RoZXIuY2xlcmsuYWNjb3VudHMuZGV2JA'
      const bad = lk.assessBundle([`a="${PK_LIVE}"`, `b="${other}"`], PK_LIVE)
      expect(bad).toHaveLength(1)
      expect(bad[0]).toContain(`${other.slice(0, 20)}…`)
      expect(bad[0]).not.toContain(other)
    })
    it('passes a bundle carrying only the key', () => {
      expect(lk.assessBundle([`"${PK_LIVE}"`, `"${PK_LIVE}"`, `"${PK_LIVE}"`], PK_LIVE)).toEqual([])
    })
  })

  describe('run', () => {
    let saved
    beforeEach(() => {
      // vite's loadEnv lets process.env override the env files.
      saved = process.env.VITE_CLERK_PUBLISHABLE_KEY
      delete process.env.VITE_CLERK_PUBLISHABLE_KEY
    })
    afterEach(() => {
      if (saved === undefined) delete process.env.VITE_CLERK_PUBLISHABLE_KEY
      else process.env.VITE_CLERK_PUBLISHABLE_KEY = saved
    })

    function makeRoot(key, { bundle = true } = {}) {
      const root = makeTmpDir()
      writeFileSync(path.join(root, '.env.local'), `VITE_CLERK_PUBLISHABLE_KEY=${key}\n`)
      if (bundle) {
        mkdirSync(path.join(root, 'dist/client/assets'), { recursive: true })
        writeFileSync(path.join(root, 'dist/client/assets/a.js'), `const k="${key}"`)
      }
      return root
    }

    it('returns 0 for a live key present in the bundle', () => {
      expect(lk.run({ env: {}, root: makeRoot(PK_LIVE) })).toBe(0)
    })
    it('returns 2 when the assets dir is missing', () => {
      expect(lk.run({ env: {}, root: makeRoot(PK_LIVE, { bundle: false }) })).toBe(2)
    })
    it('returns 1 for a pk_test_ key without ALLOW_TEST_CLERK_KEY', () => {
      expect(lk.run({ env: {}, root: makeRoot(PK_TEST) })).toBe(1)
    })
    it("returns 0 for a pk_test_ key with ALLOW_TEST_CLERK_KEY='1'", () => {
      expect(lk.run({ env: { ALLOW_TEST_CLERK_KEY: '1' }, root: makeRoot(PK_TEST) })).toBe(0)
    })
  })
})
