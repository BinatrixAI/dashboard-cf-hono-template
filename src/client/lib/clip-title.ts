// FIT-06: a native tooltip with the full text for text that truncate / line-clamp actually cuts, set on hover so text that fits gets none.
type Clip = Pick<
  Element,
  | 'getAttribute'
  | 'setAttribute'
  | 'removeAttribute'
  | 'textContent'
  | 'scrollWidth'
  | 'clientWidth'
  | 'scrollHeight'
  | 'clientHeight'
> & {
  closest(sel: string): Clip | null
  parentElement: Clip | null
}

const SEL = '[class*="truncate"], [class*="line-clamp"]'

export function titleClipped(e: Pick<Event, 'target'>): void {
  // every clipping ancestor: the nearest may be a fitting inline span inside the node that is cut
  let el = (e.target as Partial<Clip> | null)?.closest?.(SEL) ?? null
  for (; el; el = el.parentElement?.closest(SEL) ?? null) {
    const cut = el.getAttribute('class')?.includes('line-clamp')
      ? el.scrollHeight - el.clientHeight > 1
      : el.scrollWidth > el.clientWidth
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    const title = el.getAttribute('title')
    const own = title !== null && el.getAttribute('data-clip-title') === title
    if (cut && text) {
      if (title === null || own) {
        el.setAttribute('title', text)
        el.setAttribute('data-clip-title', text)
      }
    } else if (own) {
      el.removeAttribute('title')
      el.removeAttribute('data-clip-title')
    }
  }
}
