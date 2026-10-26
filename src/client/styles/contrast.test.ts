import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// WCAG AA (4.5:1) guard over the SHIPPED theme.css + tokens.css, light and dark (D-04). It reads the
// files at test time, so a fork re-skinned with setup.mjs --theme tests its own palette.
type Tokens = Record<string, string>
type Oklch = [L: number, C: number, H: number | null, A: number] // H null = powerless hue
type RGBA = [number, number, number, number] // gamma-encoded sRGB 0..1

const css = ['./theme.css', './tokens.css']
  .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

function block(sel: ':root' | '.dark'): Tokens {
  const out: Tokens = {}
  const re = new RegExp(`(^|\\n)${sel.replace('.', '\\.')} \\{([^}]*)\\}`, 'g')
  for (const m of css.matchAll(re))
    for (const [, k, v] of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g))
      out[k] = v.replace(/\s+/g, ' ').trim() // prettier wraps long values
  return out
}
const LIGHT = block(':root')
const DARK = { ...LIGHT, ...block('.dark') } // .dark sits on <html> with :root, so it overrides

const num = (n: string, pct: string) => (pct ? +n / 100 : +n)

function parse(map: Tokens, value: string): Oklch {
  const v = value.trim()
  let m: RegExpExecArray | null
  if ((m = /^var\(--([\w-]+)\)$/.exec(v))) {
    if (!(m[1] in map)) throw new Error(`theme: --${m[1]} missing`)
    return parse(map, map[m[1]])
  }
  if (v === 'black') return [0, 0, null, 1]
  if (v === 'white') return [1, 0, null, 1]
  if (v === 'transparent') return [0, 0, null, 0]
  if (
    (m =
      /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/.exec(
        v
      ))
  )
    return [
      num(m[1], m[2]),
      +m[3],
      +m[3] === 0 ? null : +m[4],
      m[5] === undefined ? 1 : num(m[5], m[6]),
    ]
  if (
    (m = /^color-mix\(\s*in oklch,\s*(.+?)\s+([\d.]+)%,\s*(.+?)\s*\)$/.exec(v))
  ) {
    const p = +m[2] / 100
    const a = parse(map, m[1])
    const b = parse(map, m[3])
    const A = a[3] * p + b[3] * (1 - p)
    // premultiplied interpolation of L and C; hue is not premultiplied
    const pre = (i: 0 | 1) =>
      A ? (a[i] * a[3] * p + b[i] * b[3] * (1 - p)) / A : 0
    let H = a[2] ?? b[2] // a powerless hue takes the other colour's
    if (a[2] !== null && b[2] !== null) {
      let d = b[2] - a[2]
      if (d > 180) d -= 360
      if (d < -180) d += 360 // shorter arc, the CSS default
      H = (((a[2] + d * (1 - p)) % 360) + 360) % 360
    }
    return [pre(0), pre(1), H, A]
  }
  throw new Error(`unparseable colour: ${v}`) // hex / rgb() / hsl() tweakcn export: fail loudly
}

// OKLCH -> gamma-encoded sRGB (Ottosson OKLab matrices), clamped to the gamut box.
function srgb([L, C, H, A]: Oklch): RGBA {
  const h = ((H ?? 0) * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const enc = (x: number) => {
    const c = Math.min(1, Math.max(0, x))
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  }
  return [
    enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    A,
  ]
}

const tok = (map: Tokens, name: string) => srgb(parse(map, `var(--${name})`))

// Alpha-composite a translucent colour on an opaque one (sRGB, as browsers paint).
const over = (top: RGBA, bottom: RGBA): RGBA => [
  top[0] * top[3] + bottom[0] * (1 - top[3]),
  top[1] * top[3] + bottom[1] * (1 - top[3]),
  top[2] * top[3] + bottom[2] * (1 - top[3]),
  1,
]

function luminance([r, g, b]: RGBA) {
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// Unrounded ratio: a 4.49 must never round up to a pass.
function ratio(fg: RGBA, bg: RGBA) {
  const [hi, lo] = [luminance(over(fg, bg)), luminance(bg)].sort(
    (x, y) => y - x
  )
  return (hi + 0.05) / (lo + 0.05)
}

// Real surfaces: the glass card sits on the app-bg glow peak, chips sit on the card.
const background = (map: Tokens) => over(tok(map, 'background'), [1, 1, 1, 1])
const card = (map: Tokens) =>
  over(tok(map, 'card'), over(tok(map, 'glow-1'), background(map)))
const chip = (map: Tokens, s: string) => over(tok(map, `${s}-soft`), card(map))
const solid = (name: string) => (map: Tokens) => tok(map, name)

type Surface = (map: Tokens) => RGBA
const PAIRS: [fg: string, surfaceName: string, surface: Surface][] = [
  ['foreground', 'background', background],
  ['foreground', 'card', card],
  ['muted-foreground', 'background', background],
  ['muted-foreground', 'card', card],
  ['brand-fg', 'card', card],
  ['on-brand', 'brand-deep', solid('brand-deep')],
  ...(['success', 'warn', 'danger'] as const).flatMap(
    (s): [string, string, Surface][] => [
      [`${s}-fg`, `${s}-soft chip`, (map) => chip(map, s)],
      [`${s}-fg`, 'card', card],
    ]
  ),
  ['destructive', 'card', card],
  ['sidebar-foreground', 'sidebar', solid('sidebar')],
  ['sidebar-label', 'sidebar', solid('sidebar')],
  ['sidebar-primary-foreground', 'sidebar-primary', solid('sidebar-primary')],
]

for (const [mode, map] of [
  ['light', LIGHT],
  ['dark', DARK],
] as const) {
  describe(`AA contrast (${mode})`, () => {
    const cases = PAIRS.map(([fg, name, surface]) => {
      const r = ratio(tok(map, fg), surface(map))
      return [`${fg} on ${name}: ${r.toFixed(2)}`, r] as const
    })
    it.each(cases)('%s', (_title, r) => {
      expect(r).toBeGreaterThanOrEqual(4.5)
    })
  })
}

describe('colour parser', () => {
  it('throws when a referenced var is missing, never substituting a default', () => {
    expect(() => parse({ a: 'var(--b)' }, 'var(--a)')).toThrow(
      /theme: --b missing/
    )
  })

  it('rejects hex (and any non-oklch syntax)', () => {
    expect(() => parse({}, '#000c2c')).toThrow(/unparseable/)
    expect(() => parse({}, 'hsl(220 50% 10%)')).toThrow(/unparseable/)
  })

  it('accepts percentage lightness and alpha', () => {
    const [L, C, H, A] = parse({}, 'oklch(50% 0.1 200 / 50%)')
    expect([L, C, H, A]).toEqual([0.5, 0.1, 200, 0.5])
  })
})
