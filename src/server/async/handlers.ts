import { sendEmail } from './email'
import type { AsyncEnv, DigestMessage } from './messages'

/**
 * The ONE believable end-to-end Cron -> Queue -> Resend example job (D-01).
 *
 * `scheduled` is the Cron Trigger entry (producer): it builds a `DigestMessage` and enqueues
 * it. `queue` is the Queue consumer entry: it drains the batch and sends each message as an
 * email via the raw-fetch Resend helper.
 *
 * Both are LIVE and type-checked, but DORMANT by default: with no `triggers.crons` and no
 * `queues.consumers` declared in wrangler.jsonc, the platform never invokes them (ASYNC-02).
 * They are wired in only via the commented arming seam in `src/server/index.ts` at activation.
 *
 * `ScheduledController`, `ExecutionContext`, `MessageBatch<T>`, and `Message<T>` are all GLOBAL
 * (from worker-configuration.d.ts / @cloudflare/workers-types) — no imports needed.
 */

// Cron entry (producer). Builds one DigestMessage per run and enqueues it through the
// producer binding. D-04: the binding is absent from generated `Env`, so we cast to
// `AsyncEnv` at the call site.
export async function scheduled(
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const msg: DigestMessage = {
    to: 'ops@example.com', // swap for your real recipient / a list resolved at send time
    subject: 'Daily digest',
    body: `Scheduled run at ${new Date(controller.scheduledTime).toISOString()} (cron ${controller.cron}).`,
    generatedAt: new Date().toISOString(),
  }
  await (env as AsyncEnv).__QUEUE_BINDING__.send(msg)
}

// Queue entry (consumer). Per-message ack/retry around the external Resend call — one bad
// message never replays the whole batch. Do NOT ack the entire batch at once: that silently
// drops failed messages (no retry, no DLQ). A thrown send retries with a short backoff;
// `max_retries` + the DLQ (configured at activation in wrangler.jsonc) bound the replays.
export async function queue(
  batch: MessageBatch<DigestMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await sendEmail(env, {
        to: message.body.to,
        subject: message.body.subject,
        text: message.body.body,
      })
      message.ack() // success — never reprocess this message
    } catch (err) {
      // Server-side log only; status/short message, never recipient PII (T-07-01).
      // eslint-disable-next-line no-console
      console.error('digest email failed; will retry', err)
      message.retry({ delaySeconds: 30 }) // transient — replay; DLQ after max_retries
    }
  }
}
