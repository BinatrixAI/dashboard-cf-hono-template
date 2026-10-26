/**
 * A non-OK `fetch` response, carrying its HTTP status. Data hooks throw it so
 * main.tsx can tell a 401 (sign out) from a 5xx (toast / error page) from a
 * network failure (no status at all). `message` is dev-facing English;
 * `serverMessage` is the server's localized `error` text, when it sent one.
 */
export class HttpError extends Error {
  readonly status: number
  readonly serverMessage?: string

  constructor(status: number, message: string, serverMessage?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.serverMessage = serverMessage
  }
}

/** The server always answers errors with a localized `{ error, path }`; this carries it to the toast. */
export async function toHttpError(
  res: Response,
  message: string
): Promise<HttpError> {
  const body: unknown = await res.json().catch(() => null)
  const error =
    body && typeof body === 'object' && 'error' in body ? body.error : undefined
  return new HttpError(
    res.status,
    message,
    typeof error === 'string' && error ? error : undefined
  )
}

export const statusOf = (e: unknown): number | undefined =>
  e instanceof HttpError ? e.status : undefined
