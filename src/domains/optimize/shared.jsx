import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { PageHeader } from '@/components/layout/AppShell'
import { WizardProgress } from '@/components/shared/progress'
import { SummaryRows } from '@/components/shared/ui'
import { activeApplication } from '@/domains/home/selectHomeState'
import { TAKEOVER_PHASES, takeoverProgress } from '@/domains/applications/meta'

export const modeName = (mode) => (mode === 'topup' ? 'Refinancing + Top-up' : 'Take Over')

// Snapshot + the active Take Over draft (if any). Pages refetch after mutations.
export function useOptimize() {
  const res = useResource(() => api.dashboard.getSnapshot())
  const app = res.data ? activeApplication(res.data.applications) : null
  const takeover = app?.productType === 'takeover' ? app : null
  const setApp = (next) => res.setData((s) => ({ ...s, applications: [next, ...s.applications.filter((a) => a.id !== next.id)] }))
  return { ...res, snap: res.data, app: takeover, otherApp: app && !takeover ? app : null, setApp }
}

const PHASE_LABELS = TAKEOVER_PHASES.map((p) => p.label)

// `screen` is the Take Over progress screen on display (1–9, see takeoverProgress); `reached` the furthest
// saved one, so stepping back to edit never lowers the percent. No `screen` → no progress (intro, Explore).
export function OptimizeHeader({ screen, reached = screen, title, subtitle, back, saving }) {
  const shown = screen && takeoverProgress(screen)
  const furthest = screen && takeoverProgress(Math.max(screen, reached))
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} back={back} />
      {screen && (
        <WizardProgress
          label={`Bagian ${shown.phase} dari 3 · ${shown.label}`}
          steps={PHASE_LABELS}
          current={shown.phase}
          reached={furthest.position}
          percent={furthest.percent}
          saving={saving}
        />
      )}
    </>
  )
}

// sticky=false when stacked inside a column that is sticky itself (nested sticky asides overlap).
export function Aside({ icon: Icon, title, note, rows, tone = 'info', sticky = true, children }) {
  return (
    <aside className={`flex flex-col gap-3.5 rounded-card bg-card p-6 shadow-card${sticky ? ' lg:sticky lg:top-6' : ''}`}>
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 text-primary" aria-hidden />
        <span className="text-base font-extrabold">{title}</span>
      </div>
      {children}
      {rows?.length > 0 && <SummaryRows size="sm" rows={rows} />}
      {note && <p className={`rounded-xl px-3.5 py-3 text-[13px] leading-5 font-medium ${tone === 'warn' ? 'bg-warning-bg text-warning' : 'bg-secondary text-ink-2'}`}>{note}</p>}
    </aside>
  )
}
