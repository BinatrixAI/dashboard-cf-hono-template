// The outbound email contract for the async layer. `text` and `html` are both optional —
// `sendEmail` prefers `html` when present, else falls back to `text`.
export interface OutboundEmail {
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

/**
 * Raw POST to the Resend REST API — ZERO npm dependency (D-02). The `resend` SDK is
 * deliberately NOT used: it would bloat every fork's bundle for a dormant layer, and the
 * REST surface (`POST https://api.resend.com/emails`, Bearer auth, `{from,to,subject,html|text}`)
 * is stable and ~15 lines.
 *
 * `RESEND_API_KEY` is a `wrangler secret` (never committed), mirroring `CLERK_SECRET_KEY`.
 * Because it is a secret absent from `wrangler.jsonc` `vars`, it is also absent from the
 * generated global `Env` — so it is read through an inline cast, the same D-04 discipline
 * the queue binding uses.
 *
 * Fail-safe (Pitfall 5): when the key is UNSET this no-ops (warns + returns, no fetch) so an
 * accidentally-armed-but-unconfigured layer doesn't crash the consumer (which would otherwise
 * retry every message to the DLQ forever). Only a real non-2xx Resend response throws.
 *
 * Security (RESEARCH §V9, T-07-01): on failure we log `res.status` + `res.statusText` ONLY —
 * never the response body or recipient address (potential PII), and never the API key.
 */
export async function sendEmail(env: Env, mail: OutboundEmail): Promise<void> {
  const apiKey = (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn('RESEND_API_KEY unset — skipping email send (async layer armed but unconfigured).')
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      // Placeholder sender — a forker MUST swap a verified sender domain in Resend (A2).
      from: 'Acme <onboarding@resend.dev>',
      to: mail.to,
      subject: mail.subject,
      ...(mail.html ? { html: mail.html } : { text: mail.text ?? '' }),
    }),
  })

  if (!res.ok) {
    // Throw so the consumer retries (transient). Status + statusText only — no body, no PII.
    throw new Error(`Resend send failed: ${res.status} ${res.statusText}`)
  }
}
