import { createElement } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeMenu } from '@/components/theme-menu'
import { resolveErrorComponent } from '@/features/errors/error-map'

export const Route = createFileRoute('/_authenticated/errors/$error')({
  component: RouteComponent,
})

function RouteComponent() {
  const { error } = Route.useParams()

  const ErrorComponent = resolveErrorComponent(error)

  return (
    <>
      <Header fixed className='border-b'>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeMenu />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <div className='flex flex-1 items-center justify-center p-4'>
        {/* createElement, not <ErrorComponent />: the compiler lint reads a call-returned
            component type as one defined during render; resolveErrorComponent only returns
            module-scope references, so there is no identity churn to guard against. */}
        {createElement(ErrorComponent)}
      </div>
    </>
  )
}
