import type { ReactNode } from 'react'
import { titleClipped } from '@/lib/clip-title'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

/**
 * A 28px sparkline: 1.5px --brand polyline over 0..100 x 0..28 with a 3px inset, the
 * last point a 5px dot. dir=ltr because time runs left to right in both directions;
 * aria-hidden because the context line states the change.
 */
export function Spark({ points }: { points: number[] }) {
  if (points.length === 0) return null
  const lo = Math.min(...points)
  const span = Math.max(...points) - lo || 1
  const xy = points.map((v, i) => [
    points.length > 1 ? (i / (points.length - 1)) * 100 : 100,
    25 - ((v - lo) / span) * 22,
  ])
  const [x, y] = xy[xy.length - 1]
  return (
    <div dir='ltr' aria-hidden className='relative h-7 min-w-0 flex-1'>
      <svg
        viewBox='0 0 100 28'
        preserveAspectRatio='none'
        className='absolute inset-0 size-full overflow-visible'
      >
        <polyline
          points={xy.map((p) => p.join(',')).join(' ')}
          fill='none'
          stroke='var(--brand)'
          strokeWidth={1.5}
          strokeLinejoin='round'
          strokeLinecap='round'
          vectorEffect='non-scaling-stroke'
        />
      </svg>
      <span
        className='bg-brand absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full'
        style={{ left: `${x}%`, top: `${(y / 28) * 100}%` }}
      />
    </div>
  )
}

/** KPI body: label, figure + sparkline, context line. The chrome is KpiCard. */
export function Kpi({
  label,
  value,
  context,
  points,
}: {
  label: string
  value: string
  context: string
  points: number[]
}) {
  return (
    <>
      <div className='text-muted-foreground truncate text-xs font-semibold tracking-[.12em] uppercase rtl:tracking-normal'>
        {label}
      </div>
      <div className='flex items-center gap-4'>
        {/* dir=ltr keeps a signed figure as "+573" in RTL; the row still places it at the inline start. */}
        <div
          dir='ltr'
          className='font-display text-[28px] leading-[1.15] font-semibold tabular-nums'
        >
          {value}
        </div>
        <Spark points={points} />
      </div>
      <div className='text-muted-foreground truncate text-sm'>{context}</div>
    </>
  )
}

/** Glass KPI card chrome; reveals truncated label / context on hover or focus. */
export function KpiCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      onMouseOver={titleClipped}
      onFocus={titleClipped}
      className={cn('min-h-32 gap-2 px-4 py-4', className)}
    >
      {children}
    </Card>
  )
}
