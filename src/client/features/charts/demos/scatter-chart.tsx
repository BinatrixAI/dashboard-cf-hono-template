import { Grid } from '@/components/charts/grid'
import { Scatter } from '@/components/charts/scatter'
import { ScatterChart } from '@/components/charts/scatter-chart'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'

const chartData = [
  { date: new Date('2024-01-01'), sessions: 420, conversions: 28 },
  { date: new Date('2024-02-01'), sessions: 510, conversions: 34 },
  { date: new Date('2024-03-01'), sessions: 390, conversions: 22 },
  { date: new Date('2024-04-01'), sessions: 580, conversions: 41 },
  { date: new Date('2024-05-01'), sessions: 620, conversions: 38 },
  { date: new Date('2024-06-01'), sessions: 710, conversions: 52 },
]

export default function ScatterChartDemo() {
  return (
    <ScatterChart data={chartData}>
      <Grid horizontal />
      <Scatter dataKey='sessions' />
      <Scatter dataKey='conversions' />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  )
}
