import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { type BreakdownSlice } from '../data/mock'

/**
 * Donut chart for the Analytics tab. Each of the 5 slices maps to a `--chart-N`
 * theme token, cycling chart-1 → chart-5 in slice order (UI-SPEC Chart Token
 * Mapping), so light/dark flip is automatic — never a literal color (D-07). The
 * config keys match the slice `name` values so `nameKey="name"` resolves the
 * legend/tooltip labels.
 */
const chartConfig = {
  value: { label: 'Traffic' },
  Direct: { label: 'Direct' },
  Referral: { label: 'Referral' },
  Organic: { label: 'Organic' },
  Social: { label: 'Social' },
  Email: { label: 'Email' },
} satisfies ChartConfig

export function AnalyticsPieChart({
  data,
  label,
}: {
  data: BreakdownSlice[]
  label: string
}) {
  // Recharts plot internals do not auto-mirror; pin the plot canvas LTR so slice
  // order and legend/tooltip anchoring stay stable under a dir="rtl" doc (DV-7).
  return (
    <div dir='ltr' role='img' aria-label={label}>
      <ChartContainer
        config={chartConfig}
        className='mx-auto aspect-square max-h-[250px]'
      >
        <PieChart accessibilityLayer={false}>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={data}
            dataKey='value'
            nameKey='name'
            innerRadius={50}
            rootTabIndex={-1}
          >
            {data.map((slice, i) => (
              <Cell key={slice.name} fill={`var(--chart-${i + 1})`} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey='name' />} />
        </PieChart>
      </ChartContainer>
    </div>
  )
}
