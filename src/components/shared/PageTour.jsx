import { useEffect, useId, useState } from 'react'
import { EVENTS, Joyride } from 'react-joyride'
import { CircleHelpIcon } from 'lucide-react'
import { api } from '@/data/api'
import { TOURS } from '@/data/tours'
import { Button } from '@/components/ui/button'

// Tours auto-started in this page session; the snapshot's `toursSeen` only catches up on the next load.
const started = new Set()

// The sidebar and the bottom nav share a tour name, so pick the element that is actually rendered.
const find = (name) => [...document.querySelectorAll(`[data-tour="${name}"]`)].find((el) => el.getClientRects().length > 0) ?? null

// Only steps whose element is on screen now, so "2 dari 5" counts what the user will actually see.
const stepsFor = (id) =>
  TOURS[id].filter((s) => !s.target || find(s.target)).map((s) => ({ ...s, target: s.target ? () => find(s.target) : 'body' }))

const OPTIONS = {
  skipBeacon: true,
  dismissKeyAction: false, // Esc ends the whole tour (handled below), not just the step
  overlayClickAction: false,
  overlayColor: '#0b1b3399',
  spotlightPadding: 8,
  spotlightRadius: 20,
  scrollOffset: 120, // clears the sticky mobile header and the sticky "Atur Dashboard" toolbar
}
const LOCALE = { back: 'Kembali', close: 'Tutup', last: 'Selesai', next: 'Lanjut', nextWithProgress: 'Lanjut', open: 'Buka panduan', skip: 'Lewati' }

// "Panduan" button for a page header: runs the page's tour once on its own, then again on every click.
export function PageTour({ id, seen, ready = true }) {
  const [steps, setSteps] = useState(null)
  const done = seen?.includes(id) ?? false
  const start = () => {
    const next = stepsFor(id)
    if (next.length) setSteps(next)
    return next.length > 0
  }

  useEffect(() => {
    if (!ready || done || started.has(id)) return
    // ponytail: fixed delay so the dashboard grid has measured and mounted its widgets before targets are checked; wait on a MutationObserver if a page ever mounts slower.
    const timer = setTimeout(() => {
      if (!start()) return
      started.add(id)
      api.dashboard.markTourSeen(id).catch(() => {})
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready, done])

  useEffect(() => {
    if (!steps) return
    const onKey = (e) => e.key === 'Escape' && setSteps(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steps])

  return (
    <>
      <Button variant="neutral" size="sm" data-tour="tour-button" aria-label="Panduan halaman ini" onClick={start} className="max-sm:w-11 max-sm:px-0">
        <CircleHelpIcon aria-hidden />
        <span className="max-sm:hidden">Panduan</span>
      </Button>
      {steps && (
        <Joyride
          run
          continuous
          steps={steps}
          options={{ ...OPTIONS, scrollDuration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 300 }}
          locale={LOCALE}
          tooltipComponent={TourTooltip}
          onEvent={({ type }) => type === EVENTS.TOUR_END && setSteps(null)}
        />
      )}
    </>
  )
}

function TourTooltip({ backProps, primaryProps, skipProps, index, size, isLastStep, step, tooltipProps }) {
  const titleId = useId()
  const bodyId = useId()
  return (
    <div {...tooltipProps} aria-labelledby={titleId} aria-describedby={bodyId} className="flex w-[min(360px,calc(100vw-32px))] flex-col gap-3 rounded-card bg-card p-5 text-foreground shadow-pop">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-base font-extrabold text-pretty">
          {step.title}
        </h2>
        <span className="shrink-0 text-xs font-bold text-muted-foreground">
          {index + 1} dari {size}
        </span>
      </div>
      <p id={bodyId} className="text-sm leading-[21px] text-ink-2">
        {step.content}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!isLastStep && (
          <Button variant="ghost" size="sm" className="-ml-3" {...skipProps}>
            Lewati
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {index > 0 && (
            <Button variant="neutral" size="sm" {...backProps}>
              Kembali
            </Button>
          )}
          <Button size="sm" {...primaryProps}>
            {isLastStep ? 'Selesai' : 'Lanjut'}
          </Button>
        </div>
      </div>
    </div>
  )
}
