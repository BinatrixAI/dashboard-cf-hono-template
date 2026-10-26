import i18n from '@/i18n'
import { toast } from 'sonner'
import { HttpError, statusOf } from '@/lib/http-error'

/**
 * Toast a failed mutation: the server's localized `error` when it sent one,
 * otherwise a localized key by status (no status = network failure).
 */
export function handleServerError(error: unknown) {
  // eslint-disable-next-line no-console
  if (import.meta.env.DEV) console.log(error)

  const status = statusOf(error)
  const key =
    status === undefined || status >= 500
      ? 'common.internalServerError'
      : 'common.requestFailed'

  toast.error(
    (error instanceof HttpError && error.serverMessage) || i18n.t(key)
  )
}
