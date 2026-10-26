# dashboard-cf-hono-template

<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/release/BinatrixAI/dashboard-cf-hono-template.svg?size=sm&amp;mode=dark"><img alt="Release" src="https://www.shieldcn.dev/github/release/BinatrixAI/dashboard-cf-hono-template.svg?size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/ci/BinatrixAI/dashboard-cf-hono-template.svg?variant=secondary&amp;size=sm&amp;mode=dark"><img alt="CI" src="https://www.shieldcn.dev/github/ci/BinatrixAI/dashboard-cf-hono-template.svg?variant=secondary&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Language · TypeScript" src="https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Bundler-Vite-646CFF.svg?logo=vite&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Bundler · Vite" src="https://www.shieldcn.dev/badge/Bundler-Vite-646CFF.svg?logo=vite&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Hosting-Cloudflare_Workers-F38020.svg?logo=cloudflare&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Hosting · Cloudflare Workers" src="https://www.shieldcn.dev/badge/Hosting-Cloudflare_Workers-F38020.svg?logo=cloudflare&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Stack-TanStack_Query-FF4154.svg?logo=reactquery&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="TanStack Query" src="https://www.shieldcn.dev/badge/Stack-TanStack_Query-FF4154.svg?logo=reactquery&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Stack-React-61DAFB.svg?logo=react&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="React" src="https://www.shieldcn.dev/badge/Stack-React-61DAFB.svg?logo=react&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>
<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/badge/Stack-Tailwind_CSS-06B6D4.svg?logo=tailwindcss&amp;variant=branded&amp;size=sm&amp;mode=dark"><img alt="Tailwind CSS" src="https://www.shieldcn.dev/badge/Stack-Tailwind_CSS-06B6D4.svg?logo=tailwindcss&amp;variant=branded&amp;size=sm&amp;mode=light"></picture>

**English** · [Русский](README.ru.md)

A brand-neutral, reusable **Cloudflare dashboard template**. One Cloudflare Worker
serves a **Vite + React SPA** (TanStack Router, shadcn/ui, Tailwind v4, bilingual
English ↔ Hebrew with an RTL-driven language switch)
as Static Assets and routes `/api/*` to a **Hono** API on the same runtime, backed
by **D1** + **KV**, with **Clerk** auth verified at the edge. Click **Use this
template**, run `setup.mjs`, create your resources, and deploy a correctly-wired
dashboard to Cloudflare in minutes.

> This repo ships with `__NAME__`-style sentinels and `REPLACE_WITH_YOUR_*`
> resource-ID placeholders — **no real secrets or account IDs are committed**.
> `setup.mjs` resolves the names for you; you fill the resource IDs after creating
> the D1/KV resources.

## Prerequisites

- **pnpm** `10.25.0` (the repo pins `packageManager` and commits `pnpm-lock.yaml`)
- **Node 22** (pinned in `.nvmrc`; Vite 8 needs Node `^20.19 || >=22.12`)
- A **Cloudflare account** (for `wrangler` + the D1/KV resources)
- A **Clerk application** (for the publishable + secret keys)

## Quickstart

> **Filling a new project?** Complete [`docs/deployment-intake.md`](docs/deployment-intake.md) first — every per-project value in deploy order — and pair it with [`setup.env.example`](setup.env.example) for a promptless `node setup.mjs --yes`.

### 1. Use this template

Click **"Use this template" → Create a new repository** on GitHub, then clone your
new repo and install:

```bash
pnpm install
```

### 2. Run the setup script

`setup.mjs` is a zero-dependency, one-shot parameterizer. It substitutes every
`__NAME__` identifier sentinel (worker/package/binding names) into your project's
values, generates `.dev.vars` from `.dev.vars.example`, records your module-toggle
choices, and prints a per-account resource checklist.

```bash
node setup.mjs            # interactive on a TTY
# or fully headless:
node setup.mjs --yes \
  --name my-dashboard \
  --app-name "My Dashboard" \
  --clerk-pk pk_test_your_publishable_key
```

Useful flags: `--d1-name`, `--kv-title`, `--theme`, `--dry-run` (preview without
writing), and `--force` (re-run after `.setup-complete` exists). The run **hard-fails
on any leftover identifier sentinel** and reports the `REPLACE_WITH_YOUR_*` resource
IDs as non-blocking outstanding actions — those you fill in step 3.

### 3. Create your Cloudflare resources

`setup.mjs` prints a copy-pasteable checklist with your chosen names interpolated.
It is exactly:

```bash
# 1. Create the D1 database, then paste the returned database_id into wrangler.jsonc
wrangler d1 create <your-d1-name>
#    → replace REPLACE_WITH_YOUR_D1_ID in wrangler.jsonc

# 2. Create the KV namespace, then paste the returned id into wrangler.jsonc
wrangler kv namespace create <your-kv-title>
#    → replace REPLACE_WITH_YOUR_KV_ID in wrangler.jsonc

# Set BOTH Clerk secrets before the first deploy — secret put creates the Worker
# if it does not exist yet (wrangler refuses to deploy with a required secret unset)
# 3. paste your sk_… key (never committed; .dev.vars leaves it empty)
wrangler secret put CLERK_SECRET_KEY
# 4. setup.mjs prints this line with your key filled in
echo <your pk_…> | wrangler secret put CLERK_PUBLISHABLE_KEY

# Then regenerate the binding types, migrate the remote D1 and deploy
# 5.
pnpm cf-typegen
# 6.
pnpm db:migrate:remote
# 7.
pnpm run deploy
```

Apply the database migration to each environment (they never sync — see
[`docs/data-layer.md`](docs/data-layer.md)):

```bash
pnpm db:migrate:local    # workerd/miniflare D1 (dev, tests, CI) — placeholder ID is fine
pnpm db:migrate:remote   # the real D1 — requires the real database_id first
```

### 4. Develop & deploy

```bash
pnpm dev                 # SPA HMR + the Hono Worker in workerd (@cloudflare/vite-plugin)
pnpm run deploy          # gated: migrations → gate → build → live key → wrangler deploy → readback + smoke
```

See [Gated deploy](#gated-deploy) for what each link refuses.

## Architecture overview

A **single Worker** is the whole deploy artifact — there is no separate frontend
host:

- **SPA as Static Assets.** The Vite/React build is served at the edge from the
  `ASSETS` binding. Unmatched non-asset requests rewrite to `index.html`
  (`not_found_handling: "single-page-application"`) for client-side routing.
- **Hono owns `/api/*`.** `run_worker_first: ["/api/*"]` forces those requests to
  the Worker (Hono) **before** the static-asset fallback; everything else is served
  as an asset for free.
- **D1 + KV bindings.** D1 (SQLite) is the relational store for the example `items`
  CRUD; KV holds the standalone app-settings blob. Both are declared in
  `wrangler.jsonc` with placeholder IDs. See [`docs/data-layer.md`](docs/data-layer.md).
- **Clerk at the edge.** `@hono/clerk-auth` verifies the Clerk session in the Worker;
  the SPA uses `@clerk/react`. Both the publishable and the secret key are
  `wrangler secret`s.
- **Dormant async layer.** A Cron → Queues → Resend path ships in `src/server/async/`
  (live + unit-tested); the platform wiring stays commented so a fresh fork deploys
  inert. Activate or remove it by following
  [`docs/async-layer.md`](docs/async-layer.md).

- **Bilingual UI (English ↔ Hebrew).** The LTR/RTL toggle is also the language
  switch — LTR renders English, RTL renders Hebrew — via `react-i18next` with both
  locales bundled and Clerk chrome localized (`heIL`). New UI strings go in both
  `en.json` and `he.json` (a parity test enforces it). See
  [`docs/i18n.md`](docs/i18n.md).

Theming is a per-project swap (tweakcn → Tailwind v4 oklch tokens), documented in
[`docs/THEMING.md`](docs/THEMING.md).

## Directory structure

Single-package layout — the SPA, the API, and their shared contracts live under
one `src/`, built and deployed as one Worker:

```
├── src/
│   ├── client/                 # Vite + React SPA (served as Static Assets)
│   │   ├── routes/             # TanStack file-based routes
│   │   │   ├── _authenticated/ #   Clerk-guarded pages (protected)
│   │   │   └── (auth)/         #   sign-in / sign-up (public)
│   │   ├── features/           # feature modules (items, dashboard, settings, …)
│   │   ├── components/         # shared UI; components/ui/ = vendored shadcn
│   │   ├── main.tsx            # ClerkProvider + router bootstrap
│   │   └── routeTree.gen.ts    # AUTO-GENERATED — never hand-edit
│   ├── server/                 # Hono API (owns /api/*)
│   │   ├── index.ts            # router registration = the auth-order contract
│   │   ├── routes/             # per-feature routers + colocated *.test.ts
│   │   ├── middleware/         # requireAuth (the edge gate)
│   │   ├── db/                 # Drizzle schema + queries
│   │   └── async/              # dormant Cron → Queues → Resend layer
│   └── shared/                 # Zod schemas + types imported by both tiers
├── migrations/                 # Drizzle-generated D1 SQL (+ committed meta/)
├── public/                     # static files copied verbatim into the build
├── scripts/                    # CI hygiene helpers (secret-grep, sentinel scan, smoke)
├── test/                       # Vitest workers-pool setup + migration helpers
├── docs/                       # the guides linked below
├── .claude/skills/dashboard-dev/  # Claude Code skill: extend-the-template recipes
├── wrangler.jsonc              # bindings, assets, run_worker_first
├── components.json             # shadcn config
├── .mcp.json                   # shadcn MCP server (dev-time)
└── setup.mjs                   # one-shot project parameterizer
```

## Module toggles

`setup.mjs` records your module intent to `.setup-config.json` (gitignored). It
records the choice only — it does **not** edit `wrangler.jsonc` this phase:

| Toggle              | Effect                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Async layer**     | Recorded now; activate the shipped dormant Cron → Queues → Resend layer via [`docs/async-layer.md`](docs/async-layer.md) |
| **Integration API** | **v2 no-op stub** — always recorded `false`; reserved for a future second Worker                                         |

## Working with this template (Claude Code skill)

This repo ships a **`dashboard-dev` Claude Code skill** at
[`.claude/skills/dashboard-dev/`](.claude/skills/dashboard-dev/SKILL.md). If you use
Claude Code (or any agent that reads `.claude/skills/`), it auto-activates when you ask
to add a page/route, a DB table + migration, an API endpoint, a shadcn component, or work
with secrets — and answers with the exact file paths + commands for **this** layout, then
points at the deep-dive guides below. It's the fastest way to learn the structure without
reading every doc. Not using an agent? The same recipes are in `docs/` (linked next).

## Documentation

Deep-dive guides live in [`docs/`](docs/):

- **[`docs/adding-pages.md`](docs/adding-pages.md)** — the core how-to: the
  4-file page anatomy and copy-paste recipes for public/protected pages, a
  data-backed page (full path), public API endpoints, KV data, and
  removing/renaming demo pages.
- **[`docs/ui-components.md`](docs/ui-components.md)** — the vendored shadcn/ui
  model, adding components via `pnpm dlx shadcn@latest add`, and the shadcn MCP.
- **[`docs/i18n.md`](docs/i18n.md)** — the English ↔ Hebrew i18n driven by the
  LTR/RTL toggle: the single switch point, the both-locales parity rule, the
  no-`t()`-at-module-scope convention, and what stays English (dates, charts).
- **[`docs/secrets.md`](docs/secrets.md)** — `.dev.vars` vs `wrangler secret put`
  vs `wrangler.jsonc` `vars` vs `VITE_*`, with a worked add-a-secret example.
- **[`docs/THEMING.md`](docs/THEMING.md)** — tweakcn + Tailwind v4 theming: the
  generate → export → commit workflow, light/dark mode, and how Clerk auth pages
  inherit the theme.
- **[`docs/data-layer.md`](docs/data-layer.md)** — D1 + KV: the schema → migration
  workflow (Drizzle + wrangler), `--local` vs `--remote`, and the KV settings store.
- **[`docs/async-layer.md`](docs/async-layer.md)** — the dormant Cron → Queues → Resend
  layer: activation (create queue + DLQ → uncomment wiring → `wrangler secret put
RESEND_API_KEY` → deploy) and the removal note.

## CI/CD + deploy

### Quality gate (GitHub Actions)

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests. It is
three parallel jobs and **holds no Cloudflare credentials — it never deploys**:

- **quality-gate** — `cf-typegen` → `typecheck` (`tsc -b`) → `lint` → `format:check`
  → `test` (Vitest workers pool against real D1/KV binding mocks, the guard tests for
  the design system, RTL icons, nav contract and CI config, and the jsdom
  `client-dom` project for `*.dom.test.tsx` component tests) → `build` →
  `node scripts/bundle-size.mjs`, which fails when gzipped initial or total JS grows
  past `CEILINGS` (raise it on purpose). `cf-typegen` regenerates the `Env` types and
  the job fails when the committed `worker-configuration.d.ts` is stale. Runs green on
  the un-`setup` template as-is.
- **secret-scan** — the MIT gitleaks binary (`.gitleaks.toml`) plus the auditable
  `scripts/secret-grep.sh`, and `scripts/gitleaks-selftest.sh`, which proves the
  gitleaks config still lets a `pk_` key pass and still fails an `sk_` key.
- **sentinel-scan** — scaffolds a `setup.mjs --yes` copy of the tree into a temp dir,
  then runs `scripts/ci-sentinel-scan.mjs` against it (never the template tree
  directly — the template legitimately still contains sentinels).

### Deploy (Cloudflare Workers Builds)

Deploy is a **separate path** from the quality gate. For v1 this template ships the
**build config + this documented procedure** — connecting a repo to Workers Builds is
a one-time manual step in the Cloudflare dashboard:

1. In the Cloudflare dashboard, go to **Workers & Pages → your Worker → Settings →
   Builds** and connect your GitHub repo.
2. Set the **build command** to `pnpm build` and the **deploy command** to
   `wrangler deploy`. (The `deploy` package script is the gated chain below; Workers
   Builds does not use it.)
3. Ensure the **Worker name matches `wrangler.jsonc` `name`** (the value
   `setup.mjs` set from `--name`), or Workers Builds will create/deploy the wrong
   Worker.

After this, a push to `main` builds and deploys automatically.

> **Workers Builds skips every gate.** It runs `wrangler deploy` directly — no
> migrations check, no quality gate, no live-key check, no readback. Before pushing to
> a connected branch, run `pnpm run deploy` (or at least `pnpm run gate` and
> `pnpm db:migrate:remote`).

### Gated deploy

`pnpm run deploy` is the gated path, and how the template's Definition of Done is
proven. Each link must pass before the next runs:

```bash
pnpm run deploy          # guard → migrations → gate → build → live key → wrangler deploy → readback + smoke
```

- **Guard** (`scripts/assert-run-deploy.mjs`) — refuses unless entered as
  `pnpm run deploy`. The bare `pnpm deploy` is pnpm's own workspace command, not this
  script, and would skip every gate.
- **Migrations** (`scripts/assert-migrations-applied.sh`) — refuses when the remote D1
  is missing a migration in `./migrations`, or when the remote state cannot be read.
  Fix: `pnpm db:migrate:remote`, then deploy again.
- **Gate** (`pnpm run gate`) — typecheck, lint, format:check, `scripts/secret-grep.sh`
  and the tests, over the whole tree. Also run it on its own before a publish.
- **Live key** (`scripts/assert-live-key.mjs`) — refuses a bundle that lacks your
  `VITE_CLERK_PUBLISHABLE_KEY` or carries any other `pk_` key, and refuses a
  `pk_test_` (development instance) key. To deploy a test instance on purpose:
  `ALLOW_TEST_CLERK_KEY=1 pnpm run deploy`.
- **Readback + smoke** (`scripts/deploy-verify.mjs`) — reads the live version back and
  smoke-tests it. The base URL is `BASE_URL`, else the custom-domain route, else the
  first `https` origin in `AUTHORIZED_PARTIES`. On failure it prints
  `npx wrangler rollback <version> --name <worker>` and exits 1. It never rolls back
  by itself, because a remote migration may already have run.

The first deploy to a new custom domain can fail the smoke while DNS and the
certificate settle. Wait a minute and re-run `node scripts/deploy-verify.mjs` before
deciding to roll back.

Set both Clerk secrets before the first deploy:
`wrangler secret put CLERK_SECRET_KEY` and
`echo <your pk_…> | wrangler secret put CLERK_PUBLISHABLE_KEY`. `secret put` creates
the Worker if it does not exist yet.

**Existing forks** that still carry `CLERK_PUBLISHABLE_KEY` as a plaintext `var`: run
`wrangler secret put CLERK_PUBLISHABLE_KEY` before the next deploy; that deploy drops
the old var.

## Troubleshooting

- **CI sentinel-scan fails on a leftover `__NAME__` sentinel.** You haven't run
  `setup.mjs` (or a new sentinel slipped in). Run `node setup.mjs` — it lists every
  `file:line` it can't resolve and hard-fails until they're all substituted.
- **`wrangler deploy` / `--remote` errors on `REPLACE_WITH_YOUR_D1_ID` (or the KV
  id).** Those are intentional placeholders. Run `wrangler d1 create` /
  `wrangler kv namespace create`, paste the returned `database_id` / `id` into
  `wrangler.jsonc`, then `pnpm cf-typegen`. (The placeholder is fine for all
  `--local` dev, tests, and CI — only `--remote`/production needs the real ID.)
- **401 / auth fails after deploy.** Both Clerk keys are Worker secrets. Check
  `wrangler secret list` shows `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`; set a
  missing one with `wrangler secret put <name>`.
- **Deploy refused at the migrations gate.** "MISSING migrations" → run
  `pnpm db:migrate:remote`, then `pnpm run deploy`. "could not read the remote
  migration state" → fix the read: `wrangler login`, the network, or the real
  `database_id` in `wrangler.jsonc`.
- **Deploy refused at the live-key gate.** Put your project's `pk_live_…` key in
  `VITE_CLERK_PUBLISHABLE_KEY` (`.env.local` or `.env.production.local`; the shell env
  wins) and deploy again. A `pk_test_` key ships only with
  `ALLOW_TEST_CLERK_KEY=1 pnpm run deploy`. "carries another pk_ key" means vite read a
  different env file than you expect.
- **A row written in dev is "missing" in production.** `--local` and `--remote` D1 are
  two databases that never sync — run `pnpm db:migrate:remote` (after filling the real
  `database_id`). See [`docs/data-layer.md`](docs/data-layer.md).

## Definition of Done

A throwaway project scaffolded from this template via `setup.mjs` deploys live to
Cloudflare and:

- [ ] **Auth loads** — the Clerk sign-in page renders at the deployed URL.
- [ ] **The Hono API responds** — `/api/*` returns from the Worker (e.g. the items or
      settings route).
- [ ] **A D1 read succeeds** — the example `items` data comes back from the deployed
      D1 database.
