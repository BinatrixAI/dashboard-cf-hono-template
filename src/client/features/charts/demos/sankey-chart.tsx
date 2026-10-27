import {
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from '@/components/charts/sankey'

const data = {
  nodes: [
    { name: 'Ads' },
    { name: 'Organic' },
    { name: 'Landing' },
    { name: 'Product' },
    { name: 'Checkout' },
  ],
  links: [
    { source: 0, target: 2, value: 40 },
    { source: 1, target: 2, value: 30 },
    { source: 2, target: 3, value: 50 },
    { source: 3, target: 4, value: 35 },
  ],
}

export default function SankeyChartDemo() {
  return (
    <SankeyChart data={data} aspectRatio='16 / 9'>
      <SankeyLink />
      <SankeyNode />
      <SankeyTooltip />
    </SankeyChart>
  )
}
