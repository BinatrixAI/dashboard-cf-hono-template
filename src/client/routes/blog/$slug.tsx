import { createFileRoute } from '@tanstack/react-router'
import { PublicDetail } from '@/features/content/public-detail'

// PUB-01 `/blog/$slug` post page — thin mount of the Plan-01 detail view. The
// typed `slug` param flows straight to PublicDetail (D-04). Genuinely anonymous:
// no session hook, no session import; data reads via the view's useContent() seam.
export const Route = createFileRoute('/blog/$slug')({
  component: BlogPostRoute,
})

function BlogPostRoute() {
  const { slug } = Route.useParams()
  return <PublicDetail slug={slug} />
}
