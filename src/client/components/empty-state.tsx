import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Zero-data body (no chrome of its own): every caller names its subject and what happens next. */
export function EmptyState({
  icon: Icon,
  heading,
  body,
  action,
}: {
  icon: LucideIcon
  heading: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className='flex min-h-60 flex-col items-center justify-center px-8 py-12 text-center'>
      <div className='bg-brand-soft flex size-14 items-center justify-center rounded-2xl'>
        <Icon aria-hidden className='text-brand size-6' />
      </div>
      <h2 className='font-display mt-4 text-lg leading-tight font-semibold'>
        {heading}
      </h2>
      <p className='text-muted-foreground mt-2 max-w-[420px] text-sm'>{body}</p>
      {action && <div className='mt-6'>{action}</div>}
    </div>
  )
}
