import { Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export function Dashboard() {
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <h1 className='text-2xl font-bold'>Overview</h1>

        <Alert className='mt-4'>
          <Info className='size-4' />
          <AlertTitle>Template placeholder overview</AlertTitle>
          <AlertDescription>
            Replace the cards below with your project's key metrics and data
            widgets.
          </AlertDescription>
        </Alert>

        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Stat One</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-bold'>—</div>
              <CardDescription className='mt-1'>
                Replace with real metric
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Stat Two</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-3xl font-bold'>—</div>
              <CardDescription className='mt-1'>
                Replace with real metric
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
