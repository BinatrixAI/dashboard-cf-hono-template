import { createFileRoute } from '@tanstack/react-router'
import { Charts } from '@/features/charts'

// Bklit chart gallery: one card per installed chart, each lazy-loaded on scroll.
export const Route = createFileRoute('/_authenticated/charts')({
  component: Charts,
})
