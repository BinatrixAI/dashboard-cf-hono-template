# Data Layer — D1 + KV

This template persists data through two Cloudflare bindings, both declared in
`wrangler.jsonc` with **placeholder resource IDs** (no real IDs are committed):

| Binding name (sentinel) | Resource | Purpose |
| ----------------------- | -------- | ------- |
| `__D1_BINDING__`        | D1 (SQLite) | Relational store for the example `items` table |
| `__KV_BINDING__`        | Workers KV  | Key-value store for the app-settings blob (see KV section) |

The binding **names** are `__NAME__` sentinels and the resource **IDs** are
`REPLACE_WITH_YOUR_*` placeholders — a two-tier convention. Phase 5 `setup.mjs`
renames the binding names and substitutes the real IDs for a forked project.

```jsonc
// wrangler.jsonc (excerpt)
"d1_databases": [
  {
    "binding": "__D1_BINDING__",
    "database_name": "__D1_BINDING__",
    "database_id": "REPLACE_WITH_YOUR_D1_ID", // placeholder — substitute before --remote
    "migrations_dir": "migrations"
  }
],
"kv_namespaces": [{ "binding": "__KV_BINDING__", "id": "REPLACE_WITH_YOUR_KV_ID" }]
```

> The committed `database_id` / KV `id` are intentional `REPLACE_WITH_YOUR_*`
> placeholders. They are ignored for all local/dev/test/CI work and only need a
> real value before a `--remote` apply or a production deploy.

## Schema → Migration workflow (Drizzle + wrangler)

The typed schema is the source of truth; the SQL migration is generated from it
and then applied with `wrangler`. This is the **generate → apply** loop (D-02),
**not** `drizzle-kit push`.

```
src/server/db/schema.ts  ──pnpm db:generate──►  migrations/0000_init.sql  ──wrangler d1 migrations apply──►  D1
   (typed source of truth)   (drizzle-kit generate)   (DDL + appended seed)        (--local | --remote)
```

### 1. Edit the schema

Edit `src/server/db/schema.ts` (Drizzle table definitions). SQL columns are
snake_case (`created_at`); the TS keys stay camelCase (`createdAt`) so a selected
row matches the `Item` contract in `src/shared/types.ts` with zero mapping.

### 2. Generate the migration

```bash
pnpm db:generate --name <feature>   # drizzle-kit generate → migrations/000N_<feature>.sql
```

`drizzle-kit generate` emits **DDL only** — it never emits data. The single seed
row in `migrations/0000_init.sql` is a **manually appended `INSERT`** that must
stay the last statement in the file (a trailing comment line breaks the test
migration applier). The drizzle `meta/` journal + snapshot are committed so the
next `db:generate` diffs correctly.

### 3. Apply the migration

`drizzle.config.ts` `out` and `wrangler.jsonc` `migrations_dir` both point at
`migrations/`, so `wrangler` applies the generated SQL directly.

```bash
pnpm db:migrate:local    # wrangler d1 migrations apply __D1_BINDING__ --local
pnpm db:migrate:remote   # wrangler d1 migrations apply __D1_BINDING__ --remote
```

## `--local` vs `--remote` (read this)

`--local` and `--remote` target **two separate databases that never sync**. Each
environment must be migrated independently.

| | `--local` / `db:migrate:local` | `--remote` / `db:migrate:remote` |
| --- | --- | --- |
| **Target** | workerd/miniflare SQLite under `.wrangler/` | the real Cloudflare D1 database |
| **Used by** | `wrangler dev`, the vitest workers pool, CI | production / deployed Worker |
| **`database_id`** | ignored — the placeholder is fine | **required** — substitute the real ID first |
| **When to run** | every time the schema changes (dev/test) | once per environment, before/after deploy |

Practical consequences:

- The `REPLACE_WITH_YOUR_D1_ID` placeholder is sufficient for all local dev,
  tests, and CI — they key the local SQLite off the binding **name**, not the ID.
- A row written via `--local` / `wrangler dev` will **not** appear in production,
  and vice versa. If a seed is "missing in prod", `--remote` was never applied.
- Run `--remote` only after substituting the real `database_id` (Phase 5
  `setup.mjs` or a manual edit).

## Tests apply the migration in workerd

`vitest.config.ts` reads the committed migrations with `readD1Migrations(...)` and
exposes them as a `TEST_MIGRATIONS` binding; `test/apply-migrations.ts` (a
`setupFiles` entry) calls `applyD1Migrations(env.__D1_BINDING__, env.TEST_MIGRATIONS)`
so the `items` table + seed materialize in the workerd-local D1 before any test
runs. This proves the committed migration applies cleanly with only placeholder
IDs (`pnpm test`).

## KV Settings Store

The `__KV_BINDING__` namespace backs a **standalone app-settings store** (DATA-04 /
D-04): a single JSON preferences blob persisted under one fixed key. This is the
template's documented KV read/write example. It is deliberately **NOT** cache-aside
over D1 — keeping KV decoupled from the items path means a forked project can rip the
whole example out (the route, the contract, the binding) without touching the D1 leg.

### Shape & key

The cross-tier contract lives in `src/shared/settings.ts` and is imported by both the
Hono route and any future React settings form:

| Field          | Type                              | Default    |
| -------------- | --------------------------------- | ---------- |
| `theme`        | `'light' \| 'dark' \| 'system'`   | `'system'` |
| `locale`       | `string` (2–10 chars)             | `'en'`     |
| `itemsPerPage` | `int` 1–100                       | `20`       |

Every field is defaulted, so `settingsSchema.parse({})` yields the complete
`defaultSettings` blob. The whole document is stored under the fixed key:

```ts
export const SETTINGS_KEY = 'app:settings' // one key, one JSON document
```

The KV binding **name** `__KV_BINDING__` and the resource **id**
`REPLACE_WITH_YOUR_KV_ID` follow the same two-tier sentinel convention as the D1
binding above — Phase 5 `setup.mjs` renames the binding and substitutes the real id.

### Read / write example (`GET` / `PUT /api/settings`)

The route (`src/server/routes/settings.ts`) reads and writes KV per-request:

```ts
// read — null on first load, then validated; falls back to defaults
const stored = await c.env.__KV_BINDING__.get(SETTINGS_KEY, 'json')
const parsed = settingsSchema.safeParse(stored)
return c.json({ settings: parsed.success ? parsed.data : defaultSettings })

// write — body validated by zValidator('json', settingsSchema)
await c.env.__KV_BINDING__.put(SETTINGS_KEY, JSON.stringify(next))
return c.json({ settings: next })
```

- `GET /api/settings` returns `{ settings }`. On first load (empty KV) it returns
  `defaultSettings`, never `null` or an error.
- `PUT /api/settings` validates the body with Zod (`zValidator`) — an invalid blob
  (e.g. `theme: 'neon'`) returns `400` and persists nothing — then writes the whole
  document and echoes it back.

### Validate stored JSON on read

The blob read back from KV is **untrusted**: across deploys it may be stale or an old
shape. The route always re-validates it with `settingsSchema.safeParse` and falls back
to `defaultSettings`, so a malformed stored blob can never crash the route or inject an
unexpected shape.

### KV is eventually consistent

Unlike D1, KV is **eventually consistent**: a write may take up to ~60s to propagate
across edge POPs, so a read from a different POP can briefly return the previous value.
This is acceptable for a low-churn settings store. Use **D1** wherever strong
read-after-write consistency is required.

