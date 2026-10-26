import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { heIL } from '@clerk/localizations'
import { ClerkProvider, useAuth } from '@clerk/react'
import { shadcn } from '@clerk/themes'
import { toast } from 'sonner'
import { getCookie } from '@/lib/cookies'
import { handleServerError } from '@/lib/handle-server-error'
import { statusOf } from '@/lib/http-error'
import { leavesForErrorPage, shouldRetry } from '@/lib/query-error'
import { endSession, sessionEnding } from '@/lib/session'
import { DirectionProvider } from './context/direction-provider'
import { ThemeProvider } from './context/theme-provider'
// i18next — init side effect + imperative t() for non-component toasts. Must load
// before render so the initial language matches the `dir` cookie.
import i18n from './i18n'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

// Clerk publishable key — the ONLY Clerk key that reaches the client bundle.
// Vite inlines only `VITE_`-prefixed vars, so the non-VITE CLERK_SECRET_KEY can
// never cross into `dist/` from here (AUTH-04 / D-16).
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// A server 401 means the Worker no longer accepts the Clerk session, even if
// Clerk's client still says signed-in. Navigating to /sign-in would bounce
// straight back (the 401 loop), so end the session through Clerk instead —
// once per page load, however many queries fail at the same time (D-07).
function signOutOnce() {
  if (!sessionEnding()) toast.error(i18n.t('common.sessionExpired'))
  const auth = router.options.context.auth
  if (!auth) return
  // Return target is a RELATIVE same-origin path + query, never the absolute
  // `window.location.href`, so the sign-in `redirect` param is same-origin.
  void endSession(
    auth.signOut,
    window.location.pathname + window.location.search
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.log({ failureCount, error })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        return shouldRetry(failureCount, error)
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
    mutations: {
      onError: (error) => {
        if (statusOf(error) === 401) return signOutOnce()

        handleServerError(error)
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const status = statusOf(error)
      if (status === 401) return signOutOnce()

      // No status = network error / timeout / non-HTTP throw. Other 4xx are the
      // page's own business (403 state, inline error), so no toast for those.
      if (status === undefined || status >= 500) {
        toast.error(i18n.t('common.internalServerError'))
      }
      // A failed refetch over data already on screen keeps the screen (D-08);
      // only a 5xx with nothing to show leaves for /500, and only in production.
      if (
        import.meta.env.PROD &&
        status !== undefined &&
        status >= 500 &&
        leavesForErrorPage(query)
      ) {
        router.navigate({ to: '/500' })
      }
    },
  }),
})

// Create a new router instance. `auth` is injected per-render by <InnerApp/>
// once Clerk has settled; the `undefined!` placeholder keeps the context type
// honest while satisfying createRouter's eager context requirement.
const router = createRouter({
  routeTree,
  context: { queryClient, auth: undefined! },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Reads the live Clerk auth state and feeds it into the router context so the
// `/_authenticated` `beforeLoad` guard (Plan 02 Task 3) sees a settled value.
// Gating render on `isLoaded` prevents a false redirect-to-/sign-in flash on a
// hard refresh while Clerk is still hydrating (RESEARCH Pitfall 3).
function InnerApp() {
  const auth = useAuth()
  if (!auth.isLoaded) return null
  return <RouterProvider router={router} context={{ queryClient, auth }} />
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {PUBLISHABLE_KEY ? (
          <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            appearance={{ theme: shadcn }}
            // ponytail: Clerk-owned chrome (sign-in/up) is keyed off the `dir`
            // cookie at load only — a mid-session RTL toggle updates it on next
            // load. Upgrade path: lift `dir` state above ClerkProvider.
            localization={getCookie('dir') === 'rtl' ? heIL : undefined}
            afterSignOutUrl='/'
            signInUrl='/sign-in'
            signUpUrl='/sign-up'
            signInFallbackRedirectUrl='/dashboard'
            signUpFallbackRedirectUrl='/dashboard'
          >
            <ThemeProvider>
              <DirectionProvider>
                <InnerApp />
              </DirectionProvider>
            </ThemeProvider>
          </ClerkProvider>
        ) : (
          <ThemeProvider>
            <DirectionProvider>
              <MissingClerkPubKey />
            </DirectionProvider>
          </ThemeProvider>
        )}
      </QueryClientProvider>
    </StrictMode>
  )
}

// Standalone guidance shown when no VITE_CLERK_PUBLISHABLE_KEY is configured, so
// a forker without Clerk keys sees setup instructions instead of a blank crash.
// Kept dependency-light (no router/sidebar context) since it renders above the
// router. This replaces the old `clerk/route.tsx` MissingClerkPubKey screen.
function MissingClerkPubKey() {
  const codeBlock =
    'bg-foreground/10 rounded-sm py-0.5 px-1 text-xs text-foreground font-bold'
  return (
    <div className='bg-background text-foreground flex min-h-svh items-center justify-center p-6'>
      <div className='max-w-xl space-y-4'>
        <h1 className='text-2xl font-bold'>Set your Clerk publishable key</h1>
        <p className='text-foreground/75'>
          No <code className={codeBlock}>VITE_CLERK_PUBLISHABLE_KEY</code> was
          found. Generate a publishable key in the{' '}
          <a
            href='https://dashboard.clerk.com'
            target='_blank'
            rel='noreferrer'
            className='underline decoration-dashed underline-offset-4 hover:decoration-solid'
          >
            Clerk Dashboard
          </a>{' '}
          (API keys), then add it to your{' '}
          <code className={codeBlock}>.env.local</code> (the file{' '}
          <code className={codeBlock}>setup.mjs</code> writes — Vite inlines{' '}
          <code className={codeBlock}>VITE_*</code> from{' '}
          <code className={codeBlock}>.env*</code>, not{' '}
          <code className={codeBlock}>.dev.vars</code>):
        </p>
        <pre className='bg-muted text-foreground overflow-auto rounded px-3 py-2 text-xs'>
          <code>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code>
        </pre>
        <p className='text-foreground/60 text-sm'>
          The Worker also needs a non-VITE{' '}
          <code className={codeBlock}>CLERK_PUBLISHABLE_KEY</code> and a{' '}
          <code className={codeBlock}>CLERK_SECRET_KEY</code> (secret) — see{' '}
          <code className={codeBlock}>.dev.vars.example</code>.
        </p>
      </div>
    </div>
  )
}
