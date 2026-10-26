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

// ---------------------------------------------------------------------------
// DS-02 — self-hosted fonts (no third-party font origin; CSP font-src 'self')
// ---------------------------------------------------------------------------
describe('DS-02: self-hosted fonts', () => {
  const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/

  it('index.html loads no font from Google Fonts', () => {
    expect(read('index.html')).not.toMatch(GOOGLE_FONTS)
  })

  it("the CSP names no Google Fonts host and sets font-src 'self'", () => {
    const csp = read('public/_headers')
      .split('\n')
      .find((l) => l.includes('Content-Security-Policy'))
    expect(csp).toBeDefined()
    expect(csp).not.toMatch(GOOGLE_FONTS)
    expect(csp).toContain("font-src 'self';")
  })

  it('index.css imports the Inter and Inter Tight fontsource packages', () => {
    const css = read('src/client/styles/index.css')
    expect(css).toMatch(/@import ['"]@fontsource-variable\/inter['"]/)
    expect(css).toMatch(/@import ['"]@fontsource-variable\/inter-tight['"]/)
  })

  it('index.css declares the Heebo Variable hebrew-subset @font-face', () => {
    const faces = read('src/client/styles/index.css').match(/@font-face\s*\{[^}]*\}/g) ?? []
    const heebo = faces.find((f) => f.includes("'Heebo Variable'"))
    expect(heebo).toBeDefined()
    expect(heebo).toContain('heebo-hebrew-wght-normal.woff2')
    expect(heebo.replace(/\s+/g, ' ')).toMatch(/unicode-range: [^;]*U\+0590-05FF/)
  })

  it("theme.css --font-sans and --font-display list 'Heebo Variable' before system-ui", () => {
    const css = read('src/client/styles/theme.css')
    for (const name of ['font-sans', 'font-display']) {
      const stack = new RegExp(`--${name}:([^;]+);`).exec(css)?.[1]
      expect(stack, `--${name} missing`).toBeDefined()
      const heebo = stack.indexOf("'Heebo Variable'")
      expect(heebo).toBeGreaterThan(-1)
      expect(heebo).toBeLessThan(stack.indexOf('system-ui'))
    }
  })
})

// ---------------------------------------------------------------------------
// DS-01 — tokens.css: derived tokens follow a tweakcn re-skin (D-02),
//         status tokens are fixed literals (D-03)
// ---------------------------------------------------------------------------
describe('DS-01: tokens.css', () => {
  const TOKENS = 'src/client/styles/tokens.css'
  const tokensCss = () => read(TOKENS).replace(/\/\*[\s\S]*?\*\//g, '')
  const block = (sel) => {
    const m = new RegExp(`(^|\\n)${sel.replace('.', '\\.')} \\{([^}]*)\\}`).exec(tokensCss())
    expect(m, `tokens.css has no ${sel} block`).not.toBeNull()
    return Object.fromEntries(
      [...m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.replace(/\s+/g, ' ').trim()])
    )
  }

  it('exists, has no 6-digit hex, an @theme inline block and @utility focus-ring', () => {
    expect(existsSync(path.join(repoRoot, TOKENS))).toBe(true)
    const css = read(TOKENS)
    expect(css).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    expect(css).toContain('@theme inline')
    expect(css).toContain('@utility focus-ring')
  })

  it('every var(--x) is a standard tweakcn key or a token declared in tokens.css (re-skin carries through)', () => {
    const { light, dark, theme } = JSON.parse(read('test/setup/fixtures/alt-preset.json')).cssVars
    const css = tokensCss()
    const known = new Set([
      ...Object.keys(light),
      ...Object.keys(dark),
      ...Object.keys(theme),
      ...[...css.matchAll(/(?:^|[\s;{])--([\w-]+):/g)].map((m) => m[1]),
    ])
    const unknown = [...css.matchAll(/var\(--([\w-]+)\)/g)].map((m) => m[1]).filter((k) => !known.has(k))
    expect(unknown).toEqual([])
  })

  it('the nine status tokens are bare oklch literals in :root and .dark (D-03)', () => {
    const status = ['success', 'warn', 'danger'].flatMap((s) => [s, `${s}-soft`, `${s}-fg`])
    for (const sel of [':root', '.dark']) {
      const decl = block(sel)
      for (const name of status) {
        expect(decl[name], `${sel} --${name}`).toMatch(/^oklch\([^()]*\)$/)
      }
    }
  })

  it("index.css imports './tokens.css' on the line right after './theme.css'", () => {
    const lines = read('src/client/styles/index.css').split('\n')
    const i = lines.findIndex((l) => /@import ['"]\.\/theme\.css['"]/.test(l))
    expect(i).toBeGreaterThan(-1)
    expect(lines[i + 1]).toMatch(/@import ['"]\.\/tokens\.css['"]/)
  })
})
