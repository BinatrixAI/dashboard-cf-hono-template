import {
  LayoutDashboard,
  Package,
  ListTodo,
  LayoutGrid,
  MessagesSquare,
  Users,
  Bell,
  Monitor,
  Palette,
  Settings,
  Wrench,
  UserCog,
  Command,
  Newspaper,
  ExternalLink,
} from 'lucide-react'
import { cmsAdminUrl } from '@/lib/cms-client'
import { type SidebarData } from '../types'

// D-09: derived at module scope; Vite inlines the underlying import.meta.env
// read (matches main.tsx / Assumption A2). Null when VITE_CMS_API_URL is unset.
const adminUrl = cmsAdminUrl()

export const sidebarData: SidebarData = {
  teams: [
    {
      // Sentinel wordmark (D-08): rendered verbatim until setup.mjs (Phase 5)
      // replaces it. A pre-setup deploy shows the raw token — accepted tradeoff.
      name: '__APP_NAME__',
      logo: Command,
      plan: 'Template',
    },
  ],
  // nav `title` fields hold translation KEYS (not English) — the owning
  // components (nav-group.tsx, app-sidebar.tsx, command-menu.tsx) call t() at
  // render so a language switch is never frozen at module scope (G2).
  navGroups: [
    {
      title: 'sidebar.groups.general',
      items: [
        {
          title: 'sidebar.nav.overview',
          url: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          // Example CRUD feature wired to the Hono /api/items round-trip (Plan 04).
          // The command palette derives "Go to Items" from this nav entry automatically.
          title: 'sidebar.nav.items',
          url: '/items',
          icon: Package,
        },
        {
          title: 'sidebar.nav.tasks',
          url: '/tasks',
          icon: ListTodo,
        },
        {
          // LayoutGrid (not Package) — Items already uses Package; keep glyphs
          // distinct (D-03a / Pitfall 6).
          title: 'sidebar.nav.apps',
          url: '/apps',
          icon: LayoutGrid,
        },
        {
          title: 'sidebar.nav.chats',
          url: '/chats',
          icon: MessagesSquare,
          badge: '3',
        },
        {
          title: 'sidebar.nav.users',
          url: '/users',
          icon: Users,
        },
      ],
    },
    {
      title: 'sidebar.groups.content',
      items: [
        // Always visible even when VITE_CMS_API_URL is unset (D-04/D-10) —
        // the /content route shows a "CMS not configured" panel in that case.
        {
          title: 'sidebar.nav.content',
          url: '/content',
          icon: Newspaper,
        },
        // Derived ${origin}/admin out-link, omitted entirely when unset (D-09/D-10).
        ...(adminUrl
          ? [
              {
                title: 'sidebar.nav.cmsAdmin' as const,
                url: adminUrl,
                icon: ExternalLink,
                external: true as const,
              },
            ]
          : []),
      ],
    },
    {
      title: 'sidebar.groups.other',
      items: [
        {
          title: 'sidebar.nav.settings',
          icon: Settings,
          items: [
            {
              title: 'sidebar.nav.profile',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'sidebar.nav.account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'sidebar.nav.appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'sidebar.nav.notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'sidebar.nav.display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
      ],
    },
  ],
}
