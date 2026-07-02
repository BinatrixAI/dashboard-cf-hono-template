import { getRouteApi } from '@tanstack/react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { UsersTable } from './components/users-table'
import { useUsers } from './data/use-users'

const route = getRouteApi('/_authenticated/users/')

export function Users() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  // D-04/D-02a: real Clerk users, read-only. No UsersProvider/PrimaryButtons/
  // Dialogs — every mutation path is trimmed (invite/add/edit/delete/bulk).
  const { data: users, isPending, isError, refetch } = useUsers()

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>User List</h2>
            <p className='text-muted-foreground'>
              The users in this Clerk instance, with their status and role.
            </p>
          </div>
        </div>
        {isPending ? (
          <UsersLoading />
        ) : isError ? (
          <UsersError onRefresh={() => refetch()} />
        ) : (
          <UsersTable data={users} search={search} navigate={navigate} />
        )}
      </Main>
    </>
  )
}

function UsersLoading() {
  return (
    <div className='space-y-3'>
      <Skeleton className='h-9 w-full max-w-sm' />
      <div className='overflow-hidden rounded-md border'>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className='flex items-center gap-4 border-b p-3'>
            <Skeleton className='size-4' />
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-4 w-40' />
            <Skeleton className='ms-auto h-6 w-20' />
          </div>
        ))}
      </div>
    </div>
  )
}

function UsersError({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className='space-y-3'>
      <Alert variant='destructive'>
        <AlertTitle>Could not load users</AlertTitle>
        <AlertDescription>
          The <code>/api/users</code> request failed. Confirm the Clerk secret
          key is configured, then refresh.
        </AlertDescription>
      </Alert>
      <Button variant='outline' size='sm' onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  )
}
