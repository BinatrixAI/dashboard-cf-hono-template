import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type PillTone =
  'success' | 'warn' | 'danger' | 'brand' | 'solid' | 'neutral'

// Status tokens from tokens.css (fixed, never follow the theme).
const TONE: Record<PillTone, string> = {
  success: 'bg-success-soft text-success-fg',
  warn: 'bg-warn-soft text-warn-fg',
  danger: 'bg-danger-soft text-danger-fg',
  brand: 'bg-brand-soft text-brand-fg',
  solid: 'bg-brand-deep text-on-brand',
  neutral: 'bg-muted text-muted-foreground',
}

/** Tone pill; the label is always rendered so status is never colour-only. */
export function StatusPill({
  tone,
  dot = true,
  children,
}: {
  tone: PillTone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs leading-none font-semibold whitespace-nowrap',
        TONE[tone]
      )}
    >
      {dot && <span aria-hidden className='size-1.5 rounded-full bg-current' />}
      {children}
    </span>
  )
}
