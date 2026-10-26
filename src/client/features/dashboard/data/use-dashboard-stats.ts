import { useQuery } from '@tanstack/react-query'
import {
  areaData,
  breakdownData,
  kpis,
  lineData,
  overviewData,
  recentSales,
  type AreaPoint,
  type BreakdownSlice,
  type Kpi,
  type LinePoint,
  type OverviewPoint,
  type RecentSale,
} from './mock'

/**
 * Dashboard data layer (D-09): one query feeds every card on /dashboard, so each
 * Widget shows the same loading / error / content state. ⚠️ DEMO DATA for now.
 */

export const dashboardStatsQueryKey = ['dashboard-stats'] as const

export type DashboardStats = {
  kpis: Kpi[]
  overview: OverviewPoint[]
  area: AreaPoint[]
  breakdown: BreakdownSlice[]
  line: LinePoint[]
  recentSales: RecentSale[]
}

// The single place a fork swaps in fetch('/api/…') + HttpError (see use-items.ts).
async function fetchDashboardStats(): Promise<DashboardStats> {
  return {
    kpis,
    overview: overviewData,
    area: areaData,
    breakdown: breakdownData,
    line: lineData,
    recentSales,
  }
}

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardStatsQueryKey,
    queryFn: fetchDashboardStats,
  })
}
