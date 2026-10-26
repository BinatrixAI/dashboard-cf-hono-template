import { beforeEach, describe, expect, it, vi } from 'vitest'

// session.ts keeps module state (one sign-out per page load), so each test
// gets a fresh module instance.
const load = () => import('./session')

describe('endSession (401 loop breaker)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('signs out once with an encoded return path', async () => {
    const { endSession } = await load()
    const signOut = vi.fn(() => Promise.resolve())
    await endSession(signOut, '/items?x=1')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledWith({
      redirectUrl: '/sign-in?redirect=%2Fitems%3Fx%3D1',
    })
  })

  it('returns the first promise to a later caller and does not sign out again', async () => {
    const { endSession } = await load()
    const signOut = vi.fn(() => Promise.resolve())
    const first = endSession(signOut, '/items')
    const second = endSession(signOut, '/other')
    expect(second).toBe(first)
    await second
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('sessionEnding is false before the first call and true after', async () => {
    const { endSession, sessionEnding } = await load()
    expect(sessionEnding()).toBe(false)
    void endSession(() => Promise.resolve(), '/items')
    expect(sessionEnding()).toBe(true)
  })

  it('forgets a rejected sign-out so the next 401 tries again (WR-03)', async () => {
    const { endSession, sessionEnding } = await load()
    const signOut = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    await endSession(signOut, '/items')
    expect(sessionEnding()).toBe(false)
    void endSession(signOut, '/items')
    expect(signOut).toHaveBeenCalledTimes(2)
    expect(sessionEnding()).toBe(true)
  })

  it('round-trips &, = and spaces through encodeURIComponent', async () => {
    const { endSession } = await load()
    const signOut = vi.fn(() => Promise.resolve())
    await endSession(signOut, '/items?x=1&y=a b')
    expect(signOut).toHaveBeenCalledWith({
      redirectUrl: '/sign-in?redirect=%2Fitems%3Fx%3D1%26y%3Da%20b',
    })
  })
})
