# Security Model & Hardening Checklist

This template ships **secure defaults** but makes one deliberate simplifying assumption:
it is a **single-tenant internal dashboard** where every authenticated user is a trusted
operator. That assumption is baked into the auth layer, and it is the single most important
thing to revisit when you fork this into a **multi-user or public-sign-up** app.

The items below came out of a security audit of a fork. Each is either (a) a deliberate
posture you inherit and must reconsider, or (b) a concrete gap worth fixing at the template
level. Read [`secrets.md`](./secrets.md) alongside this — it covers the secret-storage model
these notes build on.

> Convention in this doc: `https://<your-app-domain>` and `pk_live_…` / `sk_live_…` are
> placeholders — substitute your own. Nothing account-specific is committed to this template.

---

## The trust model you inherit

`src/server/index.ts` mounts the API in a fixed order that **is** the security contract:

1. `/api/health` — public, terminal (registered before the gate).
2. `clerkMiddleware()` — populates auth context from the `__session` cookie; never rejects.
3. `requireAuth` (`src/server/middleware/require-auth.ts`) — the real gate: 401 unless a
   `userId` is present.
4. Protected routers (`/api/items`, `/api/settings`, `/api/users`).

**`requireAuth` enforces authentication, not authorization.** It proves *some* signed-in
user is present — it does no per-user or per-role check. The consequences below all follow
from that one fact. It is fine for a single-operator dashboard; it is not fine once you have
mutually-untrusting users.

---

## H1 — `/api/users` returns every user's PII to any authenticated caller

**Where:** `src/server/routes/users.ts` — the handler is a bare `.get('/')` behind
`requireAuth` only. It returns up to 100 users' `email` and `phoneNumber` (plus name,
username, status, role).

**Why it matters:** the SPA only *renders* the Users table for admin-styled roles, but the
API is the trust boundary and is directly callable by any valid session. In a multi-user or
public-sign-up app, **anyone who registers can call `GET /api/users` and harvest every
user's contact details.** For a single-tenant dashboard this is acceptable (all users are
staff); for anything else it is a broken-authorization / PII-disclosure bug.

**Fix — gate on an admin role read from the verified session:**

```ts
// src/server/routes/users.ts
import { getAuth } from '@hono/clerk-auth'

export const users = new Hono<{ Bindings: Env }>().get('/', async (c) => {
  const auth = getAuth(c)
  const role = (auth?.sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (role !== 'admin' && role !== 'superadmin' && role !== 'manager') {
    return c.json({ error: 'Forbidden', path: c.req.path }, 403)
  }
  const clerk = c.get('clerk')
  // … existing getUserList + row mapping unchanged …
})
```

Requires that staff carry `publicMetadata.role` in Clerk (surfaced into session claims).
Better still, factor this into a reusable `requireRole(...)` middleware and apply it at the
mount in `index.ts`, so authorization is explicit and every future protected route inherits
the pattern.

---

## H2 — No per-user authorization on `/api/items` + `/api/settings` (global IDOR)

**Where:** `src/server/routes/items.ts` (all CRUD, filtered by `id` only, no owner column in
`src/server/db/schema.ts`) and `src/server/routes/settings.ts` (a single shared KV key
`app:settings`).

**Why it matters:** every signed-in user can read, modify, and delete every other user's
items, and overwrite the one global settings blob. This is the **documented single-tenant
posture** (`require-auth.ts` spells it out). It is harmless while these routes carry only
demo/global data — and a genuine cross-user data-compromise bug the moment you store
per-user data (profiles, submissions, payment info) through them.

**Fix — scope resources to their owner before any per-user data flows:**

```ts
// src/server/db/schema.ts — add an owner column
export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),        // stamp from getAuth(c).userId on create
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

Then filter every read/update/delete by owner
(`where(eq(itemsTable.userId, getAuth(c).userId))`) and namespace settings per user
(`app:settings:${userId}`). `require-auth.ts` already prescribes exactly this.

---

## H3 — CMS: `internal` collections are readable anonymously via legacy `/api/:collection` routes

**Where:** `cms/src/index.ts` registers `siteSettingsCollection` as `internal: true`
(admin-only). The gap is in the vendored `@sonicjs-cms/core` (a **beta** dependency): its
legacy content routes (`GET /api/:collection`, `/api/:collection/:id`,
`/api/collections/:collection/content`, and `/api/content?collection=`) gate reads on
`is_published` only — they do **not** enforce the `internal` flag or the `access`/base-grant
ACL that the `/api/documents/*` delivery API correctly applies. Because settings are stored
as published, an **unauthenticated** GET returns them (site config + admin email). Any future
`internal`/non-public collection with published rows leaks the same way.

**Fix — don't trust the beta core's inconsistent enforcement; guard at the worker.** Add a
public-collection allowlist in `cms/src/index.ts`:

```ts
// cms/src/index.ts — after createSonicJSApp(...)
const PUBLIC_COLLECTIONS = new Set(['blog-posts'])
app.use('/api/*', async (c, next) => {
  const m = c.req.path.match(/^\/api\/(?:content|collections\/)?([a-z0-9_-]+)/i)
  const col = c.req.query('collection') ?? m?.[1]
  if (col && !PUBLIC_COLLECTIONS.has(col) && !c.get('user')) {
    return c.json({ error: 'Not Found' }, 404)
  }
  await next()
})
```

Report the `internal`/`access` bypass upstream and bump `@sonicjs-cms/core` when a fixed
release ships. Treat any `/api/:collection`-style route as untrusted until then.

---

## Clerk hardening (defense in depth)

- **Scope the session to your origin.** `clerkMiddleware()` is called bare in
  `src/server/index.ts`, so Clerk does no server-side origin check on cookie auth. Pass your
  production origin so a forged cross-origin request is rejected:
  ```ts
  app.use('/api/*', clerkMiddleware({ authorizedParties: ['https://<your-app-domain>'] }))
  ```
- **Keep every state-changing route off GET.** CSRF is currently mitigated only by (a) all
  mutations being POST/PUT/DELETE and (b) Clerk's `__session` being `SameSite=Lax`. A single
  state-changing GET route breaks that guarantee.
- **Ship on a Clerk _production_ instance**, not a `pk_test_…` development instance —
  dev instances have a different cookie / cross-domain / bot-protection posture. See
  [`secrets.md`](./secrets.md) for where each key goes (`pk_live_…` in `.env.local` +
  `wrangler.jsonc` `vars`; `sk_live_…` via `wrangler secret put` only).
- **Decide the sign-up posture deliberately.** A production Clerk instance defaults to open
  self-sign-up. If your Users directory (H1) or any per-user data is staff-only, restrict
  sign-up (allowlist / invitation) under Clerk → **User & Authentication → Restrictions**.

## Secrets

- **Generate production secrets fresh — never reuse local `.dev.vars` values.** This applies
  to `CLERK_SECRET_KEY`, and (if the CMS is enabled) `BETTER_AUTH_SECRET` / `JWT_SECRET`.
  Anyone who obtains a reused dev secret (clone, backup, laptop) can forge sessions/JWTs
  against production. Use `openssl rand -hex 32` for the CMS secrets and set every production
  secret with `wrangler secret put`.
- The committed `pk_test_…` publishable key and the real D1/KV resource IDs in
  `wrangler.jsonc` are non-secret (opaque without account credentials), but a fork should
  still substitute its own via `setup.mjs`.

---

## Before you go live — checklist

- [ ] Decided single-tenant vs multi-user. If multi-user: applied **H1** (role-gate
      `/api/users`) and **H2** (owner-scope items/settings) before storing per-user data.
- [ ] If the CMS is enabled: applied the **H3** allowlist guard and confirmed
      `GET /api/<internal-collection>` returns nothing to an anonymous caller.
- [ ] On a Clerk **production** instance; `authorizedParties` set; sign-up posture chosen.
- [ ] All production secrets independently generated and set via `wrangler secret put`
      (none reused from `.dev.vars`).
- [ ] `grep -r "pk_test_" dist/` after build returns nothing (no stale dev key shipped).

## What's already solid (don't re-audit these)

Verified secure by the audit, so you can spend your review time elsewhere: the documented
auth ordering (no bypass; `getAuth().userId` is signature-verified and unforgeable),
mass-assignment (Zod whitelists, no `.passthrough()`, server-minted ids/timestamps), SQL
injection surface (Drizzle parameterized only; pagination capped), client XSS surface (CMS
content rendered as escaped plaintext, validated sign-in redirect, hardcoded embed
allowlist), CMS CORS (exact-match origin allowlist), `/files/*` R2 (random unguessable
keys), `POST /mcp` (auth-gated), the admin seed script (injection-safe), and the CI
secret-scan gate (gitleaks + grep; `sk_` shapes fail the build).
