import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
} from '@/components/charts/legend'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { type AreaPoint } from '../data/mock'

/**
 * Two-series Bklit area chart for the Analytics tab. Series colours are the
 * `--chart-N` theme tokens (desktop → chart-1, mobile → chart-2, per the UI-SPEC
 * Chart Token Mapping), so light/dark flip is automatic — never a literal color
 * (D-07). The two areas overlay rather than stack. Series labels stay English
 * (chart internals, docs/i18n.md).
 */
const series = [
  { key: 'desktop', label: 'Desktop', color: 'var(--chart-1)' },
  { key: 'mobile', label: 'Mobile', color: 'var(--chart-2)' },
] as const

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

export function AnalyticsAreaChart({
  data,
  label,
}: {
  data: AreaPoint[]
  label: string
}) {
  const labels = data.map((d) => weekday.format(d.date))
  // Chart plot internals do not auto-mirror; pin the plot canvas LTR so axis
  // order, ticks, and numbers stay stable under a dir="rtl" document (DV-7).
  return (
    <div dir='ltr' role='img' aria-label={label}>
      <AreaChart data={data} aspectRatio='auto' className='h-[250px]'>
        <Grid horizontal />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            fill={s.color}
            stroke={s.color}
            fillOpacity={0.4}
          />
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
      </AreaChart>
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
