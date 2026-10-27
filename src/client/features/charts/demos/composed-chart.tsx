import { curveNatural } from '@visx/curve'
import { Area } from '@/components/charts/area'
import { ComposedChart } from '@/components/charts/composed-chart'
import { Grid } from '@/components/charts/grid'
import { Line } from '@/components/charts/line'
import { SeriesBar } from '@/components/charts/series-bar'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'

const chartData = [
  { date: new Date('2024-01-01'), revenue: 4200, runRate: 3800 },
  { date: new Date('2024-02-01'), revenue: 5100, runRate: 4600 },
  { date: new Date('2024-03-01'), revenue: 4800, runRate: 5200 },
  { date: new Date('2024-04-01'), revenue: 5500, runRate: 5000 },
]

export default function ComposedChartDemo() {
  return (
    <ComposedChart data={chartData}>
      <Grid horizontal />
      <SeriesBar dataKey='revenue' fill='var(--chart-1)' />
      <Area
        dataKey='runRate'
        curve={curveNatural}
        fill='var(--chart-4)'
        fillOpacity={0.35}
      />
      <Line dataKey='runRate' curve={curveNatural} stroke='var(--chart-2)' />
      <XAxis />
      <ChartTooltip />
    </ComposedChart>
  )
}
