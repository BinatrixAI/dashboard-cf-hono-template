// Safe-query helpers for the D1 data layer (D-06 / DATA-05).
//
// These are deliberately small TEACHING artifacts, not a library substitute: they
// demonstrate the two safe patterns every forked project must respect when querying
// D1 — (1) never let an `IN (...)` exceed D1's hard ceiling of 100 bound parameters
// per query, and (2) always coerce + CAP the untrusted `?limit`/`?offset` pagination
// query strings so a `?limit=99999` can never scan the whole table (Pitfall 10).
//
// `paginate` is wired into `GET /api/items`; `chunk`/`itemsByIds` are kept as a
// documented reference (exercised by queries.test.ts) so the ≤100-param chunking is
// demonstrably proven even though the seeded list never grows past one batch.
import { z } from 'zod'
import { desc, inArray } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

/**
 * D1 allows at most 100 bound parameters per query.
 * Source: developers.cloudflare.com/d1/platform/limits — "max bound parameters per
 * query = 100". Every batched `IN (...)` MUST stay at or under this ceiling.
 */
export const D1_MAX_PARAMS = 100

/**
 * Split `arr` into batches of at most `size` (default `D1_MAX_PARAMS`). Order and
 * count are preserved across concatenation, so the batches can be re-joined safely.
 */
export function chunk<T>(arr: T[], size = D1_MAX_PARAMS): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

/**
 * Fetch many rows by id without exceeding the 100-bound-param `IN (...)` ceiling:
 * loop the ids in ≤100-id batches and accumulate. Kept as a reference even though
 * the seeded items list never needs it — it is the DATA-05 chunking demonstration.
 */
export async function itemsByIds<
  T extends SQLiteTable & { id: SQLiteTable['_']['columns']['id'] },
>(db: DrizzleD1Database<Record<string, unknown>>, table: T, ids: string[]) {
  const results: unknown[] = []
  for (const batch of chunk(ids)) {
    // Each IN(...) is built from at most D1_MAX_PARAMS bound params.
    results.push(
      ...(await db.select().from(table).where(inArray(table.id, batch)).all())
    )
  }
  return results
}

/**
 * Offset pagination (the template default — simplest to teach; cursor/keyset is the
 * documented scale-up path). Returns rows newest-first, bounded by the validated +
 * capped `limit`/`offset` from `paginationQuerySchema`.
 */
export function paginate<
  T extends SQLiteTable & { createdAt: SQLiteTable['_']['columns']['id'] },
>(
  db: DrizzleD1Database<Record<string, unknown>>,
  table: T,
  { limit, offset }: { limit: number; offset: number }
) {
  return db
    .select()
    .from(table)
    .orderBy(desc(table.createdAt))
    .limit(limit)
    .offset(offset)
    .all()
}

/**
 * Validates the untrusted `?limit`/`?offset` query strings (Pitfall 10): `limit` is
 * coerced to an int, floored at 1, CAPPED at `D1_MAX_PARAMS` (100), defaulting to 100;
 * `offset` is coerced to an int, floored at 0, defaulting to 0. Non-numeric input is
 * rejected (coercion yields `NaN`). The cap is CLAMPED (not rejected) so an oversized
 * `?limit=9999` silently degrades to 100 rather than erroring — the cap IS part of
 * DATA-05, it is what stops an unbounded table scan.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .default(D1_MAX_PARAMS)
    .transform((n) => Math.min(Math.max(n, 1), D1_MAX_PARAMS)),
  offset: z.coerce
    .number()
    .int()
    .default(0)
    .transform((n) => Math.max(n, 0)),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>
