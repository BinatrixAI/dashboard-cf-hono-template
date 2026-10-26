import { BarChart3, ChartLine, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartSkeleton, KpiSkeleton } from '@/components/bone'
import { ConfigDrawer } from '@/components/config-drawer'
import { EmptyState } from '@/components/empty-state'
import { Kpi, KpiCard } from '@/components/kpi-card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeMenu } from '@/components/theme-menu'
import { Widget } from '@/components/widget'
import { AnalyticsAreaChart } from './components/analytics-area-chart'
import { AnalyticsLineChart } from './components/analytics-line-chart'
import { AnalyticsPieChart } from './components/analytics-pie-chart'
import { OverviewChart } from './components/overview-chart'
import { RecentSales } from './components/recent-sales'
// ⚠️ DEMO DATA — every number on this page comes from useDashboardStats(), whose
// queryFn returns the static literals in ./data/mock. A forker swaps that one
// queryFn for a real fetch; see REQUIREMENTS.md.
import { useDashboardStats } from './data/use-dashboard-stats'

/** One slot per KPI, in mock order; a fork changing the metric count changes this. */
const KPI_SLOTS = [0, 1, 2, 3] as const

export function Dashboard() {
  const { t } = useTranslation()
  const query = useDashboardStats()
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeMenu />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <PageHeader
          title={t('dashboard.title')}
          subtitle={t('dashboard.subtitle')}
        />

        {/* ===== KPI row ===== */}
        <div className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {KPI_SLOTS.map((i) => (
            <KpiCard key={i}>
              <Widget query={query} skeleton={<KpiSkeleton />}>
                {(d) => {
                  const k = d.kpis[i]
                  return k && k.series.length > 0 ? (
                    <Kpi
                      label={t(k.title)}
                      value={k.value}
                      context={t(k.delta)}
                      points={k.series}
                    />
                  ) : (
                    <Kpi
                      label={k ? t(k.title) : ''}
                      value='—'
                      context={t('dashboard.kpiEmpty')}
                      points={[]}
                    />
                  )
                }}
              </Widget>
            </KpiCard>
          ))}
        </div>

        <Tabs defaultValue='overview' className='mt-4 space-y-4'>
          <TabsList>
            <TabsTrigger value='overview'>
              {t('dashboard.overview')}
            </TabsTrigger>
            <TabsTrigger value='analytics'>
              {t('dashboard.analytics')}
            </TabsTrigger>
          </TabsList>

          {/* ===== Overview tab ===== */}
          <TabsContent value='overview' className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='lg:col-span-4'>
                <CardHeader>
                  <CardTitle>{t('dashboard.overview')}</CardTitle>
                </CardHeader>
                <CardContent className='ps-2'>
                  <Widget
                    query={query}
                    skeleton={<ChartSkeleton />}
                    isEmpty={(d) => d.overview.length === 0}
                    empty={
                      <EmptyState
                        icon={BarChart3}
                        heading={t('dashboard.empty.overviewTitle')}
                        body={t('dashboard.empty.overviewBody')}
                      />
                    }
                  >
                    {(d) => (
                      <OverviewChart
                        data={d.overview}
                        label={t('widget.chartLabel', {
                          title: t('dashboard.overview'),
                        })}
                      />
                    )}
                  </Widget>
                </CardContent>
              </Card>

              <Card className='lg:col-span-3'>
                <CardHeader>
                  <CardTitle>{t('dashboard.recentSales')}</CardTitle>
                  <CardDescription>
                    {t('dashboard.recentSalesDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Widget
                    query={query}
                    skeleton={<ChartSkeleton />}
                    isEmpty={(d) => d.recentSales.length === 0}
                    empty={
                      <EmptyState
                        icon={Users}
                        heading={t('dashboard.empty.salesTitle')}
                        body={t('dashboard.empty.salesBody')}
                      />
                    }
                  >
                    {(d) => <RecentSales data={d.recentSales} />}
                  </Widget>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== Analytics tab ===== */}
          <TabsContent value='analytics' className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='lg:col-span-4'>
                <CardHeader>
                  <CardTitle>{t('dashboard.trend')}</CardTitle>
                  <CardDescription>{t('dashboard.trendDesc')}</CardDescription>
                </CardHeader>
                <CardContent className='ps-2'>
                  <Widget
                    query={query}
                    skeleton={<ChartSkeleton />}
                    isEmpty={(d) => d.area.length === 0}
                    empty={
                      <EmptyState
                        icon={ChartLine}
                        heading={t('dashboard.empty.chartTitle', {
                          title: t('dashboard.trend'),
                        })}
                        body={t('dashboard.empty.chartBody')}
                      />
                    }
                  >
                    {(d) => (
                      <AnalyticsAreaChart
                        data={d.area}
                        label={t('widget.chartLabelWithDesc', {
                          title: t('dashboard.trend'),
                          description: t('dashboard.trendDesc'),
                        })}
                      />
                    )}
                  </Widget>
                </CardContent>
              </Card>

              <Card className='lg:col-span-3'>
                <CardHeader>
                  <CardTitle>{t('dashboard.breakdown')}</CardTitle>
                  <CardDescription>
                    {t('dashboard.breakdownDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Widget
                    query={query}
                    skeleton={<ChartSkeleton />}
                    isEmpty={(d) => d.breakdown.length === 0}
                    empty={
                      <EmptyState
                        icon={ChartLine}
                        heading={t('dashboard.empty.chartTitle', {
                          title: t('dashboard.breakdown'),
                        })}
                        body={t('dashboard.empty.chartBody')}
                      />
                    }
                  >
                    {(d) => (
                      <AnalyticsPieChart
                        data={d.breakdown}
                        label={t('widget.chartLabelWithDesc', {
                          title: t('dashboard.breakdown'),
                          description: t('dashboard.breakdownDesc'),
                        })}
                      />
                    )}
                  </Widget>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.comparison')}</CardTitle>
                <CardDescription>
                  {t('dashboard.comparisonDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className='ps-2'>
                <Widget
                  query={query}
                  skeleton={<ChartSkeleton />}
                  isEmpty={(d) => d.line.length === 0}
                  empty={
                    <EmptyState
                      icon={ChartLine}
                      heading={t('dashboard.empty.chartTitle', {
                        title: t('dashboard.comparison'),
                      })}
                      body={t('dashboard.empty.chartBody')}
                    />
                  }
                >
                  {(d) => (
                    <AnalyticsLineChart
                      data={d.line}
                      label={t('widget.chartLabelWithDesc', {
                        title: t('dashboard.comparison'),
                        description: t('dashboard.comparisonDesc'),
                      })}
                    />
                  )}
                </Widget>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
