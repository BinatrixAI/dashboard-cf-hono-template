import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireAuth } from './require-auth'

/**
 * UNIT test of the gate logic in isolation (AUTH-02, D-15).
 *
 * RESEARCH A2 confirmed on first run: `vi.mock('@hono/clerk-auth')` does NOT hoist/
 * apply inside the `@cloudflare/vitest-pool-workers` runtime (the real module ran).
 * So instead of mocking, we drive the REAL `getAuth` through its actual seam: it does
 * `c.get('clerkAuth')(options)`, so a tiny upstream middleware that `c.set('clerkAuth',
 * () => authState)` lets us inject any auth state with NO mock. This exercises the real
 * `requireAuth` + real `getAuth` together — a stronger, hermetic, in-pool-safe proof
 * (and the documented A2 fallback). The CRUD suites use the same seed seam (Task 3).
 *
 * `clerkAuth` is a function (Clerk's bound `toAuth()`); seeding it as `() => state`
 * mirrors exactly what `clerkMiddleware()` installs at runtime.
 */

type AuthState = { userId: string | null } | undefined

function harness(authState: AuthState) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('clerkAuth', () => authState)
    await next()
  })
  app.use('*', requireAuth)
  app.get('/', (c) => c.json({ ok: true }))
  return app
}

describe('requireAuth gate (AUTH-02, D-15)', () => {
  it('calls next() and reaches the handler when getAuth has a userId', async () => {
    const res = await harness({ userId: 'user_test' }).request('/')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok?: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 401 { error:"Unauthorized", path } when getAuth has no userId', async () => {
    const res = await harness({ userId: null }).request('/')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string; path?: string }
    expect(body.error).toBe('Unauthorized')
    expect(body.path).toBe('/')
  })

  it('returns 401 when getAuth returns undefined (no Clerk context)', async () => {
    const res = await harness(undefined).request('/')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe('Unauthorized')
  })
})
