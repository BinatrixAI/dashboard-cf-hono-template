import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { Direction } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { titleClipped } from '@/lib/clip-title'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { checkIsActive, EXACT_PATH } from './nav-utils'
import {
  type NavCollapsible,
  type NavLink,
  type NavGroup as NavGroupProps,
} from './types'

// D-12 / UI-SPEC: restyle only; the default h-8 p-2 gap-2 item size and the font weight never change.
// Rail: a 40px square with the 16px icon centred; relative so the badge dot sits on the button's own corner.
const NAV_ITEM =
  'rounded-[9px] border border-transparent text-sidebar-foreground transition-colors duration-[120ms] hover:bg-white/[.07] [&>svg]:size-4 [&>svg]:stroke-[1.8] [&>svg]:text-sidebar-label data-[active=true]:bg-sidebar-accent data-[active=true]:border-sidebar-border data-[active=true]:font-normal data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[inset_0_1px_0_oklch(1_0_0/.25)] data-[active=true]:[&>svg]:text-sidebar-primary group-data-[collapsible=icon]:relative group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-3!'

export function NavGroup({
  title,
  items,
  divider,
}: NavGroupProps & { divider?: boolean }) {
  const { t } = useTranslation()
  const { state, isMobile } = useSidebar()
  // Pathname only: the full href carries the #content hash and ?page= search (Pitfall 5).
  const pathname = useLocation({ select: (location) => location.pathname })
  return (
    <SidebarGroup>
      {/* Collapsed to icons the label hides; a 1px divider separates the groups instead. */}
      {divider && (
        <SidebarSeparator className='hidden group-data-[collapsible=icon]:block' />
      )}
      <SidebarGroupLabel className='text-sidebar-label px-2 pt-4 pb-1 text-xs font-semibold tracking-[.12em] uppercase rtl:tracking-normal'>
        {t(title)}
      </SidebarGroupLabel>
      <SidebarMenu onMouseOver={titleClipped} onFocus={titleClipped}>
        {items.map((item) => {
          const key = `${item.title}-${item.url}`

          if (!item.items)
            return <SidebarMenuLink key={key} item={item} pathname={pathname} />

          if (state === 'collapsed' && !isMobile)
            return (
              <SidebarMenuCollapsedDropdown
                key={key}
                item={item}
                pathname={pathname}
              />
            )

          return (
            <SidebarMenuCollapsible key={key} item={item} pathname={pathname} />
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

// Zero-one-many: undefined, '' and '0' render nothing; collapsed to icons the count becomes an 8px dot.
export function NavBadge({ badge }: { badge?: string }) {
  if (!badge || badge === '0') return null
  return (
    <span className='bg-sidebar-primary text-sidebar-primary-foreground ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:end-1 group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:size-2 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:p-0'>
      <span className='group-data-[collapsible=icon]:sr-only'>{badge}</span>
    </span>
  )
}

function SidebarMenuLink({
  item,
  pathname,
}: {
  item: NavLink
  pathname: string
}) {
  const { t } = useTranslation()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={!item.external && checkIsActive(pathname, item)}
        tooltip={t(item.title)}
        className={NAV_ITEM}
      >
        {item.external ? (
          <a
            href={item.url}
            target='_blank'
            rel='noopener noreferrer'
            onClick={() => setOpenMobile(false)}
          >
            {item.icon && <item.icon />}
            <span className='truncate'>{t(item.title)}</span>
            <NavBadge badge={item.badge} />
            <ExternalLink className='ms-auto size-3.5 opacity-60' />
          </a>
        ) : (
          <Link to={item.url} onClick={() => setOpenMobile(false)}>
            {item.icon && <item.icon />}
            <span className='truncate'>{t(item.title)}</span>
            <NavBadge badge={item.badge} />
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarMenuCollapsible({
  item,
  pathname,
}: {
  item: NavCollapsible
  pathname: string
}) {
  const { t } = useTranslation()
  const { setOpenMobile } = useSidebar()
  // UX-04: open exactly when the route is inside the group; a user toggle holds until the pathname changes.
  const active = checkIsActive(pathname, item, true)
  const [open, setOpen] = useState(active)
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setOpen(active)
  }
  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={t(item.title)} className={NAV_ITEM}>
            {item.icon && <item.icon />}
            <span className='truncate'>{t(item.title)}</span>
            <NavBadge badge={item.badge} />
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180 rtl:group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {item.items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  asChild
                  isActive={checkIsActive(pathname, subItem)}
                  className={NAV_ITEM}
                >
                  <Link
                    to={subItem.url}
                    activeOptions={EXACT_PATH}
                    onClick={() => setOpenMobile(false)}
                  >
                    {subItem.icon && <subItem.icon />}
                    <span className='truncate'>{t(subItem.title)}</span>
                    <NavBadge badge={subItem.badge} />
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function SidebarMenuCollapsedDropdown({
  item,
  pathname,
}: {
  item: NavCollapsible
  pathname: string
}) {
  const { t } = useTranslation()
  const dir = Direction.useDirection()
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={t(item.title)}
            isActive={checkIsActive(pathname, item)}
            className={NAV_ITEM}
          >
            {item.icon && <item.icon />}
            <span className='truncate'>{t(item.title)}</span>
            <NavBadge badge={item.badge} />
            <ChevronRight className='ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={dir === 'rtl' ? 'left' : 'right'}
          align='start'
          sideOffset={4}
        >
          <DropdownMenuLabel>
            {t(item.title)}{' '}
            {item.badge && item.badge !== '0' ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => (
            <DropdownMenuItem key={`${sub.title}-${sub.url}`} asChild>
              <Link
                to={sub.url}
                activeOptions={EXACT_PATH}
                className={`${checkIsActive(pathname, sub) ? 'bg-secondary' : ''}`}
              >
                {sub.icon && <sub.icon />}
                <span className='max-w-52 text-wrap'>{t(sub.title)}</span>
                {sub.badge && sub.badge !== '0' && (
                  <span className='ms-auto text-xs'>{sub.badge}</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
