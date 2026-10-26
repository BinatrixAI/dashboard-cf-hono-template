import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { type OverviewPoint } from '../data/mock'

/**
 * Single-series bar chart for the Overview tab. The `total` series color maps
 * to the `--chart-1` theme token via ChartStyle (`var(--color-total)` resolves
 * to it), so light/dark flip is automatic — never a literal color (D-07).
 */
const chartConfig = {
  total: { label: 'Total', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function OverviewChart({
  data,
  label,
}: {
  data: OverviewPoint[]
  label: string
}) {
  // Recharts plot internals do not auto-mirror; pin the plot canvas LTR so axis
  // order, ticks, and numbers stay stable under a dir="rtl" document (DV-7).
  // The wrapper names the chart for assistive tech; the plot itself is not focusable.
  return (
    <div dir='ltr' role='img' aria-label={label}>
      <ChartContainer config={chartConfig} className='h-[250px] w-full'>
        <BarChart data={data} accessibilityLayer={false}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey='month'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey='total'
            fill='var(--color-total)'
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
