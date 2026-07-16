import { getAuth } from '@hono/clerk-auth'
import type { MiddlewareHandler } from 'hono'

/**
 * Role gate (authorization) — the AUTHZ counterpart to `require-auth.ts`'s
 * authentication-only gate. Allows only callers whose Clerk
 * `publicMetadata.role` is one of ADMIN_ROLES; everyone else gets the same
 * normalized `{ error, path }` envelope as the 401/404 paths, with a 403.
 *
 * Role source: the SAME `publicMetadata.role` field the /api/users Row mapping
 * already displays (users.ts `coerceRole`). Users default to no role
 * (-> 'cashier' display), so NOBODY passes this gate until an admin role is
 * granted: Clerk dashboard -> Users -> <user> -> Metadata -> Public ->
 * `{ "role": "admin" }`. Roles live per-Clerk-instance — re-grant after any
 * dev->prod instance switch.
 *
 * Why a backend `getUser` call and not `getAuth(c).sessionClaims`: default
 * Clerk session tokens do NOT carry publicMetadata — claims-based checks need
 * manual session-token customization in the Clerk dashboard. Reading the
 * caller through the context Clerk client (the seam clerkMiddleware installs)
 * is correct with zero Clerk config, at the cost of one backend API call on
 * the routes that mount this gate. If session-token customization is ever
 * configured, this can switch to a claims check and drop the call.
 *
 * Fail-closed: if the Clerk lookup throws, the error propagates to
 * `app.onError`'s 500 JSON envelope — never an open gate.
 *
 * MUST be mounted downstream of `requireAuth` (userId is assumed present).
 */
export const ADMIN_ROLES = ['admin', 'superadmin'] as const

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  // Non-null by contract: requireAuth already rejected userId-less requests.
  const userId = getAuth(c)!.userId!
  const caller = await c.get('clerk').users.getUser(userId)
  const role = caller.publicMetadata?.role
  if (!(ADMIN_ROLES as readonly string[]).includes(role as string)) {
    return c.json({ error: 'Forbidden', path: c.req.path }, 403)
  }
  await next()
}
