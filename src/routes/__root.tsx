import { Link, Outlet, createRootRoute, redirect, useLocation, useRouter } from '@tanstack/react-router'
import { LayoutDashboard, Receipt, Users, CalendarRange } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/auth'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/months', label: 'Months', icon: CalendarRange },
  { to: '/members', label: 'Members', icon: Users },
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
  return (
    <div className="flex min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            M
          </span>
          <span className="text-sm font-semibold">Mess Manager</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: 'bg-sidebar-accent text-sidebar-accent-foreground' }}
              activeOptions={{ exact: item.end }}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          <AuthInfo />
        </div>
      </aside>

      {/* mobile top nav */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b bg-background px-4 md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">M</span>
          <span className={cn('text-sm font-semibold')}>Mess Manager</span>
        </Link>
      </div>

      <main className="flex-1 md:ml-56">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-8">
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
  const location = useLocation()

  if (!user || location.pathname === '/login') return null

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{user.username}</span>
        <span>{user.role}</span>
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