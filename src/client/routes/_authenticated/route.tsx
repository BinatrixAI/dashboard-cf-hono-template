import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  // UX-only guard (D-03/D-04): redirect signed-out users to /sign-in before the
  // layout renders. Relies on main.tsx gating render on Clerk's `isLoaded`, so
  // `context.auth` is always settled here (no flash / false redirect, Pitfall 3).
  // NOT a security boundary — the real gate is Plan 01's edge `requireAuth`.
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isSignedIn) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
  },
  component: AuthenticatedLayout,
})
