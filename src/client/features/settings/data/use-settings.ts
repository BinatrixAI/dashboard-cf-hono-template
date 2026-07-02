import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFont } from '@/context/font-provider'
import { useTheme } from '@/context/theme-provider'
import { type AppSettings } from '../../../../shared/settings'

/**
 * Settings data layer (D-04): a GENUINE network round-trip to the Hono
 * `/api/settings` KV route (Plan 02), mirroring `use-items.ts` verbatim — native
 * `fetch` (no axios), plain-`Error` throws, and one shared query key so the PUT
 * mutation invalidates the GET query on success (the client consumer that closes
 * WARNING-1). The `{ settings }` envelope is unwrapped to `body.settings` (NOT
 * `items`), and the payload types against the nested `AppSettings` from 09-01.
 *
 * `useSettingsThemeSync()` (RESEARCH Open-Q1 / D-08) makes KV authoritative on
 * load: mounted once in `AuthenticatedLayout`, it drives `setTheme`/`setFont`
 * from the stored `appearance` the instant the query resolves, so the stored
 * theme wins across reloads and devices on every authenticated page.
 */

export const settingsQueryKey = ['settings'] as const

async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings')
  if (!res.ok) {
    throw new Error(`Failed to load settings (${res.status})`)
  }
  const data = (await res.json()) as { settings: AppSettings }
  return data.settings
}

export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: fetchSettings,
  })
}

async function putSettings(next: AppSettings): Promise<AppSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next),
  })
  if (!res.ok) throw new Error(`Failed to save settings (${res.status})`)
  const data = (await res.json()) as { settings: AppSettings }
  return data.settings
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: putSettings,
    onSuccess: () => {
      // Real round-trip, no manual cache mutation: re-fetch the authoritative
      // KV blob after a successful write (parity with the items pattern).
      queryClient.invalidateQueries({ queryKey: settingsQueryKey })
    },
  })
}

/**
 * KV→provider load sync (D-08): when the settings query resolves, make the stored
 * `appearance` authoritative by pushing it into the theme + font providers. Keyed
 * on the primitive `appearance.theme` / `appearance.font` values (NOT the whole
 * `data` object) so a re-sync runs only when the stored appearance actually
 * changes. An unrelated Settings save (Notifications/Display) invalidates the
 * query and yields a new `data` object reference, but since those primitives are
 * unchanged the effect does NOT re-fire — so it never clobbers a header-toggled
 * theme the user hasn't saved (WR-01 fix; keeps the "never fights the user
 * mid-session" contract true).
 *
 * Side-effect hook (returns nothing) — call it ONCE app-wide in
 * `AuthenticatedLayout`, not in the appearance form (that would only apply the
 * stored theme on `/settings/appearance`; RESEARCH Pattern 3 anti-pattern).
 */
export function useSettingsThemeSync(): void {
  const { data } = useSettings()
  const { setTheme } = useTheme()
  const { setFont } = useFont()

  useEffect(() => {
    if (!data) return
    setTheme(data.appearance.theme)
    setFont(data.appearance.font)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.appearance.theme, data?.appearance.font])
}
