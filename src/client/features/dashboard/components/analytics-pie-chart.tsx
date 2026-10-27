import { useState } from 'react'
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
} from '@/components/charts/legend'
import { PieCenter } from '@/components/charts/pie-center'
import { PieChart } from '@/components/charts/pie-chart'
import { PieSlice } from '@/components/charts/pie-slice'
import { type BreakdownSlice } from '../data/mock'

/**
 * Bklit donut chart for the Analytics tab. The 5 slices cycle the `--chart-1` →
 * `--chart-5` theme tokens in slice order (UI-SPEC Chart Token Mapping), so
 * light/dark flip is automatic — never a literal color (D-07). Hovering a slice
 * or a legend row highlights the other. Labels come from the slice `name`.
 */
export function AnalyticsPieChart({
  data,
  label,
}: {
  data: BreakdownSlice[]
  label: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const slices = data.map((s, i) => ({
    label: s.name,
    value: s.value,
    color: `var(--chart-${(i % 5) + 1})`,
  }))
  // Chart plot internals do not auto-mirror; pin the plot canvas LTR so slice
  // order and legend anchoring stay stable under a dir="rtl" document (DV-7).
  return (
    <div dir='ltr' role='img' aria-label={label}>
      <PieChart
        data={slices}
        innerRadius={60}
        hoveredIndex={hovered}
        onHoverChange={setHovered}
        className='mx-auto max-h-[250px] max-w-[250px]'
      >
        {slices.map((s, i) => (
          <PieSlice key={s.label} index={i} />
        ))}
        <PieCenter defaultLabel='Traffic' />
      </PieChart>
      <Legend
        items={slices}
        hoveredIndex={hovered}
        onHoverChange={setHovered}
        className='flex-row flex-wrap justify-center'
      >
        <LegendItem className='flex items-center gap-2 text-xs'>
          <LegendMarker />
          <LegendLabel />
        </LegendItem>
      </Legend>
    </div>
  )
}
