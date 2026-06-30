import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'

// The Dashboard now lives at `/dashboard` (relocated from `/`) so the public
// landing can own `/` and sign-out can land there (D-06/D-09).
export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
})
