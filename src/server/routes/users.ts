import { Hono } from 'hono'

/**
 * Read-only `/api/users` router (Phase-13 / UI-04, D-04/D-04b). This is the ONE
 * new server surface the Users feature module needs: it lists the Clerk instance
 * users and returns them as a minimal, hand-mapped `{ users }` envelope — a REAL
 * gated data source instead of faker (drops `users/data/users.ts`).
 *
 * Mirror `items.ts`'s router shape (`Hono<{ Bindings: Env }>`, chained `.get`,
 * `{ … }` success envelope) but WITHOUT any Drizzle/D1 imports — Users has no D1
 * surface; its data lives in Clerk.
 *
 * Two invariants this file must keep:
 *  - BACKEND CLIENT via `c.get('clerk')` (RESEARCH Pitfall 3) — NOT `clerkClient(c)`.
 *    `clerkMiddleware()` in index.ts (line 46) populates the typed `ClerkClient` on
 *    the Hono context; reading it off context keeps the CLERK_SECRET_KEY on the edge.
 *  - MINIMAL Row mapping (D-04b / T-13-02 Info-Disclosure) — each Clerk `User` is
 *    reduced server-side to exactly the columns the table needs. `privateMetadata`,
 *    `raw`, and the full `emailAddresses[]`/`phoneNumbers[]` arrays NEVER cross back
 *    to the browser.
 *
 * READ-ONLY (D-02a / T-13): a GET handler ONLY. There is deliberately no
 * POST/PUT/DELETE against real Clerk accounts.
 */

// The minimal, browser-safe shape returned in the `{ users }` envelope (D-04b).
// Dates are ISO strings; the client feature's ported `schema.ts` uses
// `z.coerce.date()`, which tolerates them (RESEARCH Open Question 1).
export type Row = {
  id: string
  username: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  status: 'active' | 'inactive' | 'invited' | 'suspended'
  role: 'superadmin' | 'admin' | 'manager' | 'cashier'
  createdAt: string
  updatedAt: string
}

// The role enum the upstream Users module recognizes. `publicMetadata.role` is
// coerced against this set; anything unknown/absent defaults to 'cashier' (no faker).
const KNOWN_ROLES = ['superadmin', 'admin', 'manager', 'cashier'] as const
type Role = (typeof KNOWN_ROLES)[number]

function coerceRole(value: unknown): Role {
  return (KNOWN_ROLES as readonly string[]).includes(value as string)
    ? (value as Role)
    : 'cashier'
}

export const users = new Hono<{ Bindings: Env }>().get('/', async (c) => {
  const clerk = c.get('clerk')
  try {
    // Fetch a reasonable page newest-first; the client table paginates in-memory
    // (matches how the mock-backed modules paginate). Server-side pagination is a
    // future enhancement (RESEARCH — planner discretion).
    const { data } = await clerk.users.getUserList({
      limit: 100,
      orderBy: '-created_at',
    })

    const rows: Row[] = data.map((u) => {
      const email =
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
          ?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        ''
      const phoneNumber =
        u.phoneNumbers.find((p) => p.id === u.primaryPhoneNumberId)
          ?.phoneNumber ??
        u.phoneNumbers[0]?.phoneNumber ??
        ''
      const status: Row['status'] = u.banned
        ? 'suspended'
        : u.locked
          ? 'inactive'
          : u.lastSignInAt == null
            ? 'invited'
            : 'active'

      return {
        id: u.id,
        username: u.username ?? email.split('@')[0] ?? u.id,
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        email,
        phoneNumber,
        status,
        role: coerceRole(u.publicMetadata?.role),
        createdAt: new Date(u.createdAt).toISOString(),
        updatedAt: new Date(u.updatedAt).toISOString(),
      }
    })

    return c.json({ users: rows })
  } catch {
    // Never leak Clerk internals to the body (T-13-03). The raw error is
    // server-logged by the app.onError convention; the client sees only the
    // normalized envelope, mirroring index.ts lines 59/72.
    return c.json({ error: 'Failed to list users', path: c.req.path }, 502)
  }
})
