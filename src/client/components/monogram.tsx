import { cn, getDisplayNameInitials } from '@/lib/utils'

/** Initials tile; size, radius and colours come from the caller's className. */
export function Monogram({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-display inline-flex shrink-0 items-center justify-center font-semibold select-none',
        className
      )}
    >
      {getDisplayNameInitials(name)}
    </span>
  )
}
