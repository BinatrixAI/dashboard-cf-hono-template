import { type LinkProps } from '@tanstack/react-router'
import { type TranslationKey } from '@/i18n'

type BaseNavItem = {
  // Translation KEY (e.g. 'sidebar.nav.items'), resolved with t() at render (G2).
  title: TranslationKey
  badge?: string
  icon?: React.ElementType
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  // When true, renders an external new-tab anchor instead of a router Link.
  external?: boolean
  // true → shown in the phone tab bar (first 4 in sidebar order; external links never).
  tab?: boolean
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
  tab?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: TranslationKey
  items: NavItem[]
}

type SidebarData = {
  app: { name: string }
  navGroups: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavLink }
