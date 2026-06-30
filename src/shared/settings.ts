import { z } from 'zod'

/**
 * Cross-tier settings contract (DATA-04 / D-04): the `src/shared` seam imported by
 * BOTH the Hono `GET`/`PUT /api/settings` route (now) and any future React settings
 * form. Mirrors the `src/shared/types.ts` convention — a Zod schema + `z.infer` type
 * + the doc comment naming the consuming tiers.
 *
 * This is a STANDALONE KV config store (D-04), NOT cache-aside over D1: a single JSON
 * preferences blob persisted under one fixed KV key. Every field is defaulted, so the
 * blob reads as obviously-replaceable scaffolding — `theme`/`locale` connect to the
 * Phase-4 theming/RTL work and `itemsPerPage` to the Phase-2 pagination example.
 */

// The fixed KV key the settings blob lives under (D-04). One key, one JSON document.
export const SETTINGS_KEY = 'app:settings'

// Every field carries a default, so parsing `{}` (or a stale stored blob) always
// yields a complete, valid settings document — the route never has to special-case
// missing keys. Bounded enums/lengths whitelist exactly these three fields.
export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  locale: z.string().min(2).max(10).default('en'),
  itemsPerPage: z.number().int().min(1).max(100).default(20),
})

export type AppSettings = z.infer<typeof settingsSchema>

// The full default blob — `settingsSchema.parse({})` materializes every default.
// Returned by `GET /api/settings` on first load (empty KV) and used as the
// fallback when a stored blob fails validation.
export const defaultSettings: AppSettings = settingsSchema.parse({})
