// Pure client-util unit test for `initialsFromUser()` (AUTH-06, D-06a).
//
// Co-located here in `test/setup/` deliberately: this is the ONLY node-env vitest
// project (see vitest.config.ts — project 'setup', environment: 'node'), and the
// helper is a dependency-free pure function that needs no jsdom/DOM. Reusing the
// existing `test/setup/**/*.test.mjs` glob avoids standing up a new jsdom project
// (11-VALIDATION.md Wave 0: extract-helper exception, do NOT add a jsdom project).
//
// The 'setup' project has no `@/` alias, so import by RELATIVE path.
import { describe, it, expect } from 'vitest'
import { initialsFromUser } from '../../src/client/lib/initials.ts'

describe('initialsFromUser', () => {
  it('firstName + lastName → both initials, uppercased', () => {
    expect(
      initialsFromUser({ firstName: 'Sara', lastName: 'Nielsen' })
    ).toBe('SN')
  })

  it('firstName only → single initial', () => {
    expect(initialsFromUser({ firstName: 'Sara' })).toBe('S')
  })

  it('no name, has email → uppercased first email char', () => {
    expect(
      initialsFromUser({
        primaryEmailAddress: { emailAddress: 'dima@oqva.io' },
      })
    ).toBe('D')
  })

  it('null/undefined user, or no name and no email → "U" fallback', () => {
    expect(initialsFromUser(null)).toBe('U')
    expect(initialsFromUser(undefined)).toBe('U')
    expect(initialsFromUser({})).toBe('U')
    expect(
      initialsFromUser({ firstName: '', primaryEmailAddress: null })
    ).toBe('U')
  })
})
