import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Ellipsis } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import { sidebarData } from './data/sidebar-data'
import { MoreSheet } from './more-sheet'
import { NavBadge } from './nav-group'
import {
  type BarState,
  checkIsActive,
  hasBadge,
  nextBar,
  splitNav,
} from './nav-utils'

// Static nav data: split once (D-01); titles stay keys and are translated at render (G2).
const { tabs, overflow } = splitNav(sidebarData.navGroups)

const TAB =
  'group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full text-muted-foreground transition-colors duration-150 focus-ring active:scale-[.985] aria-[current=page]:bg-brand-soft aria-[current=page]:text-foreground'
const ICON = 'size-6 stroke-[1.8] group-aria-[current=page]:text-brand-fg'
const LABEL = 'max-w-full truncate px-1 text-xs font-semibold'
// Over the icon's inline-end corner.
const MARK = 'absolute top-1 start-[calc(50%+4px)]'

/** Phone navigation below 768px (UX-01): replaces the sidebar. */
export function TabBar() {
  const { t } = useTranslation()
  // Pathname only: the full href carries the #content hash and ?page= search (Pitfall 5).
  const pathname = useLocation({ select: (l) => l.pathname })
  const [more, setMore] = useState(false)
  const moreRef = useRef<HTMLButtonElement>(null)
  const items = overflow.flatMap((group) => group.items)
  const moreActive = items.some((item) => checkIsActive(pathname, item, true))
  const moreDot = items.some(hasBadge)
  // D-05: landscape or 200% zoom — the bar would cover too much of the page, so it hides on scroll down.
  const short = useMediaQuery('(max-height: 699px)')
  const [bar, setBar] = useState<BarState>({ hidden: false, anchor: 0 })
  useEffect(() => {
    if (!short) return
    // First scroll compares against where short mode started, not 0, so an already-scrolled page doesn't hide on a scroll-up.
    let seed: BarState | null = { hidden: false, anchor: window.scrollY }
    const onScroll = () => {
      const y = window.scrollY
      const atEnd =
        window.innerHeight + y >= document.documentElement.scrollHeight - 2
      const from = seed
      seed = null
      setBar((s) => nextBar(from ?? s, y, atEnd))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      setBar({ hidden: false, anchor: 0 })
    }
  }, [short])
  // Never hidden while More is open; focus-within keeps a keyboard-focused bar visible.
  const hide = short && bar.hidden && !more
  return (
    <>
      <nav
        data-slot='tab-bar'
        aria-label={t('tabBar.label')}
        className={cn(
          'border-border bg-popover/85 shadow-card fixed inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-40 flex h-16 rounded-full border p-1 backdrop-blur-[16px] backdrop-saturate-150 transition-transform duration-200 ease-out focus-within:translate-y-0',
          hide && 'translate-y-[calc(100%+24px+env(safe-area-inset-bottom))]'
        )}
      >
        {tabs.map((tab) => (
          <Link
            key={tab.url}
            to={tab.url}
            aria-current={checkIsActive(pathname, tab) ? 'page' : undefined}
            className={TAB}
          >
            {tab.icon && <tab.icon aria-hidden className={ICON} />}
            <span className={LABEL}>{t(tab.title)}</span>
            {hasBadge(tab) && (
              <span className={MARK}>
                <NavBadge badge={tab.badge} />
              </span>
            )}
          </Link>
        ))}
        <button
          ref={moreRef}
          type='button'
          aria-haspopup='dialog'
          aria-expanded={more}
          onClick={() => setMore(true)}
          className={cn(TAB, moreActive && 'bg-brand-soft text-foreground')}
        >
          <Ellipsis
            aria-hidden
            className={cn(ICON, moreActive && 'text-brand-fg')}
          />
          <span className={LABEL}>
            {t('tabBar.more')}
            {moreDot && (
              <span className='sr-only'> {t('tabBar.moreActivity')}</span>
            )}
          </span>
          {moreDot && (
            <span
              aria-hidden
              className={cn(
                MARK,
                'bg-sidebar-primary ring-popover size-2 rounded-full ring-2'
              )}
            />
          )}
        </button>
      </nav>
      <MoreSheet
        open={more}
        onOpenChange={setMore}
        groups={overflow}
        returnFocusTo={moreRef}
      />
    </>
  )
}
