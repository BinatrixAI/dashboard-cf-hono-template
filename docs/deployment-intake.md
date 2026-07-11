# Deployment Intake

This is the value checklist you complete **before** starting a new fork so the
deploy works first time — one place to gather every per-project value, know
where it lands, and who fills it (the `setup.mjs` script vs. your hands). Pair it
with [`setup.env.example`](../setup.env.example) at the repo root: copy it to
`setup.env`, fill it in, `source` it, and run a promptless `node setup.mjs --yes`.

Related runbooks: [`docs/cms.md`](cms.md) (CMS deploy + hardening),
[`docs/secrets.md`](secrets.md) (where each secret lives).

The tables are grouped in deploy order. Columns: **Value | Source (env var /
flag / file / command) | Where it lands | Handled by | Required?**

> **Two values are unknowable until after the first deploy:** `CORS_ORIGINS` and
> `VITE_CMS_API_URL` default empty because they point at `*.workers.dev`
> subdomains that don't exist until the Workers are first deployed. Leave them
> blank at fork time and fill them in the post-deploy checklist step.

## Group 1 — Identity (feeds `setup.mjs`)

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| App display name | `SETUP_APP_NAME` / `--app-name` (def `"Dashboard App"`) | `index.html` `<title>`, sidebar wordmark | setup.mjs | Required |
| Worker + package slug | `SETUP_NAME` / `--name` (def `slugify(app name)`) | `wrangler.jsonc` `name`, `package.json` `name` | setup.mjs | Required |
| Dashboard D1 name | `SETUP_D1_NAME` / `--d1-name` (def `<slug>-db`) | `wrangler.jsonc` `database_name` | setup.mjs | Optional (derived) |
| Dashboard KV title | `SETUP_KV_TITLE` / `--kv-title` (def `<slug>-cache`) | `wrangler kv namespace create` cmd | setup.mjs | Optional (derived) |
| Deploy CMS module? (yes/no) | decision | whether you deploy [`cms/`](../cms) at all | manual | Optional |
| CMS Worker name | `SETUP_CMS_NAME` / `--cms-name` (def `<slug>-cms`) | `cms/wrangler.jsonc` `name` | setup.mjs | Optional (derived) |
| CMS D1 name | `SETUP_CMS_D1_NAME` / `--cms-d1-name` (def `<slug>-cms-db`) | `cms/wrangler.jsonc` `database_name` | setup.mjs | Optional (derived) |
| CMS R2 bucket | `SETUP_CMS_R2_BUCKET` / `--cms-r2-bucket` (def `<slug>-cms-media`) | `cms/wrangler.jsonc` `bucket_name` | setup.mjs | Optional (derived) |
| CMS KV title | `SETUP_CMS_KV_TITLE` / `--cms-kv-title` (def `<slug>-cms-cache`) | `wrangler kv namespace create` cmd | setup.mjs | Optional (derived) |

The name/D1/KV/CMS values are slugified and validated; leave them blank in
`setup.env` and they derive from `SETUP_NAME` (e.g. `SETUP_D1_NAME` → `<slug>-db`).

## Group 2 — Cloudflare account (wrangler login context; not a file value)

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Which account (Binatrix / OQVA / Mor CPA) | `wrangler login` target | account auth context for all wrangler cmds | manual | Required |
| Zone for custom domains | Cloudflare DNS/zone | custom-domain routes | manual | Optional |
| R2 enabled on account? | Cloudflare dashboard → R2 | CMS `MEDIA_BUCKET` (R2 mandatory for SonicJS media) | manual | Required if CMS |

## Group 3 — Resource IDs (manual paste, AFTER `wrangler … create`)

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Dashboard D1 id | printed by `wrangler d1 create` | `REPLACE_WITH_YOUR_D1_ID` in `wrangler.jsonc` | manual | Required |
| Dashboard KV id | printed by `wrangler kv namespace create` | `REPLACE_WITH_YOUR_KV_ID` in `wrangler.jsonc` | manual | Required |
| CMS D1 id | printed by `wrangler d1 create` | `REPLACE_WITH_YOUR_CMS_D1_ID` in `cms/wrangler.jsonc` | manual | Required if CMS |
| CMS KV id | printed by `wrangler kv namespace create` | `REPLACE_WITH_YOUR_CMS_KV_ID` in `cms/wrangler.jsonc` | manual | Required if CMS |

The CMS `database_name` / `bucket_name` are auto-filled by `setup.mjs` — only the
`*_ID` fields are a manual paste after resource creation.

## Group 4 — Clerk

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Publishable key `pk_…` | `SETUP_CLERK_PK` / `--clerk-pk` | `wrangler.jsonc` `vars.CLERK_PUBLISHABLE_KEY`, `.dev.vars`, `.env.local` | setup.mjs | Required (auth) |
| Secret key `sk_…` | `wrangler secret put CLERK_SECRET_KEY` | Cloudflare secret (never a file) — see [`docs/secrets.md`](secrets.md) | manual | Required |
| Instance (dev/prod) + allowed origins/redirects | Clerk Dashboard | Clerk instance config | manual | Required |
| `accounts.<domain>` custom domain | Clerk Dashboard | Clerk instance config | manual | Optional |

## Group 5 — CMS secrets & vars (see [`docs/cms.md`](cms.md))

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| `BETTER_AUTH_SECRET` | `wrangler secret put` (`openssl rand -hex 32`) | Cloudflare secret · `cms/.dev.vars` local | manual | Required if CMS (login 500s without) |
| `JWT_SECRET` | `wrangler secret put` (`openssl rand -hex 32`) | Cloudflare secret · `cms/.dev.vars` local | manual | Required if CMS |
| `ADMIN_EMAIL` | shell env for `pnpm seed` (NOT a wrangler secret) | seeds one `auth_user` | manual | Required if CMS |
| `ADMIN_PASSWORD` | shell env for `pnpm seed` — rotate after first login | PBKDF2-hashed by seed | manual | Required if CMS |
| `BETTER_AUTH_URL` (= CMS deployed origin) | `SETUP_CMS_API_URL` → derived, else manual | `cms/wrangler.jsonc` `vars.BETTER_AUTH_URL` | setup.mjs (from `--cms-api-url`) or manual | Required if CMS — the `/admin` login-loop fix |
| `CORS_ORIGINS` (= exact dashboard origin, no wildcard) | `SETUP_CMS_CORS_ORIGIN` / `--cms-cors-origin` | `cms/wrangler.jsonc` `vars.CORS_ORIGINS` | setup.mjs or manual | Required if CMS |
| `VITE_CMS_API_URL` (= CMS origin) | `SETUP_CMS_API_URL` / `--cms-api-url` | dashboard `.env.local` | setup.mjs or manual | Required if CMS |

`CORS_ORIGINS` and `VITE_CMS_API_URL` default empty at fork time — the
`*.workers.dev` origins are unknowable until first deploy, so fill them in the
post-deploy checklist step below.

## Group 6 — Domains / DNS

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Dashboard custom domain | `--custom-domain <host>` **(flag only — no env var)** | `wrangler.jsonc` `routes[]` (uncommented + filled) | setup.mjs | Optional (else `*.workers.dev`) |
| CMS custom domain | manual edit | `cms/wrangler.jsonc` routes | manual | Optional (else `*.workers.dev`) |
| Cloudflare Access on `/admin` | Zero Trust → Access → Applications | edge gate before Worker | manual | Optional (recommended for public forks) |

## Group 7 — Theme

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| tweakcn registry URL or local preset path | `--theme <url\|path>` **(flag only — no env var)** | `src/client/styles/theme.css` + `tweakcn-preset.json` | setup.mjs | Optional (else shipped slate default) |

## Group 8 — CI + optional async layer

| Value | Source | Where it lands | Handled by | Required? |
| ----- | ------ | -------------- | ---------- | --------- |
| Dashboard Workers Builds connection | Cloudflare dashboard | root dir `` (repo root), build `pnpm install --frozen-lockfile && pnpm build`, deploy `pnpm dlx wrangler deploy` | manual | Optional |
| CMS Workers Builds connection | Cloudflare dashboard | **root dir `cms`**, build `pnpm install --frozen-lockfile && pnpm build` (or empty), deploy `pnpm dlx wrangler deploy` | manual | Optional if CMS |
| GitHub repo (your fork) | Workers Builds git repo | both Builds connections | manual | Required for CI |
| (async) Resend API key | `wrangler secret put RESEND_API_KEY` | Cloudflare secret | manual | Optional (async dormant) |
| (async) verified sender | replaces hardcoded `onboarding@resend.dev` in `src/server/async/email.ts` | outbound email from-address | manual | Optional |
| (async) cron schedule | `wrangler.jsonc` `triggers.crons` (uncomment) | scheduled trigger | manual | Optional |
| (async) queue names | `wrangler.jsonc` `queues` + `wrangler queues create` (+ `-dlq`) | producer/consumer bindings | manual | Optional |

## Deploy-order checklist

1. Fork (**"Use this template"**) → clone → `pnpm install`.
2. Fill this table (`docs/deployment-intake.md`).
3. `cp setup.env.example setup.env`, edit it, then `set -a; source setup.env; set +a`.
4. `node setup.mjs --yes` (add `--theme <…>` / `--custom-domain <host>` flags as
   needed) — parameterizes both Workers, writes `.dev.vars` + `.env.local`.
5. Create resources: `wrangler d1 create`, `wrangler kv namespace create`, and
   (CMS) `wrangler r2 bucket create`.
6. Paste returned IDs into `wrangler.jsonc` + `cms/wrangler.jsonc`
   (`REPLACE_WITH_YOUR_*` → real ids); set `BETTER_AUTH_URL` if the CMS was not
   wired via `--cms-api-url`.
7. Apply migrations BEFORE first traffic: dashboard
   `wrangler d1 migrations apply DB --remote`; CMS
   `cd cms && wrangler d1 migrations apply DB --remote`.
8. Set secrets: `wrangler secret put CLERK_SECRET_KEY`; (CMS)
   `BETTER_AUTH_SECRET`, `JWT_SECRET`.
9. Seed CMS admin: `export ADMIN_EMAIL=… ADMIN_PASSWORD=…`;
   `cd cms && pnpm seed -- --remote`.
10. Deploy: `pnpm run deploy` (dashboard); `cd cms && wrangler deploy` (CMS).
11. Post-deploy wiring: set `VITE_CMS_API_URL` (`.env.local`) + `CORS_ORIGINS`
    (`cms/wrangler.jsonc`) to the real origins, rebuild + redeploy; set Clerk
    Dashboard allowed origins/redirects; connect Workers Builds.
12. Smoke test: dashboard Clerk sign-in; `/admin` login works (proves
    `BETTER_AUTH_URL` set); the RBAC trio is present (`auth_user` with
    `is_super_admin=1` + `auth_account` credential + `rbac_user_roles` grant, per
    [`docs/cms.md`](cms.md)); disable open registration and verify
    `POST /auth/register` → `403`; run the author → dashboard → public `/blog` loop.
