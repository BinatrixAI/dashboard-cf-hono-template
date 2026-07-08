import { z } from 'zod'

// The CMS list/detail JSON is untrusted cross-origin input (T-15-04). Every
// field a single malformed row could carry is .optional()/.catch() so one bad
// row cannot throw the whole list — a fetch/parse failure surfaces through
// react-query to the error panel, it never crashes the render (V5).
//
// Shape is VERIFIED against the SonicJS payload (15-RESEARCH "mapDocRowToContent"):
// top-level id/title/slug/status, nested data.publishedAt/data.content, ms epoch
// created_at. `data.content` stays z.unknown() — the Lexical tree is walked
// structurally by lexical-text.ts, not validated here.
export const contentItemSchema = z.object({
  id: z.string(),
  title: z.string().catch('(untitled)'),
  slug: z.string().optional(),
  status: z.string().optional().catch(undefined),
  data: z
    .object({
      publishedAt: z.string().nullable().optional(),
      content: z.unknown().optional(),
    })
    .partial()
    .optional(),
  created_at: z.number().optional(),
})
export type ContentItem = z.infer<typeof contentItemSchema>

// List envelope: GET /api/blog-posts -> { data: [...] }
export const contentListSchema = z.object({ data: z.array(contentItemSchema) })

// Single-item envelope: GET /api/blog-posts/:id -> { data: {...} }
export const contentDetailSchema = z.object({ data: contentItemSchema })
