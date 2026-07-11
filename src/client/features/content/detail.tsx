import { type TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { lexicalToPlainText } from './data/lexical-text'
import { useContentItem } from './data/use-content'

// D-03 read-only detail. Dependency-free: title + status + published date + the
// CMS body as ESCAPED plaintext (lexicalToPlainText) — no raw-HTML sink (T-15-05).
export function ContentDetail({ id }: { id: string }) {
  const { t } = useTranslation()
  const { data: item, isPending, isError, refetch } = useContentItem(id)

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        {isPending ? (
          <DetailLoading />
        ) : isError ? (
          <DetailError onRetry={() => refetch()} />
        ) : (
          <article className='max-w-3xl space-y-4'>
            <div className='space-y-2'>
              <h2 className='text-2xl font-bold tracking-tight'>
                {item.title}
              </h2>
              <div className='text-muted-foreground flex items-center gap-3 text-sm'>
                {item.status ? (
                  <Badge variant='outline' className='capitalize'>
                    {item.status}
                  </Badge>
                ) : null}
                <span>
                  {formatPublished(item.data?.publishedAt, item.created_at, t)}
                </span>
              </div>
            </div>
            {/* React escapes text children — plaintext only, never innerHTML. */}
            <p className='leading-relaxed whitespace-pre-wrap'>
              {lexicalToPlainText(item.data?.content)}
            </p>
          </article>
        )}
      </Main>
    </>
  )
}

function formatPublished(
  publishedAt: string | null | undefined,
  createdAt: number | undefined,
  t: TFunction
): string {
  const value = publishedAt ?? createdAt
  if (value === null || value === undefined) return t('content.unpublished')
  return new Date(value).toLocaleDateString()
}

function DetailLoading() {
  return (
    <div className='max-w-3xl space-y-4'>
      <Skeleton className='h-8 w-2/3' />
      <Skeleton className='h-6 w-24' />
      <Skeleton className='h-40 w-full' />
    </div>
  )
}

function DetailError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className='max-w-3xl space-y-3'>
      <Alert variant='destructive'>
        <AlertTitle>{t('content.detail.errorTitle')}</AlertTitle>
        <AlertDescription>{t('content.detail.errorDesc')}</AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={onRetry}>
        {t('content.retry')}
      </Button>
    </div>
  )
}
