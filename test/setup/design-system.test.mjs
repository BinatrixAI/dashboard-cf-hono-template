// design-system.test.mjs — CICD-07 design-system guard over src/client (.ts/.tsx/.css).
// D-01: colours come from theme tokens only, so every fork reskins via a tweakcn preset.
// D-02: logical properties only (ms-/pe-/start-/border-s …), so every screen mirrors in RTL.
// D-06: the fixtures below are seen to fail.
// Bare black/white (stock shadcn overlays) have no shade and are out of scope for D-01.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))

const PALETTE =
  /(?<![\w-])(?:[\w-]+:)*(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g
// The lookahead keeps `#add-user`-style fragments out; `bg-[#fff]` still fails.
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g
// Token-boundary form (RESEARCH D-02): catches variant prefixes, skips English prose.
// The last branch (25-07): a multi-value arbitrary radius `rounded-[a_b_c_d]` lists physical corners.
const DIRECTION =
  /(?<![\w-])(?:[\w\-[\]&=.*>~+()'"@/]+:)*!?-?(?:(?:m|p|scroll-m|scroll-p)[lr]|left|right|inset-[lr]|border-[lr]|rounded-[lr]|rounded-[tb][lr])-(?:\[[^\]\s]+\]|[\w./]+)|(?<![\w-])(?:[\w-]+:)*(?:text|float|clear)-(?:left|right)\b|(?<![\w-])(?:[\w\-[\]&=.*>~+()'"@/]+:)*!?rounded-\[[^\]\s_()]+(?:_[^\]\s_()]+){1,3}\]/g

// D-01: allowed by path prefix, each with its reason. No palette allowlist: none are allowed.
const HEX_OK = {
  'src/client/assets/custom/': 'theme-preview pictures must show fixed light/dark',
  'src/client/components/ui/chart.tsx': 'Recharts default-stroke attribute selectors, not colours',
  'src/client/styles/index.css': 'edge-fade mask stop, not a colour',
  'src/client/styles/theme.css': 'written verbatim from the tweakcn preset by setup.mjs --theme',
}
// D-02: allowed by file AND class, each with its reason.
const DIRECTION_OK = {
  'src/client/components/data-table/bulk-actions.tsx': {
    classes: ['left-1/2'],
    reason: 'left-1/2 + -translate-x-1/2 is symmetric centring, direction-neutral',
  },
}

// [{ file, text }] → ['file:line token'] for every `re` match not allowed for that file.
function scan(files, re, allowed = () => false) {
  return files.flatMap(({ file, text }) =>
    text.split('\n').flatMap((line, i) =>
      [...line.matchAll(re)]
        .filter(([token]) => !allowed(file, token))
        .map(([token]) => `${file}:${i + 1} ${token}`),
    ),
  )
}

const colourViolations = (files) => [
  ...scan(files, PALETTE),
  ...scan(files, HEX, (file) => Object.keys(HEX_OK).some((p) => file.startsWith(p))),
]
const directionViolations = (files) =>
  scan(files, DIRECTION, (file, token) => DIRECTION_OK[file]?.classes.includes(token) ?? false)

const real = readdirSync(path.join(root, 'src/client'), { recursive: true })
  .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f) && !f.endsWith('routeTree.gen.ts'))
  .map((f) => ({
    file: path.posix.join('src/client', f.split(path.sep).join('/')),
    text: readFileSync(path.join(root, 'src/client', f), 'utf8'),
  }))

const BAD = "<p className='dark:bg-blue-950 ml-2 text-right' style={{ color: '#ff0000' }} />"

describe('design-system guard — colour (D-01)', () => {
  it('src/client uses tokens only', () => {
    expect(colourViolations(real)).toEqual([])
  })
  it('fixture: a palette class and a raw hex are flagged (D-06)', () => {
    const files = [{ file: 'src/client/x.tsx', text: BAD }]
    expect(scan(files, PALETTE)).toEqual(['src/client/x.tsx:1 dark:bg-blue-950'])
    expect(colourViolations(files)).toEqual([
      'src/client/x.tsx:1 dark:bg-blue-950',
      'src/client/x.tsx:1 #ff0000',
    ])
  })
  it('fixture: a #fragment link is not a colour', () => {
    expect(colourViolations([{ file: 'src/client/x.tsx', text: "<a href='#add-user' />" }])).toEqual([])
  })
  it('fixture: hex is allowed under an allowlisted path only', () => {
    expect(colourViolations([{ file: 'src/client/assets/custom/x.tsx', text: BAD }])).toEqual([
      'src/client/assets/custom/x.tsx:1 dark:bg-blue-950',
    ])
  })
})

describe('design-system guard — direction (D-02)', () => {
  it('src/client uses logical classes only', () => {
    expect(directionViolations(real)).toEqual([])
  })
  it('fixture: ml-2 and text-right are flagged (D-06)', () => {
    expect(directionViolations([{ file: 'src/client/x.tsx', text: BAD }])).toEqual([
      'src/client/x.tsx:1 ml-2',
      'src/client/x.tsx:1 text-right',
    ])
  })
  it('fixture: bulk-actions.tsx allows left-1/2 only', () => {
    const file = 'src/client/components/data-table/bulk-actions.tsx'
    expect(directionViolations([{ file, text: "'fixed left-1/2 left-2'" }])).toEqual([`${file}:1 left-2`])
  })
  it('fixture: a multi-value arbitrary radius is flagged, a single value is not', () => {
    const text =
      "'rounded-[16px_16px_0_16px] sm:rounded-[1rem_0] rounded-[16px] rounded-[inherit] rounded-[calc(var(--r)_-_2px)]'"
    expect(directionViolations([{ file: 'src/client/x.tsx', text }])).toEqual([
      'src/client/x.tsx:1 rounded-[16px_16px_0_16px]',
      'src/client/x.tsx:1 sm:rounded-[1rem_0]',
    ])
  })
  it('fixture: CSS declarations are not classes', () => {
    expect(directionViolations([{ file: 'src/client/x.css', text: 'margin-right: 0; left: 50%;' }])).toEqual([])
  })
})
