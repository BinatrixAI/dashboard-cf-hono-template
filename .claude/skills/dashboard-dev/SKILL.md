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
  `fetch('/api/<name>')` that throws `new HttpError(res.status, …)` from
  `@/lib/http-error` on `!res.ok`, so a 401 signs out once and a failed
  refetch keeps the data on screen) → sidebar entry in
  `src/client/components/layout/data/sidebar-data.ts`. Reference: the `items`
  feature.
- **Public page.** Same, but the route file lives OUTSIDE `_authenticated/`
  (e.g. `src/client/routes/pricing.tsx`). No sidebar/guard.
- **External sidebar link.** A top-level item in
  `src/client/components/layout/data/sidebar-data.ts` with `external: true` and
  an absolute `url` renders a new-tab anchor (`noopener noreferrer`, trailing
  icon); title key in both locale files; top-level items only. See
  `docs/adding-pages.md` §3.
- **Page with data (full path).** Shared Zod schema in `src/shared/types.ts` →
  edit `src/server/db/schema.ts` → `pnpm db:generate --name <feature>` →
  `pnpm db:migrate:local` (+ `pnpm db:migrate:remote` on forked projects with a
  real `database_id`) → server router in `src/server/routes/<name>.ts`
  (per-request `drizzle(c.env.__D1_BINDING__, …)`, `v` from
  `src/server/validator.ts` (localized 400 + Content-Type guard; ESLint blocks
  `@hono/zod-validator` in src/server), `{ items }` / `{ error, path }`
  envelopes) → mount AFTER the gate in `src/server/index.ts` → **mandatory**
  colocated `src/server/routes/<name>.test.ts` (copy `items.test.ts`) → client
  hook → route file → sidebar entry → run `pnpm dev` once (regenerates
  `routeTree.gen.ts`; until then `pnpm build`/`typecheck` fails on the new
  route path). Before the next deploy run `pnpm db:migrate:remote`:
  `pnpm run deploy` refuses unapplied migrations.
- **D1 queries.** Patterns for new code (the shipped `items` router reads
  first; it predates them).
  - Multi-statement READS use **one** `db.batch([...])`: one round trip, one
    consistent snapshot, so a response never mixes two snapshots:
    `const [rows, [{ n }]] = await db.batch([db.select().from(items).limit(20), db.select({ n: count() }).from(items)])`.
  - Conditional WRITES put the check in SQL (`UPDATE … WHERE`,
    `INSERT … SELECT … WHERE NOT EXISTS`) and read `result.meta.changes`; 0
    means nothing matched → 404 `{ error: t(c, 'notFound'), path }` (or 409):
    `const { meta } = await db.update(items).set({ name }).where(eq(items.id, id))`
    then `if (meta.changes === 0) …`.
  - Never `db.transaction()`: drizzle types it, but D1 rejects
    BEGIN/SAVEPOINT at runtime (`D1_ERROR: To execute a transaction, please
    use the state.storage.transaction() …`). Atomic multi-statement writes use
    `db.batch([...])`, which D1 runs as one SQL transaction and rolls back if
    a statement fails.
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
  - `components.json` sets `"rtl": true` (style `new-york`), so `add` emits
    logical classes (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`,
    `border-s`/`border-e`) plus `rtl:` fixes.
  - Added components import primitives from `radix-ui` (namespace imports, e.g.
    `import { Popover as PopoverPrimitive } from 'radix-ui'`) and `cn` from
    `cn`. App code keeps importing `cn` from `@/lib/utils`.
  - Hand-check calendar and sidebar (the CLI does not fully convert them) and
    any sheet slide animation in Hebrew. `Tooltip` no longer wraps itself in a
    `TooltipProvider`: outside the authenticated layout, add one.
  - Run `git diff` after `add`: the CLI may also edit
    `src/client/styles/index.css`, create files (e.g. `hooks/use-mobile.ts`) or
    add/downgrade packages (e.g. next-themes for sonner). Revert those, keep the
    tweakcn theme, and keep `@/context/theme-provider`.
- **Charts: Bklit** (`@bklit` registry, `@/components/charts/*`). See the
  bklit-ui skills. Import from the module file (e.g.
  `@/components/charts/bar-chart`); there is no barrel. Wrap every chart in
  `<div dir='ltr'>` and colour series with `var(--chart-N)`.
  `pnpm dlx shadcn@latest add @bklit/<item>` overwrites `src/client/lib/utils.ts`
  (or writes `src/lib/utils.ts` + `src/components/charts/`) and writes cssVars
  into `src/client/styles/index.css`: restore both with `git checkout`, move new
  files under `src/client/components/charts/`; the Bklit tokens live in
  `src/client/styles/tokens.css`. Every chart is demoed at `/charts`.
  The vendored `bklit-ui` skill has its upstream `allowed-tools` line removed on
  purpose (it pre-approved any `shadcn@latest` command); strip it again if
  `npx skills add bklit/bklit-ui` restores it.
- **Secrets.** Real secret → `wrangler secret put <NAME>` (prod) + `.dev.vars`
  (local). Non-secret config → `vars` in `wrangler.jsonc`. Client-visible →
  `VITE_*` (never a secret). Declare every new secret name in `wrangler.jsonc`
  `secrets.required` (otherwise `wrangler types` leaves it out of `Env` and
  local dev drops it from `.dev.vars`). Both Clerk keys are secrets: set them
  with `wrangler secret put` before the first deploy. Run `pnpm cf-typegen`
  after; access via `c.env.X`.
  The accepted Clerk origins are the `AUTHORIZED_PARTIES` var (set by
  `setup.mjs --origin`; local dev origins in `.dev.vars`).
- **Add a UI string (i18n).** The LTR/RTL toggle is the English↔Hebrew switch.
  Every new string goes in **both** `src/client/i18n/locales/en.json` **and**
  `he.json` (the parity test fails otherwise); render with
  `const { t } = useTranslation()` → `{t('your.key')}`. Never call `t()` at
  module scope — data arrays hold `TranslationKey` strings, resolved at render.
  See [`docs/i18n.md`](../../../docs/i18n.md).
- **Component test.** A test that clicks, focuses or presses keys goes in a
  colocated `<name>.dom.test.tsx`: it runs in the jsdom `client-dom` vitest
  project with `@testing-library/react` + `user-event` + `jest-dom`. Copy
  `src/client/components/layout/tab-bar.dom.test.tsx` for the provider tree
  (router, query client, direction, theme) and the `@clerk/react` mock. Pure
  helpers keep `<name>.test.ts` in the node `client` project.
- **Guards a change can trip (`pnpm test`).** design-system
  (`test/setup/design-system.test.mjs`): theme tokens and logical classes only,
  no raw colours or physical `left`/`right` classes. rtl-icons
  (`test/setup/rtl-icons.test.mjs`): directional icons flip in RTL or carry an
  `rtl-icon-ok: <reason>` comment. nav-contract
  (`src/client/components/layout/nav-contract.test.ts`): every nav `url` is a
  real route with EN and HE title keys. Bundle size: CI runs `pnpm build` then
  `node scripts/bundle-size.mjs`; raise `CEILINGS` there on purpose and give
  the reason in the commit.

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
