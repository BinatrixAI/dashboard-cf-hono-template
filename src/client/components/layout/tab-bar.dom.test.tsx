import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import '@/i18n'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DirectionProvider } from '@/context/direction-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { TabBar } from './tab-bar'

// No real ClerkProvider in tests: the More sheet only reads the user and sign-out.
vi.mock('@clerk/react', () => ({
  useUser: () => ({ user: null }),
  useAuth: () => ({ isSignedIn: false }),
  useClerk: () => ({ signOut: vi.fn() }),
}))

function renderTabBar() {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <QueryClientProvider client={new QueryClient()}>
          <DirectionProvider>
            <ThemeProvider>
              <TabBar />
            </ThemeProvider>
          </DirectionProvider>
        </QueryClientProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('TabBar More sheet (jsdom)', () => {
  it('opens as a dialog, takes focus, and Escape returns focus to More', async () => {
    const user = userEvent.setup()
    renderTabBar()

    const more = await screen.findByRole('button', { name: 'More' })
    await user.click(more)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(more).toHaveFocus()
  })
})
