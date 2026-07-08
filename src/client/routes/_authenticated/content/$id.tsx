import { createFileRoute } from '@tanstack/react-router'
import { ContentDetail } from '@/features/content/detail'

export const Route = createFileRoute('/_authenticated/content/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <ContentDetail id={id} />
}
