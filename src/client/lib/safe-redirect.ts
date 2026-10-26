/**
 * Is an untrusted return URL safe to navigate to after sign-in? (SEC-01)
 *
 * The value arrives in the `?redirect=` search parameter of a sign-in link, so it is
 * attacker-controlled and decides where the browser goes right after authentication.
 * Getting it wrong is a phishing handoff onto a look-alike host.
 *
 * The rule: resolve the candidate against this origin with the URL parser and return it
 * only when the resolved origin IS this origin. A foreign origin, a parse failure, a
 * non-string or an empty string returns the fallback.
 *
 * The parser decides on purpose. A prefix check ("starts with `/`, not `//`") is walked
 * past by a leading backslash — `new URL('/\\evil.example', origin).host` is
 * `evil.example` — and every repair in that family (wider prefix, regex, denylist) is the
 * same mistake respelled. Only the parser agrees with the browser about where a string
 * resolves.
 *
 * It returns what the parser resolved (pathname + search + hash), not the raw input, so a
 * consumer that parses differently (Clerk's forceRedirectUrl to the Frontend API) cannot
 * see a different target. A resolved path that starts with `//` falls back too: every
 * consumer reads it as protocol-relative, i.e. another host (`/.//evil.example`).
 */
export function safeRedirect(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value === '') return fallback
  try {
    const resolved = new URL(value, window.location.origin)
    const path = resolved.pathname + resolved.search + resolved.hash
    return resolved.origin === window.location.origin && !path.startsWith('//')
      ? path
      : fallback
  } catch {
    return fallback
  }
}
