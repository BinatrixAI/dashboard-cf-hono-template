import { getAuth } from '@hono/clerk-auth'
import type { MiddlewareHandler } from 'hono'
import { t } from '../i18n'

/**
 * Edge auth GATE (AUTH-02/AUTH-03, D-12/D-15) — the real security boundary.
 *
 * The two-middleware split (RESEARCH Pattern 1): `clerkMiddleware()` only POPULATES
 * the auth context from the same-origin `__session` cookie (D-10) and never rejects;
 * this gate is what actually enforces authentication. It reads `getAuth(c)` and, when
 * there is no `userId` or the token is not a Clerk session token, returns the
 * NORMALIZED `{ error: 'Unauthorized', path }` 401 envelope (D-15) — mirroring the terminal catch-all in index.ts, never leaking the
 * library's raw 401/redirect body (T-03-03). The message follows the `dir` cookie
 * (Hebrew on 'rtl', English otherwise) via the server catalog (D-06).
 *
 * Kept a standalone module on purpose: it is the mockable seam the CRUD suites stub
 * (`vi.mock('@hono/clerk-auth')`, RESEARCH Pitfall 1) and the unit-under-test in
 * require-auth.test.ts (the A2 fallback proof).
 *
 * ⚠️ AUTHENTICATION-ONLY GATE — NOT AUTHORIZATION (WR-02). This middleware proves
 * only that SOME authenticated user is present (`userId` exists). It does NOT do any
 * per-user / per-resource authorization or ownership scoping. As shipped, the
 * protected routers (`items`, `settings`) treat all data as GLOBAL: every signed-in
 * user can list, read, mutate, and delete EVERY other user's records (a classic IDOR
 * surface). This is an acceptable, deliberate posture for a SINGLE-TENANT internal
 * dashboard — which is the template's default assumption.
 *
 * If you are cloning this template into a MULTI-TENANT or multi-user-isolated app,
 * per-resource authorization is YOUR responsibility, not this gate's. At minimum:
 *   - add a `userId` (owner) column to the items schema and stamp it from
 *     `getAuth(c).userId` on create;
 *   - filter every read/update/delete by owner (`where(eq(itemsTable.userId, …))`);
 *   - namespace settings per user (`app:settings:${userId}`).
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = getAuth(c)
  // clerkMiddleware accepts every Clerk token type (acceptsToken 'any', not
  // overridable); only session tokens went through the azp check.
  if (!auth?.userId || auth.tokenType !== 'session_token') {
    return c.json({ error: t(c, 'unauthorized'), path: c.req.path }, 401)
  }
  await next()
}
