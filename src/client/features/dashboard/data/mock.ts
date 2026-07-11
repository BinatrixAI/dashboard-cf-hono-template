/**
 * ⚠️ DEMO DATA — replace with your real metrics / API data.
 *
 * This module is the single, self-contained source of the numbers shown on the
 * dashboard (charts, stat cards, and the Recent Sales list). It is intentionally
 * static: every value is a fixed literal so the demo is reproducible and needs no
 * network, D1, or fetch seam (D-01 / D-01a). A forker swaps these consts for real
 * data — see REQUIREMENTS.md (D1 wiring is deferred to a later phase).
 *
 * Do NOT compute values at runtime (no Math.random, no Date.now) — reproducible
 * UAT depends on the literals below (DV-10).
 */
import { type TranslationKey } from '@/i18n'

/** One month of the Overview bar chart (single series). */
export interface OverviewPoint {
  month: string
  total: number
}

/** 12 monthly points feeding the Overview bar chart. */
export const overviewData: OverviewPoint[] = [
  { month: 'Jan', total: 4200 },
  { month: 'Feb', total: 3100 },
  { month: 'Mar', total: 5300 },
  { month: 'Apr', total: 4800 },
  { month: 'May', total: 6100 },
  { month: 'Jun', total: 5500 },
  { month: 'Jul', total: 7200 },
  { month: 'Aug', total: 6800 },
  { month: 'Sep', total: 5900 },
  { month: 'Oct', total: 7600 },
  { month: 'Nov', total: 8100 },
  { month: 'Dec', total: 9400 },
]

/** One period of the Analytics area chart (two numeric series). */
export interface AreaPoint {
  date: string
  desktop: number
  mobile: number
}

/** 7 sequential points feeding the Analytics area chart (two series). */
export const areaData: AreaPoint[] = [
  { date: 'Mon', desktop: 320, mobile: 180 },
  { date: 'Tue', desktop: 410, mobile: 250 },
  { date: 'Wed', desktop: 380, mobile: 220 },
  { date: 'Thu', desktop: 520, mobile: 340 },
  { date: 'Fri', desktop: 610, mobile: 410 },
  { date: 'Sat', desktop: 470, mobile: 300 },
  { date: 'Sun', desktop: 540, mobile: 360 },
]

/** One slice of the Analytics pie/donut chart. */
export interface BreakdownSlice {
  name: string
  value: number
}

/** Exactly 5 slices feeding the Analytics pie/donut (maps to chart-1..5). */
export const breakdownData: BreakdownSlice[] = [
  { name: 'Direct', value: 4200 },
  { name: 'Referral', value: 3100 },
  { name: 'Organic', value: 2400 },
  { name: 'Social', value: 1800 },
  { name: 'Email', value: 1200 },
]

/** One period of the Analytics line chart (three numeric series). */
export interface LinePoint {
  month: string
  revenue: number
  profit: number
  expenses: number
}

/** Sequential points feeding the Analytics multi-series line chart. */
export const lineData: LinePoint[] = [
  { month: 'Jan', revenue: 4200, profit: 2100, expenses: 2100 },
  { month: 'Feb', revenue: 3100, profit: 1400, expenses: 1700 },
  { month: 'Mar', revenue: 5300, profit: 2900, expenses: 2400 },
  { month: 'Apr', revenue: 4800, profit: 2500, expenses: 2300 },
  { month: 'May', revenue: 6100, profit: 3600, expenses: 2500 },
  { month: 'Jun', revenue: 5500, profit: 3100, expenses: 2400 },
]

/**
 * One dashboard stat card. Icons are paired by the shell (Plan 04), not stored
 * here. `title`/`delta` hold translation KEYS (resolved via t() at render, G2);
 * `value` is a demo numeric literal left as-is (numbers stay LTR, DV-7).
 */
export interface StatCard {
  title: TranslationKey
  value: string
  delta: TranslationKey
}

/** The 4 Overview-tab stat cards. Copy matches UI-SPEC Copywriting verbatim. */
export const statCards: StatCard[] = [
  {
    title: 'dashboard.stats.revenueTitle',
    value: '$45,231.89',
    delta: 'dashboard.stats.revenueDelta',
  },
  {
    title: 'dashboard.stats.subscriptionsTitle',
    value: '+2,350',
    delta: 'dashboard.stats.subscriptionsDelta',
  },
  {
    title: 'dashboard.stats.salesTitle',
    value: '+12,234',
    delta: 'dashboard.stats.salesDelta',
  },
  {
    title: 'dashboard.stats.activeTitle',
    value: '+573',
    delta: 'dashboard.stats.activeDelta',
  },
]

/** One row of the Recent Sales list. */
export interface RecentSale {
  name: string
  email: string
  amount: string
}

/** The 5 Recent Sales rows (obvious demo values a forker swaps). */
export const recentSales: RecentSale[] = [
  {
    name: 'Olivia Martin',
    email: 'olivia.martin@email.com',
    amount: '+$1,999.00',
  },
  { name: 'Jackson Lee', email: 'jackson.lee@email.com', amount: '+$39.00' },
  {
    name: 'Isabella Nguyen',
    email: 'isabella.nguyen@email.com',
    amount: '+$299.00',
  },
  { name: 'William Kim', email: 'will@email.com', amount: '+$99.00' },
  { name: 'Sofia Davis', email: 'sofia.davis@email.com', amount: '+$39.00' },
]
