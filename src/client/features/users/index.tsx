import { getRouteApi } from '@tanstack/react-router'
import { Users as UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { TableSkeleton } from '@/components/bone'
import { ConfigDrawer } from '@/components/config-drawer'
import { EmptyState } from '@/components/empty-state'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeMenu } from '@/components/theme-menu'
import { Widget } from '@/components/widget'
import { UsersTable } from './components/users-table'
import { useUsers } from './data/use-users'

const route = getRouteApi('/_authenticated/users/')

export function Users() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  // D-04/D-02a: real Clerk users, read-only. No UsersProvider/PrimaryButtons/
  // Dialogs — every mutation path is trimmed (invite/add/edit/delete/bulk).
  const query = useUsers()
  // 403 = the requireAdmin gate: caller is signed in but lacks the admin role.
  const forbidden = (query.error as { status?: number } | null)?.status === 403

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeMenu />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
        {/* Forbidden first: a deterministic 403 gets its alert, never the Widget's Reload. */}
        {forbidden ? (
          <UsersForbidden />
        ) : (
          <Card className='scroll-mt-20 gap-4 p-4'>
            <Widget
              query={query}
              skeleton={<TableSkeleton />}
              isEmpty={(d) => d.length === 0}
              empty={
                <EmptyState
                  icon={UsersIcon}
                  heading={t('users.empty.title')}
                  body={t('users.empty.body')}
                />
              }
            >
              {(users) => (
                <UsersTable data={users} search={search} navigate={navigate} />
              )}
            </Widget>
          </Card>
        )}
      </Main>
    </>
  )
}

function UsersForbidden() {
  const { t } = useTranslation()
  return (
    <Alert>
      <AlertTitle>{t('users.forbidden')}</AlertTitle>
      <AlertDescription>{t('users.forbiddenDesc')}</AlertDescription>
    </Alert>
  )
}
