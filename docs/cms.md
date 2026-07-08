# CMS Worker — Deploy & Hardening Guide

The optional **CMS Worker** lives in [`cms/`](../cms) and is a **separate,
self-contained Cloudflare Worker** from the dashboard. It runs
[SonicJS](https://sonicjs.com) (`@sonicjs-cms/core`, pinned exact to a beta) and
ships nothing to the dashboard by wire — the two Workers share no bindings, no
`package.json`, and no lockfile. A fork that does not want a CMS simply never
deploys `cms/`.

This guide is the operator runbook: deploy the CMS with **no 500s**, bootstrap
and **rotate** the admin, **disable + verify** open registration, optionally gate
`/admin` behind **Cloudflare Access**, and understand the shipped plugins and the
secret model.

> New to the template's secret rules first? Read [`docs/secrets.md`](secrets.md).
> The CMS follows the same "real secrets via `wrangler secret put`, sentinels in
> git" posture, scoped to its own Worker.

## Architecture — a second, isolated Worker

| Property        | Value                                                            |
| --------------- | --------------------------------------------------------------- |
| Package         | `cms/` (own `package.json` + `pnpm-lock.yaml`, no workspace tie) |
| Bindings        | `DB` (D1), `MEDIA_BUCKET` (R2), `CACHE_KV` (KV) — **literal names**, do not rename |
| Local dev port  | **8788** (`cd cms && pnpm dev`) — avoids the dashboard's 8787    |
| Entry           | `cms/src/index.ts` → `createSonicJSApp(...)`, `export default { fetch }` |
| Migrations      | package-owned SQL in `node_modules/@sonicjs-cms/core/migrations` |

SonicJS core reads its bindings **by literal name** at runtime
(`c.env.DB` / `c.env.MEDIA_BUCKET` / `c.env.CACHE_KV`), so — unlike the
dashboard's `__X_BINDING__` name-sentinels — the CMS binding **names stay
literal**. Only `database_name` / `database_id` / `bucket_name` / KV `id` are
`REPLACE_WITH_YOUR_CMS_*` sentinels in [`cms/wrangler.jsonc`](../cms/wrangler.jsonc).

## Secret model

Four values the CMS needs, and exactly where each one lives. No real secret or
resource id is ever committed — the template ships only empty
[`cms/.dev.vars.example`](../cms/.dev.vars.example) assignments and
`REPLACE_WITH_YOUR_CMS_*` id sentinels.

| Name                 | Kind                          | Where it lives                                    | Notes |
| -------------------- | ----------------------------- | ------------------------------------------------- | ----- |
| `BETTER_AUTH_SECRET` | **Runtime secret (required)** | `wrangler secret put` (prod) · `.dev.vars` (local) | Better Auth signing key. **Login 500s without it.** Must be ≥ 16 chars — `openssl rand -hex 32`. |
| `JWT_SECRET`         | **Runtime secret (required)** | `wrangler secret put` (prod) · `.dev.vars` (local) | Signs the layered JWT plugin's tokens. `openssl rand -hex 32`. |
| `ADMIN_EMAIL`        | **Seed-time shell env**       | your shell / `.dev.vars` at seed time             | Consumed once by `pnpm seed`. **Not** a runtime Worker secret — never `wrangler secret put` it. |
| `ADMIN_PASSWORD`     | **Seed-time shell env**       | your shell / `.dev.vars` at seed time             | Consumed once by `pnpm seed`. User-supplied, PBKDF2-hashed by the seed. **Not** a runtime secret. |

Non-secret Worker config (`ENVIRONMENT`, `CORS_ORIGINS`) stays as plaintext
`vars` in `cms/wrangler.jsonc`. Resource ids (`REPLACE_WITH_YOUR_CMS_D1_ID`,
`…_R2_BUCKET`, `…_KV_ID`) are sentinels you fill after creating the resources —
they are **not** secrets, but they are still never committed with real values.

> `ADMIN_EMAIL` / `ADMIN_PASSWORD` are the single most-confused pair here: they
> are read **once, at seed time, from your shell** — the deployed Worker never
> sees them. Do not add them to `wrangler.jsonc` and do not `wrangler secret
> put` them.

## Deploy runbook (no 500s)

Follow in order. The migrate step (5) **must** precede first traffic — the first
`/admin` load 500s with "no such table" if the schema was never applied.

### 1. Create the D1 / R2 / KV resources

R2 **must be enabled on the account first** — `wrangler deploy` fails without a
real `MEDIA_BUCKET`, R2 is mandatory for SonicJS media.

```bash
cd cms
wrangler d1 create <your-cms-db>          # → prints database_id
wrangler r2 bucket create <your-cms-media>
wrangler kv namespace create CACHE_KV     # → prints the KV id
```

### 2. Paste the ids into `cms/wrangler.jsonc`

Replace the sentinels with the real values from step 1:

- `database_name` → `<your-cms-db>`, `database_id` → the printed D1 id
- `bucket_name` → `<your-cms-media>`
- KV `id` → the printed KV id

(The binding **names** `DB` / `MEDIA_BUCKET` / `CACHE_KV` stay literal — only the
`REPLACE_WITH_YOUR_CMS_*` id fields change.)

### 3. Set the runtime secrets

```bash
wrangler secret put BETTER_AUTH_SECRET   # openssl rand -hex 32
wrangler secret put JWT_SECRET           # openssl rand -hex 32
```

For local dev, put the same two in `cms/.dev.vars` (gitignored) instead.

### 4. Configure the admin credentials (required pre-deploy)

See [Admin bootstrap](#admin-bootstrap-required) below — the seed **fails closed**
if `ADMIN_EMAIL` / `ADMIN_PASSWORD` are unset or still the sentinel, so set them
before you can seed.

### 5. Apply the migrations — before first traffic

The migrations are **package-owned** (shipped inside `@sonicjs-cms/core`, not
drizzle-generated); `cms/wrangler.jsonc` already points `migrations_dir` at them.

```bash
wrangler d1 migrations apply DB --local    # CI/dev gate — fails on a broken set
wrangler d1 migrations apply DB --remote    # production — non-optional, run this
```

`--local` is the CI/dev gate (fails the build on a broken migration set);
`--remote` is the real production apply and **must** run before the first
request. On first hit, SonicJS's bootstrap middleware seeds RBAC roles and
document types on top of the applied schema — so migrations first, then the
Worker is safe to serve.

> **Do not use `sonicjs-db-reset`.** Upstream's reset helper only supports a
> `.toml` config; this template is `.jsonc`. Use the **migrate + seed** flow
> documented here instead — it is the supported path for this fork.

### 6. Seed the admin, then deploy

```bash
pnpm seed -- --remote     # writes the admin against the deployed D1 (see below)
wrangler deploy
```

`pnpm seed` defaults to `--local`; pass `-- --remote` to target the deployed
database. Seed **after** the remote migrations (step 5) so the `auth_user` /
`auth_account` tables exist.

## Workers Builds (CI/CD auto-deploy) — a SECOND build config

The CMS Worker deploys from its own subdirectory, so a fork that wants
push-to-deploy needs a **second Workers Builds connection** — separate from the
main dashboard Worker's (whose Builds setup lives in the root [`README.md`](../README.md)).
Both connect the same GitHub repo; they differ only in root directory + build command.

In the Cloudflare dashboard → **Workers & Pages → the CMS Worker → Settings →
Builds → Connect / Configure**:

| Field | Value |
|-------|-------|
| Git repository | your fork of this template |
| **Root directory** | `cms` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` (or leave the build command empty if the Worker has no build step; the default `pnpm install` still resolves the `cms/` lockfile) |
| Deploy command | `pnpm dlx wrangler deploy` |

The `cms` root directory is the load-bearing setting: it scopes install +
deploy to `cms/pnpm-lock.yaml` + `cms/wrangler.jsonc`, isolated from the root
package (which pins a conflicting `drizzle-orm` major). This mirrors the
`cms-typecheck` CI job, which uses the same isolated lockfile.

CI itself holds no Cloudflare token and never deploys — Workers Builds is the
only deploy path, kept out of `.github/workflows/`.

### Keep `@sonicjs-cms/core` pinned (dependency bots)

`cms/package.json` pins `@sonicjs-cms/core` to the exact beta (`3.0.0-beta.24`,
no caret) — its schema/migrations must be re-verified by hand on every bump. The
repo ships a [`renovate.json`](../renovate.json) `packageRules` entry that
disables auto-updates for it. If your fork uses **Dependabot** instead of
Renovate, add the equivalent ignore to `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /cms
    schedule:
      interval: weekly
    ignore:
      - dependency-name: "@sonicjs-cms/core" # pinned beta; bump + re-verify migrations by hand
```

## Admin bootstrap (required)

There is **one** baked-in bootstrap path: the secrets-driven, fail-closed
[`cms/scripts/seed-admin.ts`](../cms/scripts/seed-admin.ts) (`pnpm seed`). The
upstream default `admin@sonicjs.com` credential exists **nowhere** in this
template and must never reach a deployed fork.

**1. Configure the credentials (required before first deploy).** The seed reads
`ADMIN_EMAIL` + `ADMIN_PASSWORD` from the shell and **refuses to run** (non-zero
exit, no DB write) if either is unset, empty, still a `REPLACE_WITH_YOUR_*`
sentinel, or contains a single quote:

```bash
export ADMIN_EMAIL='you@example.com'
export ADMIN_PASSWORD='a-long-passphrase-you-will-rotate'
```

**2. Run the seed.** It PBKDF2-hashes the password and writes one `auth_user`
(role `admin`) + one `auth_account` (`credential` provider):

```bash
cd cms
pnpm seed              # local D1 (default)
pnpm seed -- --remote  # deployed D1
```

**3. Rotate after first login.** The seeded password is a bootstrap credential.
**Log in once, then rotate it** from the admin profile. Never leave the initial
`ADMIN_PASSWORD` as the standing password, and never reuse it across forks.

## Disable open registration (required hardening)

On a fresh database `isRegistrationEnabled` defaults to **OPEN**. Because the
seed creates the admin *before* any HTTP request, the "first stranger becomes
admin" window never opens — but a stranger could still self-register an ordinary
account after the admin exists. **Disabling registration is a required step, not
a default.**

**Disable it:** in the Admin Panel go to **Authentication System settings** and
uncheck **"Allow User Registration"**.

**Verify it** against the deployed URL — the endpoint is `POST /auth/register`
(under `/auth`), and it returns **403** when registration is disabled:

```bash
CMS_URL=https://<your-cms-worker>.workers.dev
curl -s -o /dev/null -w '%{http_code}' -X POST "$CMS_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"probe@example.com","password":"abcd1234"}'
# expect: 403
```

> The verify path is `POST /auth/register` — under `/auth`, **not** an
> `/admin`-prefixed registration path. Only the `/auth` route enforces the
> toggle; hitting an admin-prefixed path does not gate and will mislead you.

A stronger optional follow-up is to have the seed also write the `core-auth`
plugin settings document with `registration.enabled=false` (fail-closed from the
start). It is fragile — the settings row may not exist until the first request
bootstraps plugins — so it is **not** the shipped path; the documented manual
toggle + 403 verify above is what this template ships.

## RBAC status — honest #791 / #453 writeup

Two SonicJS beta issues are relevant, and both are **fixed** in the pinned beta —
but read this before trusting `/admin` on a public URL:

- **#791 — any authenticated user could reach `/admin`.** **CLOSED / fixed.**
  `/admin` is now role-enforced (`requireRole("admin")` + `isAdmin` gates); an
  ordinary authenticated user no longer reaches the admin portal.
- **#453 — the registration toggle was not honored (new users became admin).**
  **CLOSED / fixed.** `POST /auth/register` now returns 403 when registration is
  disabled.

The remaining sharp edge is **not** a bug: registration still **defaults OPEN**
on a fresh DB, which is exactly why the [disable step](#disable-open-registration-required-hardening)
above is required hardening rather than a default. For a public or sensitive
fork, treat the built-in RBAC as necessary-but-not-sufficient and add the
Cloudflare Access perimeter below as belt-and-suspenders.

## Cloudflare Access recipe — gate `/admin` (strongly recommended for public forks)

This is a **documentation-only** hardening recipe (no code wiring this phase).
For any fork whose CMS is internet-reachable, putting Cloudflare Access in front
of `/admin` is the strongest perimeter — rejected traffic never reaches the
Worker. Copy-paste for a `*.workers.dev` fork:

1. **Zero Trust → Access → Applications → Add an application → Self-hosted.**
2. **Application configuration:**
   - Name: `CMS Admin`
   - Session duration: `24h` (your choice)
   - Application domain: `<your-cms-worker>.workers.dev`, path `/admin`
     (add a second entry for `/auth` if you also want to gate the login/register
     routes at the edge).
3. **Add a policy:**
   - Policy name: `Admins`
   - Action: `Allow`
   - Include → **Emails** → list the operator addresses (e.g. your `ADMIN_EMAIL`),
     or **Emails ending in** `@yourcompany.com` for a whole team.
4. **Save.** Cloudflare now challenges every `/admin` request with its login
   screen **before** the request hits the Worker; only matched identities pass.
5. **Verify:** open `https://<your-cms-worker>.workers.dev/admin` in a fresh
   private window — you should get the Cloudflare Access login, not the SonicJS
   admin, until you authenticate.

This layers on top of (does not replace) the built-in role checks and the
registration disable. It is strongly recommended for public forks but is **not**
a required step — a closed/internal deployment can rely on the built-in auth
plus the seeded-admin + registration-disable hardening above.

## Connect the dashboard (VITE_CMS_API_URL + CORS_ORIGINS)

The dashboard reads CMS content **cross-origin** — the two Workers share no
bindings, so wiring them is two runtime knobs, one on each side. The dashboard's
"CMS not configured" panel links here.

**1. Point the dashboard at the CMS — `VITE_CMS_API_URL`.** In the dashboard's
`.env.local`, set `VITE_CMS_API_URL` to the deployed CMS Worker origin:

```bash
VITE_CMS_API_URL=https://<your-cms-worker>.workers.dev
```

This single var drives everything CMS-related in the dashboard: content is
fetched from it cross-origin, and the sidebar's **CMS Admin** link is derived
from it as `${origin}/admin` (there is no separate admin var). When
`VITE_CMS_API_URL` is **unset**, the dashboard shows a **"CMS not configured"**
panel on the Content page and **hides** the CMS Admin sidebar link.

**2. Let the CMS accept the dashboard — `CORS_ORIGINS`.** The CMS Worker's
`CORS_ORIGINS` (in [`cms/wrangler.jsonc`](../cms/wrangler.jsonc)) is a
comma-separated **exact-origin allowlist**. Add the dashboard's own origin to it:

```jsonc
// cms/wrangler.jsonc → vars
"CORS_ORIGINS": "https://<your-dashboard>.workers.dev"
```

`CORS_ORIGINS` ships **empty**, and an empty allowlist rejects **every**
cross-origin request. Until you add the dashboard origin here, every dashboard
fetch is blocked and the Content page shows its **"Couldn't reach the CMS"**
error state — even with `VITE_CMS_API_URL` correctly set. Redeploy the CMS
(`cd cms && wrangler deploy`) after changing `CORS_ORIGINS`.

## The full loop — author → dashboard → public (SLICE-01)

This is the end-to-end proof that the CMS, the dashboard, and the public reader
are wired to the **same** `blog-posts` collection: one post authored once in
`/admin` surfaces in all three surfaces. It is a **documented** walkthrough —
the actual live run folds into the single project-wide end-to-end UAT after all
phases (per the established pattern), not a per-phase live execution.

The whole loop rides on **one** collection, `blog-posts`. `/admin` writes it, the
dashboard Content page reads it, and the public `/blog` routes render it — three
readers of a single source of truth.

**1. Author — write a post in the CMS `/admin`.** Sign into the CMS admin
(`https://<your-cms-worker>.workers.dev/admin`, the same origin as
`VITE_CMS_API_URL`), create a `blog-posts` entry with a **title**, a **`slug`**
(pretty, shareable — e.g. `hello-world`), and **body** content, then set its
**`status` to `published`**. Only `status=published` posts are readable by the
unauthenticated dashboard and public fetches — a draft stays invisible until you
publish it.

**2. Dashboard — the post appears on the authenticated Content page.** Open the
dashboard's Clerk-gated Content page (route `_authenticated/content`, URL
`/content`); the published post shows up in the read-only content list. This leg
depends on the cross-origin wiring — it works only once **both**
`VITE_CMS_API_URL` (dashboard → CMS origin) and `CORS_ORIGINS` (CMS → dashboard
origin) are set per [Connect the dashboard](#connect-the-dashboard-vite_cms_api_url--cors_origins)
above. Until that wiring is in place the Content page shows its "CMS not
configured" / "Couldn't reach the CMS" state instead of the post.

**3. Public — the post renders on the Clerk-free `/blog` reader.** With **no
sign-in at all**, open the public reader:

- `/blog` — the index shows the post as a **reader card** (title + published date
  + a short plaintext excerpt of the body).
- `/blog/$slug` — the post page (keyed on the post's `slug`, falling back to its
  `id` when a post has no slug) shows the **full post body**.

`/blog` is served **outside** `_authenticated/` and reads the CMS origin
**directly** (the same credential-free cross-origin seam as the dashboard fetch).
It **never** traverses the dashboard's Clerk-gated `/api/*` and **never** hits the
Clerk gate — an anonymous visitor with no session reads published content
straight from the CMS. (No new `CORS_ORIGINS` entry is needed for this leg: `/blog`
ships from the same dashboard Worker origin the Content page already fetches from,
so if leg 2 works, leg 3 works.)

That closes the loop: one `blog-posts` post authored in `/admin`, read back on the
authenticated dashboard, and rendered on the public Clerk-free `/blog` reader. The
**live** end-to-end run of these three legs is deferred to the single project-wide
end-to-end UAT after all phases — this section is the documented proof of the loop.

## Shipped plugins

The CMS entry enables exactly two upstream plugins (upstream's three demo
plugins/collections are trimmed for brand-neutrality). Both are zero-build-cost
differentiators:

- **`redirectPlugin`** — a `DefinedPlugin` const (registered, not called) that
  serves managed URL redirects out of the CMS. Lets editors maintain redirects
  (moved posts, vanity URLs) from the admin without a code deploy.
- **`mcpPlugin()`** — a factory (called) that exposes the CMS content over the
  **Model Context Protocol**, so an AI agent/assistant can read collections
  through a standard MCP surface. Ships enabled with safe defaults.

Both are registered in [`cms/src/index.ts`](../cms/src/index.ts) via
`createSonicJSApp({ plugins: { register: [redirectPlugin, mcpPlugin()] } })`.
Neither declares a cron, so the Worker's default export is `{ fetch }` only.
