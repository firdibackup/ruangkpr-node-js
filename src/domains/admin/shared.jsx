import { Suspense, lazy, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, ChartColumnIcon, ChevronDownIcon, FileStackIcon, LandmarkIcon, MinusIcon, NewspaperIcon, ScrollTextIcon, SlidersHorizontalIcon, TrendingDownIcon, TrendingUpIcon, UsersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateShort } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorSummary, TextAreaField } from '@/components/shared/fields'
import { FormDialog } from '@/components/shared/dialogs'
import { Chip, IconBox, Notice, Skeleton, Spinner } from '@/components/shared/ui'
import { STATUS_LABEL } from '@/domains/applications/meta'
import { ACTION_LABEL, FIELD_LABEL, at, fieldList, formatValue } from './labels'

// Status words carry tone only where it means an outcome: rejected and disbursed; drafts stay quiet.
const STATUS_TONE = { draft: 'mute', rejected: 'bad', disbursed: 'ok' }
export function StatusChip({ status }) {
  return (
    <Chip tone={STATUS_TONE[status] ?? 'info'} className="shrink-0 whitespace-nowrap">
      {STATUS_LABEL[status] ?? status}
    </Chip>
  )
}

// Signed move against the period named in `vs`: an arrow and the sign carry the direction, the tone says whether
// that direction is good news.
export function Change({ value, vs, upIsGood = true }) {
  const Icon = value > 0 ? TrendingUpIcon : value < 0 ? TrendingDownIcon : MinusIcon
  const good = value === 0 ? null : value > 0 === upIsGood
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1 text-xs font-bold', good === null ? 'text-ink-3' : good ? 'text-success' : 'text-danger')}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0'}
      <span className="font-semibold text-muted-foreground">vs {vs}</span>
    </span>
  )
}

// `change` (with `vs`, `upIsGood`) adds the move against the comparison period.
export function Kpi({ label, value, hint, change, vs, upIsGood }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-card bg-card p-5 shadow-card">
      <dt className="text-[13px] font-semibold text-ink-3">{label}</dt>
      <dd className="text-[30px] leading-none font-extrabold">{value}</dd>
      {change != null && (
        <dd>
          <Change value={change} vs={vs} upIsGood={upIsGood} />
        </dd>
      )}
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}

export function Swatch({ color, children }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-3">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden />
      {children}
    </span>
  )
}

// Legend beside a donut: the status icon in the slice colour is the key; `share` adds each part's percentage.
export function DonutLegend({ parts, label, share }) {
  return (
    <ul aria-label={label} className="flex min-w-40 flex-1 flex-col gap-3">
      {parts.map((p) => (
        <li key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-ink-3">
            <p.icon className="size-4 shrink-0" style={{ color: p.color }} aria-hidden />
            {p.name}
          </span>
          <span className="text-sm font-extrabold tabular">
            {p.value}
            {share && <span className="ml-1.5 font-semibold text-muted-foreground">{share(p.value)}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

// Recharts arrives with the first chart (as on the home dashboard), so the admin pages load without it.
const chart = (name) => lazy(() => import('./charts').then((m) => ({ default: m[name] })))
const LazyCountChart = chart('CountChart')
const LazyOutcomeDonut = chart('OutcomeDonut')
export function CountChart(props) {
  return (
    <Suspense fallback={<Skeleton className="h-56 rounded-2xl" />}>
      <LazyCountChart {...props} />
    </Suspense>
  )
}
export function OutcomeDonut(props) {
  return (
    <Suspense fallback={<Skeleton className="size-36 shrink-0 rounded-full" />}>
      <LazyOutcomeDonut {...props} />
    </Suspense>
  )
}

// One series: the number is printed beside it, the bar only shows proportion (blue on its lighter step).
export function Meter({ value, max, className }) {
  return (
    <div className={cn('h-2 rounded-r-[4px] bg-secondary', className)} aria-hidden>
      {value > 0 && <div className="h-full rounded-r-[4px] bg-primary" style={{ width: `${(value / max) * 100}%` }} />}
    </div>
  )
}

// Admin page title row: the B2C PageHeader minus the notification and profile chips.
export function AdminHeader({ title, subtitle, back, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-[1_1_320px] items-center gap-3.5">
        {back && (
          <Link to={back} aria-label="Kembali" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-muted">
            <ArrowLeftIcon className="size-5" aria-hidden />
          </Link>
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[22px] leading-tight font-extrabold tracking-[-0.4px] text-pretty lg:text-[30px]">{title}</h1>
          {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}

// A status move reads "Proses Bank → Appraisal", a formula change "v1 → v2", an export its period; other edits
// list the fields they touched.
const auditDetail = (e) =>
  e.action.startsWith('health.')
    ? `v${e.before.version} → v${e.after.version}`
    : e.action === 'application.transition'
    ? `${STATUS_LABEL[e.before?.status] ?? e.before?.status} → ${STATUS_LABEL[e.after?.status] ?? e.after?.status}`
    : e.action === 'application.document_review'
      ? `${e.after.document}: ${e.after.result}`
      : e.action === 'application.stage_note'
        ? `Tahap ${STATUS_LABEL[e.after.status] ?? e.after.status}`
        : e.action === 'report.export'
          ? `${dateShort(e.after.from)} – ${dateShort(e.after.to)} · ${e.after.rows} pengajuan`
          : e.after
            ? fieldList(Object.keys(e.after))
            : null

// "Alamat: Jl. A → Jl. B" per edited field; a value only on one side (a payment marked or undone) reads on its own.
const changeLines = (e) =>
  [...new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})])].map((k) => {
    const was = e.before && k in e.before
    const now = e.after && k in e.after
    return { k, label: FIELD_LABEL[k] ?? k, v: was && now ? `${formatValue(k, e.before[k])} → ${formatValue(k, e.after[k])}` : formatValue(k, now ? e.after[k] : e.before[k]) }
  })

const resourceLabel = (e) => e.resource.label

// Audit events, newest first. `subject` names whose record changed (false for none, or a function for some events
// only); `values` shows each edited field old → new instead of the field names; `withTime` adds the WIB time.
// Events with `actor.role: 'user'` are the user's own edits.
export function AuditList({ events, label, subject = resourceLabel, values = false, withTime = false, empty = 'Belum ada aktivitas admin.' }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul aria-label={label} className="flex flex-col">
      {events.map((e) => {
        const lines = values ? changeLines(e) : []
        const detail = lines.length ? null : auditDetail(e)
        const whose = subject && subject(e)
        return (
          <li key={e.id} className="flex flex-col gap-0.5 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-bold">
                {ACTION_LABEL[e.action] ?? e.action}
                {whose && <span className="font-semibold text-ink-3"> · {whose}</span>}
              </span>
              <span className="text-xs text-muted-foreground tabular">{withTime ? `${at(e.occurredAt)} WIB` : dateShort(e.occurredAt)}</span>
            </span>
            {e.reason && <span className="text-[13px] text-ink-2">“{e.reason}”</span>}
            {lines.map((l) => (
              <span key={l.k} className="text-[13px] break-words text-ink-2">
                <span className="text-ink-3">{l.label}:</span> <span className="tabular">{l.v}</span>
              </span>
            ))}
            <span className="text-xs text-muted-foreground">
              {detail && `${detail} · `}oleh {e.actor.name}
              {e.actor.role === 'user' && ' (user)'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const PUBLISHING = { published: 'Terbit', archived: 'Diarsipkan' }
// Values arrive already masked (NIK); this only makes them readable.
function readable(key, v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak'
  if (typeof v === 'number') return v.toLocaleString('id-ID')
  if (key === 'status') return STATUS_LABEL[v] ?? PUBLISHING[v] ?? v
  if (key === 'formats') return v.map((f) => f.toUpperCase()).join(', ')
  if (key === 'schedule') return formatValue(key, v)
  if (Array.isArray(v) && v.every((x) => typeof x !== 'object')) return v.join(', ')
  return typeof v === 'string' ? v : JSON.stringify(v)
}

// One event's before and after values, folded behind "Lihat detail".
function AuditChanges({ e }) {
  const keys = [...new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})])]
  const head = 'text-xs font-bold text-ink-3'
  return (
    <details className="group">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-primary [&::-webkit-details-marker]:hidden">
        Lihat detail
        <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-2 pt-1">
        {keys.length > 0 && (
          <Table aria-label={`Perubahan ${e.id}`}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={head}>Data</TableHead>
                <TableHead className={head}>Sebelum</TableHead>
                <TableHead className={head}>Sesudah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k}>
                  <TableCell className="py-2 font-semibold text-ink-2">{FIELD_LABEL[k] ?? k}</TableCell>
                  <TableCell className="max-w-64 py-2 break-words whitespace-normal text-ink-2">{readable(k, e.before?.[k])}</TableCell>
                  <TableCell className="max-w-64 py-2 break-words whitespace-normal text-ink-2">{readable(k, e.after?.[k])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <span className="text-xs text-muted-foreground tabular">
          ID {e.id} · request {e.requestId}
        </span>
      </div>
    </details>
  )
}

// Where each audited record lives in the admin (icons follow the admin navigation).
const RESOURCE = {
  application: { icon: FileStackIcon, open: 'Buka pengajuan', to: (id) => `/admin/applications/${id}` },
  user: { icon: UsersIcon, open: 'Buka user', to: (id) => `/admin/users/${id}` },
  product: { icon: LandmarkIcon, open: 'Buka produk', to: (id) => `/admin/products/${id}` },
  bank: { icon: LandmarkIcon, open: 'Buka daftar bank', to: () => '/admin/banks' },
  article: { icon: NewspaperIcon, open: 'Buka artikel', to: (id) => `/admin/articles/${id}` },
  report: { icon: ChartColumnIcon, open: 'Buka laporan', to: () => '/admin/reports' },
  config: { icon: SlidersHorizontalIcon, open: 'Buka konfigurasi', to: () => '/admin/configuration' },
  health_config: { icon: SlidersHorizontalIcon, open: 'Buka formula', to: () => '/admin/configuration/health' },
}

// Recent admin changes as a timeline, newest first: each one opens its record, and its before/after values unfold
// in place.
export function ActivityFeed({ events, label, empty }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ol aria-label={label} className="flex flex-col">
      {events.map((e) => {
        const r = RESOURCE[e.resource.type]
        const detail = auditDetail(e)
        return (
          <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0 not-last:before:absolute not-last:before:top-12 not-last:before:bottom-2 not-last:before:left-5 not-last:before:w-px not-last:before:bg-border">
            <IconBox icon={r?.icon ?? ScrollTextIcon} />
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                <span className="text-[15px] font-bold">
                  {ACTION_LABEL[e.action] ?? e.action}
                  {e.resource.label && <span className="font-semibold text-ink-3"> · {e.resource.label}</span>}
                </span>
                {e.reason && <span className="text-sm text-ink-2">“{e.reason}”</span>}
                <span className="text-xs text-muted-foreground">
                  {detail && `${detail} · `}oleh {e.actor.name} · <span className="tabular">{at(e.occurredAt)} WIB</span>
                </span>
                {(e.before || e.after) && <AuditChanges e={e} />}
              </div>
              {r && (
                <Button asChild size="sm" variant="neutral" className="self-start">
                  <Link to={r.to(e.resource.id)}>
                    {r.open}
                    <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// Edit, then confirm with a reason, inside one dialog (admin plan §4.2). `changed` lists the edited field keys;
// `onSave(reason)` rejects with ApiError, which stays inline (a version conflict asks for a reload).
export function EditDialog({ title, description, form, changed, onSave, onClose, onReload, children }) {
  const [step, setStep] = useState('edit')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const next = form.submit(() => {
    if (!changed.length) return setError({ message: 'Belum ada data yang diubah.' })
    setError(null)
    setStep('confirm')
  })
  const save = async (e) => {
    e.preventDefault()
    if (reason.trim().length < 5) return setError({ field: 'reason', message: 'Isi alasan perubahan (minimal 5 karakter).' })
    setSaving(true)
    setError(null)
    try {
      await onSave(reason.trim())
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }
  const conflict = error?.code === 'CONFLICT_VERSION'
  return (
    <FormDialog open onOpenChange={(open) => !open && !saving && onClose()} title={title} description={step === 'edit' ? description : 'Periksa perubahan lalu tulis alasannya. Alasan ini masuk ke riwayat perubahan.'} className="max-w-[640px]">
      {step === 'edit' ? (
        <form onSubmit={next} noValidate className="flex flex-col gap-5">
          <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
          {children}
          {error && (
            <Notice tone="bad" role="alert">
              {error.message}
            </Notice>
          )}
          <Button type="submit">Lanjut</Button>
        </form>
      ) : (
        <form onSubmit={save} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1 rounded-2xl bg-muted px-4 py-3.5">
            <span className="text-xs font-bold text-ink-3">Yang berubah</span>
            <span className="text-sm font-semibold">{fieldList(changed)}</span>
          </div>
          <TextAreaField label="Alasan perubahan" required rows={3} value={reason} onChange={setReason} error={error?.field === 'reason' ? error.message : undefined} hint="Contoh: koreksi sesuai KTP terbaru." />
          {error && error.field !== 'reason' && (
            <Notice tone="bad" role="alert" action={conflict && onReload && <Button size="xs" onClick={onReload}>Muat ulang data</Button>}>
              {conflict ? 'Data ini sudah diubah sejak halaman dibuka. Muat ulang, lalu ulangi perubahan.' : error.message}
            </Notice>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="neutral" size="md" onClick={() => setStep('edit')} disabled={saving}>
              Kembali
            </Button>
            <Button type="submit" size="md" disabled={saving} aria-busy={saving}>
              {saving && <Spinner />}
              Simpan perubahan
            </Button>
          </div>
        </form>
      )}
    </FormDialog>
  )
}
