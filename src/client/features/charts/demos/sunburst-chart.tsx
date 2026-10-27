import { buildArcs } from '@/components/charts/sunburst'
import { SunburstCenter } from '@/components/charts/sunburst-center'
import { SunburstChart } from '@/components/charts/sunburst-chart'
import { SunburstHint } from '@/components/charts/sunburst-hint'
import { SunburstLabels } from '@/components/charts/sunburst-labels'
import { SunburstSegment } from '@/components/charts/sunburst-segment'

const data = {
  name: 'Revenue',
  children: [
    {
      name: 'Product',
      children: [
        { name: 'Enterprise', value: 198 },
        { name: 'Pro', value: 145 },
        { name: 'Starter', value: 95 },
      ],
    },
    {
      name: 'Services',
      children: [
        { name: 'Consulting', value: 160 },
        { name: 'Support', value: 90 },
        { name: 'Training', value: 55 },
      ],
    },
    {
      name: 'Partners',
      children: [
        { name: 'Referrals', value: 120 },
        { name: 'Affiliates', value: 75 },
      ],
    },
  ],
}

const { arcs } = buildArcs(data)

export default function SunburstChartDemo() {
  return (
    <SunburstChart data={data} size={360} className='mx-auto'>
      {arcs.map((arc) => (
        <SunburstSegment index={arc.arcIndex} key={arc.id} />
      ))}
      <SunburstCenter />
      <SunburstLabels />
      <SunburstHint />
    </SunburstChart>
  )
}
