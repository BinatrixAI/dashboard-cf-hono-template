---
name: dashboard-dev
description: >-
  Recipes for developing on this Cloudflare + Hono + Vite/React dashboard
  template. Use when adding a page/route/screen, a public page, changing the
  main page after login, adding a table/migration/DB change, adding an API
  endpoint, adding a shadcn/ui component, or working with secrets and
  environment variables.
---

# dashboard-dev

Compact recipe index for this template. Each recipe gives exact file paths +
commands; see the linked doc for depth.

## Two invariants (read first)

1. **Protected = both layers.** A page is only protected when its route lives
   under `src/client/routes/_authenticated/` **and** its API router is mounted
   **after** `requireAuth` in `src/server/index.ts`. Registration order in
   `index.ts` IS the security contract — public routers (`/api/health`) mount
   before the gate; everything after it is protected.
2. **Never edit `src/client/routeTree.gen.ts`** (build-generated) and **never
   run `drizzle-kit push`** (this template is generate-only).

## Recipes

- **Add a page (4 files).** Route file under
  `src/client/routes/_authenticated/<name>/index.tsx` → feature dir
  `src/client/features/<name>/` → query hook `.../data/use-<name>.ts` (plain
  `fetch('/api/<name>')`) → sidebar entry in
  `src/client/components/layout/data/sidebar-data.ts`. Reference: the `items`
  feature.
- **Public page.** Same, but the route file lives OUTSIDE `_authenticated/`
  (e.g. `src/client/routes/pricing.tsx`). No sidebar/guard.
- **Page with data (full path).** Shared Zod schema in `src/shared/types.ts` →
  edit `src/server/db/schema.ts` → `pnpm db:generate --name <feature>` →
  `pnpm db:migrate:local` (+ `pnpm db:migrate:remote` on forked projects with a
  real `database_id`) → server router in `src/server/routes/<name>.ts`
  (per-request `drizzle(c.env.__D1_BINDING__, …)`, `zValidator`, `{ items }`
  envelopes) → mount AFTER the gate in `src/server/index.ts` → **mandatory**
  colocated `src/server/routes/<name>.test.ts` (copy `items.test.ts`) → client
  hook → route file → sidebar entry → run `pnpm dev` once (regenerates
  `routeTree.gen.ts`; until then `pnpm build`/`typecheck` fails on the new
  route path).
- **Public API endpoint.** Mount BEFORE `clerkMiddleware()` + `requireAuth` in
  `src/server/index.ts`, like `app.route('/api/health', health)`. Keep the
  terminal `app.all('/api/*', …404)` last.
- **KV-backed data.** Copy `src/server/routes/settings.ts` +
  `src/shared/settings.ts`: read with `settingsSchema.safeParse` + a
  `defaultSettings` fallback (KV blob is untrusted).
- **Change the post-login main page.** `signInFallbackRedirectUrl` /
  `signUpFallbackRedirectUrl` on the `ClerkProvider` in `src/client/main.tsx`
  (default `/dashboard`); update the sign-in `forceRedirectUrl` fallback too.
- **Remove/rename a demo page.** Delete route file + feature dir + sidebar entry
  (+ server router). Safe-to-delete demos: `apps`, `chats`, `tasks`, `users`.
  Keep: `items`, `dashboard`, `settings`, `errors`.
- **Add a shadcn component.** Check `src/client/components/ui/` first; add a
  missing one with `pnpm dlx shadcn@latest add <component>`. The shipped root
  `.mcp.json` also enables the shadcn MCP.
- **Secrets.** Real secret → `wrangler secret put <NAME>` (prod) + `.dev.vars`
  (local). Non-secret config → `vars` in `wrangler.jsonc`. Client-visible →
  `VITE_*` (never a secret). Run `pnpm cf-typegen` after; access via `c.env.X`.
- **Add a UI string (i18n).** The LTR/RTL toggle is the English↔Hebrew switch.
  Every new string goes in **both** `src/client/i18n/locales/en.json` **and**
  `he.json` (the parity test fails otherwise); render with
  `const { t } = useTranslation()` → `{t('your.key')}`. Never call `t()` at
  module scope — data arrays hold `TranslationKey` strings, resolved at render.
  See [`docs/i18n.md`](../../../docs/i18n.md).

## Commands

`pnpm dev` · `pnpm build` · `pnpm run deploy` · `pnpm test` · `pnpm typecheck` ·
`pnpm lint` · `pnpm format` / `pnpm format:check` · `pnpm cf-typegen` ·
`pnpm db:generate` · `pnpm db:migrate:local` · `pnpm db:migrate:remote`.

## Depth

- [`docs/adding-pages.md`](../../../docs/adding-pages.md) — every recipe in full.
- [`docs/ui-components.md`](../../../docs/ui-components.md) — shadcn + MCP.
- [`docs/i18n.md`](../../../docs/i18n.md) — English↔Hebrew i18n + parity rule.
- [`docs/secrets.md`](../../../docs/secrets.md) — env/secret model.
- [`docs/data-layer.md`](../../../docs/data-layer.md) — D1 + KV depth.
</content>
