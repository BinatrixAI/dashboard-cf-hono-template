import { cn } from '@/lib/utils'

/** Button group (period switch): role=group + aria-pressed; scrolls inline when it does not fit. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  ariaLabel: string
}) {
  return (
    <div
      role='group'
      aria-label={ariaLabel}
      className='bg-muted no-scrollbar inline-flex max-w-full overflow-x-auto rounded-[12px] border p-1'
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type='button'
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'focus-ring min-h-8 shrink-0 rounded-[8px] px-4 py-1 text-xs font-semibold whitespace-nowrap transition-colors',
              active
                ? 'bg-popover text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
