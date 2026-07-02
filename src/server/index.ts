import { clerkMiddleware } from '@hono/clerk-auth'
import { Hono } from 'hono'
import { requireAuth } from './middleware/require-auth'
import { health } from './routes/health'
import { items } from './routes/items'
import { settings } from './routes/settings'
import { users } from './routes/users'

/**
 * Single-Worker Hono entry (referenced by wrangler.jsonc `main`).
 *
 * A Hono instance satisfies the Worker `{ fetch }` contract, so `export default app`
 * is all the platform needs. The @cloudflare/vite-plugin discovers this entry via
 * `main` regardless of the directory name — this proves the 3-dir single-package
 * split (src/client + src/server + src/shared, SCAF-01) works with the plugin
 * (RESEARCH Open Question A4).
 *
 * Routing precedence (VERIFIED against developers.cloudflare.com static-assets):
 *   run_worker_first ["/api/*"] -> Hono runs first; everything else falls back to
 *   the SPA index.html. So /api/<unknown> never reaches the SPA — the terminal
 *   catch-all below returns a JSON 404, never HTML (ROUT-03).
 *
 * EDGE AUTH ORDERING (Phase 3, D-12/D-13/D-14, AUTH-02/03) — registration order IS
 * match order, so the sequence below is the security contract:
 *   1. PUBLIC  health router       — registered FIRST, terminal handler; never reaches
 *                                    the gate (public-by-ordering, D-13/D-14).
 *   2. clerkMiddleware()           — POPULATES auth context from the same-origin
 *                                    `__session` cookie (D-10); it never rejects.
 *   3. requireAuth                 — ENFORCES + normalizes the 401 `{ error, path }`
 *                                    envelope (D-15); the real boundary.
 *   4. PROTECTED items/settings    — reachable only past the gate. Any NEW router
 *                                    mounted after the gate is protected by default
 *                                    (protected-by-default, D-12).
 *   5. terminal /api/* catch-all   — JSON 404, MUST stay LAST (ROUT-03).
 *
 * The root app is typed `Hono<{ Bindings: Env }>` so `clerkMiddleware()` can read
 * CLERK_SECRET_KEY + CLERK_PUBLISHABLE_KEY from `c.env`.
 */
const app = new Hono<{ Bindings: Env }>()

// 1) PUBLIC first (D-13/D-14) — matched before the gate, terminal handler, never
//    reaches the auth middleware below.
app.route('/api/health', health)

// 2) Populate Clerk auth context for everything below from the `__session` cookie
//    (D-10/D-12). Needs env: CLERK_SECRET_KEY (secret) + CLERK_PUBLISHABLE_KEY (var).
app.use('/api/*', clerkMiddleware())

// 3) Enforce auth + normalize the 401 envelope (D-15). This is the real boundary.
app.use('/api/*', requireAuth)

// 4) PROTECTED routers (D-14). Mounted AFTER the gate, BEFORE the terminal catch-all.
//    items: D-04 in-memory store -> Phase-2 D1 swap seam. settings: KV-as-config (D-04).
app.route('/api/items', items)
app.route('/api/settings', settings)
// users: D-04 real Clerk instance-user list (read-only, minimal Row mapping, D-04b).
app.route('/api/users', users)

// 5) Terminal /api/* catch-all — JSON 404, never HTML (ROUT-03). MUST stay last.
//    (An UNauthenticated unknown /api/* path is short-circuited to 401 by requireAuth
//    above; this 404 is only reached by an AUTHENTICATED request for an unknown path.)
app.all('/api/*', (c) => c.json({ error: 'Not Found', path: c.req.path }, 404))

// Terminal error handler (WR-03) — normalizes ANY uncaught throw to the same JSON
// envelope as the 401/404 paths, instead of Hono's default text/plain 500. Without
// this, an exception from clerkMiddleware() (e.g. missing/invalid CLERK_SECRET_KEY)
// or getAuth(c) would break the documented "always-JSON-envelope { error, path }"
// contract the Axios client expects. Fail-closed (no auth bypass); the error is
// logged server-side and never echoed to the client body.
app.onError((err, c) => {
  // Intentional server-side log of the uncaught error (never echoed to the client
  // body); the worker has no other observability sink at this seam.
  // eslint-disable-next-line no-console
  console.error(err)
  return c.json({ error: 'Internal Server Error', path: c.req.path }, 500)
})

export default app

// ─── ASYNC LAYER ARMING SEAM (DORMANT — uncomment to activate; see docs/async-layer.md) ───
// To activate the Cron -> Queue -> Resend layer, replace `export default app` above with the
// handler object below and uncomment the import. With NO `triggers.crons` / `queues.consumers`
// declared in wrangler.jsonc, the platform never invokes scheduled()/queue() — so leaving this
// commented keeps a fresh fork inert (ASYNC-02). The import MUST stay inside this comment: a live
// top-level `import { scheduled, queue }` is unused while dormant and trips noUnusedLocals +
// eslint no-unused-vars, breaking CI (Pitfall 4). `app.fetch` is passed unwrapped (Pitfall 7/A1).
//
// import { scheduled, queue } from './async/handlers'
//
// export default {
//   fetch: app.fetch,   // existing Hono API + SPA assets — unchanged
//   scheduled,          // Cron Trigger entry (enqueues a digest message)
//   queue,              // Queue consumer entry (drains batch -> Resend)
// } satisfies ExportedHandler<Env>
