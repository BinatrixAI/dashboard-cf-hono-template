import { createFileRoute, Outlet } from '@tanstack/react-router'
import { BrandPage } from '@/components/brand-page'

export const Route = createFileRoute('/(auth)')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <BrandPage>
      <div className='flex w-full justify-center'>
        <Outlet />
      </div>
    </BrandPage>
  )
}
