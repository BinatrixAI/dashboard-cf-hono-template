import { z } from 'zod'

/**
 * Cross-tier contract (SCAF-01): the `src/shared` seam imported by BOTH the Hono
 * `/api/items` validator (now) and the Plan-04 React form. The authoritative shapes
 * come from 01-UI-SPEC.md (NOT the RESEARCH `note`-field example). Keep `id` a string
 * so the Phase-2 D1 swap (UUID or autoincrement-as-string) needs no client change.
 */

export type Item = {
  id: string // crypto.randomUUID() in Phase 1; D1-generated in Phase 2
  name: string // required, max 100 chars
  description: string // optional on input, max 500 chars, defaults to ""
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

// POST /api/items body. `description` defaults to "" so the stored Item.description
// is always a string (matches the Item type and the UI-SPEC table contract).
export const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
})

// PUT /api/items/:id body — every field optional (partial update). Absent fields are
// left untouched by the handler (it assigns only defined keys), so a name-only update
// does not wipe an existing description.
export const updateItemSchema = createItemSchema.partial()

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
