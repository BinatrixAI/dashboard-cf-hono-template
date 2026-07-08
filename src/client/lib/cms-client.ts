// The ONE module that reads VITE_CMS_API_URL (D-07 single seam). Everything
// cross-origin to the SonicJS CMS Worker goes through here so the "never
// /api/*", "no credentials", and "one env var" guarantees live in exactly one
// file. Read `import.meta.env.VITE_CMS_API_URL` INSIDE cmsBaseUrl() (not a
// module-scope const) so tests can override it per-case with vi.stubEnv; Vite
// still statically inlines this member expression at build.

// D-04/D-10 gate: unset/empty/whitespace -> null (callers show a "CMS not
// configured" state and skip the fetch).
export function cmsBaseUrl(): string | null {
  const v = (import.meta.env.VITE_CMS_API_URL as string | undefined)?.trim()
  return v ? v.replace(/\/$/, '') : null // strip a single trailing slash
}

// D-09: admin URL = the ORIGIN of VITE_CMS_API_URL + /admin (one var, no
// VITE_CMS_ADMIN_URL). new URL() inside try/catch returns null on a malformed
// value (T-15-02).
export function cmsAdminUrl(): string | null {
  const base = cmsBaseUrl()
  if (!base) return null
  try {
    return `${new URL(base).origin}/admin`
  } catch {
    return null
  }
}

// Absolute cross-origin read: fetch is called with the URL as its SOLE argument
// (no init object), so the browser sends no cookies/Authorization cross-origin
// (T-15-01 / D-07). Every request targets the CMS origin — never a same-origin
// /api/* path — so it cannot traverse the Clerk gate (T-15-03 / SC #2).
export async function cmsFetch<T>(path: string): Promise<T> {
  const base = cmsBaseUrl()
  if (!base) throw new Error('CMS not configured') // callers must gate first
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(`CMS request failed (${res.status})`)
  return (await res.json()) as T
}
