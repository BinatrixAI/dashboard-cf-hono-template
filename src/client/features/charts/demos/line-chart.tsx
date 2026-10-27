import { curveNatural } from '@visx/curve'
import { Grid } from '@/components/charts/grid'
import { Line } from '@/components/charts/line'
import { LineChart } from '@/components/charts/line-chart'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'

const chartData = [
  { date: new Date('2024-01-01'), users: 1200 },
  { date: new Date('2024-02-01'), users: 1350 },
  { date: new Date('2024-03-01'), users: 1100 },
  { date: new Date('2024-04-01'), users: 1450 },
  { date: new Date('2024-05-01'), users: 1380 },
  { date: new Date('2024-06-01'), users: 1520 },
]

export default function LineChartDemo() {
  return (
    <LineChart data={chartData}>
      <Grid horizontal />
      <Line
        dataKey='users'
        curve={curveNatural}
        stroke='var(--chart-line-primary)'
      />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  )
}
