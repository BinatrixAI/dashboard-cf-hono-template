// Node-environment Vitest suite for static file-content contracts (Phase 4).
//
// THEME-01: theme-agnostic baseline (no tailwind.config.*, no postcss.config.*,
//           theme.css uses @theme inline + oklch + .dark, no hex colors,
//           index.css imports tailwindcss, vite.config.ts references @tailwindcss/vite)
// THEME-02: tweakcn workflow doc (THEMING.md non-empty, references tweakcn-preset.json
//           and registry:style)
// D-08:     Clerk widget theming — static wiring (@clerk/themes in package.json,
//           appearance={{ theme: shadcn }} + import in main.tsx,
//           color-scheme rules + @clerk/themes/shadcn.css import in index.css)
//
// Runs as the 'setup' project (environment: node) — picked up by the existing glob
// test/setup/**/*.test.mjs in vitest.config.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { globSync } from 'node:fs'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const read = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8')

// ---------------------------------------------------------------------------
// THEME-01 — theme-agnostic baseline
// ---------------------------------------------------------------------------
describe('THEME-01: theme-agnostic baseline', () => {
  it('no tailwind.config.* files exist at repo root or under src/', () => {
    const hits = globSync('tailwind.config.*', {
      cwd: repoRoot,
      ignore: ['node_modules/**', '.agents/**'],
    })
    const hitsInSrc = globSync('src/**/tailwind.config.*', {
      cwd: repoRoot,
      ignore: ['node_modules/**'],
    })
    expect([...hits, ...hitsInSrc]).toHaveLength(0)
  })

  it('no postcss.config.* files exist at repo root or under src/', () => {
    const hits = globSync('postcss.config.*', {
      cwd: repoRoot,
      ignore: ['node_modules/**', '.agents/**'],
    })
    const hitsInSrc = globSync('src/**/postcss.config.*', {
      cwd: repoRoot,
      ignore: ['node_modules/**'],
    })
    expect([...hits, ...hitsInSrc]).toHaveLength(0)
  })

  it('theme.css contains @theme inline', () => {
    const css = read('src/client/styles/theme.css')
    expect(css).toContain('@theme inline')
  })

  it('theme.css contains a .dark selector block', () => {
    const css = read('src/client/styles/theme.css')
    expect(css).toMatch(/\.dark\s*\{/)
  })

  it('theme.css contains at least one oklch( token', () => {
    const css = read('src/client/styles/theme.css')
    expect(css).toContain('oklch(')
  })

  it('theme.css contains NO 6-digit hex color', () => {
    const css = read('src/client/styles/theme.css')
    expect(css).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it("index.css contains @import 'tailwindcss' or @import \"tailwindcss\"", () => {
    const css = read('src/client/styles/index.css')
    expect(css).toMatch(/@import ['"]tailwindcss['"]/)
  })

  it('vite.config.ts references @tailwindcss/vite', () => {
    const cfg = read('vite.config.ts')
    expect(cfg).toContain('@tailwindcss/vite')
  })
})

// ---------------------------------------------------------------------------
// THEME-02 — tweakcn workflow doc
// ---------------------------------------------------------------------------
describe('THEME-02: tweakcn workflow doc', () => {
  it('docs/THEMING.md exists and is non-empty', () => {
    const p = path.join(repoRoot, 'docs/THEMING.md')
    expect(existsSync(p)).toBe(true)
    const content = readFileSync(p, 'utf8')
    expect(content.trim().length).toBeGreaterThan(0)
  })

  it('docs/THEMING.md mentions tweakcn-preset.json (Phase-5 preset contract)', () => {
    const md = read('docs/THEMING.md')
    expect(md).toContain('tweakcn-preset.json')
  })

  it('docs/THEMING.md references registry:style (shadcn schema type)', () => {
    const md = read('docs/THEMING.md')
    expect(md).toContain('registry:style')
  })
})

// ---------------------------------------------------------------------------
// D-08 — Clerk widget theming (static wiring only)
// ---------------------------------------------------------------------------
describe('D-08: Clerk widget theming — static wiring', () => {
  it('package.json dependencies include @clerk/themes', () => {
    const pkg = JSON.parse(read('package.json'))
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }
    expect(allDeps['@clerk/themes']).toBeDefined()
  })

  it('main.tsx imports shadcn from @clerk/themes', () => {
    const tsx = read('src/client/main.tsx')
    expect(tsx).toMatch(/import\s*\{[^}]*\bshadcn\b[^}]*\}\s*from\s*['"]@clerk\/themes['"]/)
  })

  it('main.tsx uses appearance={{ theme: shadcn }} on ClerkProvider', () => {
    const tsx = read('src/client/main.tsx')
    // The actual key is `theme` (not `baseTheme`)
    expect(tsx).toContain('appearance={{ theme: shadcn }}')
  })

  it('index.css sets color-scheme: light under :root', () => {
    const css = read('src/client/styles/index.css')
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/)
  })

  it('index.css sets color-scheme: dark under .dark', () => {
    const css = read('src/client/styles/index.css')
    expect(css).toMatch(/\.dark\s*\{[^}]*color-scheme:\s*dark/)
  })

  it('index.css imports @clerk/themes/shadcn.css', () => {
    const css = read('src/client/styles/index.css')
    expect(css).toMatch(/@import\s+['"]@clerk\/themes\/shadcn\.css['"]/)
  })
})
