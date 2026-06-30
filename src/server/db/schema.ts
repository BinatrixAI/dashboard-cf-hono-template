// Drizzle table definitions — the typed source of truth for the D1 data layer (D-01).
//
// The `items` table MIRRORS the `Item` contract in `src/shared/types.ts` with ZERO
// mapping seam (D-03): SQL columns use snake_case (`created_at`), while the Drizzle
// TS keys stay camelCase (`createdAt`), so a selected row equals `Item` exactly with
// no int<->string cast at the `/api/items` envelope boundary. The primary key is an
// app-generated `crypto.randomUUID()` TEXT (set in the route), NOT autoincrement —
// keeping `Item.id: string` honest and matching the Phase-1 in-memory store
// byte-for-byte. `createdAt`/`updatedAt` stay ISO-8601 strings.
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const items = sqliteTable('items', {
  id: text('id').primaryKey(), // app-generated UUID (D-03) — not autoincrement
  name: text('name').notNull(), // max 100 enforced by Zod at the edge
  description: text('description').notNull().default(''), // Zod defaults '' so the column is never NULL
  createdAt: text('created_at').notNull(), // ISO-8601 string (D-03)
  updatedAt: text('updated_at').notNull(),
})

export type ItemRow = typeof items.$inferSelect
