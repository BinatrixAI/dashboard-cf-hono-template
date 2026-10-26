import { cn } from '@/lib/utils'

/** A pulsing placeholder block, sized by className. */
export function Bone({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-track shrink-0 animate-pulse rounded-md [animation-duration:1.5s] motion-reduce:animate-none',
        className
      )}
    />
  )
}

/** KPI body skeleton; the caller's KpiCard is the chrome. */
export function KpiSkeleton() {
  return (
    <div className='flex flex-col gap-2'>
      <Bone className='h-3 w-[88px]' />
      <div className='flex items-center gap-4'>
        <Bone className='h-7 w-[120px]' />
        <Bone className='h-7 flex-1' />
      </div>
      <Bone className='h-3 w-40' />
    </div>
  )
}

/** Matches the dashboard charts' 250px ChartContainer height. */
export function ChartSkeleton() {
  return <Bone className='h-[250px] w-full' />
}

/** Header row + 5 rows at the table's 40px row height. */
export function TableSkeleton() {
  return (
    <div className='flex flex-col gap-2'>
      {Array.from({ length: 6 }, (_, i) => (
        <Bone key={i} className='h-10 w-full' />
      ))}
    </div>
  )
}
