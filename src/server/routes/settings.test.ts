/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireAuth } from '../middleware/require-auth'
import { settings } from './settings'

/**
 * KV-backed `/api/settings` store (DATA-04 / D-04) — now exercised behind the Phase-3
 * edge gate as an AUTHENTICATED user.
 *
 * Phase-3 note (RESEARCH Pitfall 1 + A2 FALLBACK): identical to items.test.ts — the
 * global `requireAuth` gate 401s every unauthenticated `/api/*` call, and a
 * `vi.mock('@hono/clerk-auth')` cannot reach the separate-isolate `SELF.fetch` worker
 * (A2 confirmed). So this mounts the SAME real `settings` router behind the SAME real
 * `requireAuth`, with `clerkAuth` seeded to a signed-in user, and drives it via
 * `app.request(path, init, env)` against the real `cloudflare:test` KV binding. Every
 * KV round-trip assertion below is preserved verbatim; only the transport (authenticated
 * harness instead of `SELF.fetch`) changed. The unauthenticated 401 path is proven in
 * auth.test.ts.
 *
 * Each test sets the value it asserts, so the suite is tolerant of KV state persisting
 * across tests (and of KV's eventual consistency — reads inside one isolate are
 * read-your-writes here).
 */

const BASE = 'http://localhost'

// Authenticated harness: real `settings` router behind the real `requireAuth` gate,
// `clerkAuth` seeded to a signed-in user (mirrors what `clerkMiddleware()` installs).
const app = new Hono<{ Bindings: Env }>()
app.use('/api/*', async (c, next) => {
  c.set('clerkAuth', () => ({ userId: 'user_test' }))
  await next()
})
app.use('/api/*', requireAuth)
app.route('/api/settings', settings)

const api = {
  fetch: (input: string, init?: RequestInit) => app.request(input, init, env),
}

type SettingsBody = {
  settings: { theme: string; locale: string; itemsPerPage: number }
}

async function putSettings(body: unknown) {
  return api.fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/settings KV-backed config store (DATA-04, D-04)', () => {
  it('GET returns 200 with the default settings (theme=system) shape', async () => {
    const res = await api.fetch(`${BASE}/api/settings`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as SettingsBody
    expect(['light', 'dark', 'system']).toContain(body.settings.theme)
    expect(typeof body.settings.locale).toBe('string')
    expect(typeof body.settings.itemsPerPage).toBe('number')
  })

  it('PUT a valid blob returns 200 { settings }, and a subsequent GET reads it back (the KV round-trip)', async () => {
    const next = { theme: 'dark', locale: 'he', itemsPerPage: 50 }
    const put = await putSettings(next)
    expect(put.status).toBe(200)
    const putBody = (await put.json()) as SettingsBody
    expect(putBody.settings).toEqual(next)

    const get = await api.fetch(`${BASE}/api/settings`)
    expect(get.status).toBe(200)
    const getBody = (await get.json()) as SettingsBody
    expect(getBody.settings).toEqual(next)
  })

  it('PUT with an invalid theme returns 400 (Zod) and does not change stored settings', async () => {
    // Establish a known-good stored value first.
    const known = { theme: 'light', locale: 'en', itemsPerPage: 10 }
    expect((await putSettings(known)).status).toBe(200)

    const bad = await putSettings({
      theme: 'neon',
      locale: 'en',
      itemsPerPage: 10,
    })
    expect(bad.status).toBe(400)

    // The known-good value is untouched by the rejected write.
    const get = await api.fetch(`${BASE}/api/settings`)
    const getBody = (await get.json()) as SettingsBody
    expect(getBody.settings).toEqual(known)
  })
})
