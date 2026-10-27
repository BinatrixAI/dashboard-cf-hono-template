import { Ring } from '@/components/charts/ring'
import { RingCenter } from '@/components/charts/ring-center'
import { RingChart } from '@/components/charts/ring-chart'

const ringData = [
  { label: 'Email', value: 42, maxValue: 100 },
  { label: 'Social', value: 28, maxValue: 100 },
  { label: 'Direct', value: 18, maxValue: 100 },
  { label: 'Other', value: 12, maxValue: 100 },
]

export default function RingChartDemo() {
  return (
    <RingChart data={ringData} size={280} strokeWidth={14} className='mx-auto'>
      {ringData.map((item, i) => (
        <Ring index={i} key={item.label} />
      ))}
      <RingCenter defaultLabel='Channels' />
    </RingChart>
  )
}
