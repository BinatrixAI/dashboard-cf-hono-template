import { describe, expect, it } from 'vitest'
import { titleClipped } from '@/lib/clip-title'

type Fake = {
  textContent: string
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
  parentElement: Fake | null
  attrs: Map<string, string>
  getAttribute(n: string): string | null
  hasAttribute(n: string): boolean
  setAttribute(n: string, v: string): void
  removeAttribute(n: string): void
  closest(sel: string): Fake | null
}

const el = (o: Partial<Fake> & { cls?: string; title?: string } = {}) => {
  const attrs = new Map<string, string>()
  if (o.cls) attrs.set('class', o.cls)
  if (o.title) attrs.set('title', o.title)
  const f: Fake = {
    textContent: '',
    scrollWidth: 0,
    clientWidth: 0,
    scrollHeight: 0,
    clientHeight: 0,
    parentElement: null,
    ...o,
    attrs,
    getAttribute: (n) => attrs.get(n) ?? null,
    hasAttribute: (n) => attrs.has(n),
    setAttribute: (n, v) => void attrs.set(n, v),
    removeAttribute: (n) => void attrs.delete(n),
    closest(sel) {
      return /truncate|line-clamp/.test(attrs.get('class') ?? '')
        ? f
        : (f.parentElement?.closest(sel) ?? null)
    },
  }
  return f
}

const hover = (target: unknown) =>
  titleClipped({ target } as unknown as Pick<Event, 'target'>)

describe('titleClipped (FIT-06)', () => {
  it('titles cut truncate text with normalized textContent', () => {
    const e = el({
      cls: 'truncate',
      scrollWidth: 120,
      clientWidth: 80,
      textContent: '  Иванов   Пётр ',
    })
    hover(e)
    expect(e.getAttribute('title')).toBe('Иванов Пётр')
    expect(e.getAttribute('data-clip-title')).toBe('Иванов Пётр')
  })

  it('gives fitting text no title', () => {
    const e = el({
      cls: 'truncate',
      scrollWidth: 80,
      clientWidth: 80,
      textContent: 'Иванов',
    })
    hover(e)
    expect(e.hasAttribute('title')).toBe(false)
  })

  it('never touches a hand-written title', () => {
    const e = el({
      cls: 'truncate',
      title: 'Hand set',
      scrollWidth: 120,
      clientWidth: 80,
      textContent: 'Иванов Пётр',
    })
    hover(e)
    expect(e.getAttribute('title')).toBe('Hand set')
    expect(e.hasAttribute('data-clip-title')).toBe(false)
  })

  it('removes its own title once the text fits again', () => {
    const e = el({
      cls: 'truncate',
      scrollWidth: 120,
      clientWidth: 80,
      textContent: 'Иванов Пётр',
    })
    hover(e)
    e.scrollWidth = 80
    hover(e)
    expect(e.hasAttribute('title')).toBe(false)
    expect(e.hasAttribute('data-clip-title')).toBe(false)
  })

  it('uses height with 1px slack for line-clamp', () => {
    const e = el({
      cls: 'line-clamp-2',
      scrollHeight: 60,
      clientHeight: 39,
      textContent: 'Длинный текст',
    })
    hover(e)
    expect(e.getAttribute('title')).toBe('Длинный текст')
    const f = el({
      cls: 'line-clamp-2',
      scrollHeight: 40,
      clientHeight: 39,
      textContent: 'Длинный текст',
    })
    hover(f)
    expect(f.hasAttribute('title')).toBe(false)
  })

  it('gives empty or whitespace-only clipped nodes no title', () => {
    const e = el({
      cls: 'truncate',
      scrollWidth: 120,
      clientWidth: 80,
      textContent: '  \n ',
    })
    hover(e)
    expect(e.hasAttribute('title')).toBe(false)
  })

  it('ignores targets with no clipping ancestor or no closest', () => {
    expect(() => hover({ closest: () => null })).not.toThrow()
    expect(() => hover({})).not.toThrow()
    expect(() => hover(null)).not.toThrow()
  })

  it('titles the clipped outer node when the target is a fitting inner truncate span', () => {
    const p = el({
      cls: 'truncate',
      scrollWidth: 200,
      clientWidth: 120,
      textContent: 'Длинное имя клиента',
    })
    const span = el({ cls: 'truncate', parentElement: p, textContent: 'имя' })
    hover(span)
    expect(p.getAttribute('title')).toBe('Длинное имя клиента')
    expect(span.hasAttribute('title')).toBe(false)
  })
})
