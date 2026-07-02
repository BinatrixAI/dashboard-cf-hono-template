import { z } from 'zod'

/**
 * Cross-tier settings contract (DATA-04 / D-04): the `src/shared` seam imported by
 * BOTH the Hono `GET`/`PUT /api/settings` route and the React settings forms
 * (`use-settings.ts` client hook + the Appearance/Notifications/Display forms).
 * Mirrors the `src/shared/types.ts` convention — a Zod schema + `z.infer` type +
 * the doc comment naming the consuming tiers.
 *
 * This is a STANDALONE KV config store (D-04), NOT cache-aside over D1: a single JSON
 * preferences blob persisted under one fixed KV key. The schema is NESTED BY SECTION
 * (D-01) — `appearance` / `notifications` / `display` — mirroring the three Settings
 * forms 1:1 so a form-shaped blob PUTs with no transform (D-03).
 *
 * Two load-bearing invariants:
 *  - COMPLETENESS: every field carries `.default(...)` AND every section object carries
 *    `.prefault({})`, so `settingsSchema.parse({})` (or a stale/empty stored blob) always
 *    materializes a complete, valid settings document — the route never special-cases
 *    missing keys. (`.prefault` — Zod v4's input-side default — runs `{}` through the
 *    section schema so the field-level `.default(...)`s fill in; a plain `.default({})`
 *    would require the fully-materialized output object as its argument.)
 *  - WHITELIST: the blob whitelists exactly the three nested sections and nothing else.
 *    No `.passthrough()` anywhere — over-posting extra fields is stripped (T-09-02).
 */

// The fixed KV key the settings blob lives under (D-14). One key, one JSON document.
export const SETTINGS_KEY = 'app:settings'

// Font enum (A3): the tuple is inlined here — kept in sync with the source of truth at
// `src/client/config/fonts.ts` (['inter','manrope','system']). It is NOT imported from
// there: `src/shared/settings.ts` compiles into the Worker bundle, and a shared→client
// import would drag a client path (and the `@/` alias) into the server build, breaking
// the shared/server boundary.
const fonts = ['inter', 'manrope', 'system'] as const

export const settingsSchema = z.object({
  appearance: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).default('system'), // D-13: includes 'system'
      font: z.enum(fonts).default('inter'),
    })
    .prefault({}),
  notifications: z
    .object({
      // shapes copied verbatim from notifications-form.tsx
      type: z.enum(['all', 'mentions', 'none']).default('all'),
      mobile: z.boolean().default(false),
      communication_emails: z.boolean().default(false),
      social_emails: z.boolean().default(true),
      marketing_emails: z.boolean().default(false),
      security_emails: z.boolean().default(true),
    })
    .prefault({}),
  display: z
    .object({
      // shape from display-form.tsx
      items: z.array(z.string()).default(['recents', 'home']),
    })
    .prefault({}),
})

export type AppSettings = z.infer<typeof settingsSchema>

// The full default blob — `settingsSchema.parse({})` materializes every default.
// Returned by `GET /api/settings` on first load (empty KV) and used as the
// fallback when a stored blob fails validation.
export const defaultSettings: AppSettings = settingsSchema.parse({})
