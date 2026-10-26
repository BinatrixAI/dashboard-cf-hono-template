// deploy-verify.test.mjs — CF-04 (D-06, D-07): post-deploy readback + smoke + rollback hint.
// Hermetic: a stub `npx` on PATH answers the two wrangler reads from fixture JSON, and a local
// node:http server stands in for the live Worker. Nothing here touches Cloudflare.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { rmSync, mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { assess, baseUrl, previousVersion } from '../../scripts/deploy-verify.mjs'

// Each case spawns node + a stub shell process; budget generously like ci-gates.test.mjs.
vi.setConfig({ testTimeout: 60_000 })

const templateRoot = fileURLToPath(new URL('../../', import.meta.url))
const script = path.join(templateRoot, 'scripts', 'deploy-verify.mjs')
const execFileP = promisify(execFile)

const sandboxes = []
const servers = []

afterEach(() => {
  while (servers.length) servers.pop().close()
  while (sandboxes.length) rmSync(sandboxes.pop(), { recursive: true, force: true })
})

const SNAPSHOT = {
  name: 'w',
  vars: { AUTHORIZED_PARTIES: 'https://a.example' },
  secrets: { required: ['CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'] },
}

const TWO_DEPLOYMENTS = [
  { id: 'd1', created_on: '2026-10-01T00:00:00Z', versions: [{ version_id: 'v-prev', percentage: 100 }] },
  { id: 'd2', created_on: '2026-10-02T00:00:00Z', versions: [{ version_id: 'v-cur', percentage: 100 }] },
]

const liveVersion = (bindings) => ({
  id: 'v-cur',
  number: 7,
  resources: {
    bindings,
    script_runtime: {
      compatibility_date: '2026-01-01',
      compatibility_flags: ['nodejs_compat'],
      assets: { not_found_handling: 'single-page-application', raw_run_worker_first: ['/api/*'] },
    },
  },
})

const GOOD_BINDINGS = [
  { name: 'AUTHORIZED_PARTIES', type: 'plain_text', text: 'https://a.example' },
  { name: 'CLERK_SECRET_KEY', type: 'secret_text' },
  { name: 'CLERK_PUBLISHABLE_KEY', type: 'secret_text' },
  { name: 'DB', type: 'd1', database_id: 'x', id: 'x' },
  { name: 'ASSETS', type: 'assets' },
]

function makeFixture({ snapshot = SNAPSHOT, deployments = TWO_DEPLOYMENTS, version = liveVersion(GOOD_BINDINGS) } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-verify-test-'))
  sandboxes.push(dir)
  if (snapshot) {
    mkdirSync(path.join(dir, '.wrangler', 'deploy'), { recursive: true })
    writeFileSync(
      path.join(dir, '.wrangler', 'deploy', 'config.json'),
      JSON.stringify({ configPath: '../../dist/w/wrangler.json' })
    )
    mkdirSync(path.join(dir, 'dist', 'w'), { recursive: true })
    writeFileSync(path.join(dir, 'dist', 'w', 'wrangler.json'), JSON.stringify(snapshot))
  }
  writeFileSync(path.join(dir, 'deployments.json'), JSON.stringify(deployments))
  writeFileSync(path.join(dir, 'version.json'), JSON.stringify(version))
  mkdirSync(path.join(dir, 'bin'))
  writeFileSync(
    path.join(dir, 'bin', 'npx'),
    `#!/bin/sh
echo "$*" >> '${dir}/calls.log'
case "$*" in
  *deployments*) cat '${dir}/deployments.json' ;;
  *versions*) cat '${dir}/version.json' ;;
  *) exit 99 ;;
esac
`,
    { mode: 0o755 }
  )
  return dir
}

async function startServer({ health = 200, items = 401 } = {}) {
  const state = { requests: 0 }
  const server = createServer((req, res) => {
    state.requests++
    const status = req.url === '/api/health' ? health : req.url === '/api/items' ? items : 404
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end('{}')
  })
  servers.push(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  state.base = `http://127.0.0.1:${server.address().port}`
  return state
}

// Async execFile: a sync spawn would block this process's event loop and deadlock the server.
async function runScript(dir, { args = [], env = {} } = {}) {
  const opts = {
    cwd: dir,
    env: { ...process.env, BASE_URL: '', ...env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}` },
  }
  try {
    const { stdout, stderr } = await execFileP('node', [script, ...args], opts)
    return { code: 0, out: stdout + stderr }
  } catch (err) {
    return { code: err.code, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

const callsOf = (dir) => {
  const log = path.join(dir, 'calls.log')
  return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []
}

function expectReadOnlyCalls(dir) {
  const calls = callsOf(dir)
  expect(calls.length).toBeGreaterThan(0)
  for (const call of calls) {
    expect(call).not.toMatch(/rollback/)
    expect(call).toMatch(/--name w( |$)/)
    expect(call).toMatch(/--json/)
  }
}

describe('deploy-verify.mjs end to end (stub wrangler + local server)', () => {
  it('happy path: readback matches and smoke passes → exit 0, secrets by name, no rollback line', async () => {
    const dir = makeFixture()
    const srv = await startServer()
    const { code, out } = await runScript(dir, { env: { BASE_URL: srv.base } })
    expect(code).toBe(0)
    expect(out).toContain('CLERK_SECRET_KEY')
    expect(out).toContain('CLERK_PUBLISHABLE_KEY')
    expect(out.match(/SMOKE OK/g)).toHaveLength(2)
    expect(out).not.toMatch(/wrangler rollback/)
    expectReadOnlyCalls(dir)
  })

  it('readback failure: a secret found as plain_text fails, prints the rollback command, never its text', async () => {
    const bindings = GOOD_BINDINGS.map((b) =>
      b.name === 'CLERK_PUBLISHABLE_KEY' ? { ...b, type: 'plain_text', text: 'SHOULD-NOT-PRINT' } : b
    )
    const dir = makeFixture({ version: liveVersion(bindings) })
    const srv = await startServer()
    const { code, out } = await runScript(dir, { env: { BASE_URL: srv.base } })
    expect(code).toBe(1)
    expect(out).toContain('npx wrangler rollback v-prev --name w')
    expect(out).not.toContain('SHOULD-NOT-PRINT')
    expectReadOnlyCalls(dir)
  })

  it('smoke failure: /api/items answering 200 fails with the status and the rollback command', async () => {
    const dir = makeFixture()
    const srv = await startServer({ items: 200 })
    const { code, out } = await runScript(dir, { env: { BASE_URL: srv.base } })
    expect(code).toBe(1)
    expect(out).toMatch(/SMOKE FAIL:.*\/api\/items.*200/)
    expect(out).toContain('npx wrangler rollback v-prev --name w')
    expectReadOnlyCalls(dir)
  })
})

describe('baseUrl (D-07 precedence)', () => {
  const routed = { routes: [{ pattern: 'app.example.com', custom_domain: true }] }
  const parties = (value) => ({ vars: { AUTHORIZED_PARTIES: value } })

  it('BASE_URL wins over routes and AUTHORIZED_PARTIES', () => {
    const snap = { ...routed, ...parties('https://other.example') }
    expect(baseUrl({ BASE_URL: 'https://override.example' }, snap)).toBe('https://override.example')
  })
  it('a routes pattern beats AUTHORIZED_PARTIES', () => {
    expect(baseUrl({}, { ...routed, ...parties('https://other.example') })).toBe('https://app.example.com')
  })
  it('takes the first https AUTHORIZED_PARTIES origin', () => {
    expect(baseUrl({}, parties('http://localhost:5173,https://app.example.com'))).toBe('https://app.example.com')
  })
  it('a REPLACE_WITH_YOUR_ placeholder alone resolves to null', () => {
    expect(baseUrl({}, parties('REPLACE_WITH_YOUR_ORIGIN'))).toBeNull()
    expect(baseUrl({}, parties('https://REPLACE_WITH_YOUR_ORIGIN'))).toBeNull()
  })
  it('strips trailing slashes from BASE_URL', () => {
    expect(baseUrl({ BASE_URL: 'https://a.example//' }, {})).toBe('https://a.example')
  })
})

describe('previousVersion', () => {
  it('[] → null', () => expect(previousVersion([])).toBeNull())
  it('one deployment → null', () => expect(previousVersion(TWO_DEPLOYMENTS.slice(1))).toBeNull())
  it("two deployments → the older one's version_id", () => expect(previousVersion(TWO_DEPLOYMENTS)).toBe('v-prev'))
})

describe('assess', () => {
  it("encoding: 'https://a.example ' live against expected 'https://a.example' is a FAIL", () => {
    const live = new Map([['AUTHORIZED_PARTIES', { name: 'AUTHORIZED_PARTIES', type: 'plain_text', text: 'https://a.example ' }]])
    const [row] = assess(live, { expect: [['AUTHORIZED_PARTIES', 'https://a.example']], secrets: [] })
    expect(row.verdict).toBe('FAIL')
  })
  it("a secret found as plain_text is a FAIL whose deployed column is '(name only)'", () => {
    const live = new Map([['CLERK_SECRET_KEY', { name: 'CLERK_SECRET_KEY', type: 'plain_text', text: 'sk_live_x' }]])
    const [row] = assess(live, { expect: [], secrets: ['CLERK_SECRET_KEY'] })
    expect(row).toMatchObject({ verdict: 'FAIL', deployed: '(name only)' })
    expect(JSON.stringify(row)).not.toContain('sk_live_x')
  })
})

describe('run fails closed', () => {
  it('no .wrangler/deploy/config.json → 2', async () => {
    const dir = makeFixture({ snapshot: null })
    expect((await runScript(dir)).code).toBe(2)
  })
  it('deployments [] → 2', async () => {
    const dir = makeFixture({ deployments: [] })
    expect((await runScript(dir)).code).toBe(2)
  })
  it('a current deployment with two versions (90/10 traffic split) → 2', async () => {
    const split = [
      ...TWO_DEPLOYMENTS.slice(0, 1),
      { id: 'd2', created_on: '2026-10-02T00:00:00Z', versions: [
        { version_id: 'v-a', percentage: 90 },
        { version_id: 'v-b', percentage: 10 },
      ] },
    ]
    const dir = makeFixture({ deployments: split })
    const { code, out } = await runScript(dir)
    expect(code).toBe(2)
    expect(out).toMatch(/traffic split/)
  })
  it('a snapshot with neither vars nor secrets.required → 2', async () => {
    const dir = makeFixture({ snapshot: { name: 'w' } })
    expect((await runScript(dir)).code).toBe(2)
  })
  it("first deploy (one deployment) + smoke failure → 1 with 'No previous version'", async () => {
    const dir = makeFixture({ deployments: TWO_DEPLOYMENTS.slice(1) })
    const srv = await startServer({ health: 500 })
    const { code, out } = await runScript(dir, { env: { BASE_URL: srv.base } })
    expect(code).toBe(1)
    expect(out).toContain('No previous version')
    expect(out).not.toMatch(/wrangler rollback/)
  })
  it("no BASE_URL, no routes, placeholder AUTHORIZED_PARTIES → 1 with 'set BASE_URL', zero requests", async () => {
    const placeholder = 'REPLACE_WITH_YOUR_ORIGIN'
    const bindings = GOOD_BINDINGS.map((b) => (b.name === 'AUTHORIZED_PARTIES' ? { ...b, text: placeholder } : b))
    const dir = makeFixture({
      snapshot: { ...SNAPSHOT, vars: { AUTHORIZED_PARTIES: placeholder } },
      version: liveVersion(bindings),
    })
    const srv = await startServer()
    const { code, out } = await runScript(dir)
    expect(code).toBe(1)
    expect(out).toContain('set BASE_URL')
    expect(srv.requests).toBe(0)
  })
})
