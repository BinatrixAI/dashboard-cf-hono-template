import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ClerkProvider, useAuth } from '@clerk/react'
import { shadcn } from '@clerk/themes'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

// Clerk publishable key — the ONLY Clerk key that reaches the client bundle.
// Vite inlines only `VITE_`-prefixed vars, so the non-VITE CLERK_SECRET_KEY can
// never cross into `dist/` from here (AUTH-04 / D-16).
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.log({ failureCount, error })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(
          error instanceof AxiosError &&
          [401, 403].includes(error.response?.status ?? 0)
        )
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)

        if (error instanceof AxiosError) {
          if (error.response?.status === 304) {
            toast.error('Content not modified!')
          }
        }
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          toast.error('Session expired!')
          // An edge 401 means the Clerk session is no longer valid — send the
          // user to /sign-in (preserving where they were) so an expired session
          // can't leave them on an authed-looking screen (D-11 / T-03-09).
          router.navigate({
            to: '/sign-in',
            // Store a RELATIVE same-origin target (path + query), never the
            // absolute `window.location.href`, so the value handed to the
            // sign-in `redirect` param is already same-origin (WR-01).
            search: {
              redirect: window.location.pathname + window.location.search,
            },
          })
        }
        if (error.response?.status === 500) {
          toast.error('Internal Server Error!')
          // Only navigate to error page in production to avoid disrupting HMR in development
          if (import.meta.env.PROD) {
            router.navigate({ to: '/500' })
          }
        }
        if (error.response?.status === 403) {
          // router.navigate("/forbidden", { replace: true });
        }
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
            afterSignOutUrl='/'
            signInUrl='/sign-in'
            signUpUrl='/sign-up'
            signInFallbackRedirectUrl='/dashboard'
            signUpFallbackRedirectUrl='/dashboard'
          >
            <ThemeProvider>
              <FontProvider>
                <DirectionProvider>
                  <InnerApp />
                </DirectionProvider>
              </FontProvider>
            </ThemeProvider>
          </ClerkProvider>
        ) : (
          <ThemeProvider>
            <FontProvider>
              <DirectionProvider>
                <MissingClerkPubKey />
              </DirectionProvider>
            </FontProvider>
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
        <pre className='overflow-auto rounded bg-slate-950 px-3 py-2 text-xs text-slate-200'>
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
