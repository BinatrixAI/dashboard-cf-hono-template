import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/react'
import { Skeleton } from '@/components/ui/skeleton'

type SignInSearch = {
  // Where to return the user after a successful sign-in. Populated by the
  // `/_authenticated` guard's `throw redirect({ search: { redirect } })`.
  redirect?: string
}

export const Route = createFileRoute('/(auth)/sign-in')({
  validateSearch: (search: Record<string, unknown>): SignInSearch => {
    const r = typeof search.redirect === 'string' ? search.redirect : undefined
    // Only allow internal, path-absolute targets (`/dashboard`) — never an
    // absolute/external URL (`https://evil.example`) or a protocol-relative
    // URL (`//evil.example`). This is a same-origin guard against an
    // open-redirect / phishing handoff after sign-in (WR-01). `forceRedirectUrl`
    // below then only ever receives a relative same-origin path.
    return {
      redirect: r && r.startsWith('/') && !r.startsWith('//') ? r : undefined,
    }
  },
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
