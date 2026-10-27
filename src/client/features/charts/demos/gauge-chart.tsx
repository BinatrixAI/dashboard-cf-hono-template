import { Gauge } from '@/components/charts/gauge'

export default function GaugeChartDemo() {
  return (
    <Gauge
      value={72}
      centerValue={72}
      totalNotches={40}
      defaultLabel='Score'
      formatOptions={{ style: 'percent' }}
    />
  )
}
