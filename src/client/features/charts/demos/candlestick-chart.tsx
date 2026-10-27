import { Candlestick } from '@/components/charts/candlestick'
import { CandlestickChart } from '@/components/charts/candlestick-chart'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { YAxis } from '@/components/charts/y-axis'

const ohlcData = [
  { date: new Date('2024-01-02'), open: 100, high: 108, low: 98, close: 105 },
  { date: new Date('2024-01-03'), open: 105, high: 110, low: 102, close: 103 },
  { date: new Date('2024-01-04'), open: 103, high: 112, low: 101, close: 110 },
  { date: new Date('2024-01-05'), open: 110, high: 115, low: 107, close: 108 },
]

export default function CandlestickChartDemo() {
  return (
    <CandlestickChart data={ohlcData}>
      <Grid fadeHorizontal={false} horizontal vertical />
      <Candlestick />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  )
}
