import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
  settingsSchema,
  SETTINGS_KEY,
  defaultSettings,
} from '../../shared/settings'

/**
 * KV-backed `/api/settings` config store (Plan 03 / DATA-04 / D-04). This is the
 * documented KV read/write example: a single JSON preferences blob persisted under
 * the fixed key `app:settings`. It is a STANDALONE KV config store — NOT cache-aside
 * over D1 — so it teaches the KV binding cleanly and stays trivially removable.
 *
 * Two invariants this file keeps:
 *  - PER-REQUEST binding access: `c.env.__KV_BINDING__` is read inside each handler.
 *    The binding only exists at request time, so a module-scope reference would be a
 *    runtime error — never hoist it. Requires `new Hono<{ Bindings: Env }>()`.
 *  - UNTRUSTED stored JSON: the blob read back from KV may be stale/old-shape across
 *    deploys (T-02-04), so it is re-validated with `settingsSchema.safeParse` and
 *    falls back to `defaultSettings` — a malformed stored blob can never crash the
 *    route or inject an unexpected shape. The write whitelists exactly the three
 *    fields via `zValidator` (T-02-02 — no over-posting).
 *
 * KV is eventually consistent (Pitfall 9): a write may take up to ~60s to propagate
 * across edge POPs. That is acceptable for a settings store; use D1 where strong
 * read-after-write is required.
 */
export const settings = new Hono<{ Bindings: Env }>()
  // GET / — return the stored blob, or defaultSettings on first load / invalid blob.
  .get('/', async (c) => {
    const stored = await c.env.__KV_BINDING__.get(SETTINGS_KEY, 'json') // null on first load
    const parsed = settingsSchema.safeParse(stored) // validate untrusted stored JSON
    return c.json({ settings: parsed.success ? parsed.data : defaultSettings })
  })
  // PUT / — validate the body, persist the whole blob under the fixed key.
  .put('/', zValidator('json', settingsSchema), async (c) => {
    const next = c.req.valid('json')
    await c.env.__KV_BINDING__.put(SETTINGS_KEY, JSON.stringify(next))
    return c.json({ settings: next })
  })
