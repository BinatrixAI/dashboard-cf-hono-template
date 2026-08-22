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

## Decision: SINGLE-PACKAGE (not monorepo)

- It is **Cloudflare's own 2026 reference layout** for "React SPA + API on one Worker" (`src/` + `worker/`, one `wrangler.jsonc`). Matching it means the `@cloudflare/vite-plugin` works out-of-the-box and docs/examples apply directly.
- The SPA and API ship as **one deploy artifact** (assets + worker). A monorepo split implies two deploys for what is one Worker — needless ceremony.
- `satnaing/shadcn-admin` is itself a single package; vendoring it into `apps/web` would fight its layout (paths, `components.json`, Vite config).
- A template optimizes for "clone → understand fast." One `package.json`, one lockfile, one `pnpm dev` is the lowest-friction onboarding.
- The optional **integration-API is a genuinely separate Worker** (own `wrangler.jsonc` + own Workers Builds config) living in a subdirectory — you get perimeter isolation without paying the monorepo tax for the common case. It shares `shared/` and the D1/KV bindings by configuration, not by workspace plumbing.

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
