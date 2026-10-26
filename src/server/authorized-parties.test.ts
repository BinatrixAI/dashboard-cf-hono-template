/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AuthorizedPartiesUnset,
  parseAuthorizedParties,
} from './authorized-parties'
import app from './index'

/**
 * SEC-02 / D-01 / D-02: the Clerk `azp` check is pinned to the configured
 * AUTHORIZED_PARTIES list and fails closed when that list is empty or still the
 * placeholder (Clerk skips the azp check entirely on an empty list).
 */

describe('parseAuthorizedParties — fail-closed parser (D-01/D-02)', () => {
  it.each([
    [''],
    ['   '],
    [','],
    [' , '],
    [undefined],
    ['REPLACE_WITH_YOUR_ORIGIN'],
    [' REPLACE_WITH_YOUR_ORIGIN , '],
  ])('throws AuthorizedPartiesUnset for %j', (raw) => {
    let caught: unknown
    try {
      parseAuthorizedParties(raw)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AuthorizedPartiesUnset)
    expect((caught as Error).name).toBe('AuthorizedPartiesUnset')
  })

  it('parses one real origin to a one-element list', () => {
    expect(parseAuthorizedParties('https://a.example')).toEqual([
      'https://a.example',
    ])
  })

  it('trims entries and keeps input order', () => {
    expect(
      parseAuthorizedParties(' https://a.example , http://localhost:5173 ')
    ).toEqual(['https://a.example', 'http://localhost:5173'])
  })

  it('drops a placeholder from a mixed list', () => {
    expect(
      parseAuthorizedParties('REPLACE_WITH_YOUR_ORIGIN,https://a.example')
    ).toEqual(['https://a.example'])
  })

  it('keeps duplicates as given (azp check is set membership)', () => {
    expect(
      parseAuthorizedParties('https://a.example,https://a.example')
    ).toEqual(['https://a.example', 'https://a.example'])
  })

  it('reduces each entry to its URL origin (case, trailing slash, path, default port)', () => {
    expect(
      parseAuthorizedParties(
        'https://App.example.com/,https://a.example/dashboard,https://a.example:443'
      )
    ).toEqual([
      'https://app.example.com',
      'https://a.example',
      'https://a.example',
    ])
  })

  it.each([
    ['localhost:5173'],
    ['not a url'],
    ['https://a.example,mailto:x@y'],
    ['https://*.workers.dev'],
    ['ws://a.example'],
    ['ftp://a.example'],
    ['https://app.example.com.'],
  ])(
    'throws AuthorizedPartiesUnset when an entry is not an origin: %j',
    (raw) => {
      expect(() => parseAuthorizedParties(raw)).toThrow(AuthorizedPartiesUnset)
      expect(() => parseAuthorizedParties(raw)).toThrow(
        'AUTHORIZED_PARTIES has a non-origin entry'
      )
    }
  )

  it('holds no module state between calls', () => {
    const a = parseAuthorizedParties('https://a.example')
    const b = parseAuthorizedParties('https://b.example')
    expect(a).toEqual(['https://a.example'])
    expect(b).toEqual(['https://b.example'])
    expect(a).not.toBe(b)
  })
})

describe('real Worker with a placeholder AUTHORIZED_PARTIES (D-02 fail-closed)', () => {
  const badEnv = {
    ...env,
    AUTHORIZED_PARTIES: 'REPLACE_WITH_YOUR_ORIGIN',
  } as Env

  afterEach(() => vi.restoreAllMocks())

  it('protected /api/items answers 500 { error, path } and logs AuthorizedPartiesUnset', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await app.request(
      'http://localhost/api/items',
      undefined,
      badEnv
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error?: unknown; path?: string }
    expect(typeof body.error).toBe('string')
    expect(body.path).toBe('/api/items')
    // String(err) is "<name>: <message>", so this survives a change of log format.
    expect(spy.mock.calls.flat().map(String).join(' ')).toContain(
      'AuthorizedPartiesUnset'
    )
  })

  it('/api/health still answers 200', async () => {
    const res = await app.request(
      'http://localhost/api/health',
      undefined,
      badEnv
    )
    expect(res.status).toBe(200)
  })
})
