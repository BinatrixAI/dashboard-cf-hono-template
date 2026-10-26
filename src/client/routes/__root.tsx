import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { type useAuth } from '@clerk/react'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Toaster } from '@/components/ui/sonner'
import { BrandPage } from '@/components/brand-page'
import { NavigationProgress } from '@/components/navigation-progress'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'

// Phone toasts sit above the tab bar (64 + 24 gap + 16); sonner's own mobile switch is at 600px, so both props.
const PHONE_OFFSET = { bottom: 'calc(104px + env(safe-area-inset-bottom))' }

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  // App-wide Clerk auth (D-02). Injected per-render by <InnerApp/> in main.tsx
  // once `useAuth()` has settled; `undefined` before the first settled render.
  auth: ReturnType<typeof useAuth> | undefined
}>()({
  component: () => {
    return (
      <>
        <NavigationProgress />
        <Outlet />
        <AppToaster />
        {import.meta.env.MODE === 'development' && (
          <>
            <ReactQueryDevtools buttonPosition='bottom-left' />
            <TanStackRouterDevtools position='bottom-right' />
          </>
        )}
      </>
    )
  },
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
})

function AppToaster() {
  const phone = useMediaQuery('(width < 48rem)')
  // Public pages (sign-in, landing) draw no tab bar, so they keep sonner's default offset.
  const inApp = useRouterState({
    select: (s) =>
      s.matches.some((m) => m.routeId.startsWith('/_authenticated')),
  })
  return phone && inApp ? (
    <Toaster
      duration={5000}
      offset={PHONE_OFFSET}
      mobileOffset={PHONE_OFFSET}
    />
  ) : (
    <Toaster duration={5000} />
  )
}

function RootNotFound() {
  return (
    <BrandPage>
      <NotFoundError />
    </BrandPage>
  )
}

function RootError() {
  return (
    <BrandPage>
      <GeneralError />
    </BrandPage>
  )
}
