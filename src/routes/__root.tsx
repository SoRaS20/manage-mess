import { useState } from 'react'
import { Link, Outlet, createRootRoute, redirect, useLocation, useRouter } from '@tanstack/react-router'
import { LayoutDashboard, Receipt, Users, CalendarRange, LogOut, Menu, X, History } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/months', label: 'Months', icon: CalendarRange },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/ledger', label: 'Money log', icon: History },
  { to: '/reports', label: 'Reports', icon: Receipt },
]

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const { token } = useAuthStore.getState()
    if (!token && location.pathname !== '/login') {
      throw redirect({ to: '/login' })
    }
  },
  component: RootComponent,
})

function RootComponent() {
  const location = useLocation()

  // The login page is standalone — no sidebar or app chrome.
  if (location.pathname === '/login') {
    return (
      <>
        <Outlet />
        <Toaster position="top-right" richColors />
      </>
    )
  }

  return <AppShell />
}

function Brand({ small = false }: { small?: boolean }) {
  return (
    <>
      <span
        className={cn(
          'flex items-center justify-center rounded-md bg-primary font-bold text-primary-foreground',
          small ? 'size-6 text-xs' : 'size-7 text-sm',
        )}
      >
        M
      </span>
      <span className="text-sm font-semibold">Mess Manager</span>
    </>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: 'bg-sidebar-accent text-sidebar-accent-foreground' }}
          activeOptions={{ exact: item.end }}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
    </>
  )
}

function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = () => setMobileNavOpen(false)

  return (
    <div className="flex min-h-svh">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLinks />
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          <AuthInfo />
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b bg-background px-4 md:hidden">
        <Link to="/" className="flex items-center gap-2" onClick={closeMobileNav}>
          <Brand small />
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
          className="-mr-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
        >
          {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>

      {/* mobile slide-down menu */}
      {mobileNavOpen && (
        <div className="fixed inset-0 top-12 z-30 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={closeMobileNav}
          />
          <nav className="absolute inset-x-0 top-0 space-y-1 border-b bg-sidebar p-3 text-sidebar-foreground shadow-lg">
            <NavLinks onNavigate={closeMobileNav} />
            <div className="mt-2 border-t pt-3">
              <AuthInfo />
            </div>
          </nav>
        </div>
      )}

      <main className="min-w-0 flex-1 md:ml-56">
        <div className="mx-auto w-full min-w-0 max-w-6xl px-4 pt-16 pb-10 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>

      <Toaster position="top-right" richColors />
    </div>
  )
}

function AuthInfo() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()

  if (!user) return null

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{user.username}</span>
        <span className="text-muted-foreground">{user.role}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          logout()
          router.navigate({ to: '/login' })
        }}
        className="rounded-md p-1.5 hover:bg-muted hover:text-foreground"
        title="Logout"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )
}
