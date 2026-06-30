// Type augmentation for the virtual `cloudflare:test` module (Pitfall 8).
//
// TEST_MIGRATIONS is a TEST-ONLY binding injected by vitest.config.ts (via
// readD1Migrations) — it is NOT in wrangler.jsonc, so `wrangler types` does not know
// it. Extend ProvidedEnv with the generated `Env` (so `env.__D1_BINDING__` type-checks)
// plus the migrations array, so `applyD1Migrations(env.__D1_BINDING__, env.TEST_MIGRATIONS)`
// in test/apply-migrations.ts type-checks.
//
// [A1] `D1Migration` is imported from the package ROOT — the documented `/config`
// subpath does not exist in the installed @cloudflare/vitest-pool-workers 0.16.20.
import type { D1Migration } from '@cloudflare/vitest-pool-workers'

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[]
  }
}
