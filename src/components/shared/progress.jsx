import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CloudCheckIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from './ui'

// Share of finished steps: the last step reads below 100% until it is submitted.
export const stepPercent = (current, total) => Math.round(((current - 1) / total) * 100)

// Eases toward `target` (ease-out cubic) from wherever it currently shows; jumps under reduced motion.
function useTween(target, ms = 700) {
  const [value, setValue] = useState(0)
  const shown = useRef(0)
  useEffect(() => {
    const from = shown.current
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    const t0 = performance.now()
    let raf
    const tick = (now) => {
      const k = still ? 1 : Math.min(1, (now - t0) / ms)
      shown.current = from + (target - from) * (1 - (1 - k) ** 3)
      setValue(shown.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

// Linear wizard progress (artifact C12) with a percent readout. `current` is the step on screen, `reached`
// the furthest saved step (both 1-based), so stepping back to edit never lowers the saved percent.
// A fractional `reached` (e.g. 1.5) marks a saved sub-step inside a step.
// `percent` overrides the number (still tweened) when the wizard has its own percent table.
export function WizardProgress({ label, steps, current, reached = current, percent, saving, savedLabel = 'Tersimpan otomatis tiap klik Simpan & Lanjutkan' }) {
  const top = Math.max(current, reached)
  const filled = useTween(top - 1) // finished steps, animated; drives the bar (and the number without `percent`)
  const shownPercent = useTween(percent ?? 0)
  return (
    <div className="flex flex-col gap-3.5 rounded-3xl border border-border bg-card px-5 py-4 sm:px-[22px] sm:py-[18px]">
      <div className="flex items-center gap-4">
        <span className="flex shrink-0 items-baseline text-primary" aria-hidden>
          <span className="tabular min-w-[2ch] text-right text-[28px] leading-none font-extrabold tracking-[-0.03em]">{Math.round(percent == null ? (filled / steps.length) * 100 : shownPercent)}</span>
          <span className="text-[15px] font-extrabold">%</span>
        </span>
        <span className="sr-only">{percent ?? stepPercent(top, steps.length)}% selesai.</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1 border-l border-border pl-4">
          <span className="text-[13px] font-bold text-pretty">{label}</span>
          {saving ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary" role="status">
              <Spinner className="size-3.5" />
              Menyimpan…
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CloudCheckIcon className="size-3.5 shrink-0" aria-hidden />
              {savedLabel}
            </span>
          )}
        </div>
      </div>
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const n = i + 1
          const state = n === current ? 'current' : n < top ? 'done' : 'todo'
          return (
            <li key={s} className="flex min-w-0 flex-col gap-2" aria-current={state === 'current' ? 'step' : undefined}>
              {/* Current step reads as "you are here" even when revisited (fully filled): thicker bar
                  (negative margin keeps labels aligned) + primary label. */}
              <span className={cn('relative overflow-hidden rounded-full', state === 'current' ? '-my-0.5 h-2.5' : 'h-1.5', state === 'current' && n === Math.floor(top) ? 'bg-step-current' : 'bg-border')}>
                <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(1, Math.max(0, filled - i)) * 100}%` }} />
              </span>
              <span className={cn('hidden text-[11px] leading-tight md:block', state === 'current' ? 'font-extrabold text-primary' : state === 'done' ? 'font-semibold text-foreground' : 'font-semibold text-muted-foreground')}>
                {s}
                <span className="sr-only">{state === 'done' ? ' (selesai)' : state === 'current' ? ' (langkah saat ini)' : ''}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// Horizontal status stepper (artifact C11). step.state: done | current | rejected | todo
export function StatusStepper({ steps, label = 'Tahapan pengajuan' }) {
  return (
    <ol aria-label={label} className="relative flex overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const next = steps[i + 1]
        return (
          <li key={s.label} className="flex min-w-[88px] flex-1 flex-col gap-2.5" aria-current={s.state === 'current' ? 'step' : undefined}>
            <div className="flex items-center">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-white',
                  s.state === 'done' && 'border-primary bg-primary',
                  s.state === 'current' && 'border-primary bg-card',
                  s.state === 'rejected' && 'border-brand-red bg-brand-red',
                  s.state === 'todo' && 'border-[#d5dce6] bg-muted',
                )}
              >
                {s.state === 'done' && <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden />}
                {s.state === 'rejected' && <XIcon className="size-3.5" strokeWidth={3} aria-hidden />}
                {s.state === 'current' && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              {next && <span className={cn('mx-1.5 h-[3px] flex-1 rounded-full', s.state === 'done' && next.state !== 'todo' ? (next.state === 'rejected' ? 'bg-brand-red' : 'bg-primary') : 'bg-border')} />}
            </div>
            <div className="flex flex-col gap-0.5 pr-2">
              <span className={cn('text-[13px]', s.state === 'todo' ? 'font-semibold text-muted-foreground' : 'font-extrabold', s.state === 'current' && 'text-primary', s.state === 'rejected' && 'text-danger')}>{s.label}</span>
              <span className="text-xs text-muted-foreground">
                {s.date}
                <span className="sr-only"> — {s.state === 'done' ? 'selesai' : s.state === 'current' ? 'sedang berjalan' : s.state === 'rejected' ? 'ditolak' : 'belum'}</span>
              </span>
              {s.eta && (
                <span className="text-xs text-muted-foreground">
                  <span className="sr-only">Estimasi </span>
                  {s.eta}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// Vertical timeline (Take Over tracker, rate timeline).
export function Timeline({ steps, label }) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-3.5" aria-current={s.state === 'current' ? 'step' : undefined}>
          <div className="flex flex-col items-center">
            <span
              className={cn(
                'flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 text-white',
                s.state === 'done' && 'border-success-strong bg-success-strong',
                s.state === 'current' && 'border-primary bg-primary',
                s.state === 'estimate' && 'border-warning-accent bg-card',
                s.state === 'todo' && 'border-[#c9d2e0] bg-card',
              )}
            >
              {s.state === 'done' && <CheckIcon className="size-3" strokeWidth={3} aria-hidden />}
            </span>
            {i < steps.length - 1 && <span className={cn('min-h-5 w-0.5 flex-1', s.state === 'done' ? 'bg-success-strong' : 'bg-border')} />}
          </div>
          <div className="flex flex-1 justify-between gap-3 pb-3.5">
            <span className="flex flex-col gap-0.5">
              <span className={cn('text-sm', s.state === 'current' ? 'font-extrabold' : s.state === 'todo' ? 'font-semibold text-muted-foreground' : 'font-semibold')}>{s.label}</span>
              {s.sub && <span className="text-[13px] text-muted-foreground">{s.sub}</span>}
            </span>
            {s.date && <span className={cn('text-xs font-bold', s.state === 'current' ? 'text-primary' : 'text-muted-foreground')}>{s.date}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}
