// Offline self-check for seed-admin.ts. Run: npx tsx scripts/seed-admin.test.ts
// Validates Assumption A2 (the emitted `pbkdf2:` hash round-trips against a
// verbatim mirror of core's verifyLegacyPbkdf2) plus the fail-closed guard and
// the two-table SQL shape — no wrangler / D1 needed.
import assert from 'node:assert/strict'
import { pbkdf2Hash, validateCreds, buildSeedSql } from './seed-admin.ts'

// Verbatim mirror of @sonicjs-cms/core dist verifyLegacyPbkdf2 (chunk-SOZUG52O.js).
// A mismatch here means the seeded admin cannot log in.
async function verifyLegacyPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 4) return false
  const iterations = parseInt(parts[1], 10)
  const saltBytes = parts[2].match(/.{2}/g)
  if (!saltBytes || !Number.isFinite(iterations)) return false
  const salt = new Uint8Array(saltBytes.map((b) => parseInt(b, 16)))
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, km, 256)
  const actual = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return actual === parts[3]
}

async function main() {
  // A2: hash serialization matches the shim and round-trips.
  const hash = await pbkdf2Hash('s3cret-pw!')
  assert.match(hash, /^pbkdf2:100000:[0-9a-f]+:[0-9a-f]{64}$/, 'unexpected pbkdf2 serialization')
  assert.ok(await verifyLegacyPbkdf2('s3cret-pw!', hash), 'correct password must verify')
  assert.ok(!(await verifyLegacyPbkdf2('wrong-pw', hash)), 'wrong password must not verify')

  // Fail-closed guard (D-07): returns an error message (truthy) for bad input, null for valid.
  assert.ok(validateCreds(undefined, 'x'), 'unset email must fail')
  assert.ok(validateCreds('a@b.co', undefined), 'unset password must fail')
  assert.ok(validateCreds('', 'x'), 'empty email must fail')
  assert.ok(validateCreds('a@b.co', ''), 'empty password must fail')
  assert.ok(validateCreds('REPLACE_WITH_YOUR_ADMIN_EMAIL', 'x'), 'sentinel email must fail')
  assert.ok(validateCreds("a'b@c.co", 'x'), 'single-quote email must fail')
  assert.ok(validateCreds('a@b.co', "pw'; DROP"), 'single-quote password must fail')
  assert.equal(validateCreds('admin@example.com', 'goodpw'), null, 'valid creds must pass')

  // Emitted SQL: the two better-auth rows (admin role + superadmin, credential provider)
  // AND the document-backed RBAC grant that actually unlocks /admin.
  const sql = buildSeedSql('admin@example.com', hash)
  assert.match(sql, /INSERT INTO auth_user/)
  assert.match(sql, /INSERT INTO auth_account/)
  assert.match(sql, /'admin'/)
  assert.match(sql, /'credential'/)
  assert.match(sql, /pbkdf2:/)
  // is_super_admin=1 (membership-gate bypass) + the rbac_user_roles role-admin grant.
  assert.match(sql, /is_super_admin/, 'auth_user must set is_super_admin')
  assert.match(sql, /INSERT INTO documents/, 'must emit the RBAC grant document')
  assert.match(sql, /rbac_user_roles/, 'grant doc must be type rbac_user_roles')
  assert.match(sql, /"roleIds":\["role-admin"\]/, 'grant must reference role-admin')

  // FK prerequisite: `documents.type_id` REFERENCES `document_types(id)`, and the migrations
  // seed zero document_types rows (core registers them at runtime). Without this stub the grant
  // INSERT dies with `FOREIGN KEY constraint failed` on a fresh D1 and the whole seed rolls
  // back — i.e. seeding before the first deploy, exactly as docs/cms.md prescribes, is
  // impossible. It must be OR IGNORE (deploy-first DBs already have the real row) and must be
  // emitted BEFORE the grant.
  assert.match(
    sql,
    /INSERT OR IGNORE INTO document_types[^;]*'rbac_user_roles'/,
    'must emit the rbac_user_roles document_types stub the grant FK needs',
  )
  assert.ok(
    sql.indexOf('INSERT OR IGNORE INTO document_types') < sql.indexOf('INSERT INTO documents'),
    'the document_types stub must precede the grant INSERT (FK ordering)',
  )

  console.log('seed-admin self-check: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
