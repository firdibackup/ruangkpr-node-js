import { ArrowRightIcon, CircleCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Disclaimer, IconBox, Panel, Spinner } from './ui'

// Closing screen of a wizard phase (Primary & Take Over): what the data entered so far already tells the user.
export function MilestonePanel({ title, sub, disclaimer, onBack, onNext, nextLabel, pending = false, children }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel className="gap-5 sm:p-7">
        <div className="flex items-start gap-3.5">
          <IconBox icon={CircleCheckIcon} tone="ok" size="xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg font-extrabold text-pretty">{title}</h2>
            <p className="text-[13px] leading-5 text-muted-foreground">{sub}</p>
          </div>
        </div>
        {children}
        <Disclaimer>{disclaimer}</Disclaimer>
      </Panel>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="neutral" onClick={onBack}>
          Kembali
        </Button>
        <Button onClick={onNext} disabled={pending} aria-busy={pending}>
          {pending && <Spinner />}
          {nextLabel}
          <ArrowRightIcon aria-hidden />
        </Button>
      </div>
    </div>
  )
}

// Big-number insight tiles: 1 column on mobile, 3 from lg (1024px).
export function InsightGrid({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {items.map((x) => (
        <div key={x.k} className="flex min-w-0 flex-col gap-1 rounded-2xl bg-muted px-[18px] py-4">
          <dt className="text-[13px] font-extrabold text-ink-3">{x.k}</dt>
          <dd className="flex flex-col gap-1.5">
            <span className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] tabular">{x.v}</span>
            {x.sub && <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">{x.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
