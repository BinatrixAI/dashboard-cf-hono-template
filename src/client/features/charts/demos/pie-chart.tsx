import { PieCenter } from '@/components/charts/pie-center'
import { PieChart } from '@/components/charts/pie-chart'
import { PieSlice } from '@/components/charts/pie-slice'

const pieData = [
  { label: 'Direct', value: 320 },
  { label: 'Organic', value: 280 },
  { label: 'Referral', value: 190 },
  { label: 'Social', value: 140 },
]

export default function PieChartDemo() {
  return (
    <PieChart data={pieData} size={280} className='mx-auto'>
      {pieData.map((item, i) => (
        <PieSlice index={i} key={item.label} />
      ))}
      <PieCenter defaultLabel='Traffic' />
    </PieChart>
  )
}
