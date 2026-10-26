import { createFileRoute } from '@tanstack/react-router'
import { BrandPage } from '@/components/brand-page'
import { UnauthorisedError } from '@/features/errors/unauthorized-error'

export const Route = createFileRoute('/(errors)/401')({
  component: UnauthorizedPage,
})

function UnauthorizedPage() {
  return (
    <BrandPage>
      <UnauthorisedError />
    </BrandPage>
  )
}
