/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as email from './email'
import { queue, scheduled } from './handlers'
import type { DigestMessage } from './messages'

/**
 * Unit tests for the Cron producer (`scheduled`) + Queue consumer (`queue`) handlers.
 *
 * Runs in the `workers` Vitest project. Drives the handlers directly with hand-built
 * stubs (no real queue / no real Resend):
 *  - `queue()` is fed a fake `MessageBatch` whose messages carry `ack`/`retry` spies;
 *    `sendEmail` is stubbed to force the success (ack) and throw (retry) paths.
 *  - `scheduled()` is fed a fake env exposing `{ __QUEUE_BINDING__: { send: vi.fn() } }`
 *    (the D-04 producer binding) and a stub ScheduledController; we assert exactly one
 *    enqueue of a DigestMessage-shaped object.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

function fakeMessage(body: DigestMessage) {
  return { body, ack: vi.fn(), retry: vi.fn() }
}

function fakeBatch(
  messages: ReturnType<typeof fakeMessage>[]
): MessageBatch<DigestMessage> {
  return { messages } as unknown as MessageBatch<DigestMessage>
}

const sampleBody: DigestMessage = {
  to: 'rcpt@example.com',
  subject: 'Daily digest',
  body: 'scheduled run',
  generatedAt: '2026-06-30T09:00:00.000Z',
}

const ctx = {} as ExecutionContext

describe('queue() consumer — per-message ack/retry', () => {
  it('calls ack() once on a successful send (and never retry)', async () => {
    vi.spyOn(email, 'sendEmail').mockResolvedValue(undefined)
    const msg = fakeMessage(sampleBody)

    await queue(fakeBatch([msg]), {} as Env, ctx)

    expect(email.sendEmail).toHaveBeenCalledTimes(1)
    expect(msg.ack).toHaveBeenCalledTimes(1)
    expect(msg.retry).not.toHaveBeenCalled()
  })

  it('calls retry() once when the send throws (and never ack)', async () => {
    vi.spyOn(email, 'sendEmail').mockRejectedValue(
      new Error('Resend send failed: 500')
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const msg = fakeMessage(sampleBody)

    await queue(fakeBatch([msg]), {} as Env, ctx)

    expect(msg.retry).toHaveBeenCalledTimes(1)
    expect(msg.ack).not.toHaveBeenCalled()
  })
})

describe('scheduled() producer — enqueues one DigestMessage', () => {
  it('calls __QUEUE_BINDING__.send() exactly once with a DigestMessage-shaped object', async () => {
    const send = vi.fn(async () => {})
    const env = { __QUEUE_BINDING__: { send } } as unknown as Env
    const controller = {
      scheduledTime: Date.parse('2026-06-30T09:00:00.000Z'),
      cron: '0 9 * * *',
      noRetry: () => {},
    } as unknown as ScheduledController

    await scheduled(controller, env, ctx)

    expect(send).toHaveBeenCalledTimes(1)
    const [msg] = send.mock.calls[0] as [DigestMessage]
    expect(typeof msg.to).toBe('string')
    expect(typeof msg.subject).toBe('string')
    expect(typeof msg.body).toBe('string')
    expect(typeof msg.generatedAt).toBe('string')
  })
})
