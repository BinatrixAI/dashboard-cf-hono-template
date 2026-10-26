/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from 'cloudflare:test'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import {
  settingsSchema,
  defaultSettings,
  type AppSettings,
} from '../../shared/settings'
import { onApiError } from '../errors'
import { catalog } from '../i18n'
import { requireAuth } from '../middleware/require-auth'
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
  c.set('clerkAuth', () => ({
    userId: 'user_test',
    tokenType: 'session_token',
  }))
  await next()
})
app.use('/api/*', requireAuth)
app.route('/api/settings', settings)
app.onError(onApiError) // malformed JSON (hono's HTTPException 400) → localized envelope

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
  appearance: { theme: 'dark' },
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
    expect(['light', 'dark', 'system']).toContain(
      body.settings.appearance.theme
    )
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
      appearance: { theme: 'light' },
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
      appearance: { theme: 'neon' },
    })
    expect(bad.status).toBe(400)
    // Exact envelope: no Zod issues, field names or echoed values (D-05).
    expect(await bad.json()).toEqual({
      error: catalog.en.invalidBody,
      path: '/api/settings',
    })

    // The known-good value is untouched by the rejected write.
    const get = await api.fetch(`${BASE}/api/settings`)
    const getBody = (await get.json()) as SettingsBody
    expect(getBody.settings).toEqual(known)
  })

  describe('localized 400 + Content-Type guard (SEC-04, D-05)', () => {
    const known: AppSettings = {
      appearance: { theme: 'light' },
      notifications: {
        type: 'none',
        mobile: true,
        communication_emails: true,
        social_emails: true,
        marketing_emails: true,
        security_emails: true,
      },
      display: { items: ['home'] },
    }
    const envelope = { error: catalog.en.invalidBody, path: '/api/settings' }

    async function storedSettings() {
      const res = await api.fetch(`${BASE}/api/settings`)
      return ((await res.json()) as SettingsBody).settings
    }

    async function seedKnown() {
      expect((await putSettings(known)).status).toBe(200)
    }

    it('a valid JSON body sent as text/plain is rejected and does not reset stored settings to defaults', async () => {
      await seedKnown()
      const res = await api.fetch(`${BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify(fullBlob),
      })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual(envelope)
      expect(await storedSettings()).toEqual(known)
    })

    it('a body with no Content-Type is rejected and leaves stored settings untouched', async () => {
      await seedKnown()
      const res = await api.fetch(`${BASE}/api/settings`, {
        method: 'PUT',
        body: new TextEncoder().encode('{}'),
      })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual(envelope)
      expect(await storedSettings()).toEqual(known)
    })

    it('malformed JSON returns the localized 400, not 500 and not the parse detail', async () => {
      const res = await api.fetch(`${BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: '{',
      })
      expect(res.status).toBe(400)
      const text = await res.text()
      expect(text).not.toContain('Malformed')
      expect(JSON.parse(text)).toEqual(envelope)
    })

    it('accepts Application/JSON; charset=utf-8 exactly as hono parses it', async () => {
      const res = await api.fetch(`${BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'Application/JSON; charset=utf-8' },
        body: JSON.stringify(fullBlob),
      })
      expect(res.status).toBe(200)
      expect(await storedSettings()).toEqual(fullBlob)
    })

    it('localizes the 400 to Hebrew when the dir cookie is rtl', async () => {
      const res = await api.fetch(`${BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie: 'dir=rtl' },
        body: JSON.stringify({ appearance: { theme: 'neon' } }),
      })
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe(
        catalog.he.invalidBody
      )
    })
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

  it('GET strips a legacy appearance.font from a stored blob and keeps the theme (D-06)', async () => {
    // A blob written before the font picker was removed: z.object drops the unknown key.
    await env.__KV_BINDING__.put(
      'app:settings',
      JSON.stringify({
        ...fullBlob,
        appearance: { theme: 'dark', font: 'manrope' },
      })
    )

    const res = await api.fetch(`${BASE}/api/settings`)
    expect(res.status).toBe(200)
    const { appearance } = ((await res.json()) as SettingsBody).settings
    expect(appearance.theme).toBe('dark')
    expect('font' in appearance).toBe(false)
  })

  it('settingsSchema.parse({}) materializes a complete blob equal to defaultSettings (Pitfall 4 completeness)', () => {
    expect(settingsSchema.parse({})).toEqual(defaultSettings)
  })
})
