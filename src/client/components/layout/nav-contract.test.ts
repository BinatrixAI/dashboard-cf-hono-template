// CICD-07 / D-04: every internal nav url resolves to a route, every nav title key exists in EN
// and HE, at most 4 items are tabs, and splitNav loses no item. Each rule has a failing fixture
// (D-06). EN/HE key-set parity is owned by test/setup/i18n.test.mjs, not here.
import { type TranslationKey } from '@/i18n'
import en from '@/i18n/locales/en.json'
import he from '@/i18n/locales/he.json'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sidebarData } from './data/sidebar-data'
import { splitNav } from './nav-utils'
import { type NavGroup } from './types'

// FileRoutesByTo: the full-path interface has trailing-slash keys that never equal a nav url.
const tree = readFileSync(
  new URL('../../routeTree.gen.ts', import.meta.url),
  'utf8'
)
const byTo = tree.match(/export interface FileRoutesByTo \{([\s\S]*?)\n\}/)
if (!byTo) throw new Error('FileRoutesByTo not found in routeTree.gen.ts')
const ROUTES = [...byTo[1].matchAll(/'([^']+)':/g)].map(
  (m) => new RegExp('^' + m[1].replace(/\$[^/]+/g, '[^/]+') + '$')
)

const resolve = (dict: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      dict
    )

const LOCALES = { en, he }

function navViolations(groups: NavGroup[]): string[] {
  const out: string[] = []
  const checkKey = (key: string) => {
    for (const [lang, dict] of Object.entries(LOCALES)) {
      const value = resolve(dict, key)
      if (typeof value !== 'string' || !value.trim())
        out.push(`${key} missing in ${lang}.json`)
    }
  }
  const checkUrl = (url: string, external?: boolean) => {
    if (external) return
    const path = url.split(/[?#]/)[0]
    if (!ROUTES.some((r) => r.test(path))) out.push(`${url} is not a route`)
  }

  for (const group of groups) {
    checkKey(group.title)
    for (const item of group.items) {
      checkKey(item.title)
      if (item.items)
        for (const sub of item.items) {
          checkKey(sub.title)
          checkUrl(sub.url)
        }
      else checkUrl(item.url, item.external)
    }
  }

  const all = groups.flatMap((g) => g.items)
  const flagged = all.filter((i) => !i.items && i.tab).length
  if (flagged > 4)
    out.push(
      `${flagged} items flagged tab: the tab bar holds 4, the rest land in More`
    )

  const { tabs, overflow } = splitNav(groups)
  if (tabs.some((t) => !t.tab))
    out.push('splitNav made an unflagged item a tab')
  const kept = tabs.length + overflow.reduce((n, g) => n + g.items.length, 0)
  if (kept !== all.length)
    out.push(`splitNav lost ${all.length - kept} of ${all.length} items`)
  return out
}

const key = (k: string) => k as TranslationKey
const group = (items: NavGroup['items']): NavGroup[] => [
  { title: key('sidebar.groups.general'), items },
]
const link = (url: string, extra: object = {}) => ({
  title: key('sidebar.nav.items'),
  url,
  ...extra,
})

describe('nav contract (CICD-07 / D-04)', () => {
  it('the shipped nav is consistent', () => {
    expect(navViolations(sidebarData.navGroups)).toEqual([])
  })

  it('fails a link to an unknown route (D-06)', () => {
    expect(navViolations(group([link('/nope')]))).toHaveLength(1)
  })

  it('fails a title key missing from each locale', () => {
    const fixture = group([{ title: key('sidebar.nav.nope'), url: '/items' }])
    expect(navViolations(fixture)).toHaveLength(2)
  })

  it('fails a 5th tab', () => {
    const urls = ['/dashboard', '/items', '/tasks', '/chats', '/users']
    const fixture = group(urls.map((u) => link(u, { tab: true })))
    expect(navViolations(fixture)).toHaveLength(1)
  })

  it('skips route checks on an external link', () => {
    const fixture = group([link('https://example.com/x', { external: true })])
    expect(navViolations(fixture)).toEqual([])
  })

  it('resolves a url with a query or hash by its path', () => {
    const fixture = group([link('/items?x=1'), link('/settings/account#y')])
    expect(navViolations(fixture)).toEqual([])
  })
})
