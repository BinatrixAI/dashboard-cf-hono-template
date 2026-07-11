import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@clerk/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

// Minimal PUBLIC landing at `/` (D-06). Registered OUTSIDE `_authenticated/`,
// so it is public by the D-03 seam — the visible counterpart to the public
// `/api/health` route from Plan 01. Deliberately minimal; Phase 4 owns theming.
export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { isSignedIn } = useAuth()
  const { t } = useTranslation()
  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>{t('landing.welcome')}</h1>
        <p className='text-muted-foreground max-w-md'>
          {t('landing.description')}
        </p>
      </div>
      <div className='flex flex-wrap items-center justify-center gap-3'>
        {isSignedIn ? (
          <Button asChild>
            <Link to='/dashboard'>{t('landing.goToDashboard')}</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link to='/sign-in'>{t('landing.signIn')}</Link>
            </Button>
            <Button asChild variant='outline'>
              <Link to='/dashboard'>{t('landing.goToDashboard')}</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
