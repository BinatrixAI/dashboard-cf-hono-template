import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'

/**
 * Server-only error catalog (D-06). src/client must never import this file, so the
 * strings stay out of the client bundle. English is byte-identical to the literals the
 * API answered with before localization, so existing clients and tests see no change.
 */
const en = {
  invalidBody: 'Invalid request',
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  notFound: 'Not Found',
  internal: 'Internal Server Error',
  upstream: 'Failed to list users',
} as const

const he: Record<keyof typeof en, string> = {
  invalidBody: 'בקשה לא תקינה',
  unauthorized: 'לא מורשה',
  forbidden: 'אין הרשאה',
  notFound: 'לא נמצא',
  internal: 'שגיאת שרת פנימית',
  upstream: 'טעינת המשתמשים נכשלה',
}

export const catalog = { en, he }

export type ErrorKey = keyof typeof en

/**
 * Same rule as the client's langFromDir (D-04): the `dir` cookie exactly 'rtl' means
 * Hebrew, anything else English. A fixed two-way choice, so cookie text never indexes
 * an object. A helper, not a middleware: it works inside onError even when no
 * middleware ran, and it adds no route.
 */
export const t = (c: Context, key: ErrorKey): string =>
  (getCookie(c, 'dir') === 'rtl' ? he : en)[key]
