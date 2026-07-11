import { useTranslation } from 'react-i18next'
import { cmsBaseUrl } from '@/lib/cms-client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ContentTable } from './components/content-table'
import { useContent } from './data/use-content'

// DASH-01 read-only CMS list. Three distinct pre-render states:
//   D-04 not-configured (no fetch) · D-05 couldn't-reach error (+Retry) · loading.
export function Content() {
  const { t } = useTranslation()
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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {t('content.title')}
            </h2>
            <p className='text-muted-foreground'>{t('content.subtitle')}</p>
          </div>
        </div>
        {/* D-04: gate BEFORE mounting the query so an unconfigured CMS issues
            no fetch — ContentList (which calls useContent) is never rendered. */}
        {cmsBaseUrl() === null ? <CmsNotConfigured /> : <ContentList />}
      </Main>
    </>
  )
}

function ContentList() {
  const { data, isPending, isError, refetch } = useContent()

  if (isPending) return <ContentLoading />
  if (isError) return <ContentError onRetry={() => refetch()} />
  return <ContentTable data={data} />
}

const codeClass =
  'bg-foreground/10 rounded-sm px-1 py-0.5 text-xs font-bold text-foreground'

// D-04 onboarding panel (not an error) — mirrors main.tsx MissingClerkPubKey:
// names the env var, links the setup doc, and never triggers a fetch.
function CmsNotConfigured() {
  const { t } = useTranslation()
  return (
    <div className='max-w-xl space-y-3 rounded-md border p-6'>
      <h3 className='text-lg font-semibold'>
        {t('content.notConfigured.title')}
      </h3>
      <p className='text-muted-foreground text-sm'>
        {t('content.notConfigured.body1a')}
        <code className={codeClass}>VITE_CMS_API_URL</code>
        {t('content.notConfigured.body1b')}
        <code className={codeClass}>https://cms.example.com</code>
        {t('content.notConfigured.body1c')}
        <code className={codeClass}>.env.local</code>
        {t('content.notConfigured.body1d')}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t('content.notConfigured.body2a')}
        <code className={codeClass}>docs/cms.md</code>
        {t('content.notConfigured.body2b')}
      </p>
    </div>
  )
}

function ContentLoading() {
  return (
    <div className='space-y-3'>
      <Skeleton className='h-9 w-full max-w-sm' />
      <div className='overflow-hidden rounded-md border'>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className='flex items-center gap-4 border-b p-3'>
            <Skeleton className='h-4 w-48' />
            <Skeleton className='h-6 w-20' />
            <Skeleton className='ms-auto h-4 w-24' />
          </div>
        ))}
      </div>
    </div>
  )
}

// D-05: reachability error, distinct from the not-configured panel — a failed
// cross-origin fetch surfaces through react-query isError here (T-15-04).
function ContentError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className='space-y-3'>
      <Alert variant='destructive'>
        <AlertTitle>{t('content.error.title')}</AlertTitle>
        <AlertDescription>
          {t('content.error.descA')}
          <code className={codeClass}>CORS_ORIGINS</code>
          {t('content.error.descB')}
          <code className={codeClass}>docs/cms.md</code>
          {t('content.error.descC')}
        </AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={onRetry}>
        {t('content.retry')}
      </Button>
    </div>
  )
}
