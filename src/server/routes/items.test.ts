/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireAuth } from '../middleware/require-auth'
import { items } from './items'

/**
 * `/api/items` CRUD round-trip (D1-backed, D-04) — now exercised behind the Phase-3
 * edge gate as an AUTHENTICATED user.
 *
 * Phase-3 note (RESEARCH Pitfall 1 + A2 FALLBACK): the global `requireAuth` gate now
 * makes every UNauthenticated `/api/*` call 401. The planned fix was a
 * `vi.mock('@hono/clerk-auth')` seam, but `SELF.fetch` invokes the REAL deployed Worker
 * in a SEPARATE isolate from this test module, so a `vi.mock` here can never reach it
 * (A2 confirmed on first run — the real `getAuth`/`clerkMiddleware` always run in the
 * worker isolate). The documented fallback is used instead: mount the SAME real `items`
 * router behind the SAME real `requireAuth`, with the auth context SEEDED to an
 * authenticated user via Clerk's `clerkAuth` seam (a tiny upstream middleware that
 * `c.set('clerkAuth', () => ({ userId }))`). `app.request(path, init, env)` runs it
 * in-pool with the real `cloudflare:test` D1/KV bindings (migrations applied by
 * test/apply-migrations.ts). This keeps EVERY assertion below identical and still
 * exercises real Hono routing precedence + real D1 — just authenticated.
 *
 * The UNauthenticated 401 path (and public /api/health) is proven separately and
 * hermetically in auth.test.ts (no seed). The `GET /api/nope -> 404` test below stays
 * 404 because an AUTHENTICATED request passes the gate and reaches the catch-all
 * (Pitfall 2 — the unauthenticated `/api/nope -> 401` counterpart lives in auth.test.ts).
 *
 * Assertions are order-independent and never depend on the seed item count, so they
 * stay green regardless of store persistence across tests.
 */

const BASE = 'http://localhost'

// Authenticated harness: real `items` router behind the real `requireAuth` gate, with
// `clerkAuth` seeded to a signed-in user (mirrors what `clerkMiddleware()` installs).
// The terminal catch-all matches the deployed Worker so `/api/nope` -> authenticated 404.
const app = new Hono<{ Bindings: Env }>()
app.use('/api/*', async (c, next) => {
  c.set('clerkAuth', () => ({ userId: 'user_test' }))
  await next()
})
app.use('/api/*', requireAuth)
app.route('/api/items', items)
app.all('/api/*', (c) => c.json({ error: 'Not Found', path: c.req.path }, 404))

const api = {
  fetch: (input: string, init?: RequestInit) => app.request(input, init, env),
}

async function createItem(name: string, description?: string) {
  return api.fetch(`${BASE}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      description === undefined ? { name } : { name, description }
    ),
  })
}

describe('/api/items CRUD round-trip (D1-backed, D-04)', () => {
  it('POST creates an item and returns 201 { item }', async () => {
    const res = await createItem('Test', 'x')
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      item: { id: string; name: string; description: string }
    }
    expect(typeof body.item.id).toBe('string')
    expect(body.item.id.length).toBeGreaterThan(0)
    expect(body.item.name).toBe('Test')
    expect(body.item.description).toBe('x')
  })

  it('GET returns 200 { items } containing a just-created item (the round-trip)', async () => {
    const created = (await (await createItem('RoundTrip')).json()) as {
      item: { id: string }
    }

    const res = await api.fetch(`${BASE}/api/items`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: Array<{ id: string }> }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.some((i) => i.id === created.item.id)).toBe(true)
  })

  it('GET /:id returns the item; a missing id returns JSON 404 with .error', async () => {
    const created = (await (await createItem('FindMe')).json()) as {
      item: { id: string }
    }

    const found = await api.fetch(`${BASE}/api/items/${created.item.id}`)
    expect(found.status).toBe(200)
    const foundBody = (await found.json()) as { item: { id: string } }
    expect(foundBody.item.id).toBe(created.item.id)

    const missing = await api.fetch(`${BASE}/api/items/does-not-exist`)
    expect(missing.status).toBe(404)
    const missingBody = (await missing.json()) as { error?: string }
    expect(typeof missingBody.error).toBe('string')
  })

  it('DELETE /:id returns { success: true } and the item is gone', async () => {
    const created = (await (await createItem('DeleteMe')).json()) as {
      item: { id: string }
    }

    const del = await api.fetch(`${BASE}/api/items/${created.item.id}`, {
      method: 'DELETE',
    })
    expect(del.status).toBe(200)
    const delBody = (await del.json()) as { success: boolean }
    expect(delBody.success).toBe(true)

    const gone = await api.fetch(`${BASE}/api/items/${created.item.id}`)
    expect(gone.status).toBe(404)
  })

  it('GET honors capped pagination: ?limit=1&offset=0 returns exactly one item (DATA-05)', async () => {
    // The seed row from 0000_init.sql guarantees ≥1 item exists.
    const res = await api.fetch(`${BASE}/api/items?limit=1&offset=0`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: Array<{ id: string }> }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBe(1)
  })

  it('GET with an oversized ?limit is capped, not rejected (no error)', async () => {
    const res = await api.fetch(`${BASE}/api/items?limit=9999`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: unknown[] }
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('POST with empty name returns 400 (Zod) and writes nothing', async () => {
    const res = await createItem('')
    expect(res.status).toBe(400)

    const list = (await (await api.fetch(`${BASE}/api/items`)).json()) as {
      items: Array<{ name: string }>
    }
    expect(list.items.some((i) => i.name === '')).toBe(false)
  })
})

describe('terminal /api/* catch-all (ROUT-03)', () => {
  it('GET /api/nope returns a JSON 404 with .error and .path', async () => {
    const res = await api.fetch(`${BASE}/api/nope`)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = (await res.json()) as { error?: string; path?: string }
    expect(typeof body.error).toBe('string')
    expect(body.path).toBe('/api/nope')
  })
})
