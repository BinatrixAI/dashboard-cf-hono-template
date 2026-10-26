// Setup for the jsdom `client-dom` vitest project (see vitest.config.ts item 4).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// No `globals: true`, so RTL cannot register its own afterEach cleanup (Pitfall 2).
afterEach(cleanup)

// jsdom has no matchMedia; TabBar's useMediaQuery and ThemeProvider call it on mount.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
