/**
 * Thrown when AUTHORIZED_PARTIES holds no real origin, or an entry that is not an origin.
 * The name carries the reason into logs.
 */
export class AuthorizedPartiesUnset extends Error {
  override name = 'AuthorizedPartiesUnset'
  constructor(reason = 'AUTHORIZED_PARTIES is unset') {
    super(reason)
  }
}

// Never include the entry itself: the message can reach logs.
const NON_ORIGIN = 'AUTHORIZED_PARTIES has a non-origin entry'

/**
 * Parse the comma-separated AUTHORIZED_PARTIES var into the origin list Clerk checks
 * a session token's `azp` claim against (SEC-02, D-01).
 *
 * Fails closed (D-02): `@clerk/backend` skips the azp check entirely on an empty list,
 * so an empty, whitespace, comma-only or placeholder-only (`REPLACE_WITH_YOUR_*`) value
 * throws instead of returning `[]`. The throw lands in `app.onError` as a 500.
 * One entry that is not a concrete http(s) origin (a scheme-less `localhost:5173`,
 * `mailto:`, `ws://`, a `*.workers.dev` wildcard, a trailing-dot host, garbage) throws
 * too, because Clerk matches `azp` exactly and such an entry can never match: a named
 * 500 instead of a silent 401 sign-out loop (D-02). A well-formed origin that is simply
 * wrong (misspelled host, missing port) cannot be detected here and still 401-loops.
 * Pure: entries come back as their URL origin (lowercase host, no trailing slash, path
 * or default port), in input order, duplicates kept.
 */
export const parseAuthorizedParties = (raw: string | undefined): string[] => {
  const parties = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !/^REPLACE_WITH_YOUR_/.test(s))
  if (parties.length === 0) throw new AuthorizedPartiesUnset()
  return parties.map((entry) => {
    let url: URL
    try {
      url = new URL(entry)
    } catch {
      throw new AuthorizedPartiesUnset(NON_ORIGIN)
    }
    // Clerk matches azp exactly (no globbing); a browser azp is always http(s) and
    // never carries a trailing-dot host.
    if (
      !/^https?:$/.test(url.protocol) ||
      url.hostname.includes('*') ||
      url.hostname.endsWith('.')
    ) {
      throw new AuthorizedPartiesUnset(NON_ORIGIN)
    }
    return url.origin
  })
}
