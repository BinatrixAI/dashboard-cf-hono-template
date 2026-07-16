// ci-gates.test.mjs — Nyquist gap-fill for Phase 6 CICD-04 and CICD-05.
// CICD-04: scripts/ci-sentinel-scan.mjs — exits 0 on a clean scaffold, 1 on a leftover sentinel.
// CICD-05: scripts/secret-grep.sh — exits 1 on a secret shape in tracked files, 0 on clean.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { cpSync, rmSync, mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Every test here copies the whole template to a tmpdir and spawns node several times, which
// alone runs ~6s on a laptop — over vitest's 5s default. It only passed because the suite was
// small enough to keep the parallel load low; adding tests anywhere else in the repo tipped it
// into a spurious "Test timed out in 5000ms". The work is I/O + process spawns, not setup.mjs
// (which runs in ~70ms), so budget generously rather than trimming the fixture.
vi.setConfig({ testTimeout: 60_000 })

const templateRoot = fileURLToPath(new URL('../../', import.meta.url))

const EXCLUDE_TOP = new Set(['node_modules', '.git', '.planning', 'dist', '.wrangler', 'docs'])

const PK = 'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk'
const SETUP_FLAGS = [
  '--yes',
  '--name=ci-test-proj',
  '--app-name=CI Test',
  `--clerk-pk=${PK}`,
  '--d1-name=ci-db',
  '--kv-title=ci-cache',
]

const sandboxes = []

function makeTmpCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ci-gates-test-'))
  cpSync(templateRoot, dir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(templateRoot, src)
      if (!rel) return true
      const top = rel.split(path.sep)[0]
      return !EXCLUDE_TOP.has(top)
    },
  })
  sandboxes.push(dir)
  return dir
}

function makeTmpDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ci-gates-tmp-'))
  sandboxes.push(dir)
  return dir
}

function runSetup(dir, args = SETUP_FLAGS) {
  return spawnSync('node', ['setup.mjs', ...args], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 30000,
  })
}

afterEach(() => {
  while (sandboxes.length) {
    const dir = sandboxes.pop()
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// CICD-04: ci-sentinel-scan.mjs
// ---------------------------------------------------------------------------
describe('CICD-04 — ci-sentinel-scan.mjs: sentinel gate', () => {
  const sentinelScript = path.join(templateRoot, 'scripts', 'ci-sentinel-scan.mjs')

  it('exits 0 on a clean scaffold after setup.mjs --yes', () => {
    const dir = makeTmpCopy()
    const setup = runSetup(dir)
    expect(setup.status, `setup.mjs failed: ${setup.stderr}`).toBe(0)

    const r = spawnSync('node', [sentinelScript, dir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 15000,
    })
    expect(r.status, `sentinel scan non-zero; stderr: ${r.stderr}; stdout: ${r.stdout}`).toBe(0)
    expect(r.stdout).toMatch(/Sentinel scan clean/)
    // 30s: tree copy + setup.mjs run overruns vitest's 5s default under full-suite load.
  }, 30000)

  it('exits non-zero and names package.json when a leftover __PKG_NAME__ is injected', () => {
    const dir = makeTmpCopy()
    const setup = runSetup(dir)
    expect(setup.status, `setup.mjs failed: ${setup.stderr}`).toBe(0)

    // Inject the sentinel into package.json (non-comment position).
    const pkgPath = path.join(dir, 'package.json')
    const original = readFileSync(pkgPath, 'utf8')
    writeFileSync(pkgPath, original.trimEnd() + '\n// __PKG_NAME__\n')

    const r = spawnSync('node', [sentinelScript, dir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 15000,
    })
    expect(r.status, 'expected non-zero exit on injected sentinel').not.toBe(0)
    const output = r.stdout + r.stderr
    expect(output).toMatch(/package\.json/)
    expect(output).toMatch(/__PKG_NAME__/)
    // 30s: tree copy + setup.mjs run overruns vitest's 5s default under full-suite load.
  }, 30000)
})

// ---------------------------------------------------------------------------
// CICD-06: ci-wrangler-coverage.mjs
// ---------------------------------------------------------------------------
describe('CICD-06 — ci-wrangler-coverage.mjs: wrangler.* coverage gate', () => {
  const coverageScript = path.join(templateRoot, 'scripts', 'ci-wrangler-coverage.mjs')

  function runCoverage(root) {
    return spawnSync('node', [coverageScript, root], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 15000,
    })
  }

  it('exits 0 on the current tree (./wrangler.jsonc + ./cms/wrangler.jsonc both covered)', () => {
    const r = runCoverage(templateRoot)
    expect(r.status, `expected 0; stdout: ${r.stdout}; stderr: ${r.stderr}`).toBe(0)
    expect(r.stdout).toMatch(/coverage clean/)
  })

  it('exits non-zero and names a stray wrangler.* that is not in SUBSTITUTION_FILESET', () => {
    const dir = makeTmpDir()
    mkdirSync(path.join(dir, 'some-worker'), { recursive: true })
    writeFileSync(path.join(dir, 'wrangler.jsonc'), '{}\n') // covered
    writeFileSync(path.join(dir, 'some-worker', 'wrangler.jsonc'), '{}\n') // stray

    const r = runCoverage(dir)
    expect(r.status, 'expected non-zero on stray wrangler.*').not.toBe(0)
    expect(r.stderr).toMatch(/some-worker\/wrangler\.jsonc/)
  })

  it('ignores wrangler.* under node_modules (not treated as uncovered)', () => {
    const dir = makeTmpDir()
    mkdirSync(path.join(dir, 'node_modules', 'some-dep'), { recursive: true })
    writeFileSync(path.join(dir, 'wrangler.jsonc'), '{}\n') // covered
    writeFileSync(path.join(dir, 'node_modules', 'some-dep', 'wrangler.json'), '{}\n') // ignored

    const r = runCoverage(dir)
    expect(r.status, `expected 0; stderr: ${r.stderr}`).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// CICD-05: secret-grep.sh
// ---------------------------------------------------------------------------
describe('CICD-05 — secret-grep.sh: secret gate (isolated git repo)', () => {
  const secretGrepSrc = path.join(templateRoot, 'scripts', 'secret-grep.sh')

  function buildIsolatedRepo(fixtureFiles) {
    // Build a fresh isolated git repo in tmpdir so the script's `cd $(dirname $0)/..`
    // and `git grep` operate entirely in that sandbox — never against the real repo.
    const repoDir = makeTmpDir()
    mkdirSync(path.join(repoDir, 'scripts'), { recursive: true })

    // Copy only the script itself; do NOT copy other files from the real repo.
    const scriptContent = readFileSync(secretGrepSrc, 'utf8')
    writeFileSync(path.join(repoDir, 'scripts', 'secret-grep.sh'), scriptContent, { mode: 0o755 })

    // git init
    spawnSync('git', ['init'], { cwd: repoDir, stdio: 'ignore' })
    spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir, stdio: 'ignore' })
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, stdio: 'ignore' })

    // Write fixture files and stage them.
    for (const [relPath, content] of Object.entries(fixtureFiles)) {
      const abs = path.join(repoDir, relPath)
      mkdirSync(path.dirname(abs), { recursive: true })
      writeFileSync(abs, content)
      spawnSync('git', ['add', relPath], { cwd: repoDir, stdio: 'ignore' })
    }
    // Also stage the script itself so the repo is non-empty.
    spawnSync('git', ['add', 'scripts/secret-grep.sh'], { cwd: repoDir, stdio: 'ignore' })

    return repoDir
  }

  function runSecretGrep(repoDir) {
    return spawnSync('bash', [path.join(repoDir, 'scripts', 'secret-grep.sh')], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 15000,
    })
  }

  it('exits non-zero (SECRET-GREP FAIL) when a full sk_live_ secret shape is in a tracked file', () => {
    // 24 base62 chars after the prefix — matches PATTERNS sk_(test|live)_[A-Za-z0-9]{20,}
    const secretValue = 'sk_live_' + 'A'.repeat(24)
    const repoDir = buildIsolatedRepo({
      'fixture.txt': `This file contains a secret: ${secretValue}\n`,
    })

    const r = runSecretGrep(repoDir)
    expect(r.status, `expected non-zero; stdout: ${r.stdout}; stderr: ${r.stderr}`).not.toBe(0)
    expect(r.stderr).toMatch(/SECRET-GREP FAIL/)
  })

  it('exits non-zero (SECRET-GREP FAIL) when a full re_ resend key shape is in a tracked file', () => {
    const secretValue = 're_' + 'B'.repeat(24)
    const repoDir = buildIsolatedRepo({
      'fixture.txt': `RESEND_KEY=${secretValue}\n`,
    })

    const r = runSecretGrep(repoDir)
    expect(r.status, `expected non-zero; stdout: ${r.stdout}; stderr: ${r.stderr}`).not.toBe(0)
    expect(r.stderr).toMatch(/SECRET-GREP FAIL/)
  })

  it('exits 0 (secret-grep: clean) when only a publishable pk_test_ key is present', () => {
    const repoDir = buildIsolatedRepo({
      'fixture.txt': `VITE_CLERK_PUBLISHABLE_KEY=${PK}\n`,
    })

    const r = runSecretGrep(repoDir)
    expect(r.status, `expected 0; stdout: ${r.stdout}; stderr: ${r.stderr}`).toBe(0)
    expect(r.stdout).toMatch(/secret-grep: clean/)
  })
})
