import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { areaData } from '../data/mock'

/**
 * Two-series area chart for the Analytics tab. Each series color maps to a
 * `--chart-N` theme token via ChartStyle (`var(--color-desktop)` /
 * `var(--color-mobile)` resolve to chart-1 / chart-2), so light/dark flip is
 * automatic — never a literal color (D-07). Series → token map is fixed by the
 * UI-SPEC Chart Token Mapping (area s1 → chart-1, s2 → chart-2).
 */
const chartConfig = {
  desktop: { label: 'Desktop', color: 'var(--color-chart-1)' },
  mobile: { label: 'Mobile', color: 'var(--color-chart-2)' },
} satisfies ChartConfig

export function AnalyticsAreaChart() {
  // Recharts plot internals do not auto-mirror; pin the plot canvas LTR so axis
  // order, ticks, and numbers stay stable under a dir="rtl" document (DV-7).
  return (
    <div dir='ltr'>
      <ChartContainer config={chartConfig} className='h-[250px] w-full'>
        <AreaChart data={areaData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey='date'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip content={<ChartTooltipContent indicator='dot' />} />
          <Area
            dataKey='desktop'
            type='monotone'
            stroke='var(--color-desktop)'
            fill='var(--color-desktop)'
            fillOpacity={0.4}
            stackId='a'
          />
          <Area
            dataKey='mobile'
            type='monotone'
            stroke='var(--color-mobile)'
            fill='var(--color-mobile)'
            fillOpacity={0.4}
            stackId='a'
          />
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
