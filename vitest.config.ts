import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'

// Vitest multi-project config (`test.projects`). The repo runs FOUR suites under
// one `pnpm test`, because they need different runtimes:
//
//  1. project 'workers' — API/Worker tests run INSIDE workerd via
//     @cloudflare/vitest-plugin, bound to the real single-Worker config
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
//  3. project 'client' — pure client helpers (src/client/**), plain node with the `@`
//     alias and no jsdom. Phase 21 Plans 21-03, 21-04 and 21-08 add its tests.
//     It excludes `*.dom.test.tsx`, so no DOM test runs here (and none runs twice).
//
//  4. project 'client-dom' — client components that need a real DOM (clicks, focus,
//     Escape) run in jsdom with @testing-library. Only `*.dom.test.tsx` files, so the
//     node project above stays as it is. test/dom-setup.ts adds the jest-dom matchers,
//     RTL cleanup (no `globals: true`, so RTL can't register it itself) and matchMedia.
//
// NOTE: @cloudflare/vitest-plugin (the renamed successor of the deprecated pool package)
// exposes the `cloudflareTest` Vite plugin — its `configureVitest` hook installs the
// workers pool runner. We KEEP `wrangler.configPath` (dropping it stops the pool booting
// the real Worker and breaks `SELF.fetch`, Pitfall 7) and the existing `test.include` glob.
//
// [A1] `cloudflareTest`, `readD1Migrations` and the `D1Migration` type are all exported
// from the package root, so everything is imported from `@cloudflare/vitest-plugin`.
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
                  // wrangler.jsonc ships the placeholder, which fails closed (D-02): without this
                  // override every auth.test.ts 401 would become a 500 (RESEARCH Pitfall 3).
                  AUTHORIZED_PARTIES: 'http://localhost',
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
        // Plain node, no jsdom — pure client helpers only (Plans 21-03, 21-04, 21-08).
        resolve: { alias: { '@': path.resolve(__dirname, 'src/client') } },
        test: {
          name: 'client',
          environment: 'node',
          include: ['src/client/**/*.test.{ts,tsx}'],
          // Setting exclude replaces the defaults, so spread them back in.
          exclude: [...configDefaults.exclude, 'src/client/**/*.dom.test.tsx'],
        },
      },
      {
        // jsdom — component tests that click, focus or press keys (CICD-08).
        resolve: { alias: { '@': path.resolve(__dirname, 'src/client') } },
        test: {
          name: 'client-dom',
          environment: 'jsdom',
          include: ['src/client/**/*.dom.test.tsx'],
          setupFiles: ['./test/dom-setup.ts'],
        },
      },
    ],
  },
})
