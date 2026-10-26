import { createFileRoute } from '@tanstack/react-router'
import { BrandPage } from '@/components/brand-page'
import { GeneralError } from '@/features/errors/general-error'

export const Route = createFileRoute('/(errors)/500')({
  component: ServerErrorPage,
})

function ServerErrorPage() {
  return (
    <BrandPage>
      <GeneralError />
    </BrandPage>
  )
}
