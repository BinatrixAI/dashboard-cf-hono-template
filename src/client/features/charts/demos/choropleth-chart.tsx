import { useQuery } from '@tanstack/react-query'
import type { FeatureCollection, Geometry } from 'geojson'
import { feature } from 'topojson-client'
import { ChartSkeleton } from '@/components/bone'
import {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  type ChoroplethFeature,
  type ChoroplethFeatureProperties,
  ChoroplethTooltip,
} from '@/components/charts/choropleth'

// Bklit's sample values, keyed by the ISO-3 ids the pinned world TopoJSON uses
// (the example ships ISO-2 rows with no geometry).
const values: Record<string, number> = { USA: 120, CAN: 45, GBR: 62 }

type World = FeatureCollection<Geometry, ChoroplethFeatureProperties>

// Same-origin, sha256-pinned copy (public/data/, MIT): CSP connect-src stays 'self'.
async function fetchWorld(): Promise<World> {
  const res = await fetch('/data/world-countries.json')
  if (!res.ok) throw new Error(`world-countries.json: ${res.status}`)
  const topo = (await res.json()) as Parameters<typeof feature>[0]
  const world = feature(topo, topo.objects.countries) as World
  for (const f of world.features) {
    const id = String(f.id)
    f.properties = { ...f.properties, id, value: values[id] }
  }
  return world
}

const valueOf = (f: ChoroplethFeature) =>
  f.properties.value as number | undefined

function colorOf(f: ChoroplethFeature) {
  const v = valueOf(f)
  if (v === undefined) return 'var(--chart-scale-01)'
  if (v >= 100) return 'var(--chart-scale-05)'
  if (v >= 60) return 'var(--chart-scale-04)'
  return 'var(--chart-scale-03)'
}

export default function ChoroplethChartDemo() {
  const { data } = useQuery({
    queryKey: ['charts', 'world-countries'],
    queryFn: fetchWorld,
    staleTime: Infinity,
  })
  if (!data) return <ChartSkeleton />
  return (
    <ChoroplethChart data={data} aspectRatio='2 / 1'>
      <ChoroplethFeatureComponent getFeatureColor={colorOf} />
      <ChoroplethTooltip getFeatureValue={valueOf} />
    </ChoroplethChart>
  )
}
