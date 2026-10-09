import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, isMock } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { EMPTY, OCCUPATIONS, bpsInput, dateLong, dateShort, labelOf, percentBps, rupiah, tenorLabel, toBps, toInt, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { CheckboxField, DateField, FieldError, FormGrid, MoneyField, NumberField, RateField, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { FormDialog } from '@/components/shared/dialogs'
import { Chip, ErrorPanel, Notice, PageSkeleton, Panel, PanelTitle, Spinner, SummaryRows } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABEL, productName } from '@/domains/applications/meta'
import { PRODUCT_TYPES } from './labels'
import { AdminHeader, StatusChip } from './shared'

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
  additional_docs_requested: 'Minta revisi dokumen',
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

// Opens the stored file in a new tab through a short-lived signed link. The tab opens on the click itself so the
// browser does not treat it as a pop-up; it is pointed at the file once the link arrives.
function OpenDocument({ applicationId, documentType, label }) {
  const [pending, setPending] = useState(false)
  const open = async () => {
    const tab = window.open('', '_blank')
    setPending(true)
    try {
      const url = await api.admin.applications.documentUrl(applicationId, documentType)
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else window.location.assign(url)
    } catch (e) {
      tab?.close()
      toast.error(e.message)
    } finally {
      setPending(false)
    }
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={open} aria-busy={pending} aria-label={`Lihat ${label}`}>
      {pending && <Spinner />}
      Lihat
    </Button>
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
          <Panel>
            <PanelTitle sub={isMock ? 'Mode demo menyimpan metadata saja, tanpa file.' : 'Buka file untuk verifikasi. Link berlaku 5 menit.'}>Dokumen</PanelTitle>
            <ul className="flex flex-col">
              {app.documents.map((d) => (
                <li key={d.type} className={row}>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-bold">
                      {d.label}
                      {!d.required && <span className="font-semibold text-muted-foreground"> · opsional</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.file ? `${d.file.fileName} · ${Math.round(d.file.sizeBytes / 1024)} KB` : 'Belum diunggah'}
                      {d.file?.invalidReason && ` · ${d.file.invalidReason}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {d.file?.path && <OpenDocument applicationId={app.id} documentType={d.type} label={d.label} />}
                    <Chip tone={d.file ? (DOC_STATUS[d.file.status]?.[1] ?? 'mute') : 'mute'} className="whitespace-nowrap">
                      {d.file ? (DOC_STATUS[d.file.status]?.[0] ?? d.file.status) : 'Belum ada'}
                    </Chip>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <ApplicantPanel data={app.data} productType={app.productType} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelTitle>Riwayat status</PanelTitle>
            <ol aria-label="Riwayat status" className="flex flex-col">
              {app.statusHistory.map((h, i) => (
                <li key={`${h.status}-${h.at}`} className={row}>
                  <span className={i === app.statusHistory.length - 1 ? 'text-sm font-extrabold' : 'text-sm font-semibold text-ink-2'}>{STATUS_LABEL[h.status] ?? h.status}</span>
                  <span className="text-xs text-muted-foreground tabular">{dateShort(h.at)}</span>
                </li>
              ))}
            </ol>
          </Panel>
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
  const { application: app, allowedTransitions: moves } = data
  const docLabel = (type) => app.documents.find((d) => d.type === type)?.label ?? type
  return (
    <Panel>
      <PanelTitle>Langkah berikutnya</PanelTitle>
      {app.status === 'additional_docs_requested' && (
        <Notice tone="warn" title="Menunggu user mengunggah ulang dokumen">
          {app.pendingActions.map((p) => `${docLabel(p.documentType)}: ${p.message}`).join(' · ')}
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
        <div className="flex flex-wrap gap-3">
          {moves.map((to) => (
            <Button key={to} size="sm" variant={to === 'rejected' ? 'destructive-soft' : to === 'additional_docs_requested' ? 'outline' : 'default'} onClick={() => onMove(to)}>
              {ACTIONS[to]}
            </Button>
          ))}
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

// One dialog per move: the fields that move needs (admin plan §4.3) plus the internal note for the audit log.
function TransitionDialog({ data, toStatus, onClose, onDone, onReload }) {
  const { application: app } = data
  const s = app.selection ?? {}
  const [reason, setReason] = useState('')
  const [docs, setDocs] = useState([])
  const [message, setMessage] = useState('')
  const [code, setCode] = useState('')
  const [displayReason, setDisplayReason] = useState('')
  const [terms, setTerms] = useState({ loanAmount: String(s.loanAmount ?? ''), tenorMonths: String(s.tenorMonths ?? ''), fixedRate: bpsInput(s.fixedRateBps), fixedMonths: String(s.fixedMonths ?? ''), floatingRate: bpsInput(s.floatingRateBps), akadDate: data.asOf })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const setTerm = (k) => (v) => setTerms((t) => ({ ...t, [k]: v }))
  const fieldError = (k) => error?.fieldErrors?.find((x) => x.field === k)?.message
  const metadata = {
    additional_docs_requested: { documentTypes: docs, message },
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
  const conflict = error?.code === 'CONFLICT_VERSION'
  return (
    <FormDialog open onOpenChange={(open) => !open && !saving && onClose()} title={ACTIONS[toStatus]} description={`${STATUS_LABEL[app.status]} → ${STATUS_LABEL[toStatus]}`} className="max-w-[600px]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {toStatus === 'additional_docs_requested' && (
          <>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-2 text-sm font-semibold text-ink-2">Dokumen yang perlu diunggah ulang</legend>
              {app.documents
                .filter((d) => d.file)
                .map((d) => (
                  <CheckboxField key={d.type} label={d.label} checked={docs.includes(d.type)} onChange={(on) => setDocs((x) => (on ? [...x, d.type] : x.filter((t) => t !== d.type)))} />
                ))}
              {fieldError('documentTypes') && <FieldError>{fieldError('documentTypes')}</FieldError>}
            </fieldset>
            <TextAreaField label="Pesan untuk user" required value={message} onChange={setMessage} error={fieldError('message')} hint="Tampil di tracker dan Activity user." />
          </>
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
        {error && !error.fieldErrors?.length && (
          <Notice tone="bad" role="alert" action={conflict && <Button size="xs" onClick={onReload}>Muat ulang data</Button>}>
            {conflict ? 'Pengajuan ini sudah berubah sejak halaman dibuka. Muat ulang, lalu ulangi.' : error.message}
          </Notice>
        )}
        <Button type="submit" variant={toStatus === 'rejected' ? 'destructive' : 'default'} disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          Simpan status
        </Button>
      </form>
    </FormDialog>
  )
}
