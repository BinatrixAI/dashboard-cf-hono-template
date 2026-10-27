import { Grid } from '@/components/charts/grid'
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
} from '@/components/charts/legend'
import { Line } from '@/components/charts/line'
import { LineChart } from '@/components/charts/line-chart'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { type LinePoint } from '../data/mock'

/**
 * Three-series Bklit line chart for the Analytics tab. Series colours are the
 * `--chart-N` theme tokens (revenue → chart-1, profit → chart-2, expenses →
 * chart-3, per the UI-SPEC Chart Token Mapping), so light/dark flip is automatic
 * — never a literal color (D-07). Series labels stay English (chart internals,
 * docs/i18n.md).
 */
const series = [
  { key: 'revenue', label: 'Revenue', color: 'var(--chart-1)' },
  { key: 'profit', label: 'Profit', color: 'var(--chart-2)' },
  { key: 'expenses', label: 'Expenses', color: 'var(--chart-3)' },
] as const

const month = new Intl.DateTimeFormat('en-US', { month: 'short' })

export function AnalyticsLineChart({
  data,
  label,
}: {
  data: LinePoint[]
  label: string
}) {
  const labels = data.map((d) => month.format(d.date))
  // Chart plot internals do not auto-mirror; pin the plot canvas LTR so axis
  // order, ticks, and numbers stay stable under a dir="rtl" document (DV-7).
  return (
    <div dir='ltr' role='img' aria-label={label}>
      <LineChart data={data} aspectRatio='auto' className='h-[250px]'>
        <Grid horizontal />
        {series.map((s) => (
          <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={2} />
        ))}
        <XAxis numTicks={data.length} labels={labels} />
        <ChartTooltip
          dateLabels={labels}
          rows={(p) =>
            series.map((s) => ({
              color: s.color,
              label: s.label,
              value: p[s.key] as number,
            }))
          }
        />
      </LineChart>
      <Legend
        items={series.map((s) => ({
          label: s.label,
          value: 0,
          color: s.color,
        }))}
        className='flex-row justify-center'
      >
        <LegendItem className='flex items-center gap-2 text-xs'>
          <LegendMarker />
          <LegendLabel />
        </LegendItem>
      </Legend>
    </div>
  )
}
