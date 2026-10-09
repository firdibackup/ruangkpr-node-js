import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon, CircleCheckIcon, FileTextIcon, TriangleAlertIcon, WalletIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { dateLong } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { EmptyState, ErrorPanel, IconBox, Skeleton } from '@/components/shared/ui'

const FILTERS = [
  ['all', 'Semua', () => true],
  ['application', 'Pengajuan', (a) => a.category === 'application'],
  ['payment', 'Pembayaran', (a) => a.category === 'payment'],
  ['reminder', 'Reminder', (a) => ['reminder', 'warning', 'mortgage'].includes(a.category)],
]
const ICON = {
  application: [FileTextIcon, 'primary'],
  payment: [CircleCheckIcon, 'ok'],
  reminder: [BellIcon, 'primary'],
  warning: [TriangleAlertIcon, 'warn'],
  mortgage: [WalletIcon, 'ok'],
}

function groupLabel(date, clock) {
  if (date === clock) return 'Hari ini'
  const d = new Date(`${clock}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return date === d.toISOString().slice(0, 10) ? 'Kemarin' : dateLong(date)
}

// Activity is history (doc 02 ACT-01); reminder settings live in Profile, not here.
export function ActivityPage() {
  const { data, error, loading, reload, setData } = useResource(() => Promise.all([api.activities.list(), api.dashboard.getSnapshot()]).then(([items, snap]) => ({ items, clock: snap.clock })))
  const [filter, setFilter] = useState('all')
  const items = data?.items ?? []
  const unread = items.filter((a) => !a.readAt).length
  const shown = items.filter(FILTERS.find((f) => f[0] === filter)[2])
  const groups = shown.reduce((acc, a) => {
    const key = groupLabel(a.occurredAt.slice(0, 10), data.clock)
    ;(acc[key] ??= []).push(a)
    return acc
  }, {})

  const markRead = async (a) => {
    if (a.readAt) return
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === a.id ? { ...x, readAt: 'now' } : x)) }))
    try {
      await api.activities.markRead(a.id)
    } catch {
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === a.id ? { ...x, readAt: null } : x)) }))
    }
  }
  const markAll = async () => {
    await api.activities.markAllRead()
    reload()
  }

  return (
    <>
      <PageHeader title="Activity" subtitle="Status pengajuan, reminder, dan riwayat KPR." actions={unread > 0 && <Button variant="neutral" size="xs" onClick={markAll}>Tandai semua dibaca</Button>} />
      {!data && loading && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat aktivitas">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}
      {!data && error && <ErrorPanel onRetry={reload} />}
      {data && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter aktivitas">
            {FILTERS.map(([k, label, fn]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn('h-10 rounded-full border px-4 text-[13px] font-bold', filter === k ? 'border-primary bg-primary text-white' : 'border-border bg-card hover:bg-muted')}>
                {label} ({items.filter(fn).length})
              </button>
            ))}
          </div>
          {!shown.length ? (
            <EmptyState icon={BellIcon} title="Belum ada aktivitas">
              Status pengajuan, reminder pembayaran, dan peringatan bunga akan muncul di sini.
            </EmptyState>
          ) : (
            <div className="flex max-w-[760px] flex-col gap-5">
              {Object.entries(groups).map(([label, list]) => (
                <section key={label} className="flex flex-col gap-1 rounded-card bg-card p-5 shadow-card sm:px-7">
                  <h2 className="pb-1 text-xs font-extrabold tracking-[0.4px] text-muted-foreground uppercase">{label}</h2>
                  <ul className="flex flex-col">
                    {list.map((a) => {
                      const [Icon, tone] = ICON[a.category] ?? ICON.reminder
                      return (
                        <li key={a.id} className="flex gap-4 border-b border-line py-4 last:border-b-0">
                          <IconBox icon={Icon} tone={tone} />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex items-center gap-2 text-sm leading-[21px] font-extrabold">
                              {!a.readAt && <span className="size-2 shrink-0 rounded-full bg-brand-red" aria-hidden />}
                              {a.title}
                              {!a.readAt && <span className="sr-only">(belum dibaca)</span>}
                            </span>
                            <span className="text-sm leading-[21px] text-ink-3">{a.body}</span>
                            <span className="flex flex-wrap items-center gap-4">
                              {a.action && (
                                <Link to={a.action.route} onClick={() => markRead(a)} className="flex min-h-11 items-center text-[13px] font-bold text-primary">
                                  {a.action.label}
                                </Link>
                              )}
                              {!a.readAt && (
                                <button type="button" onClick={() => markRead(a)} className="min-h-11 text-[13px] font-semibold text-muted-foreground underline">
                                  Tandai dibaca
                                </button>
                              )}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
