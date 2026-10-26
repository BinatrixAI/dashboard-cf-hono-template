import { type RefObject, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { useUser } from '@clerk/react'
import { ChevronRight, ExternalLink, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { initialsFromUser } from '@/lib/initials'
import { cn } from '@/lib/utils'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { LanguageSwitch } from '@/components/language-switch'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { ThemeMenu } from '@/components/theme-menu'
import { NavBadge } from './nav-group'
import { checkIsActive, EXACT_PATH } from './nav-utils'
import { type NavCollapsible, type NavGroup, type NavLink } from './types'

const ROW =
  'group flex h-12 w-full items-center gap-2 rounded-lg px-4 text-sm text-foreground hover:bg-accent focus-ring active:scale-[.985] aria-[current=page]:bg-brand-soft'
const ROW_ICON =
  'size-4 shrink-0 stroke-[1.8] text-muted-foreground group-aria-[current=page]:text-brand-fg'
const LABEL =
  'px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-[.12em] rtl:tracking-normal text-muted-foreground'

type Close = () => void

/** Phone overflow nav, preferences and the user row (D-03), opened by the tab bar's More tab. */
export function MoreSheet({
  open,
  onOpenChange,
  groups,
  returnFocusTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: NavGroup[]
  returnFocusTo: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation()
  // Pathname only: the full href carries the #content hash and ?page= search (Pitfall 5).
  const pathname = useLocation({ select: (l) => l.pathname })
  const { user: clerkUser } = useUser()
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const user = {
    name:
      clerkUser?.fullName ??
      clerkUser?.firstName ??
      t('profileDropdown.account'),
    email: clerkUser?.primaryEmailAddress?.emailAddress ?? '',
    avatar: clerkUser?.imageUrl ?? '',
  }
  const initials = initialsFromUser(clerkUser)
  const close = () => onOpenChange(false)
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side='bottom'
          aria-describedby={undefined}
          // No SheetTrigger, so Radix has no trigger to refocus; sign-out's dialog keeps focus instead.
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (!signOutOpen) returnFocusTo.current?.focus()
          }}
          className='bg-popover rounded-t-card gap-0 px-4 pt-6 pb-[calc(16px+env(safe-area-inset-bottom))]'
        >
          <SheetTitle className='font-display pe-12 text-lg font-semibold'>
            {t('tabBar.more')}
          </SheetTitle>
          <div className='max-h-[80dvh] overflow-y-auto overscroll-contain'>
            {groups.map((group) => (
              <section key={group.title}>
                <h2 className={LABEL}>{t(group.title)}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={`${item.title}-${item.url}`}>
                      {item.items ? (
                        <MoreCollapsible
                          item={item}
                          pathname={pathname}
                          close={close}
                        />
                      ) : (
                        <MoreLink
                          item={item}
                          pathname={pathname}
                          close={close}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {groups.length > 0 && <Separator className='my-2' />}
            <section>
              <h2 className={LABEL}>{t('tabBar.preferences')}</h2>
              <div className='flex items-center gap-2 px-4 py-2'>
                <ThemeMenu showLabel />
                <LanguageSwitch />
              </div>
            </section>
            <Separator className='my-2' />
            <div className='flex items-center gap-2 px-4 py-2'>
              <Avatar className='size-8 rounded-lg'>
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className='rounded-lg'>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className='flex min-w-0 flex-1 flex-col'>
                <span
                  dir='auto'
                  className='truncate [text-align:match-parent] text-sm font-semibold'
                >
                  {user.name}
                </span>
                <span
                  dir='auto'
                  className='text-muted-foreground truncate [text-align:match-parent] text-xs'
                >
                  {user.email}
                </span>
              </div>
              <Button
                variant='outline'
                className='h-11'
                onClick={() => {
                  close()
                  setSignOutOpen(true)
                }}
              >
                <LogOut className='size-4' />
                {t('profileDropdown.signOut')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      {/* Sibling, not child: closing the sheet must not unmount the confirmation (Pitfall 11). */}
      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  )
}

function RowContent({
  item,
}: {
  item: NavLink | NavCollapsible['items'][number]
}) {
  const { t } = useTranslation()
  return (
    <>
      {item.icon && <item.icon aria-hidden className={ROW_ICON} />}
      <span className='truncate'>{t(item.title)}</span>
      <NavBadge badge={item.badge} />
    </>
  )
}

function MoreLink({
  item,
  pathname,
  close,
  className,
}: {
  item: NavLink | NavCollapsible['items'][number]
  pathname: string
  close: Close
  className?: string
}) {
  if ('external' in item && item.external)
    return (
      <a
        href={item.url}
        target='_blank'
        rel='noopener noreferrer'
        onClick={close}
        className={cn(ROW, className)}
      >
        <RowContent item={item} />
        <ExternalLink aria-hidden className='ms-auto size-3.5 opacity-60' />
      </a>
    )
  return (
    <Link
      to={item.url}
      activeOptions={EXACT_PATH}
      aria-current={checkIsActive(pathname, item) ? 'page' : undefined}
      onClick={close}
      className={cn(ROW, className)}
    >
      <RowContent item={item} />
    </Link>
  )
}

function MoreCollapsible({
  item,
  pathname,
  close,
}: {
  item: NavCollapsible
  pathname: string
  close: Close
}) {
  const { t } = useTranslation()
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
      open={open}
      onOpenChange={setOpen}
      className='group/collapsible'
    >
      <CollapsibleTrigger className={ROW}>
        {item.icon && <item.icon aria-hidden className={ROW_ICON} />}
        <span className='truncate'>{t(item.title)}</span>
        <NavBadge badge={item.badge} />
        <ChevronRight
          aria-hidden
          className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180 rtl:group-data-[state=open]/collapsible:rotate-90'
        />
      </CollapsibleTrigger>
      <CollapsibleContent className='CollapsibleContent'>
        <ul>
          {item.items.map((sub) => (
            <li key={`${sub.title}-${sub.url}`}>
              <MoreLink
                item={sub}
                pathname={pathname}
                close={close}
                className='ps-8'
              />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
