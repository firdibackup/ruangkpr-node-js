import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateShort } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ErrorSummary, TextAreaField } from '@/components/shared/fields'
import { FormDialog } from '@/components/shared/dialogs'
import { Chip, Notice, Spinner } from '@/components/shared/ui'
import { STATUS_LABEL } from '@/domains/applications/meta'
import { ACTION_LABEL, fieldList } from './labels'

// Status words carry tone only where it means an outcome: rejected and disbursed; drafts stay quiet.
const STATUS_TONE = { draft: 'mute', rejected: 'bad', disbursed: 'ok' }
export function StatusChip({ status }) {
  return (
    <Chip tone={STATUS_TONE[status] ?? 'info'} className="shrink-0 whitespace-nowrap">
      {STATUS_LABEL[status] ?? status}
    </Chip>
  )
}

export function Kpi({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-card bg-card p-5 shadow-card">
      <dt className="text-[13px] font-semibold text-ink-3">{label}</dt>
      <dd className="text-[30px] leading-none font-extrabold">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
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
    : e.action === 'report.export'
      ? `${dateShort(e.after.from)} – ${dateShort(e.after.to)} · ${e.after.rows} pengajuan`
      : e.after
        ? fieldList(Object.keys(e.after))
        : null

// Audit events, newest first. `subject` adds whose record changed (lists that mix many users).
export function AuditList({ events, label, subject = true, empty = 'Belum ada aktivitas admin.' }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul aria-label={label} className="flex flex-col">
      {events.map((e) => (
        <li key={e.id} className="flex flex-col gap-0.5 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-bold">
              {ACTION_LABEL[e.action] ?? e.action}
              {subject && e.resource.label && <span className="font-semibold text-ink-3"> · {e.resource.label}</span>}
            </span>
            <span className="text-xs text-muted-foreground tabular">{dateShort(e.occurredAt)}</span>
          </span>
          {e.reason && <span className="text-[13px] text-ink-2">“{e.reason}”</span>}
          <span className="text-xs text-muted-foreground">
            {auditDetail(e) && `${auditDetail(e)} · `}oleh {e.actor.name}
          </span>
        </li>
      ))}
    </ul>
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
