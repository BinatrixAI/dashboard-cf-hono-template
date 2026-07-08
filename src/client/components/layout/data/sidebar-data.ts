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
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Overview',
          url: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          // Example CRUD feature wired to the Hono /api/items round-trip (Plan 04).
          // The command palette derives "Go to Items" from this nav entry automatically.
          title: 'Items',
          url: '/items',
          icon: Package,
        },
        {
          title: 'Tasks',
          url: '/tasks',
          icon: ListTodo,
        },
        {
          // LayoutGrid (not Package) — Items already uses Package; keep glyphs
          // distinct (D-03a / Pitfall 6).
          title: 'Apps',
          url: '/apps',
          icon: LayoutGrid,
        },
        {
          title: 'Chats',
          url: '/chats',
          icon: MessagesSquare,
          badge: '3',
        },
        {
          title: 'Users',
          url: '/users',
          icon: Users,
        },
      ],
    },
    {
      title: 'Content',
      items: [
        // Always visible even when VITE_CMS_API_URL is unset (D-04/D-10) —
        // the /content route shows a "CMS not configured" panel in that case.
        {
          title: 'Content',
          url: '/content',
          icon: Newspaper,
        },
        // Derived ${origin}/admin out-link, omitted entirely when unset (D-09/D-10).
        ...(adminUrl
          ? [
              {
                title: 'CMS Admin',
                url: adminUrl,
                icon: ExternalLink,
                external: true as const,
              },
            ]
          : []),
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
      ],
    },
  ],
}
