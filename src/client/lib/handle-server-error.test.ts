import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleServerError } from '@/lib/handle-server-error'
import { HttpError, toHttpError } from '@/lib/http-error'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
// The identity t() makes each assertion name the key that was chosen.
vi.mock('@/i18n', () => ({ default: { t: (k: string) => k } }))

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('handleServerError (localized mutation toast, WR-06)', () => {
  let log: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    log.mockRestore()
  })

  it("toasts the server's localized error, end to end from a real Response", async () => {
    const res = jsonResponse({ error: 'גוף הבקשה אינו תקין', path: '/x' }, 400)
    handleServerError(await toHttpError(res, 'Failed to save settings (400)'))
    expect(toast.error).toHaveBeenCalledWith('גוף הבקשה אינו תקין')
  })

  it.each([400, 404, 500, 503])(
    'prefers the server message over the status key for %i',
    (status) => {
      handleServerError(new HttpError(status, 'dev text', 'server text'))
      expect(toast.error).toHaveBeenCalledWith('server text')
    }
  )

  it.each([500, 502, 503])(
    'falls back to internalServerError for a bare %i',
    (status) => {
      handleServerError(new HttpError(status, 'dev text'))
      expect(toast.error).toHaveBeenCalledWith('common.internalServerError')
    }
  )

  it.each([400, 404, 409, 422])(
    'falls back to requestFailed for a bare %i',
    (status) => {
      handleServerError(new HttpError(status, 'dev text'))
      expect(toast.error).toHaveBeenCalledWith('common.requestFailed')
    }
  )

  it.each([new TypeError('Failed to fetch'), new Error('x'), 'boom'])(
    'treats a non-HttpError (%s) as a server/network failure',
    (error) => {
      handleServerError(error)
      expect(toast.error).toHaveBeenCalledWith('common.internalServerError')
    }
  )

  it('does not log in production', () => {
    vi.stubEnv('DEV', false)
    handleServerError(new HttpError(500, 'x'))
    expect(log).not.toHaveBeenCalled()
  })

  it('logs the error once in development', () => {
    vi.stubEnv('DEV', true)
    const error = new HttpError(500, 'x')
    handleServerError(error)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(error)
  })
})

describe('toHttpError', () => {
  it.each([
    ['a non-JSON body', new Response('nope', { status: 502 }), 502],
    ['a non-string error', jsonResponse({ error: 42 }, 400), 400],
    ['an empty error', jsonResponse({ error: '' }, 422), 422],
    ['a JSON null body', jsonResponse(null, 500), 500],
  ])('leaves serverMessage unset for %s', async (_, res, status) => {
    const err = await toHttpError(res, 'dev text')
    expect(err).toBeInstanceOf(HttpError)
    expect(err.status).toBe(status)
    expect(err.message).toBe('dev text')
    expect(err.serverMessage).toBeUndefined()
  })
})
