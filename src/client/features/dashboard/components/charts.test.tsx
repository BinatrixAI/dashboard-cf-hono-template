import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AnalyticsAreaChart } from './analytics-area-chart'
import { AnalyticsLineChart } from './analytics-line-chart'
import { AnalyticsPieChart } from './analytics-pie-chart'
import { OverviewChart } from './overview-chart'

const cases = [
  ['OverviewChart', (l: string) => <OverviewChart data={[]} label={l} />],
  [
    'AnalyticsAreaChart',
    (l: string) => <AnalyticsAreaChart data={[]} label={l} />,
  ],
  [
    'AnalyticsLineChart',
    (l: string) => <AnalyticsLineChart data={[]} label={l} />,
  ],
  [
    'AnalyticsPieChart',
    (l: string) => <AnalyticsPieChart data={[]} label={l} />,
  ],
] as const

describe('dashboard charts are named images (UX-07)', () => {
  it.each(cases)(
    '%s wraps the plot in role="img" with the given label',
    (_, el) => {
      const label = `הכנסות "Q1" & more`
      const html = renderToStaticMarkup(el(label))
      expect(html).toMatch(
        /^<div dir="ltr" role="img" aria-label="הכנסות &quot;Q1&quot; &amp; more">/
      )
      expect(html).not.toContain('tabindex="0"')
    }
  )
})
