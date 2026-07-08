import { createFileRoute } from '@tanstack/react-router'
import { PublicIndex } from '@/features/content/public-index'

// PUB-01 `/blog` index — thin mount of the Plan-01 reader-cards view. Genuinely
// anonymous: unlike `routes/index.tsx`, no session hook here. Data flows through
// the view's reused useContent() cross-origin seam, never `/api/*`.
export const Route = createFileRoute('/blog/')({
  component: BlogIndexRoute,
})

function BlogIndexRoute() {
  return <PublicIndex />
}
