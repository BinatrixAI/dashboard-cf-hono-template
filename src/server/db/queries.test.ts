import { describe, expect, it } from 'vitest'
import { chunk, paginationQuerySchema, D1_MAX_PARAMS } from './queries'

/**
 * UNIT test (DATA-05 / D-06) — no `SELF.fetch`, no D1 binding. Proves the two
 * pure safe-query primitives in isolation:
 *   - `chunk()` keeps every batch within D1's 100-bound-param ceiling, so an
 *     `IN(...)` built from a chunk can never exceed the limit.
 *   - `paginationQuerySchema` coerces + caps the untrusted `?limit`/`?offset`
 *     query strings (Pitfall 10 — the cap IS part of DATA-05).
 * The `paginate()` slicing itself is proven against real D1 in items.test.ts.
 */

function buildIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `id-${i}`)
}

describe('chunk() — ≤100 bound-param batching (DATA-05)', () => {
  it('splits 250 ids into 3 batches, each ≤ D1_MAX_PARAMS', () => {
    const batches = chunk(buildIds(250))
    expect(batches.length).toBe(3)
    expect(batches.every((b) => b.length <= D1_MAX_PARAMS)).toBe(true)
    expect(D1_MAX_PARAMS).toBe(100)
  })

  it('preserves order + count when flattened', () => {
    const ids = buildIds(250)
    const flat = chunk(ids).flat()
    expect(flat.length).toBe(250)
    expect(flat).toEqual(ids)
  })

  it('returns [] for an empty input', () => {
    expect(chunk([]).length).toBe(0)
  })

  it('returns exactly one batch for exactly 100 ids', () => {
    expect(chunk(buildIds(100)).length).toBe(1)
  })
})

describe('paginationQuerySchema — coerce + cap (Pitfall 10, DATA-05)', () => {
  it('caps an oversized limit at 100', () => {
    expect(paginationQuerySchema.parse({ limit: '9999' }).limit).toBe(100)
  })

  it('applies defaults (limit 100, offset 0) when absent', () => {
    const parsed = paginationQuerySchema.parse({})
    expect(parsed.limit).toBe(100)
    expect(parsed.offset).toBe(0)
  })

  it('coerces numeric strings to ints', () => {
    const parsed = paginationQuerySchema.parse({ limit: '5', offset: '10' })
    expect(parsed.limit).toBe(5)
    expect(parsed.offset).toBe(10)
  })

  it('rejects non-numeric input', () => {
    expect(paginationQuerySchema.safeParse({ offset: 'abc' }).success).toBe(
      false
    )
  })
})
