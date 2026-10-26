import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { t, type ErrorKey } from './i18n'

const keyFor = (status: number): ErrorKey =>
  status === 400
    ? 'invalidBody'
    : status === 401
      ? 'unauthorized'
      : status === 403
        ? 'forbidden'
        : status === 404
          ? 'notFound'
          : 'internal'

/**
 * Terminal error handler: every throw becomes the localized `{ error, path }` envelope
 * the SPA expects, never Hono's text/plain response.
 *
 * - HTTPException keeps its status (csrf's 403, the validator's 400; D-11). Its own
 *   response (plain text) and message (parse detail) are never returned.
 * - Expected 4xx are not logged. Everything else logs ONE line:
 *   `<status> <METHOD> <path> <ErrorClass>` (D-10). Never the message, stack or error
 *   object (Drizzle puts bound parameters in its message) and never the query string.
 */
export const onApiError: ErrorHandler = (err, c) => {
  const path = c.req.path // pathname only, never c.req.url
  const status = err instanceof HTTPException ? err.status : 500
  if (status < 500) return c.json({ error: t(c, keyFor(status)), path }, status)
  // DrizzleQueryError never sets `name`, so fall back to the class name (Pitfall 6).
  const cls = err.name !== 'Error' ? err.name : err.constructor.name
  // Intentional log; the worker has no other observability sink at this seam.
  // eslint-disable-next-line no-console
  console.error(`${status} ${c.req.method} ${path} ${cls}`)
  return c.json({ error: t(c, 'internal'), path }, status)
}
