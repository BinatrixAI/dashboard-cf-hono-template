import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { type TranslationKey } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from '@/components/bone'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeMenu } from '@/components/theme-menu'

type Demo = {
  key: TranslationKey
  Chart: LazyExoticComponent<ComponentType>
}

// One lazy chunk per demo, in install order: unseen charts never load their
// visx/d3/motion code, and none of it lands in the dashboard chunk.
const demos: Demo[] = [
  { key: 'charts.items.area', Chart: lazy(() => import('./demos/area-chart')) },
  { key: 'charts.items.bar', Chart: lazy(() => import('./demos/bar-chart')) },
  { key: 'charts.items.line', Chart: lazy(() => import('./demos/line-chart')) },
  {
    key: 'charts.items.composed',
    Chart: lazy(() => import('./demos/composed-chart')),
  },
  {
    key: 'charts.items.scatter',
    Chart: lazy(() => import('./demos/scatter-chart')),
  },
  {
    key: 'charts.items.liveLine',
    Chart: lazy(() => import('./demos/live-line-chart')),
  },
  {
    key: 'charts.items.candlestick',
    Chart: lazy(() => import('./demos/candlestick-chart')),
  },
  { key: 'charts.items.pie', Chart: lazy(() => import('./demos/pie-chart')) },
  {
    key: 'charts.items.radar',
    Chart: lazy(() => import('./demos/radar-chart')),
  },
  { key: 'charts.items.ring', Chart: lazy(() => import('./demos/ring-chart')) },
  {
    key: 'charts.items.gauge',
    Chart: lazy(() => import('./demos/gauge-chart')),
  },
  {
    key: 'charts.items.heatmap',
    Chart: lazy(() => import('./demos/heatmap-chart')),
  },
  {
    key: 'charts.items.choropleth',
    Chart: lazy(() => import('./demos/choropleth-chart')),
  },
  {
    key: 'charts.items.funnel',
    Chart: lazy(() => import('./demos/funnel-chart')),
  },
  {
    key: 'charts.items.sankey',
    Chart: lazy(() => import('./demos/sankey-chart')),
  },
  {
    key: 'charts.items.sunburst',
    Chart: lazy(() => import('./demos/sunburst-chart')),
  },
  {
    key: 'charts.items.sparkline',
    Chart: lazy(() => import('./demos/sparkline')),
  },
]

/** Renders the skeleton until the card first nears the viewport, then the chart for good. */
function InView({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return <div ref={ref}>{seen ? children : <ChartSkeleton />}</div>
}

export function Charts() {
  const { t } = useTranslation()
  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeMenu />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <PageHeader title={t('charts.title')} subtitle={t('charts.subtitle')} />

        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          {demos.map(({ key, Chart }) => {
            const title = t(key)
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <InView>
                    <Suspense fallback={<ChartSkeleton />}>
                      {/* Plot internals do not mirror (DV-7); figure, not img: some demos are interactive. */}
                      <div dir='ltr' role='figure' aria-label={title}>
                        <Chart />
                      </div>
                    </Suspense>
                  </InView>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </Main>
    </>
  )
}
