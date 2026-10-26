import { useEffect } from 'react'
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '@clerk/react'
import { HttpError, toHttpError } from '@/lib/http-error'
import { useTheme } from '@/context/theme-provider'
import { type AppSettings } from '../../../../shared/settings'

/**
 * Settings data layer (D-04): a GENUINE network round-trip to the Hono
 * `/api/settings` KV route (Plan 02), mirroring `use-items.ts` verbatim — native
 * `fetch` (no axios), `HttpError` throws carrying the status, and one shared
 * query key so the PUT mutation invalidates the GET query on success (the
 * client consumer that closes WARNING-1). The `{ settings }` envelope is unwrapped to `body.settings` (NOT
 * `items`), and the payload types against the nested `AppSettings` from 09-01.
 *
 * `useSettingsThemeSync()` (RESEARCH Open-Q1 / D-08) makes KV authoritative on
 * load: mounted once in `AuthenticatedLayout`, it drives `setTheme` from the
 * stored `appearance.theme` the instant the query resolves, so the stored
 * theme wins across reloads and devices on every authenticated page.
 */

export const settingsQueryKey = ['settings'] as const

async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings')
  if (!res.ok) {
    throw new HttpError(res.status, `Failed to load settings (${res.status})`)
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
  if (!res.ok)
    throw await toHttpError(res, `Failed to save settings (${res.status})`)
  const data = (await res.json()) as { settings: AppSettings }
  return data.settings
}

/**
 * Settings writes run one at a time in click order (`scope`), so the last choice
 * is the last PUT to reach KV. Re-fetch the authoritative blob only after the
 * last queued write: an earlier write's refetch would bring back a stale theme.
 */
export function settingsMutationOptions(queryClient: QueryClient) {
  return {
    mutationKey: settingsQueryKey,
    mutationFn: putSettings,
    scope: { id: 'settings' },
    onSuccess: () => {
      if (queryClient.isMutating({ mutationKey: settingsQueryKey }) === 1)
        return queryClient.invalidateQueries({ queryKey: settingsQueryKey })
    },
  }
}

export function useUpdateSettings() {
  return useMutation(settingsMutationOptions(useQueryClient()))
}

/**
 * The full blob to PUT for a theme choice, or null when nothing should be sent:
 * no cached blob (not loaded yet) or the theme is already stored.
 * Always the whole blob, so a theme write never drops the sibling sections.
 */
export function themeUpdate(
  data: AppSettings | undefined,
  theme: AppSettings['appearance']['theme']
): AppSettings | null {
  if (!data || data.appearance.theme === theme) return null
  return { ...data, appearance: { ...data.appearance, theme } }
}

/**
 * Theme choice from any surface (ThemeMenu, ConfigDrawer, D-13): applies it at
 * once through the cookie, then saves it to KV when signed in. A failed write
 * never reverts the UI; the global mutation onError reports it.
 */
export function usePersistTheme() {
  const queryClient = useQueryClient()
  const update = useUpdateSettings()
  const { setTheme } = useTheme()
  const { isSignedIn } = useAuth()

  return (theme: AppSettings['appearance']['theme']) => {
    setTheme(theme)
    // Gate on Clerk, not the cache: the settings blob outlives an in-app sign-out,
    // and a signed-out PUT 401s into the session-expired sign-out path.
    if (isSignedIn) saveTheme(queryClient, update.mutate, theme)
  }
}

/**
 * PUT the theme and write it to the cache at once, so the next pick and any form
 * submit diff against the pending value, not the last fetched one (CR-01).
 */
export function saveTheme(
  queryClient: QueryClient,
  mutate: (next: AppSettings) => void,
  theme: AppSettings['appearance']['theme']
) {
  const next = themeUpdate(
    queryClient.getQueryData<AppSettings>(settingsQueryKey),
    theme
  )
  if (!next) return
  // Drop an in-flight refetch that would carry the old theme back.
  void queryClient.cancelQueries({ queryKey: settingsQueryKey })
  queryClient.setQueryData(settingsQueryKey, next)
  mutate(next)
}

/**
 * KV→provider load sync (D-08): when the settings query resolves, make the stored
 * theme authoritative by pushing it into the theme provider. Keyed on the
 * primitive `appearance.theme` value (NOT the whole `data` object) so a re-sync
 * runs only when the stored theme actually changes. An unrelated Settings save
 * (Notifications/Display) invalidates the query and yields a new `data` object
 * reference, but since that primitive is unchanged the effect does NOT re-fire —
 * so it never clobbers a header-toggled theme the user hasn't saved (WR-01 fix; keeps the "never fights the user
 * mid-session" contract true).
 *
 * Side-effect hook (returns nothing) — call it ONCE app-wide in
 * `AuthenticatedLayout`, not in the appearance form (that would only apply the
 * stored theme on `/settings/appearance`; RESEARCH Pattern 3 anti-pattern).
 */
export function useSettingsThemeSync(): void {
  const { data } = useSettings()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!data) return
    setTheme(data.appearance.theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.appearance.theme])
}
