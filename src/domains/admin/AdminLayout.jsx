import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChartColumnIcon, FileStackIcon, LandmarkIcon, LayoutDashboardIcon, LogOutIcon, NewspaperIcon, ScrollTextIcon, ShieldAlertIcon, SlidersHorizontalIcon, UsersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/format'
import { useRouteFocus } from '@/lib/hooks'
import { Brand } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/ui'
import { useSession } from '@/domains/session/SessionProvider'
import { STAFF, canOpen } from '@/data/roles'

// Modules from the admin plan §3; `module` is the key roles.js grants per role.
const NAV = [
  { to: '/admin', module: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
  { to: '/admin/users', module: 'users', label: 'Users', icon: UsersIcon },
  { to: '/admin/applications', module: 'applications', label: 'Applications', icon: FileStackIcon },
  { to: '/admin/products', module: 'catalog', label: 'Banks & Products', icon: LandmarkIcon, match: (p) => p.startsWith('/admin/products') || p.startsWith('/admin/banks') },
  { to: '/admin/articles', module: 'articles', label: 'Articles', icon: NewspaperIcon },
  { to: '/admin/reports', module: 'reports', label: 'Reports', icon: ChartColumnIcon },
  { to: '/admin/configuration', module: 'configuration', label: 'Configuration', icon: SlidersHorizontalIcon },
  { to: '/admin/audit-log', module: 'audit', label: 'Audit Log', icon: ScrollTextIcon },
]

// Active by path prefix (Overview only on /admin itself); `match` covers items that own several routes.
const isActive = (item, pathname) => (item.match ? item.match(pathname) : item.to === '/admin' ? pathname === '/admin' : pathname.startsWith(item.to))

function NavItem({ item, row = false }) {
  const { pathname } = useLocation()
  const active = isActive(item, pathname)
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 transition-colors',
        row ? 'shrink-0 rounded-full px-4 text-sm whitespace-nowrap' : 'rounded-xl px-3.5 py-3 text-[15px]',
        active ? 'bg-secondary font-bold text-primary' : 'font-semibold text-ink-3 hover:bg-muted',
      )}
    >
      <item.icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </Link>
  )
}

// Separate from the B2C AppShell: no bottom nav, no tours, wider content for tables. Sidebar ≥1024px,
// a sideways-scrolling module row below that.
export function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { session, logout } = useSession()
  const name = session.user.name
  useRouteFocus(pathname)
  const staff = STAFF[session.role]
  const mine = NAV.filter((n) => canOpen(session.role, n.module))
  const current = NAV.find((n) => isActive(n, pathname))
  const allowed = !current || canOpen(session.role, current.module)
  // /admin is the Overview; a role without it starts at its own home instead.
  if (!allowed && pathname === '/admin') return <Navigate to={staff.home} replace />

  const signOut = async () => {
    await logout()
    navigate('/register', { replace: true })
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <a href="#main" className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Lewati ke konten
      </a>
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col gap-[34px] overflow-y-auto border-r border-border bg-card px-[26px] py-7 lg:flex">
        <Brand tagline={staff.label} />
        <nav aria-label="Navigasi admin" className="flex flex-col gap-1.5">
          {mine.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand compact tagline={staff.label} />
            <button type="button" onClick={signOut} aria-label="Keluar admin" className="flex size-11 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted">
              <LogOutIcon className="size-5" aria-hidden />
            </button>
          </div>
          <nav aria-label="Navigasi admin" className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mine.map((item) => (
              <NavItem key={item.to} item={item} row />
            ))}
          </nav>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 pt-5 pb-16 outline-none sm:px-6 lg:px-10 lg:pt-6">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
            <div className="hidden items-center justify-end gap-4 lg:flex">
              <span className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white" aria-hidden>
                  {initials(name)}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-bold">{name}</span>
                  <span className="text-xs text-muted-foreground">{staff.label}</span>
                </span>
              </span>
              <Button variant="neutral" size="sm" onClick={signOut}>
                <LogOutIcon aria-hidden />
                Keluar admin
              </Button>
            </div>
            {allowed ? (
              <Outlet />
            ) : (
              <div className="py-10">
                <Refusal
                  title="Halaman ini di luar akses kamu"
                  body={`Akun ${staff.label} hanya bisa membuka ${mine.map((n) => n.label).join(', ')}.`}
                  to={staff.home}
                  label={`Kembali ke ${NAV.find((n) => n.to === staff.home).label}`}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// A clear refusal, never a silent redirect.
function Refusal({ title, body, to, label }) {
  return (
    <EmptyState
      icon={ShieldAlertIcon}
      title={title}
      action={
        <Button asChild size="md">
          <Link to={to}>{label}</Link>
        </Button>
      }
    >
      {body}
    </EmptyState>
  )
}

// Shown to signed-in non-staff on any /admin page.
export function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <Refusal title="Halaman ini khusus admin" body="Akun ini tidak punya akses ke dashboard admin." to="/" label="Kembali ke Home" />
    </main>
  )
}
