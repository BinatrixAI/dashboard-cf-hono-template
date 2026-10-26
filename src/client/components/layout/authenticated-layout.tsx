import { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { useMediaQuery } from '@/hooks/use-media-query'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { TabBar } from '@/components/layout/tab-bar'
import { SkipToMain } from '@/components/skip-to-main'
import { useSettingsThemeSync } from '@/features/settings/data/use-settings'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // D-06/D-07: width decides the layout (rail below 1280px, open at/above); the
  // trigger and ⌘B toggle for the session only, and crossing 1280px resets it.
  const wide = useMediaQuery('(width >= 80rem)')
  // D-06: below 768px the tab bar replaces the sidebar entirely.
  // WR-01: Tailwind's md/xl range syntax, so JS and CSS agree at fractional (zoomed)
  // widths; a pixel max-width left a band with no navigation at all.
  const phone = useMediaQuery('(width < 48rem)')
  const [open, setOpen] = useState(wide)
  const [prevWide, setPrevWide] = useState(wide)
  if (wide !== prevWide) {
    setPrevWide(wide)
    setOpen(wide)
  }
  // KV→theme sync (D-08): mounted here (not in the appearance form) so the stored
  // appearance.theme/font applies on every authenticated page — authoritative
  // across reloads and devices even when the user never opens Settings.
  useSettingsThemeSync()
  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider
          open={open}
          onOpenChange={setOpen}
          style={
            {
              '--sidebar-width': '248px',
              '--sidebar-width-icon': '72px',
            } as React.CSSProperties
          }
        >
          <SkipToMain />
          {!phone && <AppSidebar />}
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // D-12: content sits on the app-bg glow background
              'app-bg',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-data-[layout=fixed]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
          {phone && <TabBar />}
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
