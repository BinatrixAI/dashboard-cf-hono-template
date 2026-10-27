import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'

const data = [
  { month: 'Jan', revenue: 12000, profit: 4500 },
  { month: 'Feb', revenue: 15500, profit: 5200 },
  { month: 'Mar', revenue: 11000, profit: 3800 },
  { month: 'Apr', revenue: 18500, profit: 7100 },
  { month: 'May', revenue: 16800, profit: 5400 },
  { month: 'Jun', revenue: 21200, profit: 8800 },
]

export default function BarChartDemo() {
  return (
    <BarChart data={data} xDataKey='month'>
      <Grid horizontal />
      <Bar dataKey='revenue' fill='var(--chart-line-primary)' lineCap='round' />
      <Bar
        dataKey='profit'
        fill='var(--chart-line-secondary)'
        lineCap='round'
      />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  )
}
