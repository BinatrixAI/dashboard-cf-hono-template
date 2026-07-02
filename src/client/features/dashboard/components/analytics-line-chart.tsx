import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { lineData } from '../data/mock'

/**
 * Three-series line chart for the Analytics tab. Each line color maps to a
 * `--chart-N` theme token via ChartStyle (`var(--color-revenue)` /
 * `var(--color-profit)` / `var(--color-expenses)` resolve to chart-1 / chart-2 /
 * chart-3), so light/dark flip is automatic — never a literal color (D-07).
 * Series → token map is fixed by the UI-SPEC Chart Token Mapping.
 */
const chartConfig = {
  revenue: { label: 'Revenue', color: 'var(--color-chart-1)' },
  profit: { label: 'Profit', color: 'var(--color-chart-2)' },
  expenses: { label: 'Expenses', color: 'var(--color-chart-3)' },
} satisfies ChartConfig

export function AnalyticsLineChart() {
  // Recharts plot internals do not auto-mirror; pin the plot canvas LTR so axis
  // order, ticks, and numbers stay stable under a dir="rtl" document (DV-7).
  return (
    <div dir='ltr'>
      <ChartContainer config={chartConfig} className='h-[250px] w-full'>
        <LineChart data={lineData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey='month'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey='revenue'
            type='monotone'
            stroke='var(--color-revenue)'
            strokeWidth={2}
            dot={false}
          />
          <Line
            dataKey='profit'
            type='monotone'
            stroke='var(--color-profit)'
            strokeWidth={2}
            dot={false}
          />
          <Line
            dataKey='expenses'
            type='monotone'
            stroke='var(--color-expenses)'
            strokeWidth={2}
            dot={false}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </LineChart>
      </ChartContainer>
    </div>
  )
}
