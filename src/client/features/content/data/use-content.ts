import { useQuery } from '@tanstack/react-query'
import { cmsBaseUrl, cmsFetch } from '@/lib/cms-client'
import { contentDetailSchema, contentListSchema } from './schema'

/**
 * Read-only CMS content data layer (D-03/D-06/D-07). Mirrors the read-only
 * `useQuery` shape of `features/users/data/use-users.ts` — NO mutations, because
 * content editing lives in the CMS /admin, not the dashboard.
 *
 * Both queries route cross-origin through the 15-01 `cms-client` seam (never
 * import.meta.env directly) and are gated on a configured base URL (D-04) so
 * an unconfigured CMS shows the "not configured" state and issues no fetch.
 * The untrusted JSON is validated with tolerant zod at the boundary (V5).
 * Published-only is enforced server-side by the CMS for the anon read — no
 * client-side status filtering, no auth to reach drafts (T-15-03).
 */

export const contentQueryKey = ['cms-content'] as const

export function useContent() {
  return useQuery({
    queryKey: contentQueryKey,
    enabled: cmsBaseUrl() !== null,
    queryFn: async () => {
      // ?limit=50 is redundant (server default is 50) but kept explicit so the
      // D-06 cap reads legibly at the call site.
      const body = await cmsFetch<unknown>('/api/blog-posts?limit=50')
      return contentListSchema.parse(body).data
    },
  })
}

export function useContentItem(id: string) {
  return useQuery({
    queryKey: [...contentQueryKey, id] as const,
    enabled: !!id && cmsBaseUrl() !== null,
    queryFn: async () => {
      const body = await cmsFetch<unknown>('/api/blog-posts/' + id)
      return contentDetailSchema.parse(body).data
    },
  })
}
