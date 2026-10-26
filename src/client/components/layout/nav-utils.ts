import { type NavGroup, type NavItem, type NavLink } from './types'

/** Phone nav (D-01): the first `max` flagged, non-external links become tabs; everything else stays in its group, empty groups dropped. */
export function splitNav(
  groups: NavGroup[],
  max = 4
): { tabs: NavLink[]; overflow: NavGroup[] } {
  const tabs: NavLink[] = []
  const overflow: NavGroup[] = []
  for (const group of groups) {
    const rest = group.items.filter((item) => {
      if (!item.items && item.tab && !item.external && tabs.length < max) {
        tabs.push(item)
        return false
      }
      return true
    })
    if (rest.length) overflow.push({ ...group, items: rest })
  }
  return { tabs, overflow }
}

/** Active-route match on the pathname only, so a `#content` hash or `?page=` search never moves the highlight (UX-04). */
export function checkIsActive(
  pathname: string,
  item: NavItem,
  mainNav = false
): boolean {
  const segment = pathname.split('/')[1]
  return (
    pathname === item.url ||
    !!item.items?.some((sub) => sub.url === pathname) ||
    (mainNav && segment !== '' && segment === item.url?.split('/')[1])
  )
}

// The NavBadge rule: undefined, '' and '0' render nothing.
const shows = (badge?: string) => !!badge && badge !== '0'

/** True when the item or any sub-item shows a badge — lights the More dot (D-04). */
export function hasBadge(item: NavItem): boolean {
  return shows(item.badge) || !!item.items?.some((sub) => shows(sub.badge))
}

// Ignores scroll jitter and tiny nudges so the bar doesn't flicker.
const HIDE_AFTER_PX = 8

export type BarState = { hidden: boolean; anchor: number }

/** Hide-on-scroll rule (D-05): returns `prev` itself when neither visibility nor anchor changes, so React skips the render. */
export function nextBar(prev: BarState, y: number, atEnd: boolean): BarState {
  if (atEnd || y < prev.anchor) {
    return !prev.hidden && prev.anchor === y
      ? prev
      : { hidden: false, anchor: y }
  }
  return y - prev.anchor > HIDE_AFTER_PX ? { hidden: true, anchor: y } : prev
}

/** Link activeOptions matching checkIsActive (pathname only), so TanStack's fuzzy match never adds a second aria-current. */
export const EXACT_PATH = { exact: true, includeSearch: false } as const
