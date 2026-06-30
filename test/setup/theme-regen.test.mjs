// Node-environment Vitest suite for setup.mjs's theme regenerator (SETUP-04).
//
// WHY node, not workerd: regenerateTheme()/loadPreset() use node:fs + global fetch +
// AbortSignal and rewrite tracked stylesheets on disk — none of that runs inside
// @cloudflare/vitest-pool-workers. Registered as the 'setup' project (environment:
// 'node') in vitest.config.ts, alongside setup.test.mjs.
//
// This suite is the byte-faithfulness contract for the tweakcn-preset → theme.css
// transform (docs/THEMING.md "Phase-5 contract"):
//   1. regenerateTheme(<shipped preset>)  === committed src/client/styles/theme.css   (no-op default, D-09)
//   2. regenerateTheme(<alt preset>)      === fixtures/alt-theme.golden.css           (generalization proof)
//   3. loadPreset() degrades to the shipped default offline / on a hostile host       (D-08, T-05-03)
//   4. regenerateTheme() rejects a CSS-structure-injection value                      (T-05-02)
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { regenerateTheme, loadPreset } from '../../setup.mjs'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))

const read = (p) => readFileSync(p, 'utf8')
const readJson = (p) => JSON.parse(read(p))

const shippedPreset = () => readJson(path.join(repoRoot, 'src/client/styles/tweakcn-preset.json'))
const committedThemeCss = () => read(path.join(repoRoot, 'src/client/styles/theme.css'))
const altPreset = () => readJson(path.join(fixtures, 'alt-preset.json'))
const altGoldenCss = () => read(path.join(fixtures, 'alt-theme.golden.css'))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('alt-preset.json fixture (shape contract)', () => {
  it('parses and exposes cssVars.{theme,light,dark}', () => {
    const p = altPreset()
    expect(p.type).toBe('registry:style')
    expect(typeof p.cssVars.theme).toBe('object')
    expect(typeof p.cssVars.light).toBe('object')
    expect(typeof p.cssVars.dark).toBe('object')
  })

  it('preserves the documented light/dark asymmetry (dark has NO sidebar*, NO radius)', () => {
    const { light, dark, theme } = altPreset().cssVars
    // light carries the 8 sidebar* var() indirections.
    const sidebarKeys = Object.keys(light).filter((k) => k.startsWith('sidebar'))
    expect(sidebarKeys).toHaveLength(8)
    for (const k of sidebarKeys) expect(light[k]).toMatch(/^var\(--/)
    // dark omits sidebar* entirely and never carries radius (it lives in theme).
    expect(Object.keys(dark).some((k) => k.startsWith('sidebar'))).toBe(false)
    expect('radius' in dark).toBe(false)
    expect(theme.radius).toBe('0.5rem')
  })
})

describe('alt-theme.golden.css fixture (byte-shape contract)', () => {
  it('uses 2-space indent, a trailing newline, and the blank-line asymmetry', () => {
    const css = altGoldenCss()
    expect(css.endsWith('\n')).toBe(true)
    expect(css).toContain('\n  --radius: 0.5rem;')
    // Exactly one blank line BEFORE the sidebar block in :root.
    expect(css).toMatch(/--chart-5: oklch\(0\.68 0\.19 70\);\n\n  --sidebar: var\(--background\);/)
    // NO blank line before the --color-sidebar* group in @theme inline.
    expect(css).toMatch(/--color-chart-5: var\(--chart-5\);\n  --color-sidebar: var\(--sidebar\);/)
  })
})

describe('regenerateTheme (byte-faithful)', () => {
  it('regenerates the SHIPPED preset byte-identically to the committed theme.css (no-op default, D-09)', () => {
    expect(regenerateTheme(shippedPreset())).toBe(committedThemeCss())
  })

  it('regenerates the ALT preset byte-identically to the hand-built golden CSS', () => {
    expect(regenerateTheme(altPreset())).toBe(altGoldenCss())
  })

  it('rejects a preset value that would break out of a CSS declaration (T-05-02)', () => {
    const base = altPreset()
    const withBrace = structuredClone(base)
    withBrace.cssVars.light.primary = 'oklch(0.5 0.2 30)} body{display:none'
    expect(() => regenerateTheme(withBrace)).toThrow()

    const withSemi = structuredClone(base)
    withSemi.cssVars.light.primary = 'oklch(0.5 0.2 30); color:red'
    expect(() => regenerateTheme(withSemi)).toThrow()

    const withNewline = structuredClone(base)
    withNewline.cssVars.dark.background = 'oklch(0.1 0 0)\n  --evil: 1'
    expect(() => regenerateTheme(withNewline)).toThrow()
  })

  it('rejects a preset KEY that would inject CSS structure (CR-01 guard-bypass regression)', () => {
    const base = altPreset()

    // A hostile light-token KEY: the value passes FORBIDDEN_CSS_VALUE_RE, but the key itself
    // carries `: ; } { /*` which (unguarded) emits `--x: red; } body { display:none } /*: red;`.
    const hostileLightKey = structuredClone(base)
    hostileLightKey.cssVars.light['x: red; } body { display: none } /*'] = 'red'
    expect(() => regenerateTheme(hostileLightKey)).toThrow(/Unsafe preset key/)

    // The injected CSS must NOT appear in any output (guard throws before emitting).
    expect(() => regenerateTheme(hostileLightKey)).toThrow()

    // dark-token key with a closing brace.
    const hostileDarkKey = structuredClone(base)
    hostileDarkKey.cssVars.dark['background} body {display:none'] = 'oklch(0.1 0 0)'
    expect(() => regenerateTheme(hostileDarkKey)).toThrow(/Unsafe preset key/)

    // theme-token key (drives both --<key> and font-* / --color-* emission) with whitespace.
    const hostileThemeKey = structuredClone(base)
    hostileThemeKey.cssVars.theme['font-sans: x; } :root {'] = 'sans-serif'
    expect(() => regenerateTheme(hostileThemeKey)).toThrow(/Unsafe preset key/)

    // An uppercase / underscore key (not a valid CSS custom-property segment) is also rejected.
    const upperKey = structuredClone(base)
    upperKey.cssVars.light['Evil_Key'] = 'red'
    expect(() => regenerateTheme(upperKey)).toThrow(/Unsafe preset key/)
  })
})

describe('loadPreset (offline-safe, SSRF-guarded)', () => {
  it('returns the shipped preset when called with no theme arg (keep-default)', async () => {
    const preset = await loadPreset(undefined, repoRoot)
    expect(preset).toEqual(shippedPreset())
  })

  it('parses a local preset path', async () => {
    const preset = await loadPreset(path.join(fixtures, 'alt-preset.json'), repoRoot)
    expect(preset).toEqual(altPreset())
  })

  it('falls back to the shipped preset (no throw) when the tweakcn fetch rejects (D-08)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const preset = await loadPreset('https://tweakcn.com/r/themes/whatever.json', repoRoot)
    expect(preset).toEqual(shippedPreset())
  })

  it('does NOT fetch a non-tweakcn host and falls back (SSRF guard, T-05-03)', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', spy)
    const preset = await loadPreset('https://evil.example.com/themes/x.json', repoRoot)
    expect(spy).not.toHaveBeenCalled()
    expect(preset).toEqual(shippedPreset())
  })

  it('requests redirect:manual and falls back on a 3xx (SSRF-via-redirect guard, WR-05)', async () => {
    // A 302 from tweakcn.com (open redirect / compromise) must NOT be followed to another
    // host. With redirect:'manual' the 3xx surfaces as a non-ok response → fall back.
    const spy = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      url: 'https://tweakcn.com/r/themes/x.json',
      json: async () => ({ cssVars: { theme: {}, light: {}, dark: {} } }),
    })
    vi.stubGlobal('fetch', spy)
    const preset = await loadPreset('https://tweakcn.com/r/themes/x.json', repoRoot)

    // fetch was invoked with redirect:'manual' (auto-follow disabled).
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
    // The redirect was not followed; we kept the shipped default.
    expect(preset).toEqual(shippedPreset())
  })

  it('rejects a response that resolved to a non-tweakcn host (WR-05 defense-in-depth)', async () => {
    // Even if a redirect were somehow followed, a resolved res.url on a disallowed host is
    // rejected before the body is used.
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://evil.example.com/themes/x.json',
      json: async () => ({ cssVars: { theme: {}, light: { a: 'b' }, dark: { a: 'b' } } }),
    })
    vi.stubGlobal('fetch', spy)
    const preset = await loadPreset('https://tweakcn.com/r/themes/x.json', repoRoot)
    expect(preset).toEqual(shippedPreset())
  })
})
