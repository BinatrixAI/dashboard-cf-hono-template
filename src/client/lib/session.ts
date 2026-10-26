let ending: Promise<unknown> | undefined

/**
 * A Worker 401 while Clerk may still report signed-in (stale cookie, azp
 * mismatch, clock skew): sign the client out so <SignIn> renders instead of
 * bouncing straight back into the guard (the 401 loop). Clerk then does a
 * full-page navigation to /sign-in. Runs once per page load unless the sign-out
 * fails, so every failing query and mutation can call it.
 */
export function endSession(
  signOut: (o: { redirectUrl: string }) => Promise<unknown>,
  returnTo: string
) {
  ending ??= signOut({
    redirectUrl: `/sign-in?redirect=${encodeURIComponent(returnTo)}`,
  }).catch(() => {
    // A failed sign-out (Clerk's Frontend API unreachable) must not stick for
    // the rest of the page load.
    ending = undefined
  })
  return ending
}

export const sessionEnding = () => ending !== undefined
