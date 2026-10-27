import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { type OverviewPoint } from '../data/mock'

/**
 * Single-series Bklit bar chart for the Overview tab. The `total` series is
 * coloured with the `--chart-1` theme token, so light/dark flip is automatic —
 * never a literal color (D-07).
 */
export function OverviewChart({
  data,
  label,
}: {
  data: OverviewPoint[]
  label: string
}) {
  // Chart plot internals do not auto-mirror; pin the plot canvas LTR so axis
  // order, ticks, and numbers stay stable under a dir="rtl" document (DV-7).
  // The wrapper names the chart for assistive tech; the plot itself is not focusable.
  return (
    <div dir='ltr' role='img' aria-label={label}>
      <BarChart
        data={data}
        xDataKey='month'
        aspectRatio='auto'
        className='h-[250px]'
      >
        <Grid horizontal />
        <Bar dataKey='total' fill='var(--chart-1)' lineCap='round' />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </div>
  )
}
