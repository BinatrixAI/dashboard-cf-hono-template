import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { safeRedirect } from './safe-redirect'

const ORIGIN = 'http://localhost:5173'
const FALLBACK = '/dashboard'

beforeAll(() => {
  vi.stubGlobal('window', { location: { origin: ORIGIN } })
})
afterAll(() => {
  vi.unstubAllGlobals()
})

describe('safeRedirect', () => {
  it('returns same-origin targets as path + search + hash', () => {
    expect(safeRedirect('/dashboard', FALLBACK)).toBe('/dashboard')
    expect(safeRedirect('/items?x=1#h', FALLBACK)).toBe('/items?x=1#h')
    expect(safeRedirect(`${ORIGIN}/items`, FALLBACK)).toBe('/items')
  })

  it('returns the parsed path, not the raw input (WR-04)', () => {
    expect(safeRedirect('http:evil.example', FALLBACK)).toBe('/evil.example')
  })

  it('falls back on a leading backslash (a prefix check misses it)', () => {
    expect(new URL('/\\evil.example', ORIGIN).host).toBe('evil.example')
    expect(safeRedirect('/\\evil.example', FALLBACK)).toBe(FALLBACK)
  })

  it('falls back on protocol-relative, foreign, javascript: and userinfo forms', () => {
    expect(safeRedirect('//evil.example', FALLBACK)).toBe(FALLBACK)
    expect(safeRedirect('  //evil.example', FALLBACK)).toBe(FALLBACK)
    expect(safeRedirect('https://evil.example/x', FALLBACK)).toBe(FALLBACK)
    expect(safeRedirect('javascript:alert(1)', FALLBACK)).toBe(FALLBACK)
    expect(safeRedirect('https://user@evil.example', FALLBACK)).toBe(FALLBACK)
  })

  it.each([
    '/.//evil.example',
    '/..//evil.example',
    '/%2e//evil.example',
    `${ORIGIN}//evil.example`,
    '/\t/evil.example',
    '/\\/evil.example',
    '/x/..//evil.example',
  ])('falls back when the resolved path is protocol-relative: %s', (v) => {
    expect(safeRedirect(v, FALLBACK)).toBe(FALLBACK)
  })

  it('keeps a percent-encoded backslash, which resolves to a same-origin path', () => {
    expect(safeRedirect('/%5Cevil.example', FALLBACK)).toBe('/%5Cevil.example')
  })

  it('falls back on missing, empty and non-string values', () => {
    expect(safeRedirect(undefined, FALLBACK)).toBe(FALLBACK)
    expect(safeRedirect('', FALLBACK)).toBe(FALLBACK)
    expect(safeRedirect(42, FALLBACK)).toBe(FALLBACK)
    expect(safeRedirect(['/a'], FALLBACK)).toBe(FALLBACK)
  })
})
