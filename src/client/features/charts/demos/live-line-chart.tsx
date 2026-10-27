import { useEffect, useState } from 'react'
import { curveNatural } from '@visx/curve'
import { LiveLine } from '@/components/charts/live-line'
import {
  LiveLineChart,
  type LiveLinePoint,
} from '@/components/charts/live-line-chart'
import { LiveXAxis } from '@/components/charts/live-x-axis'
import { LiveYAxis } from '@/components/charts/live-y-axis'
import { ChartTooltip } from '@/components/charts/tooltip'

// Bklit's example passes interval/maxPoints props the installed LiveLineChart no longer
// takes; the current API wants the caller to stream { time: unixSeconds, value }.
const point = (i: number): LiveLinePoint => ({
  time: Date.now() / 1000,
  value: 50 + Math.sin(i / 3) * 20,
})

export default function LiveLineChartDemo() {
  const [data, setData] = useState<LiveLinePoint[]>(() => [point(0)])
  useEffect(() => {
    let i = 1
    const id = setInterval(() => {
      const next = point(i++)
      setData((prev) => [...prev, next].slice(-24))
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <LiveLineChart data={data} value={data.at(-1)?.value ?? 0}>
      <LiveLine
        dataKey='value'
        curve={curveNatural}
        stroke='var(--chart-line-primary)'
      />
      <LiveXAxis />
      <LiveYAxis />
      <ChartTooltip />
    </LiveLineChart>
  )
}
