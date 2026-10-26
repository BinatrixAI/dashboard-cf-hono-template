import { createFileRoute } from '@tanstack/react-router'
import { BrandPage } from '@/components/brand-page'
import { ForbiddenError } from '@/features/errors/forbidden'

export const Route = createFileRoute('/(errors)/403')({
  component: ForbiddenPage,
})

function ForbiddenPage() {
  return (
    <BrandPage>
      <ForbiddenError />
    </BrandPage>
  )
}
