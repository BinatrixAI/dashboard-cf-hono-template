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

import { regenerateTheme, loadPreset, resolvePreset, normalizeThemeUrl } from '../../setup.mjs'

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

  it('does NOT fetch a non-tweakcn PAGE URL — not rewritten to tweakcn, rejected by the host guard (D-06)', async () => {
    // Post-normalize SSRF regression: normalizeThemeUrl only translates the tweakcn host, so a
    // non-tweakcn page URL keeps its host and is rejected by the unchanged allow-list BEFORE fetch.
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', spy)
    const preset = await loadPreset('https://evil.example.com/themes/x', repoRoot)
    expect(spy).not.toHaveBeenCalled()
    expect(preset).toEqual(shippedPreset())
  })

  it('ACCEPTS a tweakcn PAGE URL past the host guard (rewritten to registry) and only falls back on fetch failure', async () => {
    // A tweakcn page URL is rewritten to /r/themes/whatever, passes the host guard, and
    // reaches fetch — proving the rewrite runs before the guard. With fetch stubbed to reject,
    // it degrades to the shipped preset (fallback), not a host-not-allowed rejection.
    const spy = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', spy)
    const preset = await loadPreset('https://tweakcn.com/themes/whatever', repoRoot)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(new URL(spy.mock.calls[0][0]).href).toBe('https://tweakcn.com/r/themes/whatever')
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

describe('normalizeThemeUrl (page→registry, D-04)', () => {
  const U = (s) => new URL(s)
  // A real tweakcn user-theme id (cuid). The registry serves these ONLY extensionless:
  // `/r/themes/<cuid>` → 200 JSON, `/r/themes/<cuid>.json` → HTTP 500.
  const CUID = 'cmrg7tt65000604jo2o2q92qz'

  it('rewrites a tweakcn page URL to the extensionless registry path', () => {
    const out = normalizeThemeUrl(U('https://tweakcn.com/themes/modern-minimal'))
    expect(out.href).toBe('https://tweakcn.com/r/themes/modern-minimal')
    expect(out.pathname).toBe('/r/themes/modern-minimal')
    expect(out.hostname).toBe('tweakcn.com')
  })

  it('drops a trailing slash + query on a page URL, yielding a slash-free registry URL', () => {
    const out = normalizeThemeUrl(U('https://tweakcn.com/themes/modern-minimal/?foo=bar'))
    expect(out.href).toBe('https://tweakcn.com/r/themes/modern-minimal')
  })

  it('leaves an extensionless registry URL unchanged', () => {
    const out = normalizeThemeUrl(U('https://tweakcn.com/r/themes/modern-minimal'))
    expect(out.href).toBe('https://tweakcn.com/r/themes/modern-minimal')
  })

  // REGRESSION: the old normalizer APPENDED `.json`, which 500s for every user-saved theme —
  // i.e. `--theme <any real tweakcn share URL>` silently fell back to the shipped default.
  // Never emit a `.json` suffix again.
  it('never emits a .json suffix — the form that 500s for user themes', () => {
    for (const s of [
      `https://tweakcn.com/themes/${CUID}`,
      `https://tweakcn.com/themes/${CUID}/`,
      `https://tweakcn.com/r/themes/${CUID}`,
      `https://tweakcn.com/r/themes/${CUID}.json`,
      `https://tweakcn.com/r/themes/${CUID}.json/?v=1#x`,
    ]) {
      const out = normalizeThemeUrl(U(s))
      expect(out.href).toBe(`https://tweakcn.com/r/themes/${CUID}`)
      expect(out.pathname.endsWith('.json')).toBe(false)
    }
  })

  it('strips a legacy .json suffix off a registry URL a user pasted', () => {
    const out = normalizeThemeUrl(U('https://tweakcn.com/r/themes/modern-minimal.json'))
    expect(out.href).toBe('https://tweakcn.com/r/themes/modern-minimal')
  })

  it('does NOT rewrite the host of a non-tweakcn page URL (leaves it for the allow-list)', () => {
    const out = normalizeThemeUrl(U('https://evil.example.com/themes/x'))
    expect(out.hostname).toBe('evil.example.com')
  })

  // IN-03: a registry URL with a stray trailing slash 308-redirects under redirect:'manual'
  // → silent fallback. Normalize the slash away so it's fetched directly.
  it('strips a trailing slash + query/hash on a registry URL (IN-03)', () => {
    expect(normalizeThemeUrl(U('https://tweakcn.com/r/themes/modern-minimal/')).href).toBe(
      'https://tweakcn.com/r/themes/modern-minimal',
    )
    expect(normalizeThemeUrl(U('https://tweakcn.com/r/themes/modern-minimal/?v=1#x')).href).toBe(
      'https://tweakcn.com/r/themes/modern-minimal',
    )
  })

  it('still translates a dotted-theme-id page URL to the registry path (no IN-03 regression)', () => {
    const out = normalizeThemeUrl(U('https://tweakcn.com/themes/my.theme/'))
    expect(out.href).toBe('https://tweakcn.com/r/themes/my.theme')
  })

  it('does NOT rewrite the host when trimming a trailing slash on a non-tweakcn URL', () => {
    const out = normalizeThemeUrl(U('https://evil.example.com/r/themes/x.json/'))
    expect(out.hostname).toBe('evil.example.com')
  })

  it('never mutates the hostname of its input', () => {
    for (const s of [
      'https://tweakcn.com/themes/foo',
      'https://tweakcn.com/r/themes/foo.json',
      'https://evil.example.com/themes/x',
    ]) {
      expect(normalizeThemeUrl(U(s)).hostname).toBe(U(s).hostname)
    }
  })
})

describe('resolvePreset (outcome signal, D-01)', () => {
  it('returns outcome keep-default with the shipped preset when given no theme arg (no reason)', async () => {
    const r = await resolvePreset(undefined, repoRoot)
    expect(r.outcome).toBe('keep-default')
    expect(r.reason).toBeUndefined()
    expect(r.preset).toEqual(shippedPreset())
  })

  it('returns outcome applied with the parsed preset for a valid local path', async () => {
    const r = await resolvePreset(path.join(fixtures, 'alt-preset.json'), repoRoot)
    expect(r.outcome).toBe('applied')
    expect(r.preset).toEqual(altPreset())
  })

  it('returns outcome fallback for a `..` path that escapes the project root (traversal guard, T-05-05)', async () => {
    // The guard must reject BEFORE any read is attempted outside root. Spy on fetch to prove no
    // network read either, and assert the escape-specific reason — which the resolver only
    // returns after confining the resolved path to rootDir (short-circuiting before existsSync /
    // readFileSync of the escaping path). Degrades to the shipped default (no throw).
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    const r = await resolvePreset('../../../etc/passwd', repoRoot)
    expect(r.outcome).toBe('fallback')
    expect(r.reason).toMatch(/escapes the project root/)
    expect(r.preset).toEqual(shippedPreset())
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns outcome fallback for an absolute path outside the project root (traversal guard, T-05-05)', async () => {
    const r = await resolvePreset('/etc/passwd', repoRoot)
    expect(r.outcome).toBe('fallback')
    expect(r.reason).toMatch(/escapes the project root/)
    expect(r.preset).toEqual(shippedPreset())
  })

  it('returns outcome fallback (host-not-allowed) WITHOUT fetching for a non-tweakcn host (SSRF guard)', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', spy)
    const r = await resolvePreset('https://evil.example.com/x.json', repoRoot)
    expect(spy).not.toHaveBeenCalled()
    expect(r.outcome).toBe('fallback')
    expect(r.reason).toMatch(/host not allowed/)
    expect(r.preset).toEqual(shippedPreset())
  })

  it('returns outcome fallback (with the error in reason) when the tweakcn fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const r = await resolvePreset('https://tweakcn.com/r/themes/x.json', repoRoot)
    expect(r.outcome).toBe('fallback')
    expect(r.reason).toMatch(/offline/)
    expect(r.preset).toEqual(shippedPreset())
  })

  it('returns outcome fallback when the fetched body fails the preset shape gate', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://tweakcn.com/r/themes/x.json',
      json: async () => ({ nope: true }),
    })
    vi.stubGlobal('fetch', spy)
    const r = await resolvePreset('https://tweakcn.com/r/themes/x.json', repoRoot)
    expect(r.outcome).toBe('fallback')
    expect(r.preset).toEqual(shippedPreset())
  })
})
