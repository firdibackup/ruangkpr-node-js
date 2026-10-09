// Visual patterns copied from the approved artifact (cards, chips, summary rows, hero, notices).
import { useRef, useState } from 'react'
import { Popover, Progress as ProgressPrimitive } from 'radix-ui'
import { CircleAlertIcon, CircleCheckIcon, CloudOffIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EMPTY } from '@/lib/format'

export function Panel({ as: Comp = 'section', className, children, ...props }) {
  return (
    <Comp className={cn('flex flex-col gap-4 rounded-card bg-card p-5 shadow-card sm:p-6', className)} {...props}>
      {children}
    </Comp>
  )
}

export function PanelTitle({ children, className, as: Comp = 'h2', sub }) {
  return (
    <div className="flex flex-col gap-1">
      <Comp className={cn('text-lg font-extrabold', className)}>{children}</Comp>
      {sub && <p className="text-[13px] leading-5 text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function IconBox({ icon: Icon, className, size = 'md', tone = 'primary' }) {
  const sizes = { sm: 'size-9 rounded-md [&_svg]:size-[17px]', md: 'size-10 rounded-lg [&_svg]:size-[19px]', lg: 'size-11 rounded-lg [&_svg]:size-5', xl: 'size-12 rounded-xl [&_svg]:size-[22px]' }
  const tones = {
    primary: 'bg-secondary text-primary',
    white: 'bg-card text-primary',
    muted: 'bg-muted text-ink-3',
    ok: 'bg-success-bg text-success',
    warn: 'bg-warning-bg text-warning-text',
    bad: 'bg-danger-bg text-danger',
    glass: 'bg-white/15 text-white',
    solid: 'bg-primary text-white',
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center', sizes[size], tones[tone], className)} aria-hidden>
      <Icon />
    </span>
  )
}

const CHIP_TONES = {
  info: 'bg-secondary text-primary',
  ok: 'bg-success-bg text-success',
  warn: 'bg-warning-bg text-warning',
  bad: 'bg-danger-bg text-danger-strong',
  mute: 'bg-muted text-ink-3',
  solid: 'bg-primary text-white',
  glass: 'bg-white/15 text-white',
}

export function Chip({ tone = 'info', icon: Icon, children, className }) {
  return (
    <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold', CHIP_TONES[tone], className)}>
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  )
}

export function EstimateTag({ children = 'estimasi', className }) {
  return <span className={cn('rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-extrabold text-warning', className)}>{children}</span>
}

export function SummaryRows({ rows, className, size = 'md' }) {
  return (
    <dl className={cn('flex flex-col', className)}>
      {rows.filter(Boolean).map((r) => ({ ...r, tone: r.tone ?? (r.v === EMPTY || r.v === 'Belum diisi' ? 'mute' : undefined) })).map((r) => (
        <div key={r.k} className={cn('flex items-baseline justify-between gap-4 border-b border-line last:border-b-0', size === 'sm' ? 'py-2.5 text-[13px]' : 'py-3 text-sm')}>
          <dt className="flex min-w-0 items-center gap-2 text-ink-3">
            {r.k}
            {r.tag}
          </dt>
          <dd className={cn('text-right font-extrabold tabular', r.strong && 'text-base', r.tone === 'ok' && 'text-success', r.tone === 'warn' && 'text-warning-text', r.tone === 'bad' && 'text-danger', r.tone === 'mute' && 'font-semibold text-muted-foreground')}>{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function StatTile({ label, value, tone, className }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-xl bg-muted px-4 py-3.5', className)}>
      <span className="text-xs font-semibold text-ink-3">{label}</span>
      <span className={cn('text-lg font-extrabold tabular', tone === 'ok' && 'text-success', tone === 'bad' && 'text-danger', tone === 'warn' && 'text-warning-text')}>{value}</span>
    </div>
  )
}

const NOTICE = {
  info: { box: 'bg-secondary text-ink-2', icon: InfoIcon, iconTone: 'text-primary' },
  muted: { box: 'bg-muted text-ink-3', icon: InfoIcon, iconTone: 'text-primary' },
  warn: { box: 'border border-warning-border bg-warning-soft text-[#5c4a1f]', icon: TriangleAlertIcon, iconTone: 'text-warning-text' },
  bad: { box: 'border border-danger-border bg-danger-bg text-danger-strong', icon: CircleAlertIcon, iconTone: 'text-danger' },
  ok: { box: 'bg-success-bg text-success', icon: CircleCheckIcon, iconTone: 'text-success' },
}

export function Notice({ tone = 'info', icon, title, children, action, className, role }) {
  const n = NOTICE[tone]
  const Icon = icon ?? n.icon
  return (
    <div role={role} className={cn('flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[13px] leading-5', n.box, className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', n.iconTone)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <span className="text-sm font-extrabold">{title}</span>}
        {children && <div className="font-medium">{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  )
}

// scenery: 'bottom' crops the road below the card edge; 'top' lifts the street into the corner when content fills the lower half.
export function HeroCard({ className, children, scenery = 'bottom' }) {
  return (
    <section className={cn('relative isolate flex flex-col gap-4 overflow-hidden rounded-card p-6 text-white shadow-card hero-gradient sm:p-[30px]', className)}>
      {scenery && (
        <img
          src="/card-overview.webp"
          alt=""
          width={1672}
          height={941}
          decoding="async"
          className={cn(
            'pointer-events-none absolute right-0 -z-10 w-[min(640px,95%)] select-none hero-scenery',
            scenery === 'top' ? 'top-0 -translate-y-[25%]' : 'bottom-0 translate-y-[28%]',
          )}
        />
      )}
      {children}
    </section>
  )
}

export function BankMark({ mark, size = 'md', tone = 'primary' }) {
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center font-extrabold italic', size === 'lg' ? 'size-14 rounded-2xl text-base' : size === 'sm' ? 'size-10 rounded-lg text-[13px]' : 'size-[52px] rounded-xl text-[15px]', tone === 'primary' ? 'bg-secondary text-primary' : tone === 'glass' ? 'bg-white/15 text-white' : 'bg-muted text-ink-3')}
      aria-hidden
    >
      {mark}
    </span>
  )
}

export function ProgressBar({ value, max = 100, label, className, barClassName, size = 'md' }) {
  return (
    <ProgressPrimitive.Root
      value={Math.max(0, Math.min(max, value))}
      max={max}
      aria-label={label}
      className={cn('relative w-full overflow-hidden rounded-full bg-border', size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2', className)}
    >
      <ProgressPrimitive.Indicator className={cn('h-full rounded-full bg-primary transition-all', barClassName)} style={{ width: `${(Math.max(0, Math.min(max, value)) / max) * 100}%` }} />
    </ProgressPrimitive.Root>
  )
}

export function Spinner({ className }) {
  return <LoaderCircleIcon className={cn('size-[18px] animate-spin', className)} aria-hidden />
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-[#edf0f5]', className)} aria-hidden />
}

export function LoadingCards({ count = 3, className, label = 'Memuat data' }) {
  return (
    <div aria-busy="true" aria-label={label} className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3.5 rounded-card bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
          </div>
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-10 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman" className="flex flex-col gap-5">
      <Skeleton className="h-40 rounded-card" />
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    </div>
  )
}

export function ErrorPanel({ title = 'Data gagal dimuat.', message = 'Koneksi bermasalah. Periksa koneksi lalu coba lagi.', onRetry, icon: Icon = CloudOffIcon, className }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-2.5 rounded-card bg-card px-6 py-10 text-center shadow-card', className)}>
      <span className="flex size-[52px] items-center justify-center rounded-full bg-danger-bg text-danger">
        <Icon className="size-[22px]" aria-hidden />
      </span>
      <span className="text-[15px] font-extrabold">{title}</span>
      {message && <span className="max-w-sm text-[13px] text-muted-foreground">{message}</span>}
      {onRetry && (
        <Button size="xs" onClick={onRetry} className="mt-1">
          Coba Lagi
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, media, title, children, action, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-3.5 rounded-card bg-card px-6 py-12 text-center shadow-card', className)}>
      {media}
      {Icon && !media && (
        <span className="flex size-[72px] items-center justify-center rounded-full bg-secondary text-primary">
          <Icon className="size-[30px]" aria-hidden />
        </span>
      )}
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children && <div className="max-w-sm text-sm leading-[21px] text-muted-foreground">{children}</div>}
      {action}
    </div>
  )
}

// Small ⓘ that explains a figure: hover opens it with a mouse, tap/click or Enter elsewhere (phones have no hover).
// The 16px icon keeps a 44px hit area through its ::after, so it sits inline without growing the row.
export function InfoTip({ label, children, className }) {
  const [open, setOpen] = useState(false)
  const timer = useRef()
  const mouse = useRef(false)
  const hover = (next) => (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), next ? 0 : 150)
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={label}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        onPointerDown={(e) => (mouse.current = e.pointerType === 'mouse')}
        // A mouse click on a tip hover already opened keeps it open instead of toggling it shut.
        onClick={(e) => e.detail && mouse.current && open && e.preventDefault()}
        className={cn('relative inline-flex size-4 shrink-0 items-center justify-center rounded-full text-ink-3 after:absolute after:-inset-3.5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', className)}
      >
        <InfoIcon className="size-4" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={hover(true)}
          onPointerLeave={hover(false)}
          className="z-50 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-border bg-card p-4 text-[13px] leading-5 font-medium text-ink-2 shadow-card"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Disclaimer({ children, className }) {
  return <p className={cn('text-xs leading-[18px] text-muted-foreground', className)}>{children}</p>
}

export const ESTIMATE_DISCLAIMER = 'Hasil ini merupakan estimasi berdasarkan data yang kamu masukkan dan kebijakan produk yang tersedia. Bukan persetujuan kredit, appraisal resmi, atau saldo resmi bank.'
