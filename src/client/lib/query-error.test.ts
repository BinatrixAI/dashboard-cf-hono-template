import { describe, expect, it } from 'vitest'
import { HttpError, statusOf } from '@/lib/http-error'
import { leavesForErrorPage, shouldRetry } from '@/lib/query-error'

describe('leavesForErrorPage', () => {
  it('leaves only when nothing is on screen', () => {
    expect(leavesForErrorPage({ state: { data: undefined } })).toBe(true)
  })

  it.each([[[]], [null], [0], [''], [false], [[{ id: 'a' }]]])(
    'keeps the screen when data is %j',
    (data) => {
      expect(leavesForErrorPage({ state: { data } })).toBe(false)
    }
  )
})

describe('statusOf', () => {
  it('reads the status off an HttpError', () => {
    expect(statusOf(new HttpError(503, 'x'))).toBe(503)
  })

  it('is undefined for anything that is not an HttpError', () => {
    expect(statusOf(new Error('x'))).toBeUndefined()
    expect(statusOf({ status: 401 })).toBeUndefined()
    expect(statusOf(new TypeError('Failed to fetch'))).toBeUndefined()
  })
})

describe('shouldRetry', () => {
  it.each([400, 401, 403, 404, 409, 422])('never retries a %i', (status) => {
    expect(shouldRetry(0, new HttpError(status, 'x'))).toBe(false)
  })

  it.each([500, 502, 503])('retries a %i', (status) => {
    expect(shouldRetry(0, new HttpError(status, 'x'))).toBe(true)
  })

  it.each([new TypeError('Failed to fetch'), new Error('x')])(
    'retries a failure with no status (%s)',
    (error) => {
      expect(shouldRetry(0, error)).toBe(true)
    }
  )

  it('keeps the failureCount cap', () => {
    expect(shouldRetry(3, new HttpError(503, 'x'))).toBe(true)
    expect(shouldRetry(4, new HttpError(503, 'x'))).toBe(false)
  })
})
