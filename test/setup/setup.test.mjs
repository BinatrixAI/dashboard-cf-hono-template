// Node-environment Vitest suite for the build-time `setup.mjs` parameterization CLI.
//
// WHY node, not workerd: setup.mjs uses node:fs / node:readline/promises /
// node:child_process / global fetch and rewrites tracked config on disk. None of that
// runs (or behaves identically) inside @cloudflare/vitest-pool-workers, so this suite
// is registered as the 'setup' project (environment: 'node') in vitest.config.ts,
// separate from the workers-pool API suite.
//
// SAFETY: every end-to-end case copies the template tree into an os.tmpdir() sandbox via
// fs.cpSync and ONLY ever runs `node setup.mjs` against that copy. A live run against the
// real repo root would rename the template itself and write .setup-complete — so the
// subprocess `cwd` is ALWAYS the tmpdir, never templateRoot.
import { describe, it, expect, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  rmSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  deriveNames,
  scanForSentinels,
  SUBSTITUTION_FILESET,
  HARD_FAIL_RE,
  isValidCustomDomain,
  computeSlugRewrites,
  substitute,
} from '../../setup.mjs'

const templateRoot = fileURLToPath(new URL('../../', import.meta.url))

// Top-level dirs never copied into the sandbox (huge / irrelevant / would recurse state).
const EXCLUDE_TOP = new Set(['node_modules', '.git', '.planning', 'dist', '.wrangler', 'docs'])

const PK = 'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk'
const FLAGS = [
  '--yes',
  '--name=acme-dash',
  '--app-name=Acme Dash',
  `--clerk-pk=${PK}`,
  '--d1-name=acme-db',
  '--kv-title=acme-cache',
]

const sandboxes = []

function makeTmpCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), 'setup-test-'))
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

function runSetup(dir, args) {
  // stdin: 'ignore' => process.stdin.isTTY is undefined (non-TTY headless path).
  return spawnSync('node', ['setup.mjs', ...args], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 30000,
  })
}

const read = (dir, rel) => readFileSync(path.join(dir, rel), 'utf8')

afterEach(() => {
  while (sandboxes.length) {
    const dir = sandboxes.pop()
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('deriveNames (pure)', () => {
  it('derives a kebab worker slug + pkg name and keeps the display name', () => {
    expect(deriveNames('Acme Dash')).toEqual({
      workerSlug: 'acme-dash',
      pkgName: 'acme-dash',
      appName: 'Acme Dash',
    })
  })

  it('collapses non-alphanumeric runs to a single hyphen and trims edges', () => {
    expect(deriveNames('  Foo!!  Bar  ').workerSlug).toBe('foo-bar')
  })
})

describe('scanForSentinels (pure)', () => {
  it('hard-fails on identifier sentinels but treats REPLACE_WITH_YOUR_* as non-blocking', () => {
    const dir = makeTmpCopy()
    mkdirSync(path.join(dir, 'scanfix'), { recursive: true })
    writeFileSync(path.join(dir, 'scanfix', 'hard.txt'), 'value = "__FOO__"\n')
    writeFileSync(path.join(dir, 'scanfix', 'soft.txt'), 'id = "REPLACE_WITH_YOUR_THING"\n')

    const hard = scanForSentinels(dir, ['scanfix/hard.txt'])
    expect(hard.hardFails.length).toBeGreaterThan(0)
    expect(hard.hardFails[0]).toContain('scanfix/hard.txt')

    const soft = scanForSentinels(dir, ['scanfix/soft.txt'])
    expect(soft.hardFails).toEqual([])
    expect(soft.outstanding.length).toBeGreaterThan(0)
  })

  it('ignores sentinels living in // comment tails', () => {
    const dir = makeTmpCopy()
    mkdirSync(path.join(dir, 'scanfix'), { recursive: true })
    writeFileSync(path.join(dir, 'scanfix', 'cmt.txt'), 'const ok = 1 // __STILL_A_SENTINEL__\n')
    expect(scanForSentinels(dir, ['scanfix/cmt.txt']).hardFails).toEqual([])
  })

  it('still catches a sentinel AFTER a :// URL (does not treat :// as a comment, WR-01)', () => {
    const dir = makeTmpCopy()
    mkdirSync(path.join(dir, 'scanfix'), { recursive: true })
    // The `://` in the URL must NOT be mistaken for a comment delimiter — the trailing
    // un-substituted sentinel has to hard-fail the scan.
    writeFileSync(
      path.join(dir, 'scanfix', 'url.html'),
      '<a href="https://example.com/__APP_NAME__">link</a>\n',
    )
    const res = scanForSentinels(dir, ['scanfix/url.html'])
    expect(res.hardFails.length).toBeGreaterThan(0)
    expect(res.hardFails[0]).toContain('scanfix/url.html')
  })
})

describe('isValidCustomDomain (D-09)', () => {
  it('accepts multi-label FQDNs', () => {
    expect(isValidCustomDomain('app.example.com')).toBe(true)
    expect(isValidCustomDomain('sub.app.example.co.uk')).toBe(true)
  })

  it('rejects scheme, path, and wildcard forms', () => {
    expect(isValidCustomDomain('https://app.example.com')).toBe(false)
    expect(isValidCustomDomain('app.example.com/path')).toBe(false)
    expect(isValidCustomDomain('*.example.com')).toBe(false)
  })

  it('rejects a single bare label (requires ≥1 dot)', () => {
    expect(isValidCustomDomain('app')).toBe(false)
  })

  it('rejects injection chars (quote / whitespace / newline)', () => {
    expect(isValidCustomDomain('a"b.com')).toBe(false)
    expect(isValidCustomDomain('a b.com')).toBe(false)
    expect(isValidCustomDomain('app.example.com\nEVIL')).toBe(false)
  })

  it('rejects a leading hyphen, empty string, and non-strings', () => {
    expect(isValidCustomDomain('-app.example.com')).toBe(false)
    expect(isValidCustomDomain('')).toBe(false)
    expect(isValidCustomDomain(null)).toBe(false)
    expect(isValidCustomDomain(undefined)).toBe(false)
  })
})

describe('computeSlugRewrites (D-11)', () => {
  it('emits a rewrite where slugify(raw) differs from raw', () => {
    expect(
      computeSlugRewrites({ 'worker slug': 'test_dashboard', 'd1 name': null, 'kv title': null }),
    ).toEqual([{ label: 'worker slug', from: 'test_dashboard', to: 'test-dashboard' }])
  })

  it('returns [] when every value is already a clean slug', () => {
    expect(
      computeSlugRewrites({ 'worker slug': 'acme-dash', 'd1 name': 'acme-db', 'kv title': 'acme-cache' }),
    ).toEqual([])
  })

  it('skips null/undefined entries (default-sourced fields do not echo)', () => {
    expect(
      computeSlugRewrites({ 'worker slug': undefined, 'd1 name': null, 'kv title': 'Cache Store' }),
    ).toEqual([{ label: 'kv title', from: 'Cache Store', to: 'cache-store' }])
  })
})

describe('setup.mjs end-to-end substitution', () => {
  it('replaces every identifier sentinel across the substitution file-set', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, FLAGS)
    expect(r.status, r.stderr).toBe(0)

    // No identifier sentinel survives anywhere in the scoped set.
    expect(scanForSentinels(dir).hardFails).toEqual([])

    // 100% token sampling: each token asserted present-before (in template) / absent-after.
    for (const f of SUBSTITUTION_FILESET) {
      const after = read(dir, f)
      // wrangler.jsonc keeps its // comment-tail sentinels by design; the scan exempts
      // those, so check the code-bearing (non //-comment) part only here.
      const codeOnly = after
        .split('\n')
        .map((l) => l.split('//')[0])
        .join('\n')
      expect(HARD_FAIL_RE.test(codeOnly), `leftover identifier sentinel in ${f}`).toBe(false)
    }
  })

  it('disambiguates the two wrangler.jsonc positions and fills the Clerk pub key', () => {
    const dir = makeTmpCopy()
    expect(runSetup(dir, FLAGS).status).toBe(0)
    const wj = read(dir, 'wrangler.jsonc')

    expect(wj).toMatch(/"binding":\s*"DB"/)
    expect(wj).toMatch(/"database_name":\s*"acme-db"/)
    expect(wj).toMatch(/"binding":\s*"CACHE"/)
    expect(wj).toMatch(/"name":\s*"acme-dash"/)
    expect(wj).toMatch(new RegExp(`"CLERK_PUBLISHABLE_KEY":\\s*"${PK}"`))

    // database_name and binding were NOT collapsed to a single value.
    expect(wj).not.toMatch(/"database_name":\s*"DB"/)
    // worker-name explanatory comment lines stay intact (Open Question 3).
    expect(wj).toContain('carve-out')
  })

  it('leaves the REPLACE_WITH_YOUR_* resource-ID placeholders intact', () => {
    const dir = makeTmpCopy()
    expect(runSetup(dir, FLAGS).status).toBe(0)
    const wj = read(dir, 'wrangler.jsonc')
    expect(wj).toContain('REPLACE_WITH_YOUR_D1_ID')
    expect(wj).toContain('REPLACE_WITH_YOUR_KV_ID')
  })

  it('rewrites the unambiguous binding tokens to the code identifiers DB / CACHE', () => {
    const dir = makeTmpCopy()
    expect(runSetup(dir, FLAGS).status).toBe(0)

    expect(read(dir, 'package.json')).toContain('"name": "acme-dash"')
    expect(read(dir, 'package.json')).toContain('wrangler d1 migrations apply DB --local')
    expect(read(dir, 'index.html')).toContain('<title>Acme Dash</title>')
    expect(read(dir, 'src/client/components/layout/data/sidebar-data.ts')).toContain(
      "name: 'Acme Dash'",
    )
    expect(read(dir, 'src/server/routes/items.ts')).toContain('c.env.DB')
    expect(read(dir, 'src/server/routes/settings.ts')).toContain('c.env.CACHE')
    expect(read(dir, 'worker-configuration.d.ts')).toContain('DB: D1Database;')
    expect(read(dir, 'worker-configuration.d.ts')).toContain('CACHE: KVNamespace;')
  })

  it('context-escapes an appName with an apostrophe / markup chars into valid TS + HTML (WR-04)', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, [
      '--yes',
      '--name=acme-dash',
      "--app-name=Bob's <Dashboard>",
      `--clerk-pk=${PK}`,
      '--d1-name=acme-db',
      '--kv-title=acme-cache',
    ])
    expect(r.status, r.stderr).toBe(0)

    // sidebar-data.ts: single-quoted TS string — the apostrophe is backslash-escaped, the
    // literal is NOT terminated early, and the raw markup characters survive (JS context).
    const sidebar = read(dir, 'src/client/components/layout/data/sidebar-data.ts')
    const escaped = "'Bob\\'s <Dashboard>'"
    expect(sidebar).toContain(`name: ${escaped}`)
    // Sanity: the emitted literal is valid JS and round-trips to the original display name.
    expect(() => Function(`return ${escaped}`)()).not.toThrow()
    expect(Function(`return ${escaped}`)()).toBe("Bob's <Dashboard>")

    // index.html: HTML-escaped in both <title> text and the content="…" attribute.
    const html = read(dir, 'index.html')
    expect(html).toContain('<title>Bob&#39;s &lt;Dashboard&gt;</title>')
    expect(html).toContain('content="Bob&#39;s &lt;Dashboard&gt;"')
    // The raw apostrophe / angle brackets never reach the markup unescaped.
    expect(html).not.toContain("<title>Bob's <Dashboard></title>")
  })

  it('preserves package.json 2-space indent + trailing newline (sentinel-only diff)', () => {
    const dir = makeTmpCopy()
    expect(runSetup(dir, FLAGS).status).toBe(0)
    const pkg = read(dir, 'package.json')
    expect(pkg.endsWith('}\n')).toBe(true)
    expect(pkg).toContain('\n  "name": "acme-dash",')
  })
})

describe('setup.mjs idempotency guard (.setup-complete)', () => {
  it('refuses a second run without --force and allows it with --force', () => {
    const dir = makeTmpCopy()
    expect(runSetup(dir, FLAGS).status).toBe(0)
    expect(existsSync(path.join(dir, '.setup-complete'))).toBe(true)

    const second = runSetup(dir, FLAGS)
    expect(second.status).not.toBe(0)

    const forced = runSetup(dir, [...FLAGS, '--force'])
    expect(forced.status).toBe(0)
  })

  it('writes .setup-complete and does NOT self-delete setup.mjs (D-11)', () => {
    const dir = makeTmpCopy()
    expect(runSetup(dir, FLAGS).status).toBe(0)
    expect(existsSync(path.join(dir, '.setup-complete'))).toBe(true)
    expect(existsSync(path.join(dir, 'setup.mjs'))).toBe(true)
  })
})

describe('setup.mjs blocking leftover-sentinel scan', () => {
  it('exits non-zero and reports file:line when a stray identifier sentinel remains', () => {
    const dir = makeTmpCopy()
    // Inject a stray sentinel into a NON-comment position of a scoped file.
    const idx = read(dir, 'index.html').replace('<div id="root"></div>', '<div id="root">__FOO__</div>')
    writeFileSync(path.join(dir, 'index.html'), idx)

    const r = runSetup(dir, FLAGS)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('index.html')
  })

  it('on the normal post-substitution state (only REPLACE_WITH_YOUR_*), exits zero', () => {
    const dir = makeTmpCopy()
    expect(runSetup(dir, FLAGS).status).toBe(0)
  })
})

describe('setup.mjs .dev.vars generation (SETUP-02)', () => {
  it('fills the publishable key into BOTH publishable assignments and leaves the secret empty', () => {
    const dir = makeTmpCopy()
    // Start from a clean slate so this asserts a fresh generation, not a re-fill.
    rmSync(path.join(dir, '.dev.vars'), { force: true })

    expect(runSetup(dir, FLAGS).status).toBe(0)

    const dv = read(dir, '.dev.vars')
    expect(dv).toMatch(new RegExp(`^VITE_CLERK_PUBLISHABLE_KEY=${PK}$`, 'm'))
    expect(dv).toMatch(new RegExp(`^CLERK_PUBLISHABLE_KEY=${PK}$`, 'm'))
    // The secret stays empty — never written by setup (D-06, T-05-01).
    expect(dv).toMatch(/^CLERK_SECRET_KEY=$/m)
    // No sk_-prefixed secret value ever lands in the generated file.
    expect(dv).not.toMatch(/sk_(test|live)_/)
  })

  it('generateDevVars() (unit) fills both pub keys, keeps secret empty', async () => {
    const dir = makeTmpCopy()
    rmSync(path.join(dir, '.dev.vars'), { force: true })

    const { generateDevVars } = await import('../../setup.mjs')
    generateDevVars(dir, { clerkPk: PK })

    const dv = read(dir, '.dev.vars')
    expect(dv).toMatch(new RegExp(`^VITE_CLERK_PUBLISHABLE_KEY=${PK}$`, 'm'))
    expect(dv).toMatch(new RegExp(`^CLERK_PUBLISHABLE_KEY=${PK}$`, 'm'))
    expect(dv).toMatch(/^CLERK_SECRET_KEY=$/m)
  })

  it('rejects a publishable key with an embedded quote or newline (WR-03)', () => {
    const dir = makeTmpCopy()

    // Embedded double-quote — would close the wrangler.jsonc JSON string.
    const quoted = runSetup(dir, [
      '--yes',
      '--name=acme-dash',
      '--app-name=Acme Dash',
      '--clerk-pk=pk_test_abc"def',
      '--d1-name=acme-db',
      '--kv-title=acme-cache',
    ])
    expect(quoted.status).not.toBe(0)

    // Embedded newline — would inject an arbitrary .dev.vars env line.
    const newlined = runSetup(makeTmpCopy(), [
      '--yes',
      '--name=acme-dash',
      '--app-name=Acme Dash',
      '--clerk-pk=pk_test_abc\nEVIL=1',
      '--d1-name=acme-db',
      '--kv-title=acme-cache',
    ])
    expect(newlined.status).not.toBe(0)

    // The corruption never reached the config files.
    expect(read(dir, 'wrangler.jsonc')).not.toContain('abc"def')
  })

  it('backs an existing .dev.vars up to .dev.vars.bak and never clobbers it (D-07)', () => {
    const dir = makeTmpCopy()
    const OLD = 'VITE_CLERK_PUBLISHABLE_KEY=pk_test_PREEXISTING_DO_NOT_LOSE\nCUSTOM_LOCAL=keepme\n'
    writeFileSync(path.join(dir, '.dev.vars'), OLD)

    expect(runSetup(dir, FLAGS).status).toBe(0)

    // The prior contents survive verbatim in the backup.
    expect(read(dir, '.dev.vars.bak')).toBe(OLD)
    // The live file holds the freshly-generated values.
    expect(read(dir, '.dev.vars')).toMatch(new RegExp(`^VITE_CLERK_PUBLISHABLE_KEY=${PK}$`, 'm'))
  })
})

describe('setup.mjs .env.local generation (AUTH-04 / SETUP-02, Item 1)', () => {
  it('generateEnvLocal() writes ONLY the VITE publishable key — never a secret (T-08-01)', async () => {
    const dir = makeTmpCopy()
    // Clean slate so this asserts a fresh generation, not a re-fill.
    rmSync(path.join(dir, '.env.local'), { force: true })

    const { generateEnvLocal } = await import('../../setup.mjs')
    generateEnvLocal(dir, { clerkPk: PK })

    const el = read(dir, '.env.local')
    expect(el).toMatch(new RegExp(`^VITE_CLERK_PUBLISHABLE_KEY=${PK}$`, 'm'))
    // Only the client publishable key — no secret line, no sk_ value ever (D-02).
    expect(el).not.toMatch(/CLERK_SECRET_KEY/)
    expect(el).not.toMatch(/sk_/)
  })

  it('generateEnvLocal() with an empty key still writes the hint line (D-03)', async () => {
    const dir = makeTmpCopy()
    rmSync(path.join(dir, '.env.local'), { force: true })

    const { generateEnvLocal } = await import('../../setup.mjs')
    generateEnvLocal(dir, { clerkPk: '' })

    // Empty assignment so a forker sees the var name to fill.
    expect(read(dir, '.env.local')).toMatch(/^VITE_CLERK_PUBLISHABLE_KEY=$/m)
  })

  it('backs an existing .env.local up to .env.local.bak and never clobbers it (T-08-02)', async () => {
    const dir = makeTmpCopy()
    const OLD = 'VITE_CLERK_PUBLISHABLE_KEY=pk_test_PREEXISTING_DO_NOT_LOSE\n'
    writeFileSync(path.join(dir, '.env.local'), OLD)

    const { generateEnvLocal } = await import('../../setup.mjs')
    generateEnvLocal(dir, { clerkPk: PK })

    // The prior contents survive verbatim in the backup.
    expect(read(dir, '.env.local.bak')).toBe(OLD)
    // The live file holds the freshly-generated value.
    expect(read(dir, '.env.local')).toMatch(new RegExp(`^VITE_CLERK_PUBLISHABLE_KEY=${PK}$`, 'm'))
  })

  it('reports .env.local under --dry-run without creating it on disk', () => {
    const dir = makeTmpCopy()
    rmSync(path.join(dir, '.env.local'), { force: true })

    const r = runSetup(dir, [...FLAGS, '--dry-run'])
    expect(r.status, r.stderr).toBe(0)
    // The dry-run report names the new client-env file...
    expect(r.stdout).toMatch(/\.env\.local/)
    // ...but never touches disk.
    expect(existsSync(path.join(dir, '.env.local'))).toBe(false)
  })
})

describe('setup.mjs per-account creation checklist (SETUP-02)', () => {
  it('prints copy-pasteable wrangler commands with the chosen names interpolated', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, FLAGS)
    expect(r.status, r.stderr).toBe(0)

    expect(r.stdout).toContain('wrangler d1 create acme-db')
    expect(r.stdout).toContain('wrangler kv namespace create acme-cache')
    expect(r.stdout).toContain('wrangler secret put CLERK_SECRET_KEY')
    expect(r.stdout).toContain('pnpm cf-typegen')
    // The outstanding REPLACE_WITH_YOUR_* fill step is surfaced to the user.
    expect(r.stdout).toMatch(/REPLACE_WITH_YOUR_/)
  })

  // IN-02: a --dry-run preview must surface the outstanding REPLACE_WITH_YOUR_* placeholders
  // (the one thing a dry-run is meant to preview), matching a real run. Pre-fix the dry-run
  // branch called printChecklist(vals) with no { outstanding } and omitted this block.
  it('--dry-run surfaces the outstanding REPLACE_WITH_YOUR_* placeholders + writes nothing (IN-02)', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, [...FLAGS, '--dry-run'])
    expect(r.status, r.stderr).toBe(0)

    // The outstanding-placeholders section (only emitted when { outstanding } is non-empty) appears.
    expect(r.stdout).toContain('Outstanding REPLACE_WITH_YOUR_* placeholders')
    expect(r.stdout).toMatch(/REPLACE_WITH_YOUR_D1_ID/)
    expect(r.stdout).toMatch(/REPLACE_WITH_YOUR_KV_ID/)

    // Dry-run is read-only: no completion marker, and the template sentinels remain on disk.
    expect(existsSync(path.join(dir, '.setup-complete'))).toBe(false)
    expect(read(dir, 'wrangler.jsonc')).toContain('REPLACE_WITH_YOUR_D1_ID')
  })

  it('sanitizes a D1 name carrying shell metacharacters to a [a-z0-9-] token', () => {
    const dir = makeTmpCopy()
    // A value loaded with shell metacharacters; must never survive into a pasteable command.
    const r = runSetup(dir, [
      '--yes',
      '--name=acme-dash',
      '--app-name=Acme Dash',
      `--clerk-pk=${PK}`,
      '--d1-name=ac;me$(id)-db',
      '--kv-title=ka`whoami`che',
    ])
    expect(r.status, r.stderr).toBe(0)

    // The interpolated d1/kv names are reduced to a clean [a-z0-9-] token.
    expect(r.stdout).toContain('wrangler d1 create ac-me-id-db')
    expect(r.stdout).toContain('wrangler kv namespace create ka-whoami-che')
    // No shell metacharacter survives on the printed create lines.
    const createLines = r.stdout
      .split('\n')
      .filter((l) => /wrangler (d1|kv namespace) create/.test(l))
    expect(createLines.length).toBeGreaterThan(0)
    for (const line of createLines) {
      const token = line.split('create').pop()
      expect(token).not.toMatch(/[;$()`]/)
    }
  })

  it('writes wrangler.jsonc database_name identical to the slugified create-command name (WR-02)', () => {
    const dir = makeTmpCopy()
    // A raw D1 name that slugify alters (spaces + uppercase + punctuation). Pre-WR-02 this
    // landed verbatim in database_name while the checklist slugified it → config/resource
    // mismatch (and a quote/newline could corrupt the JSONC).
    const r = runSetup(dir, [
      '--yes',
      '--name=acme-dash',
      '--app-name=Acme Dash',
      `--clerk-pk=${PK}`,
      '--d1-name=Acme DB',
      '--kv-title=acme-cache',
    ])
    expect(r.status, r.stderr).toBe(0)

    const wj = read(dir, 'wrangler.jsonc')
    // database_name is the slugified token, NOT the raw "Acme DB".
    expect(wj).toMatch(/"database_name":\s*"acme-db"/)
    expect(wj).not.toMatch(/"database_name":\s*"Acme DB"/)
    // …and it matches the create command the checklist prints (config ⇆ resource agree).
    expect(r.stdout).toContain('wrangler d1 create acme-db')
  })
})

describe('setup.mjs module-toggle record (.setup-config.json, SETUP-03)', () => {
  const readConfig = (dir) => JSON.parse(read(dir, '.setup-config.json'))

  it('records the locked schema with BOTH toggles false after a --yes run', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, FLAGS)
    expect(r.status, r.stderr).toBe(0)

    expect(existsSync(path.join(dir, '.setup-config.json'))).toBe(true)
    // Locked Open-Question-2 schema; --yes defaults both toggles off (headless safe).
    expect(readConfig(dir)).toEqual({
      asyncLayer: false,
      integrationApi: false,
      schemaVersion: 1,
    })
  })

  it('writeModuleConfig() records asyncLayer but FORCES integrationApi false (v2 no-op)', async () => {
    const dir = makeTmpCopy()
    const { writeModuleConfig } = await import('../../setup.mjs')

    // integrationApi:true is requested but must be coerced to false (D-12 v2 stub).
    writeModuleConfig(dir, { asyncLayer: true, integrationApi: true })
    expect(readConfig(dir)).toEqual({
      asyncLayer: true,
      integrationApi: false,
      schemaVersion: 1,
    })
  })

  it('writeModuleConfig({ asyncLayer:true }) defaults integrationApi false + schemaVersion 1', async () => {
    const dir = makeTmpCopy()
    const { writeModuleConfig } = await import('../../setup.mjs')

    writeModuleConfig(dir, { asyncLayer: true })
    expect(readConfig(dir)).toEqual({
      asyncLayer: true,
      integrationApi: false,
      schemaVersion: 1,
    })
  })

  it('adds NO ACTIVE cron/queue/consumer config to wrangler.jsonc (records only — async layer is dormant/commented)', () => {
    const dir = makeTmpCopy()
    // Phase 7 (07-02) ships the async layer DORMANT: wrangler.jsonc now carries
    // COMMENTED `triggers`/`queues`/`consumers` blocks (every line behind a leading `//`),
    // so the platform never arms them. The toggle records the choice only; setup.mjs must
    // not UNCOMMENT or otherwise introduce ACTIVE async keys (D-12). Strip full-line `//`
    // comments before asserting so we test the real invariant (no armed config), not the
    // presence of the inert template comments themselves.
    const stripComments = (s) =>
      s
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line))
        .join('\n')
    const before = stripComments(read(dir, 'wrangler.jsonc'))
    expect(runSetup(dir, FLAGS).status).toBe(0)
    const after = stripComments(read(dir, 'wrangler.jsonc'))

    for (const key of ['triggers', 'crons', 'queues', 'consumers', 'producers']) {
      expect(before, `template wrangler.jsonc has ACTIVE "${key}"`).not.toContain(`"${key}"`)
      expect(after, `run added ACTIVE async key "${key}" to wrangler.jsonc`).not.toContain(`"${key}"`)
    }
  })

  it('a clean run that produces .setup-config.json still passes the blocking scan and exits zero', () => {
    const dir = makeTmpCopy()
    expect(runSetup(dir, FLAGS).status).toBe(0)
    // .setup-config.json now exists AND the run exited zero — it is in the scan EXEMPT set.
    expect(existsSync(path.join(dir, '.setup-config.json'))).toBe(true)
    // A re-run with the config already present (forced past the idempotency marker) also exits zero.
    expect(runSetup(dir, [...FLAGS, '--force']).status).toBe(0)
  })
})

describe('setup.mjs headless (non-TTY) safety', () => {
  it('completes without hanging when stdin is not a TTY', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, FLAGS)
    expect(r.signal).toBe(null) // not killed by the 30s timeout
    expect(r.status).toBe(0)
  })

  it('never writes setup state into the real repo root', () => {
    // Guard the SAFETY invariant from this file's header. Only the markers THIS plan
    // can create are asserted absent — `.dev.vars` is a pre-existing local file
    // (generated by plan 05-02) and gitignored, so it is intentionally NOT checked here.
    for (const f of ['.setup-complete', '.setup-config.json']) {
      expect(existsSync(path.join(templateRoot, f)), `${f} leaked into repo root`).toBe(false)
    }
  })
})

describe('setup.mjs --require-theme (SETUP-06)', () => {
  // A blocked-host URL fails the SSRF allow-list BEFORE any fetch (Pitfall 5) — so every
  // case here is offline-deterministic: no network is ever touched. host-not-allowed →
  // outcome 'fallback' → the loud block + (under --require-theme) a non-zero exit.
  const BLOCKED = '--theme=https://evil.example.com/x.json'

  it('exits non-zero when a --theme fallback is combined with --require-theme (D-03)', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, [...FLAGS, BLOCKED, '--require-theme'])
    expect(r.status).not.toBe(0)
  })

  it('exits 0 but prints the loud block on a --theme fallback WITHOUT --require-theme (D-02)', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, [...FLAGS, BLOCKED])
    expect(r.status).toBe(0)
    expect(r.stderr).toContain('THEME NOT APPLIED')
  })

  it('is a no-op with --require-theme but no --theme: exits 0, no theme warning (D-03)', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, [...FLAGS, '--require-theme'])
    expect(r.status).toBe(0)
    expect(r.stderr).not.toContain('THEME NOT APPLIED')
  })
})

describe('setup.mjs --custom-domain (SETUP-08)', () => {
  // Strip full-line `//` comments so we assert against code-bearing lines only (mirrors the
  // async-block test): a commented routes line must NOT count as an active "routes" key.
  const codeLines = (s) => s.split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n')

  it('--custom-domain=app.example.com writes an ACTIVE routes line + a comma after "vars" (D-07)', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, [...FLAGS, '--custom-domain=app.example.com'])
    expect(r.status, r.stderr).toBe(0)

    const wj = read(dir, 'wrangler.jsonc')
    // routes is ACTIVE (not behind a //) with the given host + custom_domain: true.
    expect(codeLines(wj)).toMatch(
      /"routes":\s*\[\{\s*"pattern":\s*"app\.example\.com"\s*,\s*"custom_domain":\s*true\s*\}\]/,
    )
    // the "vars" line now ends with a trailing comma.
    expect(wj).toMatch(/"vars":\s*\{\s*"CLERK_PUBLISHABLE_KEY":\s*"[^"\n]*"\s*\},/)
    // routes[] only — never workers_dev (D-08).
    expect(wj).not.toContain('workers_dev')
  })

  it('no --custom-domain: routes line stays commented, scan clean, workers_dev absent (D-07/D-08)', () => {
    const dir = makeTmpCopy()
    const r = runSetup(dir, FLAGS)
    expect(r.status, r.stderr).toBe(0)

    const wj = read(dir, 'wrangler.jsonc')
    // the routes placeholder appears ONLY behind a leading `//` comment.
    expect(wj).toMatch(/^\s*\/\/\s*"routes":/m)
    expect(codeLines(wj)).not.toMatch(/"routes"/)
    expect(wj).not.toContain('workers_dev')

    // the dormant placeholder is invisible to the sentinel scan (neither hard-fail nor outstanding).
    const { hardFails, outstanding } = scanForSentinels(dir)
    expect(hardFails).toEqual([])
    expect(outstanding.join('\n')).not.toContain('REPLACE_WITH_YOUR_CUSTOM_DOMAIN')
  })

  // IN-01: main() rejects an empty --custom-domain before substitute() is ever called, but
  // substitute() is exported. A direct caller passing customDomain: '' must be treated as
  // "no domain" (truthiness guard), NOT emit a meaningless active `"pattern": ""` route.
  it('substitute() treats an empty-string customDomain as "no domain" (IN-01)', () => {
    const dir = makeTmpCopy()
    const vals = { ...deriveNames('Acme Dash'), clerkPk: PK, d1Name: 'acme-db' }

    substitute(dir, vals, { customDomain: '' })
    const empty = read(dir, 'wrangler.jsonc')
    // No active routes line; the placeholder stays behind a leading `//` comment.
    expect(codeLines(empty)).not.toMatch(/"routes"/)
    expect(empty).toMatch(/^\s*\/\/\s*"routes":/m)
    // Crucially, no empty active pattern was emitted.
    expect(empty).not.toMatch(/"pattern":\s*""/)

    // Contrast: a real host DOES wire an active route (guard still passes truthy values).
    const dir2 = makeTmpCopy()
    substitute(dir2, vals, { customDomain: 'app.example.com' })
    expect(codeLines(read(dir2, 'wrangler.jsonc'))).toMatch(
      /"routes":\s*\[\{\s*"pattern":\s*"app\.example\.com"/,
    )
  })

  it('an invalid --custom-domain host exits non-zero with NO write (D-09)', () => {
    // scheme, path, wildcard, and single-label forms each on a fresh copy.
    for (const host of ['https://x.com', 'a/b.com', '*.example.com', 'app']) {
      const dir = makeTmpCopy()
      const r = runSetup(dir, [...FLAGS, `--custom-domain=${host}`])
      expect(r.status, `host "${host}" should be rejected`).not.toBe(0)
      const wj = read(dir, 'wrangler.jsonc')
      // routes line stays commented — no write happened before the exit.
      expect(codeLines(wj)).not.toMatch(/"routes"/)
      expect(wj).toMatch(/^\s*\/\/\s*"routes":/m)
    }
  })

  it('echoes a slug rewrite prominently; a clean run does not (D-11/D-12)', () => {
    // printLoudBlock emits via console.warn (stderr) — assert against the combined stream.
    const r = runSetup(makeTmpCopy(), [
      '--yes',
      '--name=test_dashboard',
      '--app-name=Test Dashboard',
      `--clerk-pk=${PK}`,
      '--d1-name=acme-db',
      '--kv-title=acme-cache',
    ])
    expect(r.status, r.stderr).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toContain('test_dashboard → test-dashboard')

    // A clean input (--name=acme-dash slugifies to itself) prints no slug-rewrite arrow.
    const clean = runSetup(makeTmpCopy(), FLAGS)
    expect(clean.status, clean.stderr).toBe(0)
    expect(`${clean.stdout}${clean.stderr}`).not.toMatch(/→/)
  })
})
