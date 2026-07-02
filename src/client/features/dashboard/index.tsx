import { Activity, CreditCard, DollarSign, Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AnalyticsAreaChart } from './components/analytics-area-chart'
import { AnalyticsLineChart } from './components/analytics-line-chart'
import { AnalyticsPieChart } from './components/analytics-pie-chart'
import { OverviewChart } from './components/overview-chart'
import { RecentSales } from './components/recent-sales'
// ⚠️ DEMO DATA — `statCards`/`recentSales` (and every chart dataset) are static
// mock values in ./data/mock. A forker swaps these consts for real metrics/API
// data; see REQUIREMENTS.md (D1 wiring is deferred to a later phase).
import { statCards } from './data/mock'

/** Lucide icons paired to the four stat cards, in `statCards` order. */
const statIcons = [DollarSign, Users, CreditCard, Activity]

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
        <h1 className='text-2xl font-semibold'>Dashboard</h1>

        <Tabs defaultValue='overview' className='mt-4 space-y-4'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='analytics'>Analytics</TabsTrigger>
          </TabsList>

          {/* ===== Overview tab ===== */}
          <TabsContent value='overview' className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {statCards.map((card, i) => {
                const Icon = statIcons[i]
                return (
                  <Card key={card.title}>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                      <CardTitle className='text-xs font-normal text-muted-foreground'>
                        {card.title}
                      </CardTitle>
                      <Icon className='size-4 text-muted-foreground' />
                    </CardHeader>
                    <CardContent>
                      <div className='text-2xl font-semibold'>{card.value}</div>
                      <p className='text-xs text-muted-foreground'>
                        {card.delta}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='lg:col-span-4'>
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className='ps-2'>
                  <OverviewChart />
                </CardContent>
              </Card>

              <Card className='lg:col-span-3'>
                <CardHeader>
                  <CardTitle>Recent Sales</CardTitle>
                  <CardDescription>
                    You made 265 sales this month.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentSales />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== Analytics tab ===== */}
          <TabsContent value='analytics' className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='lg:col-span-4'>
                <CardHeader>
                  <CardTitle>Trend</CardTitle>
                  <CardDescription>
                    Desktop vs. mobile sessions over the week.
                  </CardDescription>
                </CardHeader>
                <CardContent className='ps-2'>
                  <AnalyticsAreaChart />
                </CardContent>
              </Card>

              <Card className='lg:col-span-3'>
                <CardHeader>
                  <CardTitle>Breakdown</CardTitle>
                  <CardDescription>Traffic by source.</CardDescription>
                </CardHeader>
                <CardContent>
                  <AnalyticsPieChart />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Comparison</CardTitle>
                <CardDescription>
                  Revenue, profit, and expenses month over month.
                </CardDescription>
              </CardHeader>
              <CardContent className='ps-2'>
                <AnalyticsLineChart />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
