/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireAuth } from '../middleware/require-auth'
import {
  settingsSchema,
  defaultSettings,
  type AppSettings,
} from '../../shared/settings'
import { settings } from './settings'

/**
 * KV-backed `/api/settings` store (DATA-04 / D-04, reshaped to the nested-by-section
 * schema in 09-01) — exercised behind the Phase-3 edge gate as an AUTHENTICATED user.
 *
 * Phase-3 note (RESEARCH Pitfall 1 + A2 FALLBACK): identical to items.test.ts — the
 * global `requireAuth` gate 401s every unauthenticated `/api/*` call, and a
 * `vi.mock('@hono/clerk-auth')` cannot reach the separate-isolate `SELF.fetch` worker
 * (A2 confirmed). So this mounts the SAME real `settings` router behind the SAME real
 * `requireAuth`, with `clerkAuth` seeded to a signed-in user, and drives it via
 * `app.request(path, init, env)` against the real `cloudflare:test` KV binding. The
 * unauthenticated 401 path is proven in auth.test.ts.
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

type SettingsBody = { settings: AppSettings }

async function putSettings(body: unknown) {
  return api.fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// A full, form-shaped nested blob (every section + field explicit) — proves D-03
// "no transform": a form-shaped nested blob validates against PUT unchanged.
const fullBlob: AppSettings = {
  appearance: { theme: 'dark', font: 'manrope' },
  notifications: {
    type: 'mentions',
    mobile: true,
    communication_emails: true,
    social_emails: false,
    marketing_emails: true,
    security_emails: false,
  },
  display: { items: ['recents', 'home', 'downloads'] },
}

describe('/api/settings KV-backed config store (DATA-04, D-04, nested schema)', () => {
  it('GET returns 200 with a complete nested default blob (all three sections present)', async () => {
    const res = await api.fetch(`${BASE}/api/settings`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as SettingsBody
    expect(['light', 'dark', 'system']).toContain(body.settings.appearance.theme)
    // All three sections are present objects (Pitfall 4 completeness at the route level).
    expect(typeof body.settings.appearance).toBe('object')
    expect(typeof body.settings.notifications).toBe('object')
    expect(typeof body.settings.display).toBe('object')
  })

  it('PUT a full nested form-shaped blob returns 200 { settings }, and a subsequent GET reads it back (KV round-trip, no transform — D-03)', async () => {
    const put = await putSettings(fullBlob)
    expect(put.status).toBe(200)
    const putBody = (await put.json()) as SettingsBody
    expect(putBody.settings).toEqual(fullBlob)

    const get = await api.fetch(`${BASE}/api/settings`)
    expect(get.status).toBe(200)
    const getBody = (await get.json()) as SettingsBody
    expect(getBody.settings).toEqual(fullBlob)
  })

  it('PUT with an invalid appearance.theme returns 400 (Zod) and does not change stored settings', async () => {
    // Establish a known-good stored value first.
    const known: AppSettings = {
      appearance: { theme: 'light', font: 'inter' },
      notifications: {
        type: 'all',
        mobile: false,
        communication_emails: false,
        social_emails: true,
        marketing_emails: false,
        security_emails: true,
      },
      display: { items: ['recents', 'home'] },
    }
    expect((await putSettings(known)).status).toBe(200)

    const bad = await putSettings({
      ...known,
      appearance: { theme: 'neon', font: 'inter' },
    })
    expect(bad.status).toBe(400)

    // The known-good value is untouched by the rejected write.
    const get = await api.fetch(`${BASE}/api/settings`)
    const getBody = (await get.json()) as SettingsBody
    expect(getBody.settings).toEqual(known)
  })

  it('GET falls back to nested defaultSettings when KV holds a stale OLD flat blob (T-09-01)', async () => {
    // Seed the OLD flat shape directly — the pre-reshape blob that safeParse must reject.
    await env.__KV_BINDING__.put(
      'app:settings',
      JSON.stringify({ theme: 'dark', locale: 'he', itemsPerPage: 50 })
    )

    const res = await api.fetch(`${BASE}/api/settings`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as SettingsBody
    // safeParse fails on the old shape → falls back to nested defaults, no crash.
    expect(body.settings).toEqual(defaultSettings)
  })

  it('settingsSchema.parse({}) materializes a complete blob equal to defaultSettings (Pitfall 4 completeness)', () => {
    expect(settingsSchema.parse({})).toEqual(defaultSettings)
  })
})
