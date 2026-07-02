/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { Hono, type ContextVariableMap } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireAuth } from '../middleware/require-auth'
import { users } from './users'

/**
 * `/api/users` read-only endpoint (UI-04 / D-04) — the endpoint coverage the
 * Wave-0 validation gap list calls for. This is the workers-pool integration
 * test that proves the three contracts of the router: the auth gate, the D-04b
 * Row mapping, and the Clerk-failure envelope.
 *
 * Harness (mirrors items.test.ts, RESEARCH Pitfall 1 + A2 FALLBACK): a `SELF.fetch`
 * mock can't reach the real deployed isolate, so instead we mount the SAME real
 * `users` router behind the SAME real `requireAuth`, in-pool, and SEED the request
 * context. The Users handler additionally reads the backend Clerk client off the
 * context (`c.get('clerk')`), so — unlike items — each harness also seeds a FAKE
 * `clerk` client whose `users.getUserList` returns a controlled fixture (or throws).
 * `app.request(input, init, env)` runs everything in-pool with the real
 * `cloudflare:test` bindings and real Hono routing precedence.
 */

const BASE = 'http://localhost'

// One representative Clerk `User` fixture that exercises the D-04b mapping:
//  - primaryEmailAddressId points at a matching emailAddresses entry (email resolves)
//  - username is null -> falls back to the email local-part
//  - publicMetadata.role is absent -> role defaults to 'cashier' (no faker)
//  - lastSignInAt is set + not banned/locked -> status 'active'
const CLERK_USER_FIXTURE = {
  id: 'user_2abc',
  username: null,
  firstName: 'Ada',
  lastName: 'Lovelace',
  primaryEmailAddressId: 'idn_email_1',
  emailAddresses: [{ id: 'idn_email_1', emailAddress: 'ada@example.com' }],
  primaryPhoneNumberId: null,
  phoneNumbers: [],
  banned: false,
  locked: false,
  lastSignInAt: 1_700_000_000_000,
  publicMetadata: {},
  createdAt: 1_699_000_000_000,
  updatedAt: 1_699_500_000_000,
}

// Build a fake ClerkClient exposing only the `users.getUserList` seam the handler
// touches, cast to the context's `clerk` variable type (the module augmentation
// from @hono/clerk-auth types it as ClerkClient).
function fakeClerk(
  getUserList: () => Promise<{ data: unknown[]; totalCount: number }>
): ContextVariableMap['clerk'] {
  return { users: { getUserList } } as unknown as ContextVariableMap['clerk']
}

// Authenticated harness with a controllable fake Clerk client. `signedIn=false`
// omits the clerkAuth seed so the real requireAuth gate rejects with a 401.
function makeApp(opts: {
  signedIn?: boolean
  getUserList: () => Promise<{ data: unknown[]; totalCount: number }>
}) {
  const app = new Hono<{ Bindings: Env }>()
  app.use('/api/*', async (c, next) => {
    // Mirror what clerkMiddleware() installs: a signed-IN caller has a userId; a
    // signed-OUT caller still has a clerkAuth fn, but it resolves to userId:null
    // (that's the state requireAuth turns into the normalized 401 — not a missing
    // clerkAuth, which would instead throw as a 500).
    const userId = (opts.signedIn ?? true) ? 'user_test' : null
    c.set('clerkAuth', () => ({ userId }) as never)
    c.set('clerk', fakeClerk(opts.getUserList))
    await next()
  })
  app.use('/api/*', requireAuth)
  app.route('/api/users', users)
  app.all('/api/*', (c) => c.json({ error: 'Not Found', path: c.req.path }, 404))
  return {
    fetch: (input: string, init?: RequestInit) => app.request(input, init, env),
  }
}

describe('/api/users read-only endpoint (UI-04, D-04)', () => {
  it('authenticated GET returns 200 { users } with the mapped Row shape (D-04b)', async () => {
    const api = makeApp({
      getUserList: async () => ({ data: [CLERK_USER_FIXTURE], totalCount: 1 }),
    })
    const res = await api.fetch(`${BASE}/api/users`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      users: Array<{
        id: string
        email: string
        role: string
        status: string
        username: string
        firstName: string
        lastName: string
      }>
    }
    expect(Array.isArray(body.users)).toBe(true)
    expect(body.users.length).toBe(1)
    const row = body.users[0]
    expect(typeof row.id).toBe('string')
    expect(row.id).toBe('user_2abc')
    // email resolved via primaryEmailAddressId
    expect(row.email).toBe('ada@example.com')
    expect(row.email.length).toBeGreaterThan(0)
    // role defaults to 'cashier' when publicMetadata.role is absent (never faker)
    expect(row.role).toBe('cashier')
    // status 'active' — signed in at least once, not banned/locked
    expect(row.status).toBe('active')
    // username falls back to the email local-part when Clerk username is null
    expect(row.username).toBe('ada')
  })

  it('does NOT leak Clerk internals — the Row has only the minimal fields (T-13-02)', async () => {
    const api = makeApp({
      getUserList: async () => ({
        data: [{ ...CLERK_USER_FIXTURE, privateMetadata: { ssn: 'secret' } }],
        totalCount: 1,
      }),
    })
    const res = await api.fetch(`${BASE}/api/users`)
    const body = (await res.json()) as { users: Array<Record<string, unknown>> }
    const row = body.users[0]
    expect(row).not.toHaveProperty('privateMetadata')
    expect(row).not.toHaveProperty('emailAddresses')
    expect(row).not.toHaveProperty('phoneNumbers')
    expect(Object.keys(row).sort()).toEqual([
      'createdAt',
      'email',
      'firstName',
      'id',
      'lastName',
      'phoneNumber',
      'role',
      'status',
      'updatedAt',
      'username',
    ])
  })

  it('unauthenticated GET returns 401 { error } behind the real gate (T-13-01)', async () => {
    const api = makeApp({
      signedIn: false,
      getUserList: async () => ({ data: [CLERK_USER_FIXTURE], totalCount: 1 }),
    })
    const res = await api.fetch(`${BASE}/api/users`)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string }
    expect(typeof body.error).toBe('string')
  })

  it('Clerk backend throw returns 502 { error, path } with no internals (T-13-03)', async () => {
    const api = makeApp({
      getUserList: async () => {
        throw new Error('clerk boom: secret-key rejected')
      },
    })
    const res = await api.fetch(`${BASE}/api/users`)
    expect(res.status).toBe(502)
    const body = (await res.json()) as Record<string, unknown>
    expect(typeof body.error).toBe('string')
    expect(body.path).toBe('/api/users')
    // The raw Clerk error message must not be echoed to the client body.
    expect(JSON.stringify(body)).not.toContain('boom')
    expect(JSON.stringify(body)).not.toContain('secret-key')
  })
})
