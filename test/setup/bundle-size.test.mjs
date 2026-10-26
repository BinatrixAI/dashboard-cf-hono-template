// bundle-size.test.mjs — CICD-07 (D-06..D-09): proves the bundle ceiling sums, fails and refuses.
// Hermetic: a fixture SPA build in a tmpdir. No build, no spawn, nothing touches the real dist/.
import { describe, it, expect, afterEach } from 'vitest'
import { rmSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { measure, check, run } from '../../scripts/bundle-size.mjs'

const sandboxes = []
afterEach(() => {
  while (sandboxes.length) rmSync(sandboxes.pop(), { recursive: true, force: true })
})

const sandbox = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bundle-'))
  sandboxes.push(dir)
  return dir
}

const FILES = {
  'entry.js': 'import "./dep.js";\n'.repeat(40) + 'console.log("entry")\n',
  'dep.js': 'export const dep = ' + JSON.stringify('d'.repeat(500)) + '\n',
  'lazy.js': 'export default function lazy() { return ' + JSON.stringify('x'.repeat(2000)) + ' }\n',
}
const gz = (name) => gzipSync(Buffer.from(FILES[name])).length

function fixture() {
  const dir = sandbox()
  mkdirSync(path.join(dir, 'assets'))
  for (const [name, body] of Object.entries(FILES)) writeFileSync(path.join(dir, 'assets', name), body)
  writeFileSync(
    path.join(dir, 'index.html'),
    `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/entry.js"></script>
<link rel="modulepreload" crossorigin href="/assets/dep.js">
<link rel="stylesheet" crossorigin href="/assets/index.css">
</head><body><div id="root"></div></body></html>`
  )
  return dir
}

describe('bundle-size (CICD-07)', () => {
  it('measure sums entry + modulepreload as initial and every assets/*.js as total', () => {
    expect(measure(fixture())).toEqual({
      entryGzip: gz('entry.js'),
      initialGzip: gz('entry.js') + gz('dep.js'),
      totalGzip: gz('entry.js') + gz('dep.js') + gz('lazy.js'),
      initialFiles: 2,
      totalFiles: 3,
    })
  })

  it('check passes when both measures are within their ceilings', () => {
    const m = measure(fixture())
    expect(check(m, { initialGzip: m.initialGzip, totalGzip: m.totalGzip })).toEqual([])
  })

  it('check flags initial JS over its ceiling with measured, allowed and the raise hint', () => {
    const m = { entryGzip: 1, initialGzip: 300000, totalGzip: 10, initialFiles: 1, totalFiles: 1 }
    const msgs = check(m, { initialGzip: 295120, totalGzip: 100 })
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toContain('300,000 B')
    expect(msgs[0]).toContain('295,120 B')
    expect(msgs[0]).toContain('scripts/bundle-size.mjs')
  })

  it('check flags total JS over its ceiling', () => {
    const m = measure(fixture())
    const msgs = check(m, { initialGzip: m.initialGzip, totalGzip: m.totalGzip - 1 })
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatch(/^total JS/)
  })

  it('run returns 2 when there is no build to measure', async () => {
    expect(await run([sandbox()])).toBe(2)
  })

  it('run returns 0 on a fixture build within the shipped ceilings', async () => {
    expect(await run([fixture()])).toBe(0)
  })
})
