# Deployment Intake

This is the value checklist you complete **before** starting a new fork so the
deploy works first time — one place to gather every per-project value, know
where it lands, and who fills it (the `setup.mjs` script vs. your hands). Pair it
with [`setup.env.example`](../setup.env.example) at the repo root: copy it to
`setup.env`, fill it in, `source` it, and run a promptless `node setup.mjs --yes`.

Related runbook: [`docs/secrets.md`](secrets.md) (where each secret lives).

The tables are grouped in deploy order. Columns: **Value | Source (env var /
flag / file / command) | Where it lands | Handled by | Required?**

## Group 1 — Identity (feeds `setup.mjs`)

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| App display name | `SETUP_APP_NAME` / `--app-name` (def `"Dashboard App"`) | `index.html` `<title>`, sidebar wordmark | setup.mjs | Required |
| Worker + package slug | `SETUP_NAME` / `--name` (def `slugify(app name)`) | `wrangler.jsonc` `name`, `package.json` `name` | setup.mjs | Required |
| Dashboard D1 name | `SETUP_D1_NAME` / `--d1-name` (def `<slug>-db`) | `wrangler.jsonc` `database_name` | setup.mjs | Optional (derived) |
| Dashboard KV title | `SETUP_KV_TITLE` / `--kv-title` (def `<slug>-cache`) | `wrangler kv namespace create` cmd | setup.mjs | Optional (derived) |

The name/D1/KV values are slugified and validated; leave them blank in
`setup.env` and they derive from `SETUP_NAME` (e.g. `SETUP_D1_NAME` → `<slug>-db`).

## Group 2 — Cloudflare account (wrangler login context; not a file value)

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Which account (Binatrix / OQVA / Mor CPA) | `wrangler login` target | account auth context for all wrangler cmds | manual | Required |
| Zone for custom domains | Cloudflare DNS/zone | custom-domain routes | manual | Optional |

## Group 3 — Resource IDs (manual paste, AFTER `wrangler … create`)

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Dashboard D1 id | printed by `wrangler d1 create` | `REPLACE_WITH_YOUR_D1_ID` in `wrangler.jsonc` | manual | Required |
| Dashboard KV id | printed by `wrangler kv namespace create` | `REPLACE_WITH_YOUR_KV_ID` in `wrangler.jsonc` | manual | Required |

## Group 4 — Clerk

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Publishable key `pk_…` | `SETUP_CLERK_PK` / `--clerk-pk` | `.dev.vars`, `.env.local`, and the Worker secret via the printed `echo <pk> \| wrangler secret put CLERK_PUBLISHABLE_KEY` | setup.mjs + manual secret put | Required (auth) |
| Secret key `sk_…` | `wrangler secret put CLERK_SECRET_KEY` | Cloudflare secret (never a file) — see [`docs/secrets.md`](secrets.md) | manual | Required |
| Instance (dev/prod) + allowed origins/redirects | Clerk Dashboard | Clerk instance config | manual | Required |
| `accounts.<domain>` custom domain | Clerk Dashboard | Clerk instance config | manual | Optional |

## Group 5 — Domains / DNS

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Dashboard custom domain | `--custom-domain <host>` **(flag only — no env var)** | `wrangler.jsonc` `routes[]` (uncommented + filled) | setup.mjs | Optional (else `*.workers.dev`) |
| Production origin (Clerk azp) | `SETUP_ORIGIN` / `--origin` (default blank → `REPLACE_WITH_YOUR_ORIGIN`) | `wrangler.jsonc` `vars.AUTHORIZED_PARTIES`, `.dev.vars` | setup.mjs | Required before deploy (a placeholder-only value makes every protected `/api/*` call return 500) |

## Group 6 — Theme

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| tweakcn registry URL or local preset path | `--theme <url\|path>` **(flag only — no env var)** | `src/client/styles/theme.css` + `tweakcn-preset.json` | setup.mjs | Optional (else shipped slate default) |

## Group 7 — CI + optional async layer

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Dashboard Workers Builds connection | Cloudflare dashboard | root dir `` (repo root), build `pnpm install --frozen-lockfile && pnpm build`, deploy `pnpm dlx wrangler deploy` — runs `wrangler deploy` directly and **skips the deploy gates** (run `pnpm run deploy` or `pnpm run gate` + `pnpm db:migrate:remote` before pushing) | manual | Optional |
| GitHub repo (your fork) | Workers Builds git repo | the Builds connection | manual | Required for CI |
| (async) Resend API key | `wrangler secret put RESEND_API_KEY` | Cloudflare secret | manual | Optional (async dormant) |
| (async) verified sender | replaces hardcoded `onboarding@resend.dev` in `src/server/async/email.ts` | outbound email from-address | manual | Optional |
| (async) cron schedule | `wrangler.jsonc` `triggers.crons` (uncomment) | scheduled trigger | manual | Optional |
| (async) queue names | `wrangler.jsonc` `queues` + `wrangler queues create` (+ `-dlq`) | producer/consumer bindings | manual | Optional |

## Deploy-order checklist

1. Fork (**"Use this template"**) → clone → `pnpm install`.
2. Fill this table (`docs/deployment-intake.md`).
3. `cp setup.env.example setup.env`, edit it, then `set -a; source setup.env; set +a`.
4. `node setup.mjs --yes --origin https://<host>` (add `--theme <…>` /
   `--custom-domain <host>` flags as needed) — parameterizes the Worker, writes
   `.dev.vars` + `.env.local`.
5. Create resources: `wrangler d1 create` and `wrangler kv namespace create`.
6. Paste the returned IDs into `wrangler.jsonc` (`REPLACE_WITH_YOUR_*` → real ids).
7. Apply migrations BEFORE first traffic: `pnpm db:migrate:remote`.
8. Set both Clerk secrets before the first deploy (`secret put` creates the Worker if
   it does not exist yet): `wrangler secret put CLERK_SECRET_KEY` and
   `echo <pk> | wrangler secret put CLERK_PUBLISHABLE_KEY` (setup.mjs prints it with
   your key filled in).
9. Deploy: `pnpm run deploy` — gated (migrations → quality gate → build → live key →
   `wrangler deploy` → readback + smoke); refuses a `pk_test_` bundle unless
   `ALLOW_TEST_CLERK_KEY=1`. On a failed smoke it prints the rollback command and never
   rolls back by itself.
10. Post-deploy wiring: set Clerk Dashboard allowed origins/redirects; connect
    Workers Builds.
11. Smoke test: dashboard Clerk sign-in.
