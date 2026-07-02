// Pure avatar-initials helper for the Clerk-backed user menus (AUTH-06, D-06a).
//
// Derives a short uppercased initials string from the current session's
// `useUser()` identity so the header + sidebar AvatarFallback render the real
// user, not a hardcoded placeholder. Kept dependency-free (no runtime imports,
// no `@/` alias) so it also runs in the plain-node `setup` vitest project — the
// only node-env suite — via a relative import from `test/setup/`.

// Minimal structural shape matching the fields we read off the `useUser()` user.
// A type-only interface (erased at runtime), so the module stays import-free.
export interface InitialsUserLike {
  firstName?: string | null
  lastName?: string | null
  primaryEmailAddress?: { emailAddress?: string | null } | null
}

/**
 * Returns 1–2 uppercase initials for a Clerk user:
 *  - firstName + lastName → first letter of each (e.g. "Sara Nielsen" → "SN")
 *  - firstName only → its first letter (e.g. "Sara" → "S")
 *  - no name → uppercased first char of the primary email (e.g. "dima@…" → "D")
 *  - nothing usable (null/undefined user, no name, no email) → "U"
 */
export function initialsFromUser(
  user: InitialsUserLike | null | undefined
): string {
  const first = user?.firstName?.trim() ?? ''
  const last = user?.lastName?.trim() ?? ''

  const initials = `${first.charAt(0)}${last.charAt(0)}`.trim()
  if (initials) return initials.toUpperCase()

  const email = user?.primaryEmailAddress?.emailAddress?.trim() ?? ''
  if (email) return email.charAt(0).toUpperCase()

  return 'U'
}
