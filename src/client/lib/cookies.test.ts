import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCookieOf, setCookie } from './cookies'

const DIRS = ['ltr', 'rtl'] as const
const THEMES = ['dark', 'light', 'system'] as const

const withCookie = (cookie: string) => vi.stubGlobal('document', { cookie })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getCookieOf (SEC-08 allow-list reader)', () => {
  it('returns an allowed value', () => {
    withCookie('dir=rtl')
    expect(getCookieOf('dir', DIRS, 'ltr')).toBe('rtl')
  })

  it.each([
    'dir=xx',
    'dir=',
    'dir=__proto__',
    'dir=constructor',
    'dir=RTL',
    'theme=dark',
    'xdir=rtl',
    'dir=rtl; dir=ltr',
  ])('%j falls back to the default', (cookie) => {
    withCookie(cookie)
    expect(getCookieOf('dir', DIRS, 'ltr')).toBe('ltr')
  })

  it('ignores an adjacent cookie name', () => {
    withCookie('dir=rtl; xdir=ltr')
    expect(getCookieOf('dir', DIRS, 'ltr')).toBe('rtl')
    withCookie('my-vite-ui-theme=dark')
    expect(getCookieOf('vite-ui-theme', THEMES, 'system')).toBe('system')
    withCookie('vite-ui-theme=dark')
    expect(getCookieOf('vite-ui-theme', THEMES, 'system')).toBe('dark')
  })

  it('returns the fallback without a document', () => {
    expect(getCookieOf('dir', DIRS, 'ltr')).toBe('ltr')
  })
})

describe('setCookie flags (SEC-08)', () => {
  it('writes path, max-age, secure and samesite=lax', () => {
    withCookie('')
    setCookie('dir', 'rtl', 60)
    expect(document.cookie).toBe(
      'dir=rtl; path=/; max-age=60; secure; samesite=lax'
    )
  })
})
