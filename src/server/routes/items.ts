import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import {
  createItemSchema,
  updateItemSchema,
  type Item,
} from '../../shared/types'
import { paginate, paginationQuerySchema } from '../db/queries'
import { items as itemsTable } from '../db/schema'

/**
 * D1-backed `/api/items` CRUD router (Plan 02 / DATA-03). This is the Phase-1
 * in-memory store swapped for REAL D1 storage behind the SAME route surface +
 * response envelopes ({ items } / { item } / { success: true } / { error }) — a
 * backend swap, NOT a UI rewrite (the D-04 seam: `use-items.ts` is unchanged).
 *
 * Two invariants this file must keep:
 *  - PER-REQUEST Drizzle client: `drizzle(c.env.__D1_BINDING__, …)` is constructed
 *    inside each handler. The binding only exists at request time, so a module-scope
 *    client would be a runtime error — never hoist it.
 *  - App-generated identity (D-03): `crypto.randomUUID()` + a single ISO timestamp
 *    for both `createdAt`/`updatedAt` are minted IN THE HANDLER, not by the DB, so
 *    `Item.id: string` stays honest with zero int↔string cast at the envelope.
 *
 * Only Drizzle parameterized queries are used — SQL is never string-concatenated
 * (T-02-01: SQL-injection mitigation).
 */

// Build the per-request Drizzle client from the request-time D1 binding.
const client = (c: { env: Env }) =>
  drizzle(c.env.__D1_BINDING__, { schema: { items: itemsTable } })

export const items = new Hono<{ Bindings: Env }>()
  // GET / — newest-first, with validated + capped ?limit/?offset pagination (DATA-05).
  .get('/', zValidator('query', paginationQuerySchema), async (c) => {
    const db = client(c)
    const rows = await paginate(db, itemsTable, c.req.valid('query'))
    return c.json({ items: rows })
  })
  .post('/', zValidator('json', createItemSchema), async (c) => {
    const db = client(c)
    const body = c.req.valid('json')
    const ts = new Date().toISOString()
    const item: Item = {
      id: crypto.randomUUID(),
      name: body.name,
      description: body.description,
      createdAt: ts,
      updatedAt: ts,
    }
    await db.insert(itemsTable).values(item)
    return c.json({ item }, 201)
  })
  .get('/:id', async (c) => {
    const db = client(c)
    const [item] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, c.req.param('id')))
      .all()
    return item ? c.json({ item }) : c.json({ error: 'Not Found' }, 404)
  })
  .put('/:id', zValidator('json', updateItemSchema), async (c) => {
    const db = client(c)
    const id = c.req.param('id')
    const [current] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, id))
      .all()
    if (!current) return c.json({ error: 'Not Found' }, 404)
    const body = c.req.valid('json')
    // Assign only provided fields so a partial update never clobbers an existing value.
    const updated: Item = {
      ...current,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      updatedAt: new Date().toISOString(),
    }
    await db.update(itemsTable).set(updated).where(eq(itemsTable.id, id))
    return c.json({ item: updated })
  })
  .delete('/:id', async (c) => {
    const db = client(c)
    await db.delete(itemsTable).where(eq(itemsTable.id, c.req.param('id')))
    return c.json({ success: true })
  })
