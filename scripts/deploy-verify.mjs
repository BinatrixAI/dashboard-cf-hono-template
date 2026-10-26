#!/usr/bin/env node
// Post-deploy check (CF-04, D-06, D-07): read back what is ACTUALLY live, smoke-test it, and on
// any failure print the exact rollback command.
//
// WHY THE BUILD SNAPSHOT: `wrangler deploy` ships `dist/<worker>/wrangler.json`, the config the
// vite plugin wrote at build time, not `wrangler.jsonc`. So the expectations come from that
// snapshot (found via `.wrangler/deploy/config.json`): every `vars` entry must be live as
// plain_text with an exactly equal value, every `secrets.required` name must be live as
// secret_text. Secrets are reported by NAME ONLY, even when one is wrongly live as plain_text.
//
// WHY IT NEVER ROLLS BACK: a remote D1 migration may already have run, and the older code may
// not match the new schema (D-06). The developer decides; the script only prints the command.
//
// The only processes spawned are two read-only argv-array wrangler calls, never a shell string:
//   execFileSync('npx', ['wrangler', 'deployments', 'list', '--name', w, '--json'])
//   execFileSync('npx', ['wrangler', 'versions', 'view', id, '--name', w, '--json'])
//
// EXIT: 0 only when every readback row and every smoke probe passed; 1 when something was
// measured and failed (or no base URL could be resolved); 2 when nothing could be measured
// (no snapshot, unreadable wrangler read, empty deployments, traffic split, empty expectations).
// `deployments list --json` is OLDEST-FIRST: current = .at(-1), rollback target = .at(-2).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const USAGE = 'usage: [BASE_URL=https://<host>] node scripts/deploy-verify.mjs [--name <worker>]'

/** One `npx wrangler … --json` read. Argv array; the JSON is the caller's to shape. */
function wrangler(args) {
  return JSON.parse(
    execFileSync('npx', ['wrangler', ...args, '--json'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  )
}

/** The build snapshot `pnpm build` wrote: plain JSON, never the JSONC source. */
export function readSnapshot(cwd = process.cwd()) {
  const dir = path.join(cwd, '.wrangler', 'deploy')
  const redirect = path.join(dir, 'config.json')
  if (!existsSync(redirect)) {
    throw new Error('no build snapshot (.wrangler/deploy/config.json) — run pnpm build first')
  }
  const { configPath } = JSON.parse(readFileSync(redirect, 'utf8'))
  return JSON.parse(readFileSync(path.resolve(dir, configPath), 'utf8'))
}

export function previousVersion(deployments) {
  return deployments.at(-2)?.versions?.[0]?.version_id ?? null
}

/** The live version id plus the rollback target. Refuses an empty list and a traffic split. */
export function resolveVersions(name) {
  const deployments = wrangler(['deployments', 'list', '--name', name])
  if (!Array.isArray(deployments) || deployments.length === 0) {
    throw new Error(`no deployments listed for worker ${name}`)
  }
  const current = deployments.at(-1)
  const versions = current?.versions ?? []
  if (versions.length > 1) {
    throw new Error(
      `deployment carries ${versions.length} versions (traffic split): ` +
        `${versions.map((v) => v.version_id).join(', ')} — a single-version read cannot speak for it`
    )
  }
  const id = versions[0]?.version_id
  if (!id) throw new Error('current deployment carries no version_id')
  return { id, deployed: current.created_on ?? '(no created_on)', previous: previousVersion(deployments) }
}

/** One row per expectation, keyed by binding NAME; other live bindings become INFO rows. */
export function assess(bindings, { expect, secrets }) {
  const rows = []
  for (const [name, expected] of expect) {
    const found = bindings.get(name)
    // Exact string equality on raw values: no trim, case-fold or URL normalisation.
    const deployed = found?.type === 'plain_text' ? found.text : undefined
    rows.push({
      name,
      type: found?.type ?? '(absent)',
      deployed: deployed ?? '(no plain_text value)',
      expected,
      verdict: deployed === expected ? 'PASS' : 'FAIL',
    })
  }
  for (const name of secrets) {
    const found = bindings.get(name)
    rows.push({
      name,
      type: found?.type ?? '(absent)',
      deployed: '(name only)',
      expected: 'secret_text',
      verdict: found?.type === 'secret_text' ? 'PASS' : 'FAIL',
    })
  }
  const named = new Set([...expect.map(([name]) => name), ...secrets])
  for (const [name, found] of bindings) {
    if (!named.has(name)) rows.push({ name, type: found.type, deployed: '-', expected: '-', verdict: 'INFO' })
  }
  return rows
}

/** D-07 order: BASE_URL, then the custom-domain route, then the first real https origin. */
export function baseUrl(env, snapshot) {
  if (env.BASE_URL) return env.BASE_URL.replace(/\/+$/, '')
  const pattern = snapshot.routes?.[0]?.pattern
  if (pattern) return `https://${pattern.split('/')[0]}`
  const origin = String(snapshot.vars?.AUTHORIZED_PARTIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .find((s) => s.startsWith('https://') && !/REPLACE_WITH_YOUR_/.test(s))
  return origin ?? null
}

/** Public health must be 200; a protected route with no session must be 401. */
export async function smoke(base, fetchImpl = fetch) {
  const rows = []
  for (const [route, want] of [
    ['/api/health', 200],
    ['/api/items', 401],
  ]) {
    let status
    let mitigated = null
    try {
      const res = await fetchImpl(`${base}${route}`, { redirect: 'manual' })
      status = res.status
      // Bot protection answers Node fetch with 403 + cf-mitigated: challenge (RESEARCH Pitfall 9).
      mitigated = res.headers.get('cf-mitigated')
      await res.body?.cancel()
    } catch (err) {
      status = `network error: ${err.message}`
    }
    const ok = status === want
    rows.push({ route, status, want, mitigated, ok })
    process.stdout.write(
      ok
        ? `SMOKE OK:   GET ${route} -> ${status}\n`
        : `SMOKE FAIL: GET ${route} -> ${status} (expected ${want})` +
            `${mitigated ? ` cf-mitigated: ${mitigated}` : ''}\n`
    )
  }
  return rows
}

export function rollbackHint(previous, name) {
  return previous
    ? `Roll back with:  npx wrangler rollback ${previous} --name ${name}`
    : 'No previous version to roll back to (first deploy).'
}

/** Returns the exit code; it never calls process.exit itself. */
export async function run(argv, env = process.env) {
  let nameOverride = ''
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name' && argv[i + 1]) {
      nameOverride = argv[++i]
      continue
    }
    process.stderr.write(`error: unknown argument: ${argv[i]}\n${USAGE}\n`)
    return 2
  }

  let snapshot
  try {
    snapshot = readSnapshot()
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`)
    return 2
  }
  const name = nameOverride || snapshot.name
  if (!name) {
    process.stderr.write(`error: the snapshot has no worker name\n${USAGE}\n`)
    return 2
  }
  const expect = Object.entries(snapshot.vars ?? {}).map(([k, v]) => [k, String(v)])
  const secrets = snapshot.secrets?.required ?? []
  if (expect.length + secrets.length === 0) {
    process.stderr.write('error: the snapshot has no vars and no secrets.required — nothing to verify\n')
    return 2
  }

  let resolved
  let version
  try {
    resolved = resolveVersions(name)
    version = wrangler(['versions', 'view', resolved.id, '--name', name])
    if (!Array.isArray(version?.resources?.bindings)) {
      throw new Error('resources.bindings is missing or not an array')
    }
  } catch (err) {
    process.stderr.write(
      `error: could not read the live deployment: ${err.message}\n` +
        `check npx wrangler deployments list --name ${name}\n`
    )
    return 2
  }

  const rt = version.resources.script_runtime ?? {}
  process.stdout.write(
    `worker ${name} | version ${resolved.id} | number ${version.number} | deployed ${resolved.deployed}\n` +
      `compatibility ${rt.compatibility_date ?? '(unknown)'} | flags ${(rt.compatibility_flags ?? []).join(',') || '(none)'}\n` +
      `assets ${JSON.stringify(rt.assets ?? null)}\n` +
      'name | type | deployed | expected | verdict\n'
  )
  const rows = assess(new Map(version.resources.bindings.map((b) => [b.name, b])), { expect, secrets })
  for (const r of rows) {
    process.stdout.write(`${r.name} | ${r.type} | ${r.deployed} | ${r.expected} | ${r.verdict}\n`)
  }

  const base = baseUrl(env, snapshot)
  let smokeOk = false
  if (base) {
    smokeOk = (await smoke(base)).every((r) => r.ok)
  } else {
    process.stdout.write('SMOKE FAIL: no base URL to probe — set BASE_URL=https://<your host>\n')
  }

  if (smokeOk && rows.every((r) => r.verdict !== 'FAIL')) {
    process.stdout.write('DEPLOY VERIFY OK\n')
    return 0
  }
  process.stdout.write(`DEPLOY VERIFY FAILED\n${rollbackHint(resolved.previous, name)}\n`)
  return 1
}

// CLI entry only — importing this module runs nothing. exitCode (not exit) so stdout flushes.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2), process.env)
}
