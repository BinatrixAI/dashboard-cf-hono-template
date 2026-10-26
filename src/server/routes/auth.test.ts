/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { catalog } from '../i18n'

/**
 * Hermetic edge-auth NEGATIVE/public proof (AUTH-02/AUTH-03, D-13/D-14/D-15).
 *
 * Unlike items.test.ts / settings.test.ts this file deliberately does NOT
 * `vi.mock('@hono/clerk-auth')` — it exercises the REAL gate. With no `__session`
 * cookie on the request, `clerkMiddleware()` populates a signed-out auth context
 * (no network/JWKS call on an empty token, RESEARCH A3) and the custom `requireAuth`
 * gate returns the normalized `{ error: 'Unauthorized', path }` 401 envelope (D-15).
 *
 * Same black-box `SELF.fetch` idiom as the terminal-catch-all block in items.test.ts:
 * a service binding to the Worker's default export in the same isolate, so this proves
 * the REAL Hono registration-order precedence the deployed Worker uses (public-by-
 * ordering, D-13) — not a client-side mock.
 *
 * The authenticated SUCCESS path (valid Clerk session -> 200) is NOT hermetically
 * reproducible in workers-pool (needs a real Clerk-signed JWT + JWKS) and is proven by
 * live browser UAT in the phase gate (RESEARCH A5).
 */

const BASE = 'http://localhost'

describe('edge auth gate — unauthenticated protected requests (AUTH-03, D-15)', () => {
  it('GET /api/items with no session returns 401 { error:"Unauthorized", path }', async () => {
    const res = await SELF.fetch(`${BASE}/api/items`)
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = (await res.json()) as { error?: string; path?: string }
    expect(body.error).toBe('Unauthorized')
    expect(body.path).toBe('/api/items')
  })

  it('GET /api/settings with no session returns 401 (protected-by-default, D-12)', async () => {
    const res = await SELF.fetch(`${BASE}/api/settings`)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string; path?: string }
    expect(body.error).toBe('Unauthorized')
    expect(body.path).toBe('/api/settings')
  })

  it('GET /api/nope (unknown protected path) returns 401, not 404 — gate precedes the catch-all (Pitfall 2)', async () => {
    // Returning 401 (not 404) for an unauthenticated unknown /api/* path is the chosen,
    // documented behavior: do not reveal route existence (RESEARCH Security Domain / T-03-06).
    // The authenticated counterpart (GET /api/nope -> 404) lives in items.test.ts.
    const res = await SELF.fetch(`${BASE}/api/nope`)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string; path?: string }
    expect(body.error).toBe('Unauthorized')
    expect(body.path).toBe('/api/nope')
  })

  it('dir=rtl cookie answers the 401 in Hebrew', async () => {
    const res = await SELF.fetch(`${BASE}/api/items`, {
      headers: { cookie: 'dir=rtl' },
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string; path?: string }
    expect(body.error).toBe(catalog.he.unauthorized)
    expect(body.path).toBe('/api/items')
  })

  it.each(['dir=xx', 'dir=RTL'])(
    '%s cookie answers the 401 in English (exact-match rule)',
    async (cookie) => {
      const res = await SELF.fetch(`${BASE}/api/items`, { headers: { cookie } })
      expect(res.status).toBe(401)
      const body = (await res.json()) as { error?: string }
      expect(body.error).toBe(catalog.en.unauthorized)
    }
  )
})

describe('public-by-ordering exception — /api/health (D-13/D-14)', () => {
  it('GET /api/health carries the one-year HSTS without the subdomain flag (D-10)', async () => {
    const res = await SELF.fetch(`${BASE}/api/health`)
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=31536000'
    )
  })

  it('GET /api/health returns 200 { status:"ok" } with no session (matched before the gate)', async () => {
    const res = await SELF.fetch(`${BASE}/api/health`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = (await res.json()) as { status?: string }
    expect(body.status).toBe('ok')
  })
})

describe('CSRF on /api/* (SEC-03, D-13)', () => {
  const EVIL = 'https://evil.example'

  it('foreign-origin text/plain POST -> 403 JSON envelope with secure headers', async () => {
    const res = await SELF.fetch(`${BASE}/api/items`, {
      method: 'POST',
      headers: { origin: EVIL, 'content-type': 'text/plain' },
      body: 'x',
    })
    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=31536000'
    )
    expect(await res.json()).toEqual({
      error: catalog.en.forbidden,
      path: '/api/items',
    })
  })

  it('foreign-origin bodiless DELETE -> 403 JSON envelope', async () => {
    const res = await SELF.fetch(`${BASE}/api/items/abc`, {
      method: 'DELETE',
      headers: { origin: EVIL },
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: catalog.en.forbidden,
      path: '/api/items/abc',
    })
  })

  it('dir=rtl cookie localizes the csrf 403', async () => {
    const res = await SELF.fetch(`${BASE}/api/items`, {
      method: 'POST',
      headers: {
        origin: EVIL,
        'content-type': 'text/plain',
        cookie: 'dir=rtl',
      },
      body: 'x',
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe(catalog.he.forbidden)
  })

  it('same-origin text/plain POST passes csrf (then 401 unauthenticated)', async () => {
    const res = await SELF.fetch(`${BASE}/api/items`, {
      method: 'POST',
      headers: { origin: BASE, 'content-type': 'text/plain' },
      body: 'x',
    })
    expect(res.status).toBe(401)
  })

  it('foreign-origin application/json POST is left to CORS (401, Pitfall 5)', async () => {
    const res = await SELF.fetch(`${BASE}/api/items`, {
      method: 'POST',
      headers: { origin: EVIL, 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(401)
  })
})
