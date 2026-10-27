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
   Clerk session token (`tokenType` `'session_token'`) with a `userId` is present.
4. Protected routers (`/api/items`, `/api/settings`, `/api/users`).

**`requireAuth` enforces authentication, not authorization.** It proves *some* signed-in
user is present — it does no per-user or per-role check. H1 shows the role gate the
template adds on top where it matters; H2 is what follows from that one fact. It is fine
for a single-operator dashboard; it is not fine once you have mutually-untrusting users.

---

## H1 — `/api/users` PII is admin-only (fixed in template)

**Where:** `src/server/routes/users.ts` mounts `requireAdmin`
(`src/server/middleware/require-admin.ts`) on its `.get('/')`, downstream of `requireAuth`.
The handler returns up to 100 users' `email` and `phoneNumber` (plus name, username, status,
role), so it is gated on role, not just on a signed-in session. `users.test.ts` covers it.

**How the gate decides:** it reads the caller's Clerk `publicMetadata.role` with a Backend
API `users.getUser(userId)` call, not from session claims, because default Clerk session
tokens do not carry `publicMetadata`. Only `admin` and `superadmin` (`ADMIN_ROLES`) pass;
everyone else gets 403 `{ error, path }`. If the Clerk lookup throws, the request fails
closed with a 500.

**What you must do:** nobody passes the gate until you grant a role: Clerk dashboard →
Users → `<user>` → Metadata → Public → `{ "role": "admin" }`. Roles live per Clerk
instance, so re-grant them after a dev → prod switch. To gate another route, mount
`requireAdmin` the same way, after `requireAuth`. Do not swap it for a
`sessionClaims.metadata` check unless you have customized the session token in the Clerk
dashboard to include it; without that the claim is absent.

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

## Clerk hardening (defense in depth)

- **Only Clerk session tokens pass.** `@hono/clerk-auth` verifies every Clerk token type
  (`acceptsToken: 'any'`, not configurable), so `requireAuth` also requires
  `tokenType === 'session_token'`. A Clerk OAuth access token, API key or M2M token sent as
  `Authorization: Bearer` gets 401 even though it carries a `userId`. Machine clients need a
  separate M2M path (the integration-API design), not this gate.
- **Scope the session to your origin(s).** `clerkMiddleware()` in `src/server/index.ts`
  passes `authorizedParties` from the `AUTHORIZED_PARTIES` var in `wrangler.jsonc`: a
  comma-separated list of origins, filled by `node setup.mjs --origin https://<your-app-domain>`.
  Local dev origins go in `.dev.vars` (setup writes `<origin>,http://localhost:5173`). Clerk
  rejects a session token whose `azp` claim names an origin that is not in the list. List
  **every** hostname that serves the app (custom domain, plus
  `https://<worker>.<account-subdomain>.workers.dev` if you use it — exact origins; no wildcards).
  Each entry is reduced to its origin (host lowercased; trailing slash, path and default
  port dropped), so
  `https://App.example.com/` matches `https://app.example.com`.
  **Limit:** Clerk omits `azp` when the Frontend API request had no `Origin`, or an empty or
  `null` one (native or mobile SDKs, plain HTTP clients, browsers that send `Origin: null`),
  and such a token is not origin-checked. Requiring `azp` would sign those browser users out
  in a 401 loop, so the template does not. If that matters, keep one app per Clerk instance
  (only the instance owner can add apps to it).
  The Worker **fails closed**: an empty or placeholder (`REPLACE_WITH_YOUR_ORIGIN`) value, or
  an entry that is not a concrete http(s) origin (`localhost:5173` without a scheme, `mailto:…`,
  `ws://…`, a `*.workers.dev` wildcard, a trailing-dot host, an unparseable entry),
  makes every protected `/api/*` route return 500, with a log line ending in
  `AuthorizedPartiesUnset`, while `/api/health` stays 200. A well-formed but wrong origin
  (misspelled host, missing dev port) is not caught: its symptom is every signed-in user
  being signed out in a loop.
- **Keep every state-changing route off GET.** `csrf()` from `hono/csrf` runs on `/api/*` and
  answers a cross-site POST/PUT/PATCH/DELETE with a form-type or missing Content-Type with 403
  `{ error, path }`. JSON requests are left to the browser's CORS preflight (the API sends no
  CORS headers), and Clerk's `__session` is `SameSite=Lax`. A state-changing GET route bypasses
  all of that. Non-browser callers (scripts, curl) must send `Content-Type: application/json`:
  a body-less DELETE/POST with no `Origin` and no Content-Type gets 403.
- **Ship on a Clerk _production_ instance**, not a `pk_test_…` development instance —
  dev instances have a different cookie / cross-domain / bot-protection posture. See
  [`secrets.md`](./secrets.md) for where each key goes (`pk_live_…` in `.env.local` and as
  the Worker secret via `wrangler secret put CLERK_PUBLISHABLE_KEY`, not in `wrangler.jsonc`
  `vars`; `sk_live_…` via `wrangler secret put` only).
- **Decide the sign-up posture deliberately.** A production Clerk instance defaults to open
  self-sign-up. If your Users directory (H1) or any per-user data is staff-only, restrict
  sign-up (allowlist / invitation) under Clerk → **User & Authentication → Restrictions**.

## Error responses and logs

- Every `/api` error is `{ error, path }` with its real status (400, 401, 403, 404, 500),
  never Hono's plain-text body. `onApiError` in `src/server/errors.ts` is the terminal handler.
- The `error` message comes from the server-only catalog in `src/server/i18n.ts`, English or
  Hebrew by the `dir` cookie. `src/client` must never import it.
- An invalid body, malformed JSON, or a JSON route called with a non-JSON or missing
  Content-Type returns 400 via `v` from `src/server/validator.ts`, never Zod issues, field
  names or echoed values. The Content-Type check matters: hono hands the schema `{}` for a
  non-JSON body, and a schema with defaults (like `settingsSchema`) would accept it and
  overwrite stored data. The guard covers only the non-JSON case: a JSON `{}` is still a
  valid full-replace PUT (see docs/data-layer.md). ESLint blocks importing
  `@hono/zod-validator` directly in `src/server`, so a new route has to use `v`.
- Unexpected errors log ONE line: `status METHOD path ErrorClass`. Never log the message,
  stack, query string or body: Drizzle puts bound parameters (user data) in its messages.

## Client session, redirects and cookies

- A server 401 signs the user out once per page load (`endSession` in
  `src/client/lib/session.ts`) and sends them to sign-in with a return path to their page,
  instead of looping between the guard and a rejected API. A sign-out that fails (Clerk
  unreachable) is forgotten, so the next 401 tries again.
- The sign-in `redirect` parameter goes through `safeRedirect`
  (`src/client/lib/safe-redirect.ts`): same-origin targets only, and it returns the parsed
  path (pathname + search + hash), never the raw input.
- A failed refetch keeps the data already on screen and shows a toast; only a 5xx with nothing
  on screen opens `/500`.
- Preference cookies are read through `getCookieOf` allow-lists (`src/client/lib/cookies.ts`),
  so a tampered cookie can only pick a known value.
- Data hooks must throw `new HttpError(res.status, …)` (`src/client/lib/http-error.ts`) on
  `!res.ok`. That status is what the 401 sign-out and the keep-data rule key on.

## SPA security headers (`public/_headers`)

Workers Static Assets sends the headers in `public/_headers` with the SPA HTML (`/` and
deep links such as `/dashboard`) and every static asset:

- **An enforced Content-Security-Policy** (not report-only). Scripts may come only from the
  app itself, your Clerk Frontend API host and Clerk's bot-protection hosts
  (`challenges.cloudflare.com`, `*.protect.clerk.com`); there is no `'unsafe-inline'` or
  `'unsafe-eval'` in `script-src`. `setup.mjs` decodes the Frontend API host from your
  publishable key and writes it into `script-src` and `connect-src`; without a key the
  `REPLACE_WITH_YOUR_CLERK_FAPI_HOST` placeholder stays and setup lists it as outstanding.
  Images allow `img.clerk.com`, fonts are self-hosted from the app's own origin (fontsource
  packages bundled by Vite) so `font-src` is `'self'`, `style-src` allows inline
  styles (the Bklit charts' motion animations and Clerk's components need them), and `worker-src` allows
  `blob:`. `clerk-telemetry.com` is used only by Clerk development instances.
- **Frame denial:** `frame-ancestors 'none'` plus `X-Frame-Options: DENY`.
- **HSTS:** `max-age=31536000` (one year) without `includeSubDomains` or `preload`, so a
  fork's custom domain never forces HTTPS onto the owner's other subdomains. Adding them is a
  per-fork choice: change `public/_headers` and the `secureHeaders` call in
  `src/server/index.ts` together.

To allow a new third-party origin (an analytics script, an image CDN, an embedded frame), add
it to the matching directive and check the page with `pnpm preview`. **`pnpm dev` does not
apply `_headers`**, so a CSP problem shows up only in `pnpm preview` or after deploy.

`/api/*` responses come from the Worker, so `_headers` never applies to them. Their headers
come from Hono `secureHeaders` in `src/server/index.ts` (same HSTS, no CSP on JSON).

The `/chats` demo avatars load from `randomuser.me`, which `img-src` blocks on purpose: they
fall back to initials. Delete the demo, or add the host to `img-src` in your fork.

## Secrets

- **Generate production secrets fresh — never reuse local `.dev.vars` values.** This applies
  to `CLERK_SECRET_KEY`. Anyone who obtains a reused dev secret (clone, backup, laptop) can
  forge sessions against production. Set every production secret with `wrangler secret put`.
- The publishable key is no longer in `wrangler.jsonc`: it is set as the Worker secret
  `CLERK_PUBLISHABLE_KEY` and lives locally in `.env.local` / `.dev.vars`. The D1/KV
  resource IDs in `wrangler.jsonc` are non-secret (opaque without account credentials), but
  a fork should still fill in its own.

---

## Before you go live — checklist

- [ ] Decided single-tenant vs multi-user. If multi-user: applied **H2** (owner-scope
      items/settings) before storing per-user data, and granted `admin` to the staff who
      need the Users directory (**H1**).
- [ ] On a Clerk **production** instance; sign-up posture chosen.
- [ ] `AUTHORIZED_PARTIES` lists your production origin(s) (`setup.mjs --origin`), not the
      placeholder.
- [ ] All production secrets independently generated and set via `wrangler secret put`
      (none reused from `.dev.vars`).
- [ ] `pnpm run deploy` refuses a bundle without your live key, or with a `pk_test_` key
      unless `ALLOW_TEST_CLERK_KEY=1` (no stale dev key shipped).
- [ ] Custom domain set via `setup.mjs --custom-domain` (workers.dev and preview URLs off).

## What's already solid (don't re-audit these)

Verified secure by the audit, so you can spend your review time elsewhere: the documented
auth ordering (no bypass; `getAuth().userId` is signature-verified and unforgeable),
mass-assignment (Zod whitelists, no `.passthrough()`, server-minted ids/timestamps), SQL
injection surface (Drizzle parameterized only; pagination capped), client XSS surface
(validated sign-in redirect, hardcoded embed allowlist), and the CI secret-scan gate
(gitleaks + grep; `sk_` shapes fail the build).
