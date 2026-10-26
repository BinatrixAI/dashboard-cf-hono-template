import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/react'
import { safeRedirect } from '@/lib/safe-redirect'
import { Skeleton } from '@/components/ui/skeleton'

type SignInSearch = {
  // Where to return the user after a successful sign-in. Populated by the
  // `/_authenticated` guard's `throw redirect({ search: { redirect } })`.
  redirect?: string
}

export const Route = createFileRoute('/(auth)/sign-in')({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    // Same-origin targets only; see @/lib/safe-redirect for why the URL parser decides (SEC-01).
    redirect: safeRedirect(search.redirect, '') || undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  return (
    <SignIn
      forceRedirectUrl={redirect ?? '/dashboard'}
      fallback={<Skeleton className='h-[30rem] w-[25rem]' />}
    />
  )
}
