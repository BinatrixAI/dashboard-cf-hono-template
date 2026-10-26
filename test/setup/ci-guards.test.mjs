// ci-guards.test.mjs — CICD-07 repo invariants, each pure and in-process (no spawn, no tree copy).
// D-05: no D1 transaction — D1 rejects BEGIN, so drizzle's db.transaction() fails at runtime; use db.batch.
// D-05: no leftover sentinel after setup — runs setup.mjs's own substitute() + scanForSentinels(), no regex here.
// 24-UAT item 7a: sidebar open state is width-derived, never persisted in a cookie (Phase 24 D-06/D-07).
// D-06: every check has a fixture below that is seen to fail.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanForSentinels, substitute, SUBSTITUTION_FILESET, deriveNames } from '../../setup.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))

// [{ file, text }] for every file under `dir` whose name matches `ext`, minus tests.
function readTree(dir, ext) {
  return readdirSync(path.join(root, dir), { recursive: true })
    .filter((f) => ext.test(f) && !/\.test\./.test(f))
    .map((f) => ({
      file: path.posix.join(dir, f.split(path.sep).join('/')),
      text: readFileSync(path.join(root, dir, f), 'utf8'),
    }))
}

function transactionCalls(files) {
  return files.flatMap(({ file, text }) =>
    text.split('\n').flatMap((line, i) =>
      // same comment-tail strip as scanForSentinels: keeps `://`, drops ` // …`
      /\.transaction\s*\(/.test(line.replace(/\s\/\/.*$/, '')) ? [`${file}:${i + 1}`] : [],
    ),
  )
}

// Template: every setup token resolves in memory. Fork: collect stays empty and the scan reads
// disk. Either way, any token setup does not substitute is left over and lands in hardFails.
function leftoverSentinels(mutate = (files) => files) {
  const vals = { ...deriveNames('CI Guard'), d1Name: 'ci-guard', origin: '', clerkPk: '' }
  const collect = {}
  substitute(root, vals, { dryRun: true, collect })
  return scanForSentinels(root, SUBSTITUTION_FILESET, mutate(collect)).hardFails
}

function sidebarCookie(files) {
  return files.filter(({ text }) => text.includes('sidebar_state')).map(({ file }) => file)
}

describe('ci-guards — no D1 .transaction( in src/server (D-05)', () => {
  it('real tree has none', () => {
    expect(transactionCalls(readTree('src/server', /\.ts$/))).toEqual([])
  })
  it('fixture: a db.transaction call is flagged (D-06)', () => {
    const bad = [{ file: 'src/server/x.ts', text: 'await db.transaction(async (tx) => {})' }]
    expect(transactionCalls(bad)).toEqual(['src/server/x.ts:1'])
  })
})

describe('ci-guards — no leftover sentinel after setup (D-05)', () => {
  it('real tree: setup resolves every identifier sentinel', () => {
    expect(leftoverSentinels()).toEqual([])
  })
  it('fixture: a token setup never substitutes is flagged (D-06)', () => {
    const hardFails = leftoverSentinels((files) => {
      const html = files['index.html'] ?? readFileSync(path.join(root, 'index.html'), 'utf8')
      return { ...files, 'index.html': `${html}\n<meta name="x" content="__CMS_API_URL__">` }
    })
    expect(hardFails).toHaveLength(1)
    expect(hardFails[0]).toContain('__CMS_API_URL__')
  })
})

describe('ci-guards — no sidebar open-state cookie (24-UAT 7a)', () => {
  it('real tree has none', () => {
    expect(sidebarCookie(readTree('src/client', /\.tsx?$/))).toEqual([])
  })
  it('fixture: setting the sidebar_state cookie is flagged (D-06)', () => {
    const bad = [{ file: 'src/client/x.ts', text: "document.cookie = 'sidebar_state=true; path=/'" }]
    expect(sidebarCookie(bad)).toEqual(['src/client/x.ts'])
  })
})
