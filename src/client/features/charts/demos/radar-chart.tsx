import { RadarArea } from '@/components/charts/radar-area'
import { RadarAxis } from '@/components/charts/radar-axis'
import { RadarChart } from '@/components/charts/radar-chart'
import { RadarGrid } from '@/components/charts/radar-grid'
import { RadarLabels } from '@/components/charts/radar-labels'

const metrics = [
  { key: 'speed', label: 'Speed' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'comfort', label: 'Comfort' },
  { key: 'safety', label: 'Safety' },
  { key: 'efficiency', label: 'Efficiency' },
]
const data = [
  {
    label: 'A',
    values: {
      speed: 80,
      reliability: 70,
      comfort: 60,
      safety: 90,
      efficiency: 75,
    },
  },
]

export default function RadarChartDemo() {
  return (
    <RadarChart data={data} metrics={metrics} size={320} className='mx-auto'>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels fontSize={10} offset={16} />
      {data.map((row, i) => (
        <RadarArea
          key={row.label}
          index={i}
          color='var(--chart-line-primary)'
        />
      ))}
    </RadarChart>
  )
}
