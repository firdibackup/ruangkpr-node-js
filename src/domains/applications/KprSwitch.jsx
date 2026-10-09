import { NavLink } from 'react-router-dom'
import { ActivityIcon, FileTextIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shown in My KPR when the user has both an application and a monitored mortgage (artifact "KPR Saya" header).
export function KprSwitch({ current }) {
  const items = [
    { key: 'application', to: '/my-kpr/application', label: 'Pengajuan', icon: FileTextIcon },
    { key: 'mortgage', to: '/my-kpr/overview', label: 'Pantau KPR', icon: ActivityIcon },
  ]
  return (
    <nav aria-label="Bagian KPR Saya" className="flex w-fit gap-1 rounded-full border border-border bg-card p-1">
      {items.map((i) => (
        <NavLink key={i.key} to={i.to} aria-current={current === i.key ? 'page' : undefined} className={cn('flex h-10 items-center gap-2 rounded-full px-[18px] text-sm font-bold', current === i.key ? 'bg-primary text-white' : 'text-ink-3 hover:bg-muted')}>
          <i.icon className="size-4" aria-hidden />
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}
