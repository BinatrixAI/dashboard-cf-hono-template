/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from './email'

/**
 * Unit tests for the raw-fetch Resend helper (D-02 — ZERO npm dependency, raw `fetch`).
 *
 * These run in the `workers` Vitest project (file lives under `src/server/**\/*.test.ts`),
 * but unlike settings.test.ts they do NOT drive `app.request` — `sendEmail()` is a plain
 * outbound-HTTP helper, so we mock `globalThis.fetch` via `vi.stubGlobal` and assert the
 * request shape (URL, Bearer auth, JSON body), the unset-key no-op, and the throw-on-non-2xx.
 *
 * Security: the Bearer key asserted here is an obvious placeholder test value — never a real
 * Resend key — and the recipient/body are synthetic. No PII, no real secret.
 */

const RESEND_URL = 'https://api.resend.com/emails'
const TEST_KEY = 're_test_placeholder_key'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function envWith(apiKey?: string): Env {
  // RESEND_API_KEY is a secret absent from generated `Env` — cast to attach it for the test.
  return { RESEND_API_KEY: apiKey } as unknown as Env
}

describe('sendEmail() raw-fetch Resend helper (D-02)', () => {
  it('POSTs to the Resend endpoint with Bearer auth and a JSON body (from/to/subject/text)', async () => {
    const fetchMock = vi.fn(
      async () => new Response('{"id":"abc"}', { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendEmail(envWith(TEST_KEY), {
      to: 'rcpt@example.com',
      subject: 'Daily digest',
      text: 'hello',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(RESEND_URL)
    expect(init.method).toBe('POST')

    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${TEST_KEY}`)
    expect(headers['content-type']).toContain('application/json')

    const body = JSON.parse(init.body as string) as {
      from: string
      to: string
      subject: string
      text?: string
    }
    expect(body.to).toBe('rcpt@example.com')
    expect(body.subject).toBe('Daily digest')
    expect(body.text).toBe('hello')
    expect(typeof body.from).toBe('string')
  })

  it('no-ops (performs NO fetch) when RESEND_API_KEY is unset', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    // silence the intentional console.warn in the unset-key path
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await sendEmail(envWith(undefined), {
      to: 'rcpt@example.com',
      subject: 'Daily digest',
      text: 'hello',
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when Resend returns a non-2xx response', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('forbidden', {
          status: 422,
          statusText: 'Unprocessable Entity',
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      sendEmail(envWith(TEST_KEY), {
        to: 'rcpt@example.com',
        subject: 'Daily digest',
        text: 'hello',
      })
    ).rejects.toThrow()
  })
})
