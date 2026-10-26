import { createContext, useContext, useEffect, useState } from 'react'
import i18n, { langFromDir } from '@/i18n'
import { Direction as RadixDirection } from 'radix-ui'
import { getCookieOf, setCookie, removeCookie } from '@/lib/cookies'

const DIRECTIONS = ['ltr', 'rtl'] as const
export type Direction = (typeof DIRECTIONS)[number]

const DEFAULT_DIRECTION = 'ltr'
const DIRECTION_COOKIE_NAME = 'dir'
const DIRECTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

type DirectionContextType = {
  defaultDir: Direction
  dir: Direction
  setDir: (dir: Direction) => void
  resetDir: () => void
}

const DirectionContext = createContext<DirectionContextType | null>(null)

export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const [dir, _setDir] = useState<Direction>(() =>
    getCookieOf(DIRECTION_COOKIE_NAME, DIRECTIONS, DEFAULT_DIRECTION)
  )

  useEffect(() => {
    // The single language-switch point: direction drives language (LTR=en, RTL=he).
    const lang = langFromDir(dir)
    const htmlElement = document.documentElement
    htmlElement.setAttribute('dir', dir)
    htmlElement.setAttribute('lang', lang)
    void i18n.changeLanguage(lang)
  }, [dir])

  const setDir = (dir: Direction) => {
    _setDir(dir)
    setCookie(DIRECTION_COOKIE_NAME, dir, DIRECTION_COOKIE_MAX_AGE)
  }

  const resetDir = () => {
    _setDir(DEFAULT_DIRECTION)
    removeCookie(DIRECTION_COOKIE_NAME)
  }

  return (
    <DirectionContext
      value={{
        defaultDir: DEFAULT_DIRECTION,
        dir,
        setDir,
        resetDir,
      }}
    >
      <RadixDirection.Provider dir={dir}>{children}</RadixDirection.Provider>
    </DirectionContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDirection() {
  const context = useContext(DirectionContext)
  if (!context) {
    throw new Error('useDirection must be used within a DirectionProvider')
  }
  return context
}
