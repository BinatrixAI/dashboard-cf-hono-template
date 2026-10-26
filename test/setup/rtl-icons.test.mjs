// rtl-icons.test.mjs — CICD-07 / D-03: directional icons flip per icon in RTL, nothing is
// mirrored wholesale, and never-flipped icons stay put (Phase 24 D-08, 24-UI-SPEC). Locks
// 24-UAT item 7b. Every rule has a fixture that is seen to fail (D-06).
//
// Per-line opt-out: `rtl-icon-ok: <reason>` on the tag's own lines or the line directly above.
// Known limit: icons passed as data (the Tasks priority `icon: ArrowRight` in
// features/tasks/data/data.tsx) are invisible to a JSX scan; they are never flipped by design.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const clientRoot = fileURLToPath(new URL('../../src/client/', import.meta.url))

const ICON_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"](?:lucide-react|@radix-ui\/react-icons)['"]/g
const DIRECTIONAL = (n) => /Left|Right/.test(n) && !/LeftRight|RightLeft/.test(n)
const NEVER_FLIP = (n) =>
  /^(PanelLeft|PanelRight|ExternalLink|Chevrons?(Up|Down)|Arrow(Up|Down)|CaretSort)/.test(n)
const FLIP = /rtl:(?:rotate-180|-scale-x-100)/
const OPT_OUT = /rtl-icon-ok:\s*\w/
const BLANKET = /\[dir=['"]?rtl['"]?\][^{]*svg|rtl:\[&[_>]svg\]/

export function iconViolations(file, src) {
  // local name → imported name, so an alias (`ChevronLeftIcon as Prev`) is classified by its source
  const names = new Map()
  for (const m of src.matchAll(ICON_IMPORT))
    for (const spec of m[1].split(',')) {
      const [a, b] = spec.trim().replace(/^type\s+/, '').split(/\s+as\s+/)
      if (a) names.set((b ?? a).trim(), a.trim())
    }
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lines = src.split('\n')
  const out = []
  const walk = (n) => {
    if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
      const name = n.tagName.getText(sf)
      if (names.has(name)) {
        const s = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line
        const e = sf.getLineAndCharacterOfPosition(n.getEnd()).line
        const flipped = FLIP.test(n.getText(sf))
        const optedOut = OPT_OUT.test(lines.slice(Math.max(0, s - 1), e + 1).join('\n'))
        const real = names.get(name)
        if (NEVER_FLIP(real) && flipped) out.push(`${file}:${s + 1} ${name} must never flip`)
        else if (DIRECTIONAL(real) && !NEVER_FLIP(real) && !flipped && !optedOut)
          out.push(`${file}:${s + 1} ${name} needs rtl:rotate-180 / rtl:-scale-x-100`)
        else if (DIRECTIONAL(real) && NEVER_FLIP(real) && !optedOut)
          out.push(`${file}:${s + 1} ${name} needs an rtl-icon-ok: note (never flipped)`)
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return out
}

export function blanketMirror(file, text) {
  return text
    .split('\n')
    .flatMap((l, i) => (BLANKET.test(l) ? [`${file}:${i + 1} blanket RTL svg mirroring`] : []))
}

const sources = readdirSync(clientRoot, { recursive: true })
  .filter((f) => /\.(tsx|ts|css)$/.test(f) && !/\.test\./.test(f) && !f.endsWith('routeTree.gen.ts'))
  .map((f) => [f, readFileSync(path.join(clientRoot, f), 'utf8')])

describe('rtl-icons (CICD-07 / D-03)', () => {
  it('the real tree has no unflipped directional icon, never-flip violation or blanket mirror', () => {
    const out = sources.flatMap(([f, src]) => [
      ...(f.endsWith('.tsx') ? iconViolations(f, src) : []),
      ...blanketMirror(f, src),
    ])
    expect(out).toEqual([])
  })

  const bare = "import { ChevronRight } from 'lucide-react'\n"
  it('fails an unflipped directional icon (D-06)', () => {
    expect(iconViolations('x.tsx', bare + "const A = () => <ChevronRight className='size-4' />")).toHaveLength(1)
  })
  it('accepts an opt-out with a reason on the line above', () => {
    const src = bare + "const A = () => (\n  <>\n    {/* rtl-icon-ok: points at a physical edge */}\n    <ChevronRight className='size-4' />\n  </>\n)"
    expect(iconViolations('x.tsx', src)).toEqual([])
  })
  it('rejects a bare opt-out with no reason', () => {
    const src = bare + "const A = () => (\n  <>\n    {/* rtl-icon-ok: */}\n    <ChevronRight className='size-4' />\n  </>\n)"
    expect(iconViolations('x.tsx', src)).toHaveLength(1)
  })
  it('follows an aliased import', () => {
    const src = "import { ChevronLeftIcon as Prev } from 'lucide-react'\nconst A = () => <Prev />"
    expect(iconViolations('x.tsx', src)).toHaveLength(1)
  })
  it('accepts a flip class inside a multi-line cn()', () => {
    const src = bare + "const A = () => (\n  <ChevronRight\n    className={cn('size-4', 'rtl:rotate-180')}\n  />\n)"
    expect(iconViolations('x.tsx', src)).toEqual([])
  })
  it('fails a flip class on a never-flipped icon', () => {
    const src = "import { PanelLeftIcon } from 'lucide-react'\nconst A = () => <PanelLeftIcon className='rtl:-scale-x-100' />"
    expect(iconViolations('x.tsx', src)).toHaveLength(1)
  })
  it('fails a blanket [dir=rtl] svg mirroring rule', () => {
    expect(blanketMirror('x.css', "[dir='rtl'] .x svg { transform: scaleX(-1) }")).toHaveLength(1)
  })
})
