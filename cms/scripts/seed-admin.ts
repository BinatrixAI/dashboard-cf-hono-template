// One-shot, secrets-driven, fail-closed admin bootstrap (CMS-03, D-04..D-08).
//
// Reads ADMIN_EMAIL + ADMIN_PASSWORD from the shell env, PBKDF2-hashes the
// password into the exact `pbkdf2:` serialization core's verifyLegacyPbkdf2
// parses (accepted by the beta.24 legacy->scrypt login shim, then self-upgraded
// on first login), and INSERTs one better-auth admin (auth_user + auth_account)
// via `wrangler d1 execute DB`. It REFUSES to run on unset / empty / sentinel /
// single-quote input, and carries none of upstream's hardcoded default admin.
//
//   pnpm seed                 # --local (CI / dev gate) [default]
//   pnpm seed -- --remote     # deploy target
//   pnpm seed -- --print      # emit SQL to stdout, no D1 write (offline check)
//
// Adapted from SonicJs-Org/sonicjs main/my-sonicjs-app/scripts/seed-admin.ts +
// the verified auth_user/auth_account schema (14-RESEARCH Gap 2).
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const SENTINEL_RE = /^REPLACE_WITH_YOUR_/

const REFUSE = 'Configure ADMIN_EMAIL + ADMIN_PASSWORD before seeding. Refusing to run.'

/** Fail-closed guard (D-07). Returns an error message for bad input, or null when valid. */
export function validateCreds(email: string | undefined, password: string | undefined): string | null {
  if (!email || !password) return REFUSE
  if (SENTINEL_RE.test(email) || SENTINEL_RE.test(password)) return REFUSE
  // Single-quote reject keeps the generated SQL injection-safe (T-14-08).
  if (email.includes("'") || password.includes("'")) return REFUSE
  return null
}

/** PBKDF2-SHA256 / 100k iterations -> `pbkdf2:<iterations>:<saltHex>:<hashHex>` (matches verifyLegacyPbkdf2). */
export async function pbkdf2Hash(password: string): Promise<string> {
  const iterations = 100000
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, km, 256)
  const toHex = (u: Uint8Array) =>
    Array.from(u)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  return `pbkdf2:${iterations}:${toHex(salt)}:${toHex(new Uint8Array(bits))}`
}

/**
 * Emit the admin bootstrap INSERTs. Four rows, all the seeded admin needs to actually
 * reach `/admin` on a fresh beta.24 deploy:
 *   0. document_types — a stub `rbac_user_roles` row. REQUIRED: `documents.type_id` carries a
 *                      FOREIGN KEY onto `document_types(id)`, and the shipped migrations seed
 *                      ZERO document_types rows — core registers them at RUNTIME
 *                      (bootstrapDocumentTypes(), on the first request). So on a fresh D1 the
 *                      grant INSERT below fails with `FOREIGN KEY constraint failed` and the
 *                      whole seed rolls back, making the documented seed-BEFORE-first-deploy
 *                      order impossible. Emitting the stub keeps that order working (and with
 *                      it the "no admin exists while the CMS is publicly reachable" property).
 *                      `INSERT OR IGNORE` so a deploy-first database is a silent no-op, and
 *                      core's DocumentTypeRegistry.register() is an UPSERT — it UPDATEs every
 *                      column of an existing row — so the real definition overwrites this stub
 *                      on first boot. Only the NOT-NULL columns are set; the rest default.
 *   1. auth_user     — role='admin' AND is_super_admin=1 (the latter bypasses the
 *                      multi-tenant membership gate: `enforceMembership = user &&
 *                      pluginActive && !isSuperAdmin`; without it a non-member admin 403s).
 *   2. auth_account  — provider_id='credential' with the pbkdf2 hash.
 *   3. documents     — the `rbac_user_roles` grant (slug=userId, roleIds=['role-admin']).
 *                      SonicJS authorizes via document-backed RBAC, NOT auth_user.role
 *                      (that column is only a derived projection). Without this grant the
 *                      admin has zero effective permissions → `/admin` 403 "Insufficient
 *                      permissions". `role-admin` (grants portal:access + rbac:manage) is
 *                      seeded idempotently by core's ensureSystemRbacSeed() on first /admin
 *                      access, so referencing it by slug here is order-safe.
 */
export function buildSeedSql(email: string, passwordHash: string): string {
  const q = (v: string): string => {
    // Defense in depth — callers pass validateCreds-checked / hex values only.
    if (v.includes("'")) throw new Error('single quote not allowed in seed value')
    return `'${v}'`
  }
  const now = Date.now()
  // documents.created_at/updated_at default to unixepoch() (SECONDS) — do NOT reuse the
  // millisecond `now` for the grant row or it lands ~53,000 years in the future.
  const nowSec = Math.floor(now / 1000)
  const userId = crypto.randomUUID()
  const accountId = crypto.randomUUID()
  const grantId = crypto.randomUUID()
  const firstName = email.split('@')[0] || 'Admin' // NOT-NULL columns need safe defaults
  const lastName = 'Admin'
  const name = `${firstName} ${lastName}`

  // FK prerequisite for grantSql (see the doc comment above). Core upserts over this stub.
  const typeSql =
    `INSERT OR IGNORE INTO document_types ` +
    `(id, name, display_name, source, is_system, is_auth, created_at, updated_at) VALUES ` +
    `('rbac_user_roles', 'rbac_user_roles', 'RBAC User Roles', 'system', 1, 1, ${nowSec}, ${nowSec});`

  const userSql =
    `INSERT INTO auth_user ` +
    `(id, email, email_verified, name, first_name, last_name, role, is_super_admin, is_active, created_at, updated_at) VALUES ` +
    `(${q(userId)}, ${q(email)}, 1, ${q(name)}, ${q(firstName)}, ${q(lastName)}, 'admin', 1, 1, ${now}, ${now});`

  const accountSql =
    `INSERT INTO auth_account ` +
    `(id, user_id, account_id, provider_id, password, created_at, updated_at) VALUES ` +
    `(${q(accountId)}, ${q(userId)}, ${q(userId)}, 'credential', ${q(passwordHash)}, ${now}, ${now});`

  // RBAC grant. Only id/root_id/type_id/slug/data/created_at/updated_at are set; every other
  // documents column relies on its schema default (is_current_draft=1, is_published=0,
  // status='draft', tenant_id/locale='default', parent_root_id='', visible=1, metadata='{}').
  const grantSql =
    `INSERT INTO documents ` +
    `(id, root_id, type_id, slug, data, created_at, updated_at) VALUES ` +
    `(${q(grantId)}, ${q(grantId)}, 'rbac_user_roles', ${q(userId)}, '{"roleIds":["role-admin"]}', ${nowSec}, ${nowSec});`

  return `${typeSql} ${userSql} ${accountSql} ${grantSql}`
}

function printRotateWarning(email: string): void {
  console.warn(
    `\nSeeded admin ${email} (role=admin, superadmin + role-admin RBAC grant — can reach /admin). ` +
      `ROTATE this password after the first /admin login — it was supplied in your shell env and ` +
      `the hash self-upgrades to scrypt on that login.`,
  )
}

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  const err = validateCreds(email, password)
  if (err) {
    // Fail closed BEFORE any hashing or D1 access (D-07).
    console.error(err)
    process.exit(1)
  }
  // validateCreds guarantees both are non-empty strings here.
  const hash = await pbkdf2Hash(password as string)
  const sql = buildSeedSql(email as string, hash)

  if (process.argv.includes('--print') || process.env.SEED_PRINT === '1') {
    console.log(sql)
    printRotateWarning(email as string)
    return
  }

  const target = process.argv.includes('--remote') || process.env.SEED_REMOTE === '1' ? '--remote' : '--local'
  const res = spawnSync('wrangler', ['d1', 'execute', 'DB', target, '--command', sql], { stdio: 'inherit' })
  if (res.status !== 0) {
    console.error(`wrangler d1 execute ${target} failed.`)
    process.exit(res.status ?? 1)
  }
  printRotateWarning(email as string)
}

// Run only when invoked directly (so the self-check can import the helpers offline).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
