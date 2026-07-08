import globals from 'globals'
import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      'dist',
      'src/client/components/ui',
      'src/client/routeTree.gen.ts',
      // Gitignored, locally-installed agent skills (npx skills add). Their vendored
      // templates are not template source — eslint must skip them so `pnpm lint`
      // (and the CI quality gate) is green both locally and on a fresh checkout.
      '.agents',
      '.claude/skills',
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...pluginQuery.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-console': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Enforce type-only imports for TypeScript types
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      // Prevent duplicate imports from the same module
      'no-duplicate-imports': 'error',
    },
  },
  {
    // CMS Worker Node CLI scripts + tsx self-check tests (cms/scripts/*.ts) legitimately
    // print to console — same as the root .mjs scripts (setup.mjs, ci-wrangler-coverage.mjs),
    // which escape no-console only because the block above lints .ts/.tsx. Allow it here so
    // `pnpm lint` (and the CI quality gate) stays green with the CMS module present.
    files: ['cms/scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  }
)
