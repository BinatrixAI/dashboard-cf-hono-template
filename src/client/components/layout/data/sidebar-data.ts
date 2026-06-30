import {
  LayoutDashboard,
  Package,
  Bell,
  Monitor,
  Palette,
  Settings,
  Wrench,
  UserCog,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
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
