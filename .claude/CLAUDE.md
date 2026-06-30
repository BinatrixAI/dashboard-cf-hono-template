<!-- GSD:project-start source:PROJECT.md -->

## Project

**dashboard-cf-hono-template**

A brand-neutral, reusable **GitHub Template repository** that becomes the starting point for every future Binatrix dashboard or simple site. It ships a complete Cloudflare-native stack — a Vite + React SPA (satnaing/shadcn-admin base: TanStack Router, shadcn/ui, Tailwind, RTL/Hebrew) served as static assets from a Cloudflare Worker, with a Hono API on the same runtime, backed by D1 + KV, Clerk auth, and a dormant Cron→Queues→Resend async layer. New projects are created via "Use this template" plus an interactive setup script that renames the worker/package/bindings, swaps in a per-project tweakcn theme, and prints the secrets/D1 checklist.

**Core Value:** A developer can spin up a new, correctly-wired, deployable Cloudflare dashboard project from this template in minutes — not by hand-editing scattered config and find-replacing a brand name.

### Constraints

- **Tech stack**: Cloudflare Workers · Hono · D1 · KV · Vite/React/TanStack Router · shadcn/ui · Tailwind · Clerk · Queues · Cron Triggers · Resend · tweakcn — Final per the handoff; build against them, do not substitute.
- **Repo structure**: Must be a standalone git repo (was initially nested under `~/.git`; reinitialized as its own repo on `main`) so it can be a clean GitHub Template repository.
- **Templating**: No real account-specific secrets or resource IDs may be committed; all per-project values come from the setup script + example files.
- **Auth split**: Dashboard uses Clerk (human auth); the integration API module uses M2M/service auth in a closed perimeter — distinct auth models, do not conflate.
- **Modularity**: Async layer and integration API must be removable/optional without breaking the core dashboard.
- **Security**: Closed-perimeter posture for the integration API; secrets via wrangler secrets, never git.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## TL;DR — Resolved Decisions

| Deferred question | Decision | Confidence |
|---|---|---|
| satnaing/shadcn-admin: Clerk integrated? | **Yes, partially** — ships `@clerk/react@^6`, sign-in/sign-up routes + user-button wired; route protection is per-project to finish | HIGH |
| Layout: single-package vs monorepo | **SINGLE-PACKAGE** (`src/` SPA + `worker/` API, one `wrangler.jsonc`) — Cloudflare's own 2026 reference layout | HIGH |
| Tailwind v3 or v4 | **v4** — the base already ships Tailwind 4 via `@tailwindcss/vite` | HIGH |
| How SPA is served alongside Hono | Workers **Static Assets** + `not_found_handling:"single-page-application"` + `run_worker_first:["/api/*"]`; Hono owns only `/api/*`, the platform serves assets for free | HIGH |
| Package manager | **pnpm** (base ships `pnpm-lock.yaml`, README uses `pnpm`) | HIGH |
| Integration-API base | **Plain Hono Worker starter** (same Hono + `@hono/zod-validator` + Drizzle/D1), NOT a framework | HIGH |
| Integration-API M2M auth | **Layered: Cloudflare Access service tokens (perimeter) + hashed API key in KV (app layer)**; HMAC for replay-sensitive inbound webhooks | MEDIUM |

## Recommended Stack

### Core Technologies

| Technology | Version (pin) | Purpose | Why Recommended |
|------------|---------------|---------|-----------------|
| Cloudflare Workers | runtime (compat date `2026-06-01`+) | Single runtime for SPA assets + API + cron/queues | Locked. One deploy target; SPA assets served at edge for free, API on same isolate. |
| Hono | `^4.12.27` | API framework on Workers | Locked. De-facto Workers HTTP framework; tiny, Web-standard `Request`/`Response`, first-class CF bindings typing. |
| Vite | `^8.0.8` (`8.1.0` latest) | Frontend build/dev | Comes with the base; Vite 8 + `@cloudflare/vite-plugin` runs the Worker in the real workerd runtime during `dev`. |
| `@cloudflare/vite-plugin` | `^1.42.3` | Unifies Vite SPA build + Worker in one dev server/build | **This is the glue.** Lets `pnpm dev` run SPA HMR and the Hono Worker together in workerd; `pnpm build` emits assets + worker. Preferred over legacy `wrangler dev` + separate Vite. |
| React | `^19.2.5` (`19.2.7` latest) | UI | Base ships React 19; required by current shadcn/Radix versions. |
| `@tanstack/react-router` | `^1.168.22` (`1.170.x` latest) | Type-safe SPA routing | Base default; file-based routes via `@tanstack/router-plugin`. |
| `@tanstack/react-query` | `^5.99.0` | Server-state/data fetching | Ships in base; standard pairing for API calls + caching. |
| Tailwind CSS | `^4.2.2` (`4.3.x` latest) | Styling | **v4**, via `@tailwindcss/vite` (no `tailwind.config.js`/PostCSS chain). tweakcn exports v4 `@theme`/CSS-variable tokens. |
| shadcn/ui (CLI) | `shadcn@^4.12.0` | Component generator/registry | Use the `shadcn` CLI (not the deprecated `shadcn-ui`). Base vendors components already; CLI for adding more + tweakcn registry. |
| Clerk (frontend) | `@clerk/react@^6.4.3` (`6.11.x` latest) | Human auth in the SPA | **New unified package** (`@clerk/react` v6 supersedes `@clerk/clerk-react` v5). Already a dependency of the base. |
| Clerk (Worker/edge) | `@hono/clerk-auth@^3.1.1` (wraps `@clerk/backend@^3.8.4`) | Verify Clerk session in Hono | Edge-safe middleware; injects a Clerk client + auth() into Hono context. Use this, not Node-only Clerk SDKs. |
| D1 | binding | Relational data | Locked. SQLite at edge; pair with Drizzle. |
| KV | binding | Key-value / cache / API-key store | Locked. Fast eventually-consistent reads; also the integration-API key store. |
| Wrangler | `^4.105.0` | CLI: dev/deploy/migrations/secrets/types | Locked tooling. v4 required for current static-assets + `wrangler types`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Drizzle ORM | `drizzle-orm@^0.45.2` + `drizzle-kit` | Typed D1 schema + SQL migrations | **Recommended** for the D1 schema/migration workflow (typed, generates migrations consumed by `wrangler d1 migrations apply`). Alternative: raw `wrangler d1 migrations` SQL if you want zero ORM. |
| `@hono/zod-validator` | `^0.8.0` | Request validation in Hono | Both Workers; validates body/query/params against Zod schemas. Base already ships `zod@^4`. |
| Zod | `^4.3.6` | Schemas (shared client+server) | Already in base. Share schemas between SPA forms and API. |
| Resend | `resend@^6.16.0` | Outbound email | Locked. Called from the Queue consumer (async layer) and from the integration-API outbound dispatch. **Dormant by default.** |
| `hono-rate-limiter` | `^0.5.3` | Rate limiting integration-API ingress | Use in the integration-API Worker (KV/DO-backed) to protect inbound endpoints. |
| `@cloudflare/workers-types` | `^4.20260627.1` | Types | Prefer `wrangler types` (generates `worker-configuration.d.ts` from your bindings) over hand-importing; keep this as fallback. |
| tweakcn | web tool @ tweakcn.com (+ shadcn registry) | Theme generation | **Not an npm dependency.** Generate theme on tweakcn.com → export Tailwind v4 CSS variables → paste into `src/styles/index.css` → commit the exported preset JSON. Optionally `npx shadcn@latest add <tweakcn-registry-url>`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Package manager | **Confirmed**: base ships `pnpm-lock.yaml`; README uses `pnpm install` / `pnpm dev`. Set `packageManager` field + commit lockfile. |
| Node.js 22 LTS (or 24) | Local toolchain for Vite/Wrangler | Vite 8 needs Node `^20.19 || >=22.12`; Wrangler 4 needs Node 18+. Base uses `@types/node@^25`. **Pin Node 22 LTS** in `.nvmrc` + Workers Builds config for reproducibility. |
| Vitest + `@cloudflare/vitest-pool-workers` | API/Worker unit + integration tests | `vitest@^4.1.4` + `@cloudflare/vitest-pool-workers@^0.16.20`. Runs tests **inside workerd** with real D1/KV/Queue binding mocks via `env`. This is the locked test harness for the API. |
| Vitest browser mode (base default) | SPA component tests | Base ships `@vitest/browser-playwright`. Optional for the template; keep for component coverage, but the **API** must use the workers pool. |
| `wrangler types` | Generate binding types | Run in CI + a `postinstall`/`predev` hook so `Env` stays in sync with `wrangler.jsonc`. |
| Cloudflare Workers Builds | CI/CD auto-deploy on push | Locked. Connect repo; build cmd `pnpm build`, deploy via wrangler. Separate build config per Worker (main + integration-API). |
| GitHub Actions | typecheck + lint + test gate | Locked. `tsc -b`, `eslint`, `vitest run` (workers pool) on PR; Workers Builds handles deploy. |

## How It Fits Together (verified against Cloudflare docs)

## Decision: SINGLE-PACKAGE (not monorepo)

- It is **Cloudflare's own 2026 reference layout** for "React SPA + API on one Worker" (`src/` + `worker/`, one `wrangler.jsonc`). Matching it means the `@cloudflare/vite-plugin` works out-of-the-box and docs/examples apply directly.
- The SPA and API ship as **one deploy artifact** (assets + worker). A monorepo split implies two deploys for what is one Worker — needless ceremony.
- `satnaing/shadcn-admin` is itself a single package; vendoring it into `apps/web` would fight its layout (paths, `components.json`, Vite config).
- A template optimizes for "clone → understand fast." One `package.json`, one lockfile, one `pnpm dev` is the lowest-friction onboarding.
- The optional **integration-API is a genuinely separate Worker** (own `wrangler.jsonc` + own Workers Builds config) living in a subdirectory — you get perimeter isolation without paying the monorepo tax for the common case. It shares `shared/` and the D1/KV bindings by configuration, not by workspace plumbing.

## Integration-API Module — Base + Auth

### Base: plain Hono Worker (not a framework)

### M2M / closed-perimeter auth — layered recommendation

| Pattern | What it is | Tradeoffs | Verdict |
|---|---|---|---|
| **Cloudflare Access service tokens** (Zero Trust) | n8n sends `CF-Access-Client-Id` + `CF-Access-Client-Secret`; Cloudflare validates at the **edge before the Worker runs** | Strongest isolation (rejected traffic never hits your code/bill); central rotation in Zero Trust; **requires** Zero Trust setup; n8n stores token in an HTTP Header credential (documented, mild community friction) | **Primary — perimeter layer** |
| **Hashed API key in KV** | Caller sends `Authorization: Bearer <key>`; Hono middleware hashes + looks up in KV (store only SHA-256, never plaintext) | Simplest, portable, no Zero Trust dependency; you own rotation/revocation (delete KV entry); app-managed | **Secondary — app layer (defense in depth)** |
| **HMAC-signed requests** | Caller signs `timestamp + body` with a shared secret; server verifies + rejects stale timestamps | Replay protection + integrity; more client complexity | Use for **replay-sensitive inbound webhooks** only |
| **mTLS** | Client certificate auth | Highest assurance; operationally heavy (cert lifecycle), n8n support awkward | Skip unless a partner mandates it |

### How n8n authenticates to it

### Outbound connector patterns

- **Zoho CRM:** OAuth2 **refresh-token** flow. Store the long-lived refresh token as a `wrangler secret`; exchange for a short-lived access token; **cache the access token in KV with a TTL** (~55 min) to avoid re-minting per request. Region-aware base URLs (`.com`/`.eu`/etc.).
- **Monday.com:** GraphQL API with a **personal/API token** → simple `Authorization: <token>` bearer header; token in `wrangler secret`.
- **Resend:** API key in `wrangler secret`; reuse the same Resend client as the dormant async layer.

## Installation

# Package manager

# Core (already in the satnaing base — listed for the template's own additions)

# Dev / tooling

# Frontend base already provides: react@19, vite@8, @tanstack/react-router,

# @tailwindcss/vite, tailwindcss@4, @clerk/react@6, shadcn components.

# Components / theme

# theme: generate on tweakcn.com -> export Tailwind v4 CSS vars -> src/styles/index.css

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Single-package (`src/`+`worker/`) | pnpm monorepo (`apps/web`+`apps/api`) | Only if SPA and API need different deploy targets, or multiple apps share packages |
| `@cloudflare/vite-plugin` | Separate `vite build` + `wrangler dev` + manual asset wiring | Legacy; avoid — the plugin gives real-runtime dev + unified build |
| Drizzle ORM for D1 | Raw `wrangler d1 migrations` SQL | If you want zero ORM/codegen and hand-written SQL |
| Cloudflare Access service tokens | App-only API keys in KV | If Zero Trust isn't available on the account/plan; then rely on KV keys + HMAC |
| `@hono/clerk-auth` (edge) | Manual JWT verification of Clerk session token | If you want to drop the dependency and verify the Clerk JWT yourself via JWKS |
| Plain Hono integration-API | Dedicated API framework / second runtime | Never for this template — keep one stack |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@clerk/clerk-react` (v5) | Superseded by the unified `@clerk/react` v6, which the base already uses | `@clerk/react@^6` |
| `shadcn-ui` CLI (old name) | Deprecated; renamed | `shadcn` CLI (`pnpm dlx shadcn@latest`) |
| Tailwind v3 + `tailwind.config.js` + PostCSS | Base is Tailwind v4 (`@tailwindcss/vite`, CSS-first `@theme`); mixing v3 config breaks tweakcn exports | Tailwind v4 via `@tailwindcss/vite` |
| Cloudflare **Pages** for the SPA | Pages is in maintenance posture for new full-stack apps; can't co-host the Hono API on one runtime | Workers Static Assets (single Worker) |
| Node-only Clerk/Express SDKs in the Worker | Won't run on workerd / heavy `nodejs_compat` surface | `@hono/clerk-auth` + `@clerk/backend` (edge-safe) |
| Hono `serveStatic` for the whole SPA | Workers Static Assets serves assets at the edge for free, before the Worker | `assets` binding + `run_worker_first:["/api/*"]` |
| npm/yarn for this repo | Base is pnpm; lockfile + workspace assumptions | pnpm (commit `pnpm-lock.yaml`) |

## Stack Patterns by Variant

- Ship only the main Worker. Leave async layer commented and omit `integration-api/`.
- Clerk optional; D1/KV can stay minimal.
- Enable the dormant Cron → Queues → Resend layer in `wrangler.jsonc` (uncomment `triggers.crons`, `queues.producers/consumers`) and the example consumer.
- Enable `integration-api/` as a second Worker with its own Workers Builds config.
- Turn on Cloudflare Access service tokens for the perimeter + KV API keys; add Zoho/Monday/Resend outbound connectors.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `vite@8` | Node `^20.19 \|\| >=22.12` | Pin Node 22 LTS in `.nvmrc` + Workers Builds |
| `react@19` | `@clerk/react@6`, shadcn/Radix current | Base is built on React 19 throughout |
| `tailwindcss@4` | `@tailwindcss/vite@4`, tweakcn v4 exports | No `tailwind.config.js`; CSS-first `@theme` |
| `@hono/clerk-auth@3` | `hono@>=3` (use `hono@4`), `@clerk/backend@3` | Edge-safe; pair with `@clerk/react@6` on client |
| `@cloudflare/vitest-pool-workers@0.16` | `vitest@^4`, `wrangler@4` | Runs tests in workerd with binding mocks |
| `@cloudflare/vite-plugin@1.42` | `vite@8`, `wrangler@4` | Unified dev+build for SPA + Worker |

## Sources

- `https://raw.githubusercontent.com/satnaing/shadcn-admin/main/package.json` — base v2.2.1 exact deps (Clerk `@clerk/react@^6`, Vite 8, React 19, Tailwind 4, TanStack Router 1.168, Vitest 4) — HIGH
- `https://raw.githubusercontent.com/satnaing/shadcn-admin/main/README.md` — RTL approach, "Auth (partial): Clerk", 10+ pages, pnpm — HIGH
- `https://raw.githubusercontent.com/satnaing/shadcn-admin/main/pnpm-lock.yaml` (HTTP 200; npm/yarn/bun lockfiles 404) — package manager = pnpm — HIGH
- npm registry live queries — hono 4.12.27, wrangler 4.105.0, @cloudflare/vitest-pool-workers 0.16.20, @clerk/react 6.11.1, @clerk/backend 3.8.4, @hono/clerk-auth 3.1.1, resend 6.16.0, @cloudflare/vite-plugin 1.42.3, shadcn 4.12.0, drizzle-orm 0.45.2, @cloudflare/workers-types 4.20260627.1 — HIGH
- `https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/` — SPA routing, `not_found_handling`, `run_worker_first` precedence — HIGH
- `https://developers.cloudflare.com/workers/framework-guides/web-apps/react/` — official single-package `src/`+`worker/` layout + `@cloudflare/vite-plugin` — HIGH
- `https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/` + n8n docs/community — service-token M2M pattern, n8n header-auth path — MEDIUM
- NotebookLM notebook `71b254d1-...` — **could not consult**: the NotebookLM MCP tools were not loaded in this session (no ToolSearch available to defer-load them). Cloudflare claims were instead verified against primary `developers.cloudflare.com` docs. Recommend a follow-up NotebookLM pass to cross-check D1/Queues/Cron specifics during phase planning.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
