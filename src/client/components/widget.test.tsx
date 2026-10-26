import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Widget, WidgetError, WidgetPending } from './widget'

// No @/i18n import (it reads document.cookie): the pending and error branches are
// checked as returned elements, not rendered.
const skeleton = <div>SKELETON</div>
type Q = Parameters<typeof Widget<{ n: number } | null>>[0]['query']
const q = (status: string, data?: unknown) =>
  ({ status, data, refetch: vi.fn() }) as unknown as Q
const content = (d: { n: number } | null) => <p>{d ? `n=${d.n}` : 'NULL'}</p>

describe('Widget (DS-03)', () => {
  it('pending: wraps the skeleton in WidgetPending and never calls children', () => {
    const children = vi.fn(content)
    const el = Widget({
      query: q('pending'),
      skeleton,
      children,
    }) as ReactElement<{
      children: unknown
    }>
    expect(el.type).toBe(WidgetPending)
    expect(el.props.children).toBe(skeleton)
    expect(children).not.toHaveBeenCalled()
  })

  it('error with no data: WidgetError whose onRetry refetches once, joining in-flight', () => {
    const query = q('error')
    const el = Widget({ query, skeleton, children: content }) as ReactElement<{
      onRetry: () => void
    }>
    expect(el.type).toBe(WidgetError)
    el.props.onRetry()
    expect(query.refetch).toHaveBeenCalledTimes(1)
    expect(query.refetch).toHaveBeenCalledWith({ cancelRefetch: false })
  })

  it('error with data kept: renders the content (a failed refetch never blanks)', () => {
    const html = renderToStaticMarkup(
      <Widget query={q('error', { n: 1 })} skeleton={skeleton}>
        {content}
      </Widget>
    )
    expect(html).toContain('n=1')
    expect(html).not.toContain('SKELETON')
  })

  it('success with isEmpty true: renders the empty node, not the children', () => {
    const html = renderToStaticMarkup(
      <Widget
        query={q('success', { n: 0 })}
        skeleton={skeleton}
        isEmpty={(d) => d?.n === 0}
        empty={<p>EMPTY</p>}
      >
        {content}
      </Widget>
    )
    expect(html).toContain('EMPTY')
    expect(html).not.toContain('n=0')
  })

  it('success with null data and no isEmpty: children(null), no skeleton or error', () => {
    const el = Widget({
      query: q('success', null),
      skeleton,
      children: content,
    })
    expect((el as ReactElement).type).not.toBe(WidgetError)
    const html = renderToStaticMarkup(<>{el}</>)
    expect(html).toContain('NULL')
    expect(html).not.toContain('SKELETON')
  })

  it('success with data: renders children(data), no skeleton', () => {
    const html = renderToStaticMarkup(
      <Widget query={q('success', { n: 2 })} skeleton={skeleton}>
        {content}
      </Widget>
    )
    expect(html).toContain('n=2')
    expect(html).not.toContain('SKELETON')
  })
})
