import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { CircleAlert, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type WidgetProps<T> = {
  query: Pick<UseQueryResult<T>, 'status' | 'data' | 'refetch'>
  skeleton: ReactNode
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
  children: (data: T) => ReactNode
}

/**
 * One card's loading / error / empty / content switch (DS-03), placed by its caller
 * inside the card chrome. The error branch needs data === undefined: TanStack v5 keeps
 * data on a failed refetch, and that keeps the content (never blanks). Reads only
 * status / data / refetch, so a background refetch never swaps in the skeleton.
 * No hooks here, which keeps it callable as a plain function in tests.
 */
export function Widget<T>({
  query,
  skeleton,
  isEmpty,
  empty,
  children,
}: WidgetProps<T>) {
  if (query.status === 'pending')
    return <WidgetPending>{skeleton}</WidgetPending>
  if (query.data === undefined)
    return (
      // cancelRefetch:false joins an in-flight fetch: repeated clicks, one request
      <WidgetError
        onRetry={() => void query.refetch({ cancelRefetch: false })}
      />
    )
  if (empty !== undefined && isEmpty?.(query.data)) return empty
  return children(query.data)
}

export function WidgetPending({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div aria-busy='true' className='flex flex-1 flex-col'>
      {children}
      <span className='sr-only'>{t('widget.loading')}</span>
    </div>
  )
}

/** Inline error that stays inside its card; the rest of the page still renders. */
export function WidgetError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      role='alert'
      className='text-muted-foreground flex flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm'
    >
      <CircleAlert aria-hidden className='size-4 shrink-0' />
      <span>{t('widget.loadError')}</span>
      <button
        type='button'
        onClick={onRetry}
        className='focus-ring hit-24 text-brand-fg inline-flex shrink-0 items-center gap-1 rounded-md font-semibold whitespace-nowrap'
      >
        <RotateCw aria-hidden className='size-3.5' />
        {t('widget.reload')}
      </button>
    </div>
  )
}
