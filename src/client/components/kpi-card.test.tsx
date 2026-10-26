import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Kpi, Spark } from './kpi-card'

const render = (points: number[]) =>
  renderToStaticMarkup(<Spark points={points} />)
const coords = (html: string) =>
  (html.match(/points="([^"]*)"/)?.[1] ?? '')
    .split(' ')
    .map((p) => p.split(',').map(Number))

describe('Spark (DS-04)', () => {
  it('renders nothing for no points', () => {
    expect(render([])).toBe('')
  })

  it('puts a single point at the inline end (x = 100)', () => {
    expect(render([5])).toContain('left:100%')
  })

  it('draws a flat series as a flat line with no NaN', () => {
    const html = render([3, 3, 3])
    expect(html).not.toContain('NaN')
    const ys = coords(html).map(([, y]) => y)
    expect(ys).toHaveLength(3)
    expect(new Set(ys).size).toBe(1)
  })

  it('isolates the KPI figure as LTR so a leading sign stays in front in RTL', () => {
    const html = renderToStaticMarkup(
      <Kpi label='L' value='+573' context='c' points={[1]} />
    )
    expect(html).toMatch(/<div dir="ltr"[^>]*>\+573<\/div>/)
  })

  it('spans x from 0 to 100', () => {
    const xy = coords(render([1, 2, 3]))
    expect(xy[0][0]).toBe(0)
    expect(xy[xy.length - 1][0]).toBe(100)
  })
})
