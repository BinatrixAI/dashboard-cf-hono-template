import { LanguageSwitch } from '@/components/language-switch'
import { Monogram } from '@/components/monogram'
import { ThemeMenu } from '@/components/theme-menu'
import { sidebarData } from './layout/data/sidebar-data'

/** Branded signed-out page (D-15): app-bg, the fork's Monogram + name, corner language/theme pill. */
export function BrandPage({ children }: { children: React.ReactNode }) {
  return (
    <div className='app-bg relative min-h-svh'>
      <div className='bg-card shadow-card absolute end-6 top-6 z-10 flex items-center gap-1 rounded-full border p-1 backdrop-blur-[16px]'>
        <LanguageSwitch reload />
        <ThemeMenu />
      </div>
      <main className='mx-auto flex max-w-[400px] flex-col items-center px-4 pt-16 pb-16'>
        <Monogram
          name={sidebarData.app.name}
          className='bg-sidebar text-sidebar-accent-foreground size-14 rounded-2xl text-lg'
        />
        <p className='font-display mt-4 mb-6 text-lg font-semibold'>
          {sidebarData.app.name}
        </p>
        <div className='w-full'>{children}</div>
      </main>
    </div>
  )
}
