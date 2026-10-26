/// <reference types="@cloudflare/vitest-plugin/types" />
import { DrizzleQueryError } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthorizedPartiesUnset } from './authorized-parties'
import { onApiError } from './errors'
import { catalog } from './i18n'

/**
 * onApiError contract (SEC-04, D-10/D-11): an HTTPException keeps its status and gets
 * the localized envelope; anything else is a 500 that logs exactly
 * `<status> <METHOD> <path> <ErrorClass>` and nothing from the request.
 */
const app = new Hono()
app.get('/forbidden', () => {
  throw new HTTPException(403)
})
app.get('/bad', () => {
  throw new HTTPException(400, { message: 'Malformed JSON in request body' })
})
app.get('/unavailable', () => {
  throw new HTTPException(503)
})
app.get('/boom', () => {
  throw new DrizzleQueryError(
    'select * from items where email = ?',
    ['secret@example.com'],
    new Error('D1_ERROR')
  )
})
app.get('/unset', () => {
  throw new AuthorizedPartiesUnset()
})
app.onError(onApiError)

const get = (path: string, cookie?: string) =>
  app.request(`http://localhost${path}`, {
    headers: cookie ? { cookie } : {},
  })

describe('onApiError (SEC-04, D-10/D-11)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('HTTPException(403) keeps 403, localized envelope, no log', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await get('/forbidden')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: catalog.en.forbidden,
      path: '/forbidden',
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('HTTPException(400) keeps 400 and never echoes its message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await get('/bad')
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      error: catalog.en.invalidBody,
      path: '/bad',
    })
    expect(text).not.toContain('Malformed')
    expect(spy).not.toHaveBeenCalled()
  })

  it('DrizzleQueryError -> 500, one class-only log line without query data', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await get('/boom?q=secret')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: catalog.en.internal,
      path: '/boom',
    })
    expect(spy).toHaveBeenCalledTimes(1)
    const args = spy.mock.calls[0]
    expect(args).toHaveLength(1)
    expect(typeof args[0]).toBe('string')
    const line = args[0] as string
    expect(line).toMatch(/^500 GET \/boom DrizzleQueryError$/)
    expect(line).not.toContain('secret')
    expect(line).not.toContain('q=')
  })

  it('AuthorizedPartiesUnset is logged by its name', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await get('/unset')
    expect(res.status).toBe(500)
    expect(spy).toHaveBeenCalledWith('500 GET /unset AuthorizedPartiesUnset')
  })

  it('HTTPException(503) keeps 503 and is logged', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await get('/unavailable')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: catalog.en.internal,
      path: '/unavailable',
    })
    expect(spy).toHaveBeenCalledWith('503 GET /unavailable HTTPException')
  })

  it('dir=rtl answers in Hebrew; any other value answers in English', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const he = (await (await get('/boom', 'dir=rtl')).json()) as {
      error: string
    }
    expect(he.error).toBe(catalog.he.internal)
    for (const cookie of ['dir=RTL', 'dir=xx']) {
      const en = (await (await get('/boom', cookie)).json()) as {
        error: string
      }
      expect(en.error).toBe(catalog.en.internal)
    }
  })
})
