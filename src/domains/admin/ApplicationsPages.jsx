import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleCheckIcon, CircleDashedIcon, ClockIcon, TriangleAlertIcon } from 'lucide-react'
import { api, isMock } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { daysUntil } from '@/calculations/dates'
import { EMPTY, OCCUPATIONS, bpsInput, dateLong, dateShort, labelOf, percentBps, rupiah, tenorLabel, toBps, toInt, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { DOC_REJECT_REASONS, rejectMessage } from '@/data/documentRules'
import { CheckboxField, DateField, FormGrid, MoneyField, NumberField, RateField, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { FormDialog } from '@/components/shared/dialogs'
import { StatusStepper } from '@/components/shared/progress'
import { Chip, ErrorPanel, Notice, PageSkeleton, Panel, PanelTitle, Spinner, SummaryRows } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STAGE_NOTE_STATUSES, STATUS_LABEL, productName, trackerSteps } from '@/domains/applications/meta'
import { PRODUCT_TYPES } from './labels'
import { AdminHeader, DonutLegend, OutcomeDonut, StatusChip } from './shared'

const STATUSES = ['submitted', 'docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed', 'rejected']
const head = 'text-xs font-bold text-ink-3'
const days = (n) => (n === 0 ? 'Hari ini' : `${n} hari`)
const program = (x) => [productName(x), x.bankName, x.productName].filter(Boolean).join(' · ')

export function ApplicationListPage() {
  const [f, setF] = useState({ query: '', status: '', productType: '', bankName: '', pending: false, from: '', to: '' })
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const { data, error, reload } = useResource(
    () => api.admin.applications.list({ query: f.query, status: f.status || undefined, productType: f.productType || undefined, bankName: f.bankName || undefined, pendingAction: f.pending || undefined, from: f.from || undefined, to: f.to || undefined }),
    [JSON.stringify(f)],
  )
  return (
    <>
      <AdminHeader title="Applications" subtitle="Pengajuan yang sudah dikirim user, terlama menunggu di atas." />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <TextField label="Cari pengajuan" type="search" placeholder="Nama pemohon atau ID pengajuan" value={f.query} onChange={set('query')} />
          <SelectField label="Status" placeholder="Semua" value={f.status} onChange={set('status')} options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
          <SelectField label="Jenis" placeholder="Semua" value={f.productType} onChange={set('productType')} options={PRODUCT_TYPES} />
          <SelectField label="Bank" placeholder="Semua" value={f.bankName} onChange={set('bankName')} options={(data?.banks ?? []).map((b) => ({ value: b, label: b }))} />
        </div>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto]">
          <DateField label="Diajukan dari" value={f.from} onChange={set('from')} />
          <DateField label="Sampai" value={f.to} onChange={set('to')} />
          <CheckboxField label="Hanya yang menunggu dokumen user" checked={f.pending} onChange={set('pending')} />
        </div>
      </div>
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <Panel>
          <p className="text-sm font-semibold text-ink-3">{data.items.length} pengajuan</p>
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada pengajuan yang cocok dengan filter ini.</p>
          ) : (
            <Table aria-label="Antrean pengajuan">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={head}>Pemohon & program</TableHead>
                  <TableHead className={head}>Status</TableHead>
                  <TableHead className={head}>Diajukan</TableHead>
                  <TableHead className={`${head} text-right`}>Di status ini</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="min-w-56 py-3 whitespace-normal">
                      <span className="flex flex-col">
                        <Link to={`/admin/applications/${a.id}`} className="w-fit font-bold text-primary underline-offset-4 hover:underline">
                          {a.userName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{program(a)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusChip status={a.status} />
                    </TableCell>
                    <TableCell className="py-3 text-ink-2 tabular">{dateShort(a.submittedAt)}</TableCell>
                    <TableCell className="py-3 text-right font-bold tabular">{days(a.waitingDays)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      )}
    </>
  )
}

const ACTIONS = {
  docs_verification: 'Mulai verifikasi dokumen',
  additional_docs_requested: 'Kirim permintaan revisi ke user',
  bank_processing: 'Teruskan ke bank',
  appraisal: 'Masuk tahap appraisal',
  approved: 'Tandai disetujui bank',
  old_mortgage_settlement: 'Mulai pelunasan KPR lama',
  akad: 'Catat akad',
  disbursed: 'Tandai sudah cair',
  rejected: 'Tolak pengajuan',
}
const DOC_STATUS = { uploaded: ['Terunggah', 'info'], verified: ['Terverifikasi', 'ok'], needs_update: ['Perlu diperbarui', 'warn'] }
const row = 'flex items-center justify-between gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0'
// The Button's `disabled:` look for an aria-disabled button (it stays focusable), as PrimaryWizard does.
const looksDisabled = 'border-transparent bg-border text-ink-3 hover:bg-border'

// Required documents by where they stand, for the ring at the top of the documents panel.
const DOC_PARTS = [
  { key: 'verified', name: 'Terverifikasi', color: 'var(--chart-ok)', icon: CircleCheckIcon },
  { key: 'waiting', name: 'Menunggu dicek', color: 'var(--chart-step)', icon: ClockIcon },
  { key: 'fix', name: 'Perlu diperbarui', color: 'var(--chart-warn)', icon: TriangleAlertIcon },
  { key: 'missing', name: 'Belum diunggah', color: 'var(--muted-foreground)', icon: CircleDashedIcon },
]
const docState = (f) => (!f ? 'missing' : f.review || f.status === 'needs_update' ? 'fix' : f.status === 'verified' ? 'verified' : 'waiting')

// [label, chip tone]; a drafted rejection outranks the stored status until it is sent.
const docChip = (f) => (!f ? ['Belum ada', 'mute'] : f.review ? ['Ditolak · belum dikirim', 'bad'] : (DOC_STATUS[f.status] ?? [f.status, 'mute']))

// Per-document review while verifying (spec 2026-10-13 §4.1): Sesuai saves at once; Tolak drafts a reason the user
// only sees once the team sends the revision request.
function DocumentsPanel({ data, onSaved, onReload, onSend }) {
  const { application: app } = data
  const reviewing = app.status === 'docs_verification'
  const [busy, setBusy] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const required = app.documents.filter((d) => d.required)
  const checked = required.filter((d) => d.file?.status === 'verified' || d.file?.review).length
  const drafts = app.documents.filter((d) => d.file?.review).length
  const parts = DOC_PARTS.map((p) => ({ ...p, value: required.filter((d) => docState(d.file) === p.key).length }))
  const approve = async (d) => {
    if (busy || d.file.status === 'verified') return
    setBusy(d.type)
    try {
      onSaved(await api.admin.applications.reviewDocument(app.id, { documentType: d.type, result: 'ok', expectedVersion: app.version }))
    } catch (e) {
      toast.error(e.message)
      if (e.code === 'CONFLICT_VERSION') onReload()
    } finally {
      setBusy(null)
    }
  }
  return (
    <Panel>
      <PanelTitle sub={isMock ? 'Mode demo menyimpan metadata saja, tanpa file.' : 'Unduh file untuk verifikasi.'}>Dokumen</PanelTitle>
      {required.length > 0 && (
        <div className="flex flex-wrap items-center gap-5">
          <OutcomeDonut parts={parts} total={`${parts[0].value}/${required.length}`} unit="terverifikasi" desc={`Dokumen wajib: ${parts.map((p) => `${p.name} ${p.value}`).join(', ')}.`} />
          <DonutLegend parts={parts} label="Status dokumen wajib" />
        </div>
      )}
      <ul className="flex flex-col">
        {app.documents.map((d) => {
          const [chip, tone] = docChip(d.file)
          return (
            <li key={d.type} className={`${row} flex-wrap`}>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold">
                  {d.label}
                  {!d.required && <span className="font-semibold text-muted-foreground"> · opsional</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.file ? `${d.file.fileName} · ${Math.round(d.file.sizeBytes / 1024)} KB` : 'Belum diunggah'}
                  {d.file?.invalidReason && ` · ${d.file.invalidReason}`}
                </span>
                {d.file?.review && <span className="text-xs font-semibold text-danger">↳ {rejectMessage(d.file.review)}</span>}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {d.file?.path && <DownloadDocument applicationId={app.id} documentType={d.type} label={d.label} />}
                {reviewing && d.file && (
                  <>
                    {/* aria-disabled, not disabled: the button keeps keyboard focus while it saves and once it is done. */}
                    <Button type="button" size="sm" variant="outline" onClick={() => approve(d)} aria-disabled={!!busy || d.file.status === 'verified'} className={busy || d.file.status === 'verified' ? looksDisabled : ''} aria-busy={busy === d.type} aria-label={`Sesuai ${d.label}`}>
                      {busy === d.type && <Spinner />}
                      Sesuai
                    </Button>
                    <Button type="button" size="sm" variant="destructive-soft" onClick={() => !busy && setRejecting(d)} aria-disabled={!!busy} className={busy ? looksDisabled : ''} aria-label={`Tolak ${d.label}`}>
                      Tolak
                    </Button>
                  </>
                )}
                <Chip tone={tone} className="whitespace-nowrap">
                  {chip}
                </Chip>
              </span>
            </li>
          )
        })}
      </ul>
      {reviewing && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm font-semibold text-ink-3">
            {checked} dari {required.length} dokumen wajib diperiksa{drafts > 0 && ` · ${drafts} ditolak`}
          </span>
          <Button type="button" size="sm" variant="outline" disabled={!drafts || !!busy} onClick={onSend}>
            Kirim permintaan revisi ke user
          </Button>
        </div>
      )}
      {rejecting && (
        <RejectDialog
          app={app}
          doc={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(next) => {
            onSaved(next)
            setRejecting(null)
          }}
          onReload={() => {
            setRejecting(null)
            onReload()
          }}
        />
      )}
    </Panel>
  )
}

// Shared by RejectDialog, StageNotePanel and TransitionDialog: a CONFLICT_VERSION notice offers reload, any other
// save error just shows its message.
function ErrorNotice({ error, onReload }) {
  if (!error || error.fieldErrors?.length) return null
  const conflict = error.code === 'CONFLICT_VERSION'
  return (
    <Notice tone="bad" role="alert" action={conflict && <Button size="xs" onClick={onReload}>Muat ulang data</Button>}>
      {conflict ? 'Pengajuan ini sudah berubah sejak halaman dibuka. Muat ulang, lalu ulangi.' : error.message}
    </Notice>
  )
}

function RejectDialog({ app, doc, onClose, onDone, onReload }) {
  const [reasonCode, setReasonCode] = useState(doc.file.review?.reasonCode ?? '')
  const [note, setNote] = useState(doc.file.review?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldError = (k) => error?.fieldErrors?.find((x) => x.field === k)?.message
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onDone(await api.admin.applications.reviewDocument(app.id, { documentType: doc.type, result: 'rejected', reasonCode, note, expectedVersion: app.version }))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }
  return (
    <FormDialog open onOpenChange={(open) => !open && !saving && onClose()} title={`Tolak ${doc.label}`} description="Belum terkirim ke user sampai kamu menekan Kirim permintaan revisi ke user." className="max-w-[520px]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <SelectField label="Alasan" required value={reasonCode} onChange={setReasonCode} options={DOC_REJECT_REASONS} error={fieldError('reasonCode')} />
        <TextAreaField label="Catatan untuk user" required={reasonCode === 'other'} optional={reasonCode !== 'other'} value={note} onChange={setNote} error={fieldError('note')} hint="Tampil di Home dan tracker user setelah dikirim." />
        <ErrorNotice error={error} onReload={onReload} />
        <Button type="submit" variant="destructive" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          Simpan penolakan
        </Button>
      </form>
    </FormDialog>
  )
}

// Downloads the stored file through a short-lived signed link. The link answers with Content-Disposition: attachment,
// so following it saves the file and the page stays where it is.
function DownloadDocument({ applicationId, documentType, label }) {
  const [pending, setPending] = useState(false)
  const download = async () => {
    setPending(true)
    try {
      window.location.assign(await api.admin.applications.documentUrl(applicationId, documentType))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setPending(false)
    }
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={download} disabled={pending} aria-busy={pending} aria-label={`Unduh ${label}`}>
      {pending && <Spinner />}
      Unduh
    </Button>
  )
}

const TERMINAL = ['disbursed', 'rejected']
const span = (n) => (n === 0 ? '< 1 hari' : `${n} hari`)
const dayOf = (iso) => iso.slice(0, 10)

// The tracker diagram the user sees, plus how long the whole application has taken.
function StagesPanel({ app, asOf }) {
  const closed = TERMINAL.includes(app.status)
  const n = app.submittedAt && daysUntil({ fromDate: dayOf(app.submittedAt), targetDate: closed ? dayOf(app.statusHistory.at(-1).at) : asOf })
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <PanelTitle sub="Diagram yang sama dengan tracker di aplikasi user.">Tahapan pengajuan</PanelTitle>
        {n != null && (
          <span className="text-sm font-bold text-ink-3 tabular">
            {closed ? `${span(n)} sampai ${STATUS_LABEL[app.status].toLowerCase()}` : `${span(n)} sejak diajukan`}
          </span>
        )}
      </div>
      <StatusStepper steps={trackerSteps(app)} />
    </Panel>
  )
}

// Each status with how long the application stayed in it; the one still running counts up to today and stands out.
function HistoryPanel({ app, asOf }) {
  const spans = app.statusHistory.map((h, i) => {
    const next = app.statusHistory[i + 1]
    const open = !next && !TERMINAL.includes(h.status)
    return { ...h, open, days: next || open ? daysUntil({ fromDate: dayOf(h.at), targetDate: next ? dayOf(next.at) : asOf }) : null }
  })
  const max = Math.max(1, ...spans.map((x) => x.days ?? 0))
  return (
    <Panel>
      <PanelTitle sub="Lama di tiap status; yang sedang berjalan dihitung sampai hari ini.">Riwayat status</PanelTitle>
      <ol aria-label="Riwayat status" className="flex flex-col gap-3.5">
        {spans.map((x) => (
          <li key={`${x.status}-${x.at}`} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className={x.open ? 'text-sm font-extrabold' : 'text-sm font-semibold text-ink-2'}>{STATUS_LABEL[x.status] ?? x.status}</span>
              <span className="text-xs text-muted-foreground tabular">
                {dateShort(x.at)}
                {x.days != null && <span className={x.open ? 'font-bold text-primary' : undefined}> · {x.open ? `berjalan ${span(x.days)}` : span(x.days)}</span>}
              </span>
            </span>
            {x.days != null && (
              <span className="h-2 rounded-r-[4px] bg-secondary" aria-hidden>
                {x.days > 0 && <span className={`block h-full rounded-r-[4px] ${x.open ? 'bg-primary' : 'bg-step-current'}`} style={{ width: `${(x.days / max) * 100}%` }} />}
              </span>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  )
}

export function ApplicationDetailPage() {
  const { applicationId } = useParams()
  const { data, error, reload, setData } = useResource(() => api.admin.applications.get(applicationId), [applicationId])
  const [moving, setMoving] = useState(null)
  if (!data) {
    return (
      <>
        <AdminHeader title="Detail pengajuan" back="/admin/applications" />
        {error ? <ErrorPanel onRetry={reload} title={error.code === 'RESOURCE_NOT_FOUND' ? 'Pengajuan tidak ditemukan.' : undefined} /> : <PageSkeleton />}
      </>
    )
  }
  const { user, application: app } = data
  const s = app.selection ?? {}
  return (
    <>
      <AdminHeader title={user.name} subtitle={`${program({ ...app, bankName: s.bankName, productName: s.productName })} · ${app.id}`} back="/admin/applications" actions={<StatusChip status={app.status} />} />
      <NextStep data={data} onMove={setMoving} />
      <StagesPanel app={app} asOf={data.asOf} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelTitle>Ringkasan</PanelTitle>
            <SummaryRows
              rows={[
                {
                  k: 'Pemohon',
                  v: (
                    <Link to={`/admin/users/${user.id}`} className="text-primary underline-offset-4 hover:underline">
                      {user.name}
                    </Link>
                  ),
                },
                { k: 'Kontak', v: user.contact },
                { k: 'Plafon', v: rupiah(s.loanAmount) },
                { k: 'Tenor', v: s.tenorMonths ? tenorLabel(s.tenorMonths) : EMPTY },
                { k: 'Bunga fixed', v: s.fixedRateBps ? `${percentBps(s.fixedRateBps)} · ${s.fixedMonths} bulan` : EMPTY },
                { k: 'Estimasi floating', v: percentBps(s.floatingRateBps) },
                { k: 'Estimasi cicilan', v: rupiah(s.estimatedPayment) },
                { k: 'Diajukan', v: app.submittedAt ? dateLong(app.submittedAt) : EMPTY },
              ]}
            />
          </Panel>
          {app.finalTerms && (
            <Panel>
              <PanelTitle sub="Dipakai untuk KPR aktif user saat dana cair.">Angka final akad</PanelTitle>
              <SummaryRows
                rows={[
                  { k: 'Plafon final', v: rupiah(app.finalTerms.loanAmount) },
                  { k: 'Tenor', v: tenorLabel(app.finalTerms.tenorMonths) },
                  { k: 'Bunga fixed', v: `${percentBps(app.finalTerms.fixedRateBps)} · ${app.finalTerms.fixedMonths} bulan` },
                  { k: 'Estimasi floating', v: percentBps(app.finalTerms.floatingRateBps) },
                  { k: 'Tanggal akad', v: dateLong(app.finalTerms.akadDate) },
                  { k: 'Cicilan awal', v: rupiah(app.finalTerms.payment) },
                ]}
              />
            </Panel>
          )}
          <DocumentsPanel data={data} onSaved={setData} onReload={reload} onSend={() => setMoving('additional_docs_requested')} />
          <ApplicantPanel data={app.data} productType={app.productType} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {/* Keyed on the saved note too: after a reload with another admin's note, the form starts from that note. */}
          {STAGE_NOTE_STATUSES.includes(app.status) && <StageNotePanel key={`${app.status}:${app.stageNotes[app.status]?.updatedAt ?? ''}`} data={data} onSaved={setData} onReload={reload} />}
          <HistoryPanel app={app} asOf={data.asOf} />
          <NotesPanel data={data} onSaved={setData} />
        </div>
      </div>
      {moving && (
        <TransitionDialog
          data={data}
          toStatus={moving}
          onClose={() => setMoving(null)}
          onReload={() => {
            setMoving(null)
            reload()
          }}
          onDone={(next) => {
            setData(next)
            setMoving(null)
            toast(`Status diubah ke ${STATUS_LABEL[next.application.status]}.`)
          }}
        />
      )}
    </>
  )
}

function NextStep({ data, onMove }) {
  const { application: app, allowedTransitions } = data
  const moves = allowedTransitions.filter((to) => to !== 'additional_docs_requested') // sent from the Dokumen panel
  const docsReady = app.documents.every((d) => (!d.required || d.file?.status === 'verified') && !d.file?.review)
  const docLabel = (type) => app.documents.find((d) => d.type === type)?.label ?? type
  return (
    <Panel>
      <PanelTitle>Langkah berikutnya</PanelTitle>
      {app.status === 'additional_docs_requested' && (
        <Notice tone="warn" title="Menunggu user mengunggah ulang dokumen">
          {app.pendingActions.map((p) => `${docLabel(p.documentType)} — ${p.message}`).join(' · ')}
        </Notice>
      )}
      {app.status === 'rejected' && (
        <Notice tone="bad" title="Pengajuan ditolak">
          {app.rejection?.displayReason}
        </Notice>
      )}
      {app.status === 'disbursed' && (
        <Notice tone="ok" title="Pengajuan selesai">
          KPR user sudah aktif dari angka final akad.
        </Notice>
      )}
      {moves.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {moves.map((to) => (
            <Button key={to} size="sm" variant={to === 'rejected' ? 'destructive-soft' : 'default'} onClick={() => onMove(to)} disabled={to === 'bank_processing' && !docsReady} aria-describedby={to === 'bank_processing' && !docsReady ? 'bank-docs-hint' : undefined}>
              {ACTIONS[to]}
            </Button>
          ))}
          {moves.includes('bank_processing') && !docsReady && (
            <span id="bank-docs-hint" className="text-sm text-muted-foreground">
              Semua dokumen wajib harus Sesuai.
            </span>
          )}
        </div>
      )}
    </Panel>
  )
}

function ApplicantPanel({ data, productType }) {
  const p = data.personal ?? {}
  const e = data.employment ?? {}
  const debts = (e.vehicleDebt ?? 0) + (e.cardDebt ?? 0) + (e.otherDebt ?? 0)
  return (
    <Panel>
      <PanelTitle sub="Snapshot saat pengajuan dikirim. NIK ditampilkan tersamar.">Data pemohon</PanelTitle>
      <SummaryRows
        rows={[
          { k: 'Nama sesuai KTP', v: p.fullName || EMPTY },
          { k: 'NIK', v: p.nik || EMPTY },
          { k: 'Tanggal lahir', v: p.birthDate ? dateLong(p.birthDate) : EMPTY },
          { k: 'Pekerjaan', v: e.occupation ? labelOf(OCCUPATIONS, e.occupation) : EMPTY },
          { k: 'Penghasilan bulanan', v: rupiah(e.monthlyIncome) },
          { k: 'Cicilan lain per bulan', v: rupiah(debts) },
          productType === 'primary'
            ? { k: 'Harga properti', v: rupiah(data.property?.price) }
            : { k: 'Sisa pokok KPR lama', v: rupiah(data.oldLoan?.outstanding) },
          { k: 'Alamat properti', v: data.property?.address || EMPTY },
        ]}
      />
    </Panel>
  )
}

function NotesPanel({ data, onSaved }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const add = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      onSaved(await api.admin.applications.addNote(data.application.id, { text }))
      setText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Panel>
      <PanelTitle sub="Hanya terlihat oleh tim admin, tidak pernah dikirim ke user.">Catatan internal</PanelTitle>
      <form onSubmit={add} noValidate className="flex flex-col gap-3">
        <TextAreaField label="Catatan baru" rows={2} value={text} onChange={setText} error={error || undefined} />
        <Button type="submit" variant="outline" size="sm" className="w-fit" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          Tambah catatan
        </Button>
      </form>
      {data.notes.length > 0 && (
        <ul aria-label="Catatan internal" className="flex flex-col">
          {data.notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-0.5 border-b border-line py-3 last:border-b-0">
              <span className="text-sm text-ink-2">{n.text}</span>
              <span className="text-xs text-muted-foreground">
                {n.author.name} · {dateShort(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// What the team agreed with the user (on WhatsApp) for the current stage; the user always sees the latest save.
function StageNotePanel({ data, onSaved, onReload }) {
  const { application: app } = data
  const note = app.stageNotes[app.status]
  const appraisal = app.status === 'appraisal'
  const [message, setMessage] = useState(note?.message ?? '')
  const [schedule, setSchedule] = useState(note?.schedule ?? { date: '', time: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const setSlot = (k) => (v) => setSchedule((s) => ({ ...s, [k]: v }))
  const fieldError = (k) => error?.fieldErrors?.find((x) => x.field === k)?.message
  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(await api.admin.applications.saveStageNote(app.id, { message, schedule: appraisal ? schedule : null, expectedVersion: app.version }))
      toast('Info untuk user tersimpan.')
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }
  const empty = appraisal ? 'Belum diisi. User melihat: jadwal menunggu konfirmasi tim via WhatsApp.' : 'Belum diisi. User belum melihat info tambahan.'
  return (
    <Panel>
      <PanelTitle sub={note ? `Terakhir diubah ${dateShort(note.updatedAt)}` : empty}>Info untuk user · {STATUS_LABEL[app.status]}</PanelTitle>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        {appraisal && (
          <>
            <DateField label="Tanggal appraisal" required value={schedule.date} onChange={setSlot('date')} error={fieldError('date')} />
            <TextField label="Jam appraisal" type="time" required value={schedule.time} onChange={setSlot('time')} error={fieldError('time')} />
            <TextField label="Lokasi appraisal" required value={schedule.location} onChange={setSlot('location')} error={fieldError('location')} />
          </>
        )}
        <TextAreaField label={appraisal ? 'Catatan untuk user' : 'Pesan untuk user'} required={!appraisal} optional={appraisal} rows={3} value={message} onChange={setMessage} error={fieldError('message')} hint="Hasil kesepakatan dengan user, mis. dari WhatsApp. Tampil di Home dan tracker user." />
        <ErrorNotice
          error={error}
          onReload={() => {
            setError(null)
            onReload()
          }}
        />
        <Button type="submit" variant="outline" size="sm" className="w-fit" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          Simpan info
        </Button>
      </form>
    </Panel>
  )
}

// One dialog per move: the fields that move needs (admin plan §4.3) plus the internal note for the audit log.
function TransitionDialog({ data, toStatus, onClose, onDone, onReload }) {
  const { application: app } = data
  const s = app.selection ?? {}
  const [reason, setReason] = useState('')
  const [code, setCode] = useState('')
  const [displayReason, setDisplayReason] = useState('')
  const [terms, setTerms] = useState({ loanAmount: String(s.loanAmount ?? ''), tenorMonths: String(s.tenorMonths ?? ''), fixedRate: bpsInput(s.fixedRateBps), fixedMonths: String(s.fixedMonths ?? ''), floatingRate: bpsInput(s.floatingRateBps), akadDate: data.asOf })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const setTerm = (k) => (v) => setTerms((t) => ({ ...t, [k]: v }))
  const fieldError = (k) => error?.fieldErrors?.find((x) => x.field === k)?.message
  const metadata = {
    rejected: { code, displayReason },
    akad: { finalTerms: { loanAmount: toMoney(terms.loanAmount), tenorMonths: toInt(terms.tenorMonths), fixedRateBps: toBps(terms.fixedRate), fixedMonths: toInt(terms.fixedMonths), floatingRateBps: toBps(terms.floatingRate), akadDate: terms.akadDate } },
  }[toStatus]
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onDone(await api.admin.applications.transition(app.id, { toStatus, reason, expectedVersion: app.version, metadata }))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }
  return (
    <FormDialog open onOpenChange={(open) => !open && !saving && onClose()} title={ACTIONS[toStatus]} description={`${STATUS_LABEL[app.status]} → ${STATUS_LABEL[toStatus]}`} className="max-w-[600px]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {toStatus === 'additional_docs_requested' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink-2">Dikirim ke user untuk diunggah ulang</span>
            <ul aria-label="Dokumen yang ditolak" className="flex flex-col gap-1.5">
              {app.documents
                .filter((d) => d.file?.review)
                .map((d) => (
                  <li key={d.type} className="text-sm">
                    <span className="font-bold">{d.label}</span> — {rejectMessage(d.file.review)}
                  </li>
                ))}
            </ul>
          </div>
        )}
        {toStatus === 'rejected' && (
          <>
            <SelectField label="Alasan penolakan" required value={code} onChange={setCode} options={data.rejectionCodes.map((c) => ({ value: c.code, label: c.label }))} error={fieldError('code')} />
            <TextAreaField label="Penjelasan untuk user" required value={displayReason} onChange={setDisplayReason} error={fieldError('displayReason')} hint="Tampil di tracker user; tulis dengan bahasa yang mudah dipahami." />
          </>
        )}
        {toStatus === 'akad' && (
          <FormGrid>
            <MoneyField label="Plafon final" required value={terms.loanAmount} onChange={setTerm('loanAmount')} error={fieldError('loanAmount')} />
            <NumberField label="Tenor" suffix="bulan" required value={terms.tenorMonths} onChange={setTerm('tenorMonths')} error={fieldError('tenorMonths')} />
            <RateField label="Bunga fixed" required value={terms.fixedRate} onChange={setTerm('fixedRate')} error={fieldError('fixedRateBps')} />
            <NumberField label="Masa fixed" suffix="bulan" required value={terms.fixedMonths} onChange={setTerm('fixedMonths')} error={fieldError('fixedMonths')} />
            <RateField label="Estimasi bunga floating" required value={terms.floatingRate} onChange={setTerm('floatingRate')} error={fieldError('floatingRateBps')} />
            <DateField label="Tanggal akad" required value={terms.akadDate} onChange={setTerm('akadDate')} error={fieldError('akadDate')} />
          </FormGrid>
        )}
        <TextAreaField label="Catatan perubahan status" required value={reason} onChange={setReason} error={fieldError('reason')} hint="Internal, masuk ke audit log." />
        <ErrorNotice error={error} onReload={onReload} />
        <Button type="submit" variant={toStatus === 'rejected' ? 'destructive' : 'default'} disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          Simpan status
        </Button>
      </form>
    </FormDialog>
  )
}
