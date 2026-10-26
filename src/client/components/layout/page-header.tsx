import type { ReactNode } from 'react'
import { titleClipped } from '@/lib/clip-title'

/** Page title row; below 768px the actions wrap to their own full-width row. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header
      onMouseOver={titleClipped}
      onFocus={titleClipped}
      className='flex items-end gap-4 max-md:flex-wrap'
    >
      <div className='min-w-0 flex-1'>
        <h1 className='font-display truncate text-[28px] leading-[1.15] font-semibold tracking-[-.01em] rtl:tracking-normal'>
          {title}
        </h1>
        {subtitle && (
          <p className='text-muted-foreground truncate text-sm'>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className='flex gap-2 max-md:w-full max-md:*:only:flex-1'>
          {actions}
        </div>
      )}
    </header>
  )
}
