import { createFileRoute } from '@tanstack/react-router'
import { BrandPage } from '@/components/brand-page'
import { NotFoundError } from '@/features/errors/not-found-error'

export const Route = createFileRoute('/(errors)/404')({
  component: NotFoundPage,
})

function NotFoundPage() {
  return (
    <BrandPage>
      <NotFoundError />
    </BrandPage>
  )
}
