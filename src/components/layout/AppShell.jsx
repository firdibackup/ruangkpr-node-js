import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { DropdownMenu } from 'radix-ui'
import { ActivityIcon, ArrowLeftIcon, BellIcon, ChevronDownIcon, CompassIcon, HouseIcon, LandmarkIcon, LogOutIcon, UserRoundIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/data/api'
import { ConfirmDialog } from '@/components/shared/dialogs'
import { useSession } from '@/domains/session/SessionProvider'
import { firstName, initials } from '@/lib/format'
import { useRouteFocus } from '@/lib/hooks'

const NAV = [
  { to: '/', label: 'Home', icon: HouseIcon, match: (p) => p === '/' || p.startsWith('/monitoring') },
  { to: '/my-kpr', label: 'My KPR', icon: LandmarkIcon, match: (p) => p.startsWith('/my-kpr') || p.startsWith('/apply') || p.startsWith('/optimize') },
  { to: '/explore', label: 'Explore', icon: CompassIcon, match: (p) => p.startsWith('/explore') || p.startsWith('/education') },
  { to: '/activity', label: 'Activity', icon: ActivityIcon, match: (p) => p.startsWith('/activity') },
  { to: '/profile', label: 'Profile', icon: UserRoundIcon, match: (p) => p.startsWith('/profile') },
]

export function Brand({ compact = false, tagline = 'Command Center' }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-white" aria-hidden>
        R
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn('font-extrabold', compact ? 'text-base' : 'text-[17px]')}>RuangKPR</span>
        <span className="text-[11px] font-semibold tracking-[0.4px] text-brand-red">{tagline}</span>
      </span>
    </div>
  )
}

const unreadLabel = (n) => (n > 9 ? '9+' : String(n))

// Five items, never disabled (PRD §4.1). Desktop sidebar ≥1024px, bottom nav below.
export function AppShell() {
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)
  useRouteFocus(pathname)

  useEffect(() => {
    let alive = true
    api.dashboard
      .getSnapshot()
      .then((s) => alive && setUnread(s.unreadActivities))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [pathname])

  return (
    <div className="flex min-h-dvh bg-background">
      <a href="#main" className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Lewati ke konten
      </a>
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col gap-[34px] border-r border-border bg-card px-[26px] py-7 lg:flex">
        <Brand />
        <nav data-tour="nav" aria-label="Navigasi utama" className="flex flex-col gap-1.5">
          {NAV.map((n) => {
            const active = n.match(pathname)
            return (
              <NavLink
                key={n.to}
                to={n.to}
                aria-current={active ? 'page' : undefined}
                className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] transition-colors', active ? 'bg-secondary font-bold text-primary' : 'font-semibold text-ink-3 hover:bg-muted')}
              >
                <n.icon className="size-5" aria-hidden />
                <span className="flex-1">{n.label}</span>
                {n.to === '/activity' && unread > 0 && (
                  <span className="rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold text-white">
                    {unreadLabel(unread)}
                    <span className="sr-only"> belum dibaca</span>
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <Brand compact />
          <NavLink to="/activity" aria-label={`Aktivitas${unread ? `, ${unread} belum dibaca` : ''}`} className="relative flex size-11 items-center justify-center rounded-xl border border-border bg-card">
            <BellIcon className="size-5" aria-hidden />
            {unread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-brand-red" />}
          </NavLink>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 pt-5 pb-[calc(96px+env(safe-area-inset-bottom))] outline-none sm:px-6 lg:px-10 lg:pt-8 lg:pb-24">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
            <Outlet context={{ unread }} />
          </div>
        </main>
      </div>

      <nav data-tour="nav" aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const active = n.match(pathname)
          return (
            <NavLink key={n.to} to={n.to} aria-current={active ? 'page' : undefined} className={cn('relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px]', active ? 'font-bold text-primary' : 'font-semibold text-ink-3')}>
              <n.icon className="size-[22px]" aria-hidden />
              {n.label}
              {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-primary" aria-hidden />}
              {n.to === '/activity' && unread > 0 && <span className="absolute top-2 left-1/2 ml-2 size-2 rounded-full bg-brand-red" aria-hidden />}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

// Sign-out confirmation, shared by the Profile page and the desktop profile menu.
export function LogoutDialog({ open, onOpenChange }) {
  const navigate = useNavigate()
  const { logout } = useSession()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive={false}
      title="Keluar dari RuangKPR?"
      body="Draft dan data KPR yang sudah tersimpan tidak dihapus. Kamu bisa masuk lagi dengan email dan password yang sama."
      confirmLabel="Keluar"
      onConfirm={async () => {
        await logout()
        navigate('/login', { replace: true })
      }}
    />
  )
}

const menuItem = 'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm font-semibold outline-none select-none data-[highlighted]:bg-muted'

// Page title row (artifact): optional back, crumb, title/subtitle, notification + profile menu on desktop.
export function PageHeader({ title, subtitle, back, crumb, actions }) {
  const navigate = useNavigate()
  const { session } = useSession()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const name = session?.user?.name
  const unread = useOutletContext()?.unread ?? 0
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-[1_1_320px] items-center gap-3.5">
        {back && (
          <button type="button" onClick={() => (typeof back === 'function' ? back() : navigate(back))} aria-label="Kembali" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted">
            <ArrowLeftIcon className="size-5" aria-hidden />
          </button>
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          {crumb && <span className="text-xs font-bold text-muted-foreground">{crumb}</span>}
          <h1 className="text-[22px] leading-tight font-extrabold tracking-[-0.4px] text-pretty lg:text-[30px]">{title}</h1>
          {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <NavLink to="/activity" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`} className="relative hidden size-11 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted lg:flex">
          <BellIcon className="size-5" aria-hidden />
          {unread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-brand-red" />}
        </NavLink>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="hidden items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-3 pl-1.5 hover:bg-muted data-[state=open]:bg-muted lg:flex">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white" aria-hidden>
              {initials(name)}
            </span>
            <span className="text-sm font-semibold">{firstName(name) || 'Profil'}</span>
            <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className="z-50 flex min-w-48 flex-col gap-0.5 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
              <DropdownMenu.Item className={menuItem} onSelect={() => navigate('/profile')}>
                <UserRoundIcon className="size-4" aria-hidden />
                Lihat Profil
              </DropdownMenu.Item>
              <DropdownMenu.Item className={cn(menuItem, 'text-danger')} onSelect={() => setLogoutOpen(true)}>
                <LogOutIcon className="size-4" aria-hidden />
                Keluar
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
      </div>
    </div>
  )
}
