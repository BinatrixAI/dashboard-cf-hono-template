// vitest setupFile — applies the committed D1 migrations into the workerd-local D1
// before each test file runs, materializing the `items` table + seed from
// migrations/0000_init.sql. `applyD1Migrations` only applies UN-applied migrations
// (it shares the d1_migrations ledger), so it is idempotent and safe to run per file.
//
// `env.TEST_MIGRATIONS` is the binding wired in vitest.config.ts via readD1Migrations;
// `env.__D1_BINDING__` is the D1 binding from wrangler.jsonc. Both are typed via the
// `cloudflare:test` ProvidedEnv augmentation in test/env.d.ts (Pitfall 8).
import { applyD1Migrations, env } from 'cloudflare:test'

await applyD1Migrations(env.__D1_BINDING__, env.TEST_MIGRATIONS)
