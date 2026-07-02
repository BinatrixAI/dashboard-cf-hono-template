import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'

/**
 * Pure toggle helper: returns the explicit opposite of the RESOLVED theme.
 * The header only ever emits 'light' or 'dark' — never 'system'. Deriving the
 * next value from the resolved theme (not the stored `theme`) means a click
 * while on 'system' commits to the opposite of what the user currently sees,
 * with no dead first click.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function nextTheme(resolved: 'light' | 'dark'): 'light' | 'dark' {
  return resolved === 'dark' ? 'light' : 'dark'
}

export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()

  /* Update theme-color meta tag
   * when the resolved theme is updated */
  useEffect(() => {
    const themeColor = resolvedTheme === 'dark' ? '#020817' : '#fff'
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [resolvedTheme])

  return (
    <Button
      variant='ghost'
      size='icon'
      className='scale-95 rounded-full'
      onClick={() => setTheme(nextTheme(resolvedTheme))}
    >
      <Sun className='size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
      <Moon className='absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
      <span className='sr-only'>Toggle theme</span>
    </Button>
  )
}
