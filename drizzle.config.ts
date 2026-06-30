// drizzle-kit config — GENERATE-ONLY (D-02).
//
// This template wires drizzle-kit purely to GENERATE the SQL migration from the
// typed schema (`pnpm db:generate` -> `migrations/0000_init.sql`), which is then
// applied with `wrangler d1 migrations apply` (D-02 is migration-based, NOT
// `drizzle-kit push`). `generate` needs ONLY `dialect`/`schema`/`out`.
//
// Deliberately NO `driver: 'd1-http'` and NO `dbCredentials`: those are for
// push/migrate/studio and would force committing a Cloudflare account id, a D1
// API token, and the real `database_id` into the repo — violating the template's
// "no real IDs/secrets" constraint (Pitfall 3). The `out` dir MUST equal the
// `migrations_dir` in `wrangler.jsonc` so wrangler applies the generated SQL.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './migrations',
})
