import { titleClipped } from '@/lib/clip-title'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Monogram } from '@/components/monogram'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {/* Brand block (D-14): the name is a React text node only, never HTML. */}
        <div
          className='flex items-center gap-2 px-2 pt-6 pb-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
          onMouseOver={titleClipped}
          onFocus={titleClipped}
        >
          <Monogram
            name={sidebarData.app.name}
            className='bg-sidebar-primary text-sidebar-primary-foreground size-8 shrink-0 rounded-[8px] text-xs'
          />
          <span className='font-display text-sidebar-accent-foreground truncate text-lg font-semibold group-data-[collapsible=icon]:hidden'>
            {sidebarData.app.name}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props, i) => (
          <NavGroup key={props.title} {...props} divider={i > 0} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
