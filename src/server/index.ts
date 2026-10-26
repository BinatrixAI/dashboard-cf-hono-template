import { clerkMiddleware } from '@hono/clerk-auth'
import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'
import { parseAuthorizedParties } from './authorized-parties'
import { onApiError } from './errors'
import { t } from './i18n'
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
 *   0.1 csrf()                    — foreign-origin form-type / no-type state changes get
 *                                    a JSON 403 via onError (SEC-03, D-13). Adds no route.
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

// 0) Security headers on every /api/* response (no CSP; the SPA's headers come from
//    public/_headers). HSTS is the same one year as public/_headers, without the
//    includeSubDomains hono adds by default, so a fork's custom domain never forces HTTPS
//    onto the owner's other subdomains (D-10). Everything else is hono defaults.
//    Registered before the health mount so the public route is covered too.
app.use(
  '/api/*',
  secureHeaders({ strictTransportSecurity: 'max-age=31536000' })
)

// 0.1) CSRF (SEC-03, D-13): an unsafe-method request whose Content-Type is form-type or
//      missing is rejected unless Sec-Fetch-Site is same-origin or Origin equals the
//      request's own origin (the same-origin SPA). The HTTPException(403) it throws is
//      turned into the localized JSON envelope by onApiError. JSON bodies are left to
//      the browser's CORS preflight (the API sends no CORS headers).
app.use('/api/*', csrf())

// 1) PUBLIC first (D-13/D-14) — matched before the gate, terminal handler, never
//    reaches the auth middleware below.
app.route('/api/health', health)

// 2) Populate Clerk auth context for everything below from the `__session` cookie
//    (D-10/D-12). Needs env: CLERK_SECRET_KEY (secret) + CLERK_PUBLISHABLE_KEY (var).
//    authorizedParties pins the accepted `azp` claim to the configured AUTHORIZED_PARTIES
//    list (SEC-02, D-01): a session token whose azp names an unlisted origin is
//    rejected. requireAuth (step 3) turns away every non-session token, and a token
//    without azp is not origin-checked (docs/security.md). An empty, placeholder-only
//    or non-origin list throws AuthorizedPartiesUnset (Clerk would skip the azp check
//    on []), so every protected route answers 500 via onError while /api/health,
//    mounted above, stays 200 (D-02 fail-closed).
//    GOTCHA: passing ANY options object to clerkMiddleware() disables its env-based
//    key fallback (`options || {env defaults}` in @hono/clerk-auth), so the keys MUST
//    be passed explicitly — hence the per-request wrapper reading c.env.
app.use('/api/*', (c, next) =>
  clerkMiddleware({
    secretKey: c.env.CLERK_SECRET_KEY,
    publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
    authorizedParties: parseAuthorizedParties(c.env.AUTHORIZED_PARTIES),
  })(c, next)
)

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
app.all('/api/*', (c) =>
  c.json({ error: t(c, 'notFound'), path: c.req.path }, 404)
)

// Terminal error handler (WR-03, SEC-04): every uncaught throw becomes the localized
// JSON envelope, HTTPExceptions keep their status, and the log is one
// `<status> <METHOD> <path> <ErrorClass>` line. The old inline handler logged the whole
// error object, which could carry query data (Drizzle bound params) into logs (D-10).
app.onError(onApiError)

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
