import { describe, expect, it } from 'vitest'
import { PAGE_SIZES, snapPageSize } from './use-table-url-state'

describe('snapPageSize', () => {
  it('exposes the five page sizes', () => {
    expect(PAGE_SIZES).toEqual([10, 20, 30, 40, 50])
  })

  it.each([
    [7, 10],
    [25, 20], // tie goes to the smaller size
    [45, 40],
    [1000, 50],
    [30, 30],
    [-5, 10],
  ])('snaps %s to %s', (raw, expected) => {
    expect(snapPageSize(raw, 10)).toBe(expected)
  })

  it.each([['x'], [NaN], [Infinity], [-Infinity], [undefined], [null]])(
    'falls back to the default for %s',
    (raw) => {
      expect(snapPageSize(raw, 10)).toBe(10)
    }
  )

  it('snaps an off-list default too', () => {
    expect(snapPageSize(undefined, 25)).toBe(20)
  })
})
