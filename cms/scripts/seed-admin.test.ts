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

  // Emitted SQL: both better-auth rows, admin role, credential provider.
  const sql = buildSeedSql('admin@example.com', hash)
  assert.match(sql, /INSERT INTO auth_user/)
  assert.match(sql, /INSERT INTO auth_account/)
  assert.match(sql, /'admin'/)
  assert.match(sql, /'credential'/)
  assert.match(sql, /pbkdf2:/)

  console.log('seed-admin self-check: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
