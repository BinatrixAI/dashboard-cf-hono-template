import { Hono } from 'hono'

/**
 * Public `/api/health` probe (D-14, RESEARCH Open Q3) — the server-side counterpart
 * to the public landing route. It is the PUBLIC-BY-ORDERING exception (D-13): mounted
 * FIRST in index.ts, before `clerkMiddleware()`/`requireAuth`, so Hono's
 * registration-order matching reaches this terminal handler and never falls through to
 * the gate. No env access, no auth, no `{ error, path }` envelope — just a liveness 200.
 *
 * Uses the same `new Hono<{ Bindings: Env }>()` router idiom as settings.ts so it stays
 * type-consistent with the rest of the API even though it reads no binding.
 */
export const health = new Hono<{ Bindings: Env }>().get('/', (c) =>
  c.json({ status: 'ok' })
)
