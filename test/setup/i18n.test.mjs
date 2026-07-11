// i18n.test.mjs — en/he locale parity gate.
// Enforces that both locales carry the SAME set of keys AND that each key uses the
// SAME set of {{token}} interpolation placeholders. This is the "both files move
// together" contract: adding a UI string to en.json without he.json (or with a
// mismatched interpolation token) fails the build.
//
// Runs in the plain-node `setup` project (include glob: test/setup/**/*.test.mjs),
// following the .mjs + vitest describe/it/expect convention of ci-gates.test.mjs.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const localesDir = fileURLToPath(
  new URL('../../src/client/i18n/locales/', import.meta.url)
)

const en = JSON.parse(readFileSync(localesDir + 'en.json', 'utf8'))
const he = JSON.parse(readFileSync(localesDir + 'he.json', 'utf8'))

/** Flatten a nested object into { 'a.b.c': 'value' }. */
function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key))
    } else {
      out[key] = v
    }
  }
  return out
}

/** Sorted set of {{token}} placeholders in a string. */
function tokens(value) {
  const found = new Set()
  const re = /\{\{\s*([^}]+?)\s*\}\}/g
  let m
  while ((m = re.exec(String(value))) !== null) found.add(m[1])
  return [...found].sort()
}

const flatEn = flatten(en)
const flatHe = flatten(he)

describe('i18n en/he parity', () => {
  it('has identical key sets', () => {
    const enKeys = Object.keys(flatEn).sort()
    const heKeys = Object.keys(flatHe).sort()
    const missingInHe = enKeys.filter((k) => !(k in flatHe))
    const missingInEn = heKeys.filter((k) => !(k in flatEn))
    expect(missingInHe, `keys missing from he.json: ${missingInHe.join(', ')}`).toEqual([])
    expect(missingInEn, `keys missing from en.json: ${missingInEn.join(', ')}`).toEqual([])
  })

  it('has identical {{token}} interpolation sets per key', () => {
    const mismatches = []
    for (const key of Object.keys(flatEn)) {
      if (!(key in flatHe)) continue
      const a = tokens(flatEn[key])
      const b = tokens(flatHe[key])
      if (a.join('|') !== b.join('|')) {
        mismatches.push(`${key}: en[${a.join(',')}] vs he[${b.join(',')}]`)
      }
    }
    expect(mismatches, `interpolation token mismatches:\n${mismatches.join('\n')}`).toEqual([])
  })

  it('contains no leftover __SENTINEL__ tokens (G1)', () => {
    const bad = [...Object.entries(flatEn), ...Object.entries(flatHe)].filter(
      ([, v]) => /__[A-Z0-9_]+__/.test(String(v))
    )
    expect(bad.map(([k]) => k), 'locale JSON must not contain __…__ sentinels').toEqual([])
  })
})
