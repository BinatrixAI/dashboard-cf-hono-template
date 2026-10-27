import { curveNatural } from '@visx/curve'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'

const chartData = [
  { date: new Date('2024-01-01'), desktop: 186 },
  { date: new Date('2024-02-01'), desktop: 305 },
  { date: new Date('2024-03-01'), desktop: 237 },
  { date: new Date('2024-04-01'), desktop: 73 },
  { date: new Date('2024-05-01'), desktop: 209 },
  { date: new Date('2024-06-01'), desktop: 214 },
]

export default function AreaChartDemo() {
  return (
    <AreaChart data={chartData} animationDuration={1100}>
      <Grid horizontal />
      <Area
        dataKey='desktop'
        curve={curveNatural}
        strokeWidth={2.5}
        fillOpacity={0.4}
      />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  )
}
