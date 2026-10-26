import { describe, expect, it } from 'vitest'
import { sidebarData } from './data/sidebar-data'
import { checkIsActive, hasBadge, nextBar, splitNav } from './nav-utils'
import { type NavGroup, type NavItem } from './types'

const urls = (items: NavItem[]) =>
  items.flatMap((i) => (i.items ? i.items.map((s) => s.url) : [i.url]))

describe('splitNav', () => {
  it('takes the shipped Overview, Items, Tasks and Chats as tabs', () => {
    const { tabs } = splitNav(sidebarData.navGroups)
    expect(tabs.map((t) => t.url)).toEqual([
      '/dashboard',
      '/items',
      '/tasks',
      '/chats',
    ])
  })

  it('keeps Apps, Users and the Settings group in overflow, in order', () => {
    const { overflow } = splitNav(sidebarData.navGroups)
    expect(overflow.map((g) => g.title)).toEqual([
      'sidebar.groups.general',
      'sidebar.groups.other',
    ])
    expect(overflow[0].items.map((i) => i.url)).toEqual(['/apps', '/users'])
    expect(overflow[1].items.map((i) => i.title)).toEqual([
      'sidebar.nav.settings',
    ])
  })

  it('leaves a 5th flagged link in overflow at its original position', () => {
    const groups: NavGroup[] = [
      {
        title: 'sidebar.groups.general',
        items: [
          { title: 'sidebar.nav.overview', url: '/a', tab: true },
          { title: 'sidebar.nav.items', url: '/b', tab: true },
          { title: 'sidebar.nav.apps', url: '/x' },
          { title: 'sidebar.nav.tasks', url: '/c', tab: true },
          { title: 'sidebar.nav.chats', url: '/d', tab: true },
          { title: 'sidebar.nav.users', url: '/e', tab: true },
        ],
      },
    ]
    const { tabs, overflow } = splitNav(groups)
    expect(tabs.map((t) => t.url)).toEqual(['/a', '/b', '/c', '/d'])
    expect(overflow[0].items.map((i) => i.url)).toEqual(['/x', '/e'])
  })

  it('never makes a flagged external link a tab', () => {
    const groups: NavGroup[] = [
      {
        title: 'sidebar.groups.general',
        items: [
          {
            title: 'sidebar.nav.apps',
            url: 'https://example.com',
            external: true,
            tab: true,
          },
          { title: 'sidebar.nav.items', url: '/b', tab: true },
        ],
      },
    ]
    const { tabs, overflow } = splitNav(groups)
    expect(tabs.map((t) => t.url)).toEqual(['/b'])
    expect(overflow[0].items.map((i) => i.url)).toEqual(['https://example.com'])
  })

  it('drops a group whose every item became a tab', () => {
    const groups: NavGroup[] = [
      {
        title: 'sidebar.groups.general',
        items: [{ title: 'sidebar.nav.items', url: '/b', tab: true }],
      },
      {
        title: 'sidebar.groups.other',
        items: [{ title: 'sidebar.nav.apps', url: '/x' }],
      },
    ]
    const { overflow } = splitNav(groups)
    expect(overflow.map((g) => g.title)).toEqual(['sidebar.groups.other'])
  })

  it('only partitions: every output url exists in the input, none lost', () => {
    const input = urls(sidebarData.navGroups.flatMap((g) => g.items))
    const { tabs, overflow } = splitNav(sidebarData.navGroups)
    const output = [...urls(tabs), ...urls(overflow.flatMap((g) => g.items))]
    expect([...output].sort()).toEqual([...input].sort())
  })
})

const shipped = sidebarData.navGroups.flatMap((g) => g.items)
const byTitle = (title: string) => shipped.find((i) => i.title === title)!

describe('checkIsActive', () => {
  const tasks = byTitle('sidebar.nav.tasks')
  const items = byTitle('sidebar.nav.items')
  const settings = byTitle('sidebar.nav.settings')

  it('matches the exact pathname', () => {
    expect(checkIsActive('/tasks', tasks)).toBe(true)
    expect(checkIsActive('/dashboard', items)).toBe(false)
  })

  it('activates a collapsible when a sub-item matches', () => {
    expect(checkIsActive('/settings/account', settings)).toBe(true)
  })

  it('matches the first segment for mainNav', () => {
    expect(checkIsActive('/settings', settings, true)).toBe(true)
    expect(checkIsActive('/tasks/42', tasks, true)).toBe(true)
  })

  it('never matches "/" via the segment rule', () => {
    for (const item of shipped)
      expect(checkIsActive('/', item, true)).toBe(false)
  })
})

describe('hasBadge', () => {
  const link = (badge?: string): NavItem => ({
    title: 'sidebar.nav.chats',
    url: '/chats',
    badge,
  })

  it('follows the NavBadge zero rule', () => {
    expect(hasBadge(link())).toBe(false)
    expect(hasBadge(link(''))).toBe(false)
    expect(hasBadge(link('0'))).toBe(false)
    expect(hasBadge(link('3'))).toBe(true)
  })

  it('lights for a badge on a sub-item', () => {
    expect(
      hasBadge({
        title: 'sidebar.nav.settings',
        items: [
          { title: 'sidebar.nav.profile', url: '/settings' },
          {
            title: 'sidebar.nav.account',
            url: '/settings/account',
            badge: '2',
          },
        ],
      })
    ).toBe(true)
  })
})

describe('nextBar', () => {
  const shown = { hidden: false, anchor: 0 }

  it('hides on a scroll-down of more than 8px', () => {
    expect(nextBar(shown, 9, false)).toEqual({ hidden: true, anchor: 9 })
  })

  it('returns the same state for 8px, so nothing re-renders', () => {
    expect(nextBar(shown, 8, false)).toBe(shown)
  })

  it('accumulates small steps against the anchor', () => {
    const s = [3, 6, 9].reduce((acc, y) => nextBar(acc, y, false), shown)
    expect(s.hidden).toBe(true)
  })

  it('shows on any scroll-up', () => {
    expect(nextBar({ hidden: true, anchor: 120 }, 119, false)).toEqual({
      hidden: false,
      anchor: 119,
    })
  })

  it('shows at page end', () => {
    expect(nextBar({ hidden: true, anchor: 120 }, 200, true).hidden).toBe(false)
  })

  it('keeps the bar shown on a scroll-up from a non-zero start', () => {
    const s = nextBar({ hidden: false, anchor: 1500 }, 1490, false)
    expect(s.hidden).toBe(false)
    expect(s.anchor).toBe(1490)
  })

  it('shows on a negative y (iOS rubber band)', () => {
    expect(nextBar({ hidden: true, anchor: 0 }, -20, false).hidden).toBe(false)
  })
})
