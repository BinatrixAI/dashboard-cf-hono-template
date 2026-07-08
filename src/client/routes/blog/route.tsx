import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Logo } from '@/assets/logo'
import { ThemeSwitch } from '@/components/theme-switch'

// PUB-01 public reader shell (D-01/D-02). Registered at top-level `routes/blog/`
// — outside the authenticated route group, not a `(auth)` pathless group — so
// anonymous visitors reach `/blog*` with no Clerk gate, public by the same seam
// as `routes/index.tsx`. Chrome is limited to the two verified Clerk-free imports
// (Logo + ThemeSwitch); no auth-panel logo, no LearnMore, nothing that pulls a
// Clerk session. The read path stays cross-origin via the reused useContent()
// seam — this layout never touches `/api/*`.
export const Route = createFileRoute('/blog')({
  component: BlogLayout,
})

function BlogLayout() {
  return (
    <div className='mx-auto flex min-h-svh max-w-3xl flex-col px-4'>
      <header className='flex items-center justify-between py-6'>
        <Link to='/' className='flex items-center gap-2 font-medium'>
          <Logo />
          <span>Blog</span>
        </Link>
        <ThemeSwitch />
      </header>
      <main className='flex-1'>
        <Outlet />
      </main>
      <footer className='text-muted-foreground py-6 text-sm'>
        © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
