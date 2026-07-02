import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { breakdownData } from '../data/mock'

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

export function AnalyticsPieChart() {
  // Recharts plot internals do not auto-mirror; pin the plot canvas LTR so slice
  // order and legend/tooltip anchoring stay stable under a dir="rtl" doc (DV-7).
  return (
    <div dir='ltr'>
      <ChartContainer
        config={chartConfig}
        className='mx-auto aspect-square max-h-[250px]'
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={breakdownData}
            dataKey='value'
            nameKey='name'
            innerRadius={50}
          >
            {breakdownData.map((slice, i) => (
              <Cell key={slice.name} fill={`var(--color-chart-${i + 1})`} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey='name' />} />
        </PieChart>
      </ChartContainer>
    </div>
  )
}
