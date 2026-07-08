import type { ContentItem } from './schema'

// Pure slug->post resolver (D-04). No by-slug endpoint exists on the CMS
// (RESEARCH Open Q1), so the detail page resolves client-side against the
// cached list. Slug wins; id is the slug-less fallback so slug-less posts
// still address (and match the index card's slug-or-id link key).
export function findPost(
  posts: ContentItem[],
  key: string
): ContentItem | undefined {
  return posts.find((p) => p.slug === key) ?? posts.find((p) => p.id === key)
}
