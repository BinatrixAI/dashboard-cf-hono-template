import { FunnelChart } from '@/components/charts/funnel-chart'

const funnelData = [
  { label: 'Visitors', value: 12000 },
  { label: 'Signups', value: 4800 },
  { label: 'Activated', value: 2100 },
  { label: 'Paid', value: 840 },
]

export default function FunnelChartDemo() {
  return <FunnelChart data={funnelData} style={{ aspectRatio: '2 / 1' }} />
}
