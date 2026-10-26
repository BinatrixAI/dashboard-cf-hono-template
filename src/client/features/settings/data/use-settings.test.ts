import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, type AppSettings } from '../../../../shared/settings'
import {
  saveTheme,
  settingsMutationOptions,
  settingsQueryKey,
  themeUpdate,
} from './use-settings'

describe('themeUpdate', () => {
  it('returns null with no cached blob (not loaded yet)', () => {
    expect(themeUpdate(undefined, 'dark')).toBeNull()
  })

  it('returns null when the theme is already stored', () => {
    const data: AppSettings = {
      ...defaultSettings,
      appearance: { ...defaultSettings.appearance, theme: 'dark' },
    }
    expect(themeUpdate(data, 'dark')).toBeNull()
  })

  it('returns the full blob with only appearance.theme changed', () => {
    const data: AppSettings = {
      ...defaultSettings,
      appearance: { theme: 'system' },
      display: { items: ['recents'] },
    }
    const next = themeUpdate(data, 'light')
    expect(next?.appearance).toEqual({ theme: 'light' })
    expect(next?.notifications).toEqual(data.notifications)
    expect(next?.display).toEqual(data.display)
  })

  it('does not mutate the input blob', () => {
    const data = structuredClone(defaultSettings)
    themeUpdate(data, 'dark')
    expect(data).toEqual(defaultSettings)
  })
})

describe('saveTheme (CR-01)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('two quick picks: both PUT in click order and the last one wins', async () => {
    // Fake /api/settings: GET returns what KV holds, each PUT waits for release().
    let stored: AppSettings = structuredClone(defaultSettings)
    const puts: AppSettings['appearance']['theme'][] = []
    const pending: (() => void)[] = []
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      const reply = () =>
        new Response(JSON.stringify({ settings: stored }), {
          headers: { 'Content-Type': 'application/json' },
        })
      if (init?.method !== 'PUT') return Promise.resolve(reply())
      const body = JSON.parse(init.body as string) as AppSettings
      puts.push(body.appearance.theme)
      return new Promise<Response>((resolve) =>
        pending.push(() => {
          stored = body
          resolve(reply())
        })
      )
    })

    const qc = new QueryClient()
    qc.setQueryData(settingsQueryKey, structuredClone(defaultSettings)) // theme: system
    const mutate = (next: AppSettings) =>
      void new MutationObserver(qc, settingsMutationOptions(qc)).mutate(next)

    saveTheme(qc, mutate, 'dark')
    saveTheme(qc, mutate, 'system') // the dark PUT is still pending

    await vi.waitFor(() => expect(pending).toHaveLength(1))
    expect(puts).toEqual(['dark']) // serialised: system waits for dark
    pending[0]()
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]()
    await vi.waitFor(() => expect(qc.isMutating()).toBe(0))

    expect(puts).toEqual(['dark', 'system'])
    expect(stored.appearance.theme).toBe('system')
    expect(
      qc.getQueryData<AppSettings>(settingsQueryKey)?.appearance.theme
    ).toBe('system')
  })
})
