import { createFileRoute } from '@tanstack/react-router'
import { BrandPage } from '@/components/brand-page'
import { MaintenanceError } from '@/features/errors/maintenance-error'

export const Route = createFileRoute('/(errors)/503')({
  component: MaintenancePage,
})

function MaintenancePage() {
  return (
    <BrandPage>
      <MaintenanceError />
    </BrandPage>
  )
}
