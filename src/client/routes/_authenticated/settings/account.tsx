import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/account')({
  // Account has no standalone surface (D-04): the real Clerk user lives on the
  // Profile page's <UserProfile/>. Redirect to /settings before render, staying
  // inside the _authenticated guarded tree and mirroring the beforeLoad +
  // `throw redirect` convention from _authenticated/route.tsx. The Account nav
  // entry is intentionally kept in both sub-nav sources (D-05).
  beforeLoad: () => {
    throw redirect({ to: '/settings' })
  },
})
