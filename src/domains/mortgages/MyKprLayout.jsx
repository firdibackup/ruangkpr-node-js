import { useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleCheckIcon, CircleIcon } from 'lucide-react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { dateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { PageTour } from '@/components/shared/PageTour'
import { ConfirmDialog } from '@/components/shared/dialogs'
import { EmptyState, ErrorPanel, Panel, PageSkeleton } from '@/components/shared/ui'
import { activeApplication } from '@/domains/home/selectHomeState'
import { KprSwitch } from '@/domains/applications/KprSwitch'
import { deriveMortgage } from './derive'
import { SETUP_STEPS, setupStepOf } from './setupMeta'

export function MyKprResolver() {
  const navigate = useNavigate()
  const { data: snap, error, reload } = useResource(() => api.dashboard.getSnapshot())
  const [confirm, setConfirm] = useState(false)
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  if (activeApplication(snap.applications)) return <Navigate to="/my-kpr/application" replace />
  if (snap.mortgages.some((m) => m.status === 'active')) return <Navigate to="/my-kpr/overview" replace />
  const draft = snap.mortgages.find((m) => m.status === 'draft')
  const draftStep = draft ? setupStepOf(draft) : null

  return (
    <>
      <PageHeader title="My KPR" subtitle={draft ? 'Pengaturan KPR kamu belum selesai.' : 'Belum ada pengajuan atau KPR yang dipantau.'} />
      {draft ? (
        <Panel className="max-w-[720px] gap-5 sm:p-7">
          <div className="flex flex-col gap-1.5">
            <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-extrabold text-ink-3">Draft Pantau KPR</span>
            <h2 className="text-[22px] font-extrabold">Lanjutkan pengaturan KPR kamu</h2>
            <p className="text-[13px] text-muted-foreground">Terakhir disimpan {dateShort(draft.updatedAt ?? draft.createdAt)}</p>
          </div>
          <ol className="flex flex-col gap-1">
            {SETUP_STEPS.map((label, i) => {
              const n = i + 1
              const state = n < draftStep ? 'done' : n === draftStep ? 'current' : 'todo'
              return (
                <li key={label} aria-current={state === 'current' ? 'step' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-3', state === 'current' && 'bg-secondary')}>
                  {state === 'done' ? <CircleCheckIcon className="size-5 text-success" aria-hidden /> : <CircleIcon className={cn('size-5', state === 'current' ? 'text-primary' : 'text-muted-foreground')} aria-hidden />}
                  <span className={cn('flex-1 text-sm', state === 'current' ? 'font-extrabold' : 'font-semibold', state === 'todo' && 'text-muted-foreground')}>{label}</span>
                  <span className="text-xs font-bold text-muted-foreground">{state === 'done' ? 'Selesai' : state === 'current' ? 'Posisi kamu sekarang' : 'Belum'}</span>
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap gap-3">
            <Button size="md" onClick={() => navigate(`/monitoring/setup/${draftStep}`)}>
              Lanjutkan Pengaturan
            </Button>
            <Button size="md" variant="neutral" className="text-danger" onClick={() => setConfirm(true)}>
              Hapus data
            </Button>
          </div>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Hapus data pengaturan KPR?"
            body="Data KPR yang sudah kamu isi akan dihapus permanen."
            confirmLabel="Hapus data"
            onConfirm={async () => {
              await api.mortgages.deleteDraft(draft.id)
              toast('Data pengaturan KPR dihapus.')
              reload()
            }}
          />
        </Panel>
      ) : (
        <EmptyState
          media={
            // The drawing sits on #FEFEFE with ground cut at the sides: brightness lifts it to card white,
            // the mask fades the cut, and the negative margins absorb its built-in whitespace.
            <img
              src="/no-kpr-page.webp"
              alt=""
              width={1448}
              height={1086}
              decoding="async"
              className="-mt-4 -mb-3 h-auto w-full max-w-[340px] brightness-[1.02] [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)] sm:max-w-[380px]"
            />
          }
          title="Belum ada KPR atau pengajuan"
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="md">
                <Link to="/">Mulai Pengajuan</Link>
              </Button>
              <Button asChild size="md" variant="outline">
                <Link to="/monitoring/intro">Pantau KPR Saya</Link>
              </Button>
            </div>
          }
        >
          Pilih produk di Home untuk mengajukan KPR, atau tambahkan KPR yang sudah berjalan untuk dipantau.
        </EmptyState>
      )}
    </>
  )
}

const TABS = [
  ['overview', 'Overview'],
  ['payment', 'Payment'],
  ['rate', 'Rate'],
  ['property', 'Property'],
]

// Local tabs Overview/Payment/Rate/Property (PRD §12.1) — no new sidebar items.
export function MyKprLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data: snap, error, reload, setData } = useResource(() => api.dashboard.getSnapshot())
  const tab = pathname.split('/')[2] ?? 'overview'
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const m = snap.mortgages.find((x) => x.status === 'active')
  if (!m) return <Navigate to="/my-kpr" replace />
  const d = deriveMortgage(m, snap.clock)
  const setMortgage = (next) => setData((s) => ({ ...s, mortgages: s.mortgages.map((x) => (x.id === next.id ? next : x)) }))
  const hasApp = !!activeApplication(snap.applications)

  return (
    <>
      <PageHeader title="KPR Saya" subtitle={`${m.bankName} · KPR ${m.scheme === 'sharia' ? 'Syariah' : 'Konvensional'}`} actions={<PageTour id="my-kpr" seen={snap.toursSeen} />} />
      {hasApp && <KprSwitch current="mortgage" />}
      <TabsPrimitive.Root value={tab} onValueChange={(v) => navigate(`/my-kpr/${v}`)} className="flex flex-col gap-5">
        <TabsPrimitive.List aria-label="Detail KPR" className="relative flex w-full max-w-full gap-1 self-start overflow-x-auto rounded-full border border-border bg-card p-1 sm:w-fit">
          {TABS.map(([k, label]) => (
            <TabsPrimitive.Trigger key={k} value={k} data-tour={`tab-${k}`} className="h-11 shrink-0 rounded-full px-[22px] text-sm font-bold text-ink-3 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=active]:bg-primary data-[state=active]:text-white">
              {label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        <TabsPrimitive.Content value={tab} className="outline-none">
          <Outlet context={{ m, d, snap, setMortgage, reload }} />
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </>
  )
}
