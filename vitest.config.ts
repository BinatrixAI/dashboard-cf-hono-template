import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'

// Vitest 4 multi-project config (`test.projects`). The repo now runs TWO suites under
// one `pnpm test`, because they need different runtimes:
//
//  1. project 'workers' — API/Worker tests run INSIDE workerd via
//     @cloudflare/vitest-pool-workers, bound to the real single-Worker config
//     (wrangler.jsonc -> main: src/server/index.ts). `wrangler.configPath` makes the
//     pool boot the actual Hono entry, so `SELF.fetch` exercises the same routing
//     precedence the deployed Worker uses. This is the original (pre-Phase-5) config,
//     moved verbatim into the first project entry — nothing about it changed.
//
//  2. project 'setup' — Phase-5 `setup.mjs` tests run in PLAIN NODE, not workerd.
//     setup.mjs uses node:fs / node:readline/promises / node:child_process / global
//     fetch — none of which exist (or behave the same) inside the workers pool. It is
//     a build-time CLI, never deployed code, so it must NOT load the workers pool, the
//     wrangler config, or the D1-migration setupFile. Hence a separate node-env project
//     with no plugins and no setupFiles. (Mirrors test/apply-migrations.ts's discipline
//     of documenting WHY a suite runs where it does.)
//
// NOTE: the locked vitest@4 ships pool-workers 0.16.20, whose public API replaced the
// old `defineWorkersConfig` (from `@cloudflare/vitest-pool-workers/config`) with the
// `cloudflareTest` Vite plugin — its `configureVitest` hook installs the workers pool
// runner. We KEEP `wrangler.configPath` (dropping it stops the pool booting the real
// Worker and breaks `SELF.fetch`, Pitfall 7) and the existing `test.include` glob.
//
// [A1] In the installed 0.16.20, `readD1Migrations` (and the `D1Migration` type) are
// re-exported from the package ROOT — the documented `/config` subpath does not exist
// in this version, so we import from `@cloudflare/vitest-pool-workers`.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest(async () => {
            const migrations = await readD1Migrations(path.join(__dirname, 'migrations'))
            return {
              wrangler: { configPath: './wrangler.jsonc' }, // KEEP — boots the real Worker
              miniflare: {
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  // Phase 3 (auth.test.ts): dummy Clerk bindings so `clerkMiddleware()` can
                  // construct in-pool. The PUBLISHABLE key is STRUCTURALLY valid (`pk_test_` +
                  // base64 of a placeholder `*.clerk.accounts.dev$` FAPI domain) so the backend
                  // parses a FAPI URL; on a request with NO `__session` cookie, authenticateRequest
                  // returns signed-out WITHOUT a network/JWKS call (RESEARCH A3), keeping the 401
                  // test hermetic. The SECRET is an OBVIOUSLY-FAKE non-`sk_` placeholder so a future
                  // Phase-6 secret scanner never flags this test config (it is not a realistic key).
                  CLERK_PUBLISHABLE_KEY: 'pk_test_cGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA==',
                  CLERK_SECRET_KEY: 'dummy-clerk-test-secret-not-a-real-key',
                },
              },
            }
          }),
        ],
        test: {
          name: 'workers',
          include: ['src/server/**/*.test.ts'],
          setupFiles: ['./test/apply-migrations.ts'],
        },
      },
      {
        // Plain node — setup.mjs is a stdlib-only build-time CLI, NOT workerd code.
        test: {
          name: 'setup',
          environment: 'node',
          include: ['test/setup/**/*.test.mjs'],
        },
      },
      {
        // Plain node — client-side unit tests for pure URL/string/JSON helpers
        // (e.g. src/client/lib/cms-client.ts). These functions have no worker or
        // DOM dependency, so loading the workers pool (or a jsdom env) would be
        // wrong overhead; like `setup`, this project documents WHY it runs in node.
        test: {
          name: 'client',
          environment: 'node',
          include: ['src/client/**/*.test.ts'],
        },
      },
    ],
  },
})
