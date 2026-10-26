import { useRef } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons'
import { type ReactTable, type RowData } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { cn, getPageNumbers } from '@/lib/utils'
import { PAGE_SIZES } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type DataTableFeatures } from '@/components/data-table/features'

type DataTablePaginationProps<TData extends RowData> = {
  table: ReactTable<DataTableFeatures, TData>
  className?: string
}

export function DataTablePagination<TData extends RowData>({
  table,
  className,
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const currentPage = table.state.pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const rowCount = table.getRowCount()
  const pageNumbers = getPageNumbers(currentPage, totalPages)

  if (rowCount <= PAGE_SIZES[0]) return null
  const paged = totalPages > 1

  // Page changes bring the table's Card top under the sticky header (80px = scroll-mt-20).
  // Never on page-size changes, and focus is never moved (D-14).
  const goTo = (change: () => void) => {
    change()
    const card = ref.current?.closest('[data-slot="card"]')
    if (!card || card.getBoundingClientRect().top >= 80) return
    card.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between overflow-clip px-2 max-md:py-1.5',
        '@max-2xl/content:flex-col-reverse @max-2xl/content:gap-4',
        className
      )}
      style={{ overflowClipMargin: 1 }}
    >
      <div className='flex w-full items-center justify-between'>
        {paged && (
          <div className='flex w-[100px] items-center justify-center text-sm font-medium @2xl/content:hidden'>
            {t('dataTable.pageOf', { current: currentPage, total: totalPages })}
          </div>
        )}
        <div className='flex items-center gap-2 @max-2xl/content:flex-row-reverse'>
          <Select
            value={`${table.state.pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger size='sm' className='hit-44 w-[70px]'>
              <SelectValue placeholder={table.state.pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side='top'>
              {PAGE_SIZES.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='hidden text-sm font-medium sm:block'>
            {t('dataTable.rowsPerPage')}
          </p>
        </div>
      </div>

      {paged && (
        <div className='flex items-center sm:space-x-6 lg:space-x-8'>
          <div className='flex w-[100px] items-center justify-center text-sm font-medium @max-3xl/content:hidden'>
            {t('dataTable.pageOf', { current: currentPage, total: totalPages })}
          </div>
          <div className='flex items-center space-x-2'>
            <Button
              variant='outline'
              className='hit-44 size-8 p-0 @max-md/content:hidden'
              onClick={() => goTo(() => table.setPageIndex(0))}
              disabled={!table.getCanPreviousPage()}
            >
              <span className='sr-only'>{t('dataTable.goToFirst')}</span>
              <DoubleArrowLeftIcon className='h-4 w-4 rtl:rotate-180' />
            </Button>
            <Button
              variant='outline'
              className='hit-44 size-8 p-0'
              onClick={() => goTo(() => table.previousPage())}
              disabled={!table.getCanPreviousPage()}
            >
              <span className='sr-only'>{t('dataTable.goToPrevious')}</span>
              <ChevronLeftIcon className='h-4 w-4 rtl:rotate-180' />
            </Button>

            {/* Page number buttons */}
            {pageNumbers.map((pageNumber, index) => (
              <div key={`${pageNumber}-${index}`} className='flex items-center'>
                {pageNumber === '...' ? (
                  <span className='text-muted-foreground px-1 text-sm'>
                    ...
                  </span>
                ) : (
                  <Button
                    variant={currentPage === pageNumber ? 'default' : 'outline'}
                    className='hit-44 h-8 min-w-8 px-2'
                    // aria-label, not an sr-only span: the span plus the digit read "Go to page 22".
                    aria-label={t('dataTable.goToPage', { page: pageNumber })}
                    onClick={() =>
                      goTo(() => table.setPageIndex((pageNumber as number) - 1))
                    }
                  >
                    {pageNumber}
                  </Button>
                )}
              </div>
            ))}

            <Button
              variant='outline'
              className='hit-44 size-8 p-0'
              onClick={() => goTo(() => table.nextPage())}
              disabled={!table.getCanNextPage()}
            >
              <span className='sr-only'>{t('dataTable.goToNext')}</span>
              <ChevronRightIcon className='h-4 w-4 rtl:rotate-180' />
            </Button>
            <Button
              variant='outline'
              className='hit-44 size-8 p-0 @max-md/content:hidden'
              onClick={() => goTo(() => table.setPageIndex(totalPages - 1))}
              disabled={!table.getCanNextPage()}
            >
              <span className='sr-only'>{t('dataTable.goToLast')}</span>
              <DoubleArrowRightIcon className='h-4 w-4 rtl:rotate-180' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
