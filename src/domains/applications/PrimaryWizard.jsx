import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BriefcaseIcon, FileTextIcon, HandCoinsIcon, HouseIcon, LandmarkIcon, PencilIcon, UserIcon } from 'lucide-react'
import { api } from '@/data/api'
import { uploadHint } from '@/data/documentRules'
import { useResource } from '@/lib/hooks'
import { dateLong, labelOf, percentBps, percentRatio, rupiah, tenorLabel, GENDERS, MARITAL, OCCUPATIONS, PROPERTY_TYPES } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { CheckboxField } from '@/components/shared/fields'
import { ConfirmDialog, UnsavedChangesGuard } from '@/components/shared/dialogs'
import { WizardProgress } from '@/components/shared/progress'
import { UploadRow } from '@/components/shared/UploadRow'
import { Chip, Disclaimer, ErrorPanel, IconBox, Notice, Panel, PageSkeleton, ProgressBar, Spinner, SummaryRows } from '@/components/shared/ui'
import { activeApplication } from '@/domains/home/selectHomeState'
import { PRIMARY_PHASES, PRIMARY_STEPS, primaryProgress, productName, resumePath } from './meta'
import { PrimaryDetailsStep } from './PrimaryDetailsStep'
import { PrimaryCompareStep, PrimaryProgramDetail } from './PrimaryCompare'
import { PrimaryMilestone } from './PrimaryMilestone'

const HEADERS = {
  1: ['Data diri', 'KPR Primary · isi sesuai KTP'],
  2: ['Pekerjaan & penghasilan', 'KPR Primary · dasar hitung kemampuan cicilan'],
  3: ['Properti yang dibeli', 'KPR Primary · rumah baru atau rumah bekas'],
  4: ['Rencana pinjaman', 'KPR Primary · uang muka, plafon & tenor'],
  5: ['Upload dokumen', 'KPR Primary'],
  6: ['Bandingkan program bank', 'KPR Primary · 1 pengajuan = 1 program bank'],
  7: ['Review & submit', 'Periksa lagi sebelum dikirim ke bank.'],
}
const LAST = PRIMARY_STEPS.length
const PHASE_LABELS = PRIMARY_PHASES.map((p) => p.label)

export function PrimaryWizard() {
  const { step, productId } = useParams()
  const n = Number(step)
  const { data: snap, error, reload, setData } = useResource(() => api.dashboard.getSnapshot())
  const navigate = useNavigate()
  const location = useLocation()
  const app = snap ? activeApplication(snap.applications) : null
  const primary = app?.productType === 'primary' ? app : null

  useEffect(() => {
    if (snap && n > 1 && !primary) toast('Draft pengajuan tidak ditemukan.')
  }, [snap, n, primary])

  if (!(n >= 1 && n <= LAST)) return <Navigate to="/apply/primary/1" replace />
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  if (app && app.productType !== 'primary') return <OtherDraftNotice app={app} onDeleted={reload} />
  if (primary && primary.status !== 'draft') return <Navigate to="/my-kpr/application" replace />
  if (n > 1 && !primary) return <Navigate to="/" replace />
  if (primary && n > primary.currentStep) return <Navigate to={`/apply/primary/${primary.currentStep}`} replace />

  const setApp = (next) => setData((s) => ({ ...s, applications: s.applications.map((a) => (a.id === next.id ? next : a)) }))
  const fromReview = location.state?.from === 'review'
  // Set only right after saving screen 2 / 4; shown on the next phase's first screen (3 / 5).
  const milestone = !productId && location.state?.milestone
  const go = (to, opts) => navigate(to, opts)
  const [title, subtitle] = milestone ? [`Tahap ${milestone} selesai`, 'KPR Primary · hasil dari data kamu'] : HEADERS[n]
  const back = fromReview ? `/apply/primary/${LAST}` : n === 1 ? '/' : `/apply/primary/${n - 1}`
  const shown = primaryProgress(n)
  const furthest = primaryProgress(Math.max(n, Math.min(primary?.currentStep ?? 1, LAST)))

  return (
    <>
      <PageHeader title={productId ? 'Detail program' : title} subtitle={productId ? 'Simulasi cicilan' : subtitle} back={productId ? '/apply/primary/6' : back} />
      <WizardProgress label={`Bagian ${shown.phase} dari 3 · ${shown.label}`} steps={PHASE_LABELS} current={shown.phase} reached={furthest.position} percent={furthest.percent} />
      {milestone && <PrimaryMilestone milestone={milestone} app={primary} go={go} />}
      {!milestone && n <= 4 && (
        <PrimaryDetailsStep
          key={n}
          step={n}
          app={primary}
          snapshot={snap}
          onCreated={(created) => setData((s) => ({ ...s, applications: [created, ...s.applications] }))}
          onSaved={setApp}
          fromReview={fromReview}
          go={go}
        />
      )}
      {!milestone && n === 5 && <DocumentsStep app={primary} onChange={setApp} fromReview={fromReview} go={go} uploadRules={snap.config.upload} />}
      {n === 6 && !productId && <PrimaryCompareStep app={primary} go={go} fromReview={fromReview} />}
      {n === 6 && productId && <PrimaryProgramDetail app={primary} productId={productId} onSaved={setApp} go={go} />}
      {n === 7 && <ReviewStep app={primary} go={go} />}
    </>
  )
}

function OtherDraftNotice({ app, onDeleted }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <PageHeader title="Pengajuan lain masih aktif" back="/" />
      <Panel>
        <p className="text-sm leading-[21px] text-ink-3">
          Kamu masih punya pengajuan <b>{productName(app)}</b>. MVP mendukung satu pengajuan aktif. Lanjutkan pengajuan itu, atau hapus draft-nya untuk memulai KPR Primary.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="md">
            <Link to={app.status === 'draft' ? resumePath(app) : '/my-kpr/application'}>Lanjutkan {productName(app)}</Link>
          </Button>
          {app.status === 'draft' && (
            <Button variant="destructive-soft" size="md" onClick={() => setConfirm(true)}>
              Hapus draft &amp; mulai KPR Primary
            </Button>
          )}
        </div>
      </Panel>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Hapus draft pengajuan?"
        body={`Draft ${productName(app)} dan dokumennya akan dihapus permanen.`}
        onConfirm={async () => {
          await api.applications.cancel(app.id)
          toast('Draft dihapus.')
          onDeleted()
        }}
      />
    </>
  )
}

export function DocumentsStep({ app, onChange, fromReview, go, uploadRules, nextPath = '/apply/primary/6', backPath = '/apply/primary/4' }) {
  const [uploading, setUploading] = useState(0)
  const [demoPending, setDemoPending] = useState(false)
  const docs = app.requiredDocuments
  const required = docs.filter((d) => d.required)
  const done = required.filter((d) => ['uploaded', 'verified'].includes(app.documents[d.type]?.status)).length
  const complete = done === required.length

  const upload = (type) => async (file, onProgress) => {
    setUploading((n) => n + 1)
    try {
      const next = await api.applications.uploadDocument(app.id, { documentType: type, file }, { onProgress })
      onChange(next)
    } finally {
      setUploading((n) => n - 1)
    }
  }
  const fillDemo = async () => {
    setDemoPending(true)
    try {
      let latest = app
      for (const d of required) {
        if (['uploaded', 'verified'].includes(latest.documents[d.type]?.status)) continue
        latest = await api.applications.uploadDocument(app.id, { documentType: d.type, file: { name: `${d.type.replaceAll('_', '-')}-contoh.pdf`, size: 420_000, type: 'application/pdf' } })
      }
      onChange(latest)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDemoPending(false)
    }
  }
  const [saving, setSaving] = useState(false)
  // "Lanjutkan" is the autosave point for this step (files themselves are saved per upload).
  const next = async () => {
    if (!complete || saving) return
    setSaving(true)
    try {
      onChange(await api.applications.saveStep(app.id, { step: 5, values: {} }))
      go(fromReview ? '/apply/primary/7' : nextPath)
    } catch (e) {
      toast.error(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <UnsavedChangesGuard when={uploading > 0} />
        <Panel>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold">Dokumen pengajuan</h2>
            <p className="text-[13px] leading-5 text-muted-foreground">Pratinjau dokumen tidak ditampilkan demi keamanan.</p>
          </div>
          <div className="flex flex-col gap-3">
            {docs.map((d) => (
              <UploadRow key={d.type} doc={d} state={app.documents[d.type]} onUpload={upload(d.type)} rules={uploadRules} />
            ))}
          </div>
        </Panel>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="neutral" onClick={() => go(fromReview ? '/apply/primary/7' : backPath)}>
            Kembali
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            {!complete && <span className="text-center text-xs text-muted-foreground">Upload semua dokumen wajib untuk lanjut.</span>}
            <Button onClick={next} aria-disabled={!complete} aria-busy={saving} className={!complete ? 'bg-border text-ink-3 hover:bg-border' : ''}>
              {saving && <Spinner />}
              {fromReview ? 'Simpan & kembali ke Review' : 'Lanjutkan'}
            </Button>
          </div>
        </div>
      </div>
      {/* Same counter aside as the Take Over documents step. */}
      <aside className="flex flex-col gap-3.5 rounded-card bg-card p-6 shadow-card xl:sticky xl:top-6">
        <span className="text-[13px] font-extrabold text-ink-3">Dokumen wajib</span>
        <span className="text-[30px] font-extrabold" role="status">
          {done} <span className="text-base text-muted-foreground">dari {required.length} terunggah</span>
        </span>
        <ProgressBar value={(done / Math.max(1, required.length)) * 100} label="Dokumen wajib terunggah" barClassName="bg-success-strong" />
        <p className="text-[13px] leading-5 text-ink-3">{uploadHint(uploadRules)} per file. File tersimpan otomatis begitu dipilih.</p>
        {import.meta.env.DEV && !complete && (
          <button type="button" onClick={fillDemo} disabled={demoPending} className="w-fit text-[13px] font-bold text-primary underline">
            {demoPending ? 'Mengisi…' : 'Isi contoh'}
          </button>
        )}
      </aside>
    </div>
  )
}

function ReviewSection({ icon, title, ok, onEdit, children }) {
  return (
    <Panel className="gap-3.5">
      <div className="flex items-center gap-3">
        <IconBox icon={icon} />
        <h2 className="flex-1 text-[17px] font-extrabold">{title}</h2>
        <Button variant="neutral" size="xs" onClick={onEdit} className="h-9 text-primary">
          <PencilIcon aria-hidden />
          Edit
        </Button>
      </div>
      <Chip tone={ok ? 'ok' : 'warn'}>{ok ? '✓ Lengkap' : '⚠ Belum lengkap'}</Chip>
      {children}
    </Panel>
  )
}

function ReviewStep({ app, go }) {
  const [consents, setConsents] = useState({ dataAccuracy: false, sendToBank: false })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const { personal: p = {}, employment: e = {}, property: pr = {}, loan: l = {} } = app.data
  const s = app.selection
  const edit = (step) => go(`/apply/primary/${step}`, { state: { from: 'review' } })
  const personalOk = !!(p.fullName && p.nik && p.birthDate && p.address)
  const employmentOk = !!(e.occupation && e.monthlyIncome)
  const propertyOk = !!(pr.purchaseType && pr.propertyType && pr.price)
  const loanOk = !!(l.amount && l.tenorMonths)
  const required = app.requiredDocuments.filter((d) => d.required)
  const docsOk = required.every((d) => ['uploaded', 'verified'].includes(app.documents[d.type]?.status))
  const allOk = personalOk && employmentOk && propertyOk && loanOk && docsOk && !!s
  const canSubmit = allOk && consents.dataAccuracy && consents.sendToBank

  const submit = async () => {
    if (!canSubmit || pending) return
    setPending(true)
    setError(null)
    try {
      await api.applications.submit(app.id, { consents })
      go('/', { replace: true, state: { success: { appId: app.id } } })
    } catch (err) {
      setError(err)
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ReviewSection icon={UserIcon} title="Data Diri" ok={personalOk} onEdit={() => edit(1)}>
          <SummaryRows
            size="sm"
            rows={[
              { k: 'Nama', v: p.fullName },
              { k: 'NIK', v: p.nik ? `${p.nik.slice(0, 4)}********${p.nik.slice(-4)}` : '—' },
              { k: 'Tempat, tgl lahir', v: p.birthPlace ? `${p.birthPlace}, ${dateLong(p.birthDate)}` : '—' },
              { k: 'Jenis kelamin', v: labelOf(GENDERS, p.gender) },
              { k: 'Status', v: labelOf(MARITAL, p.maritalStatus) },
            ]}
          />
        </ReviewSection>
        <ReviewSection icon={BriefcaseIcon} title="Pekerjaan & Penghasilan" ok={employmentOk} onEdit={() => edit(2)}>
          <SummaryRows
            size="sm"
            rows={[
              { k: 'Pekerjaan', v: `${labelOf(OCCUPATIONS, e.occupation)} · ${e.companyName ?? ''}` },
              { k: 'Penghasilan', v: `${rupiah(e.monthlyIncome)}/bln` },
              e.jointIncome && { k: 'Penghasilan pasangan', v: `${rupiah(e.partnerIncome)}/bln` },
              { k: 'Cicilan lain', v: `${rupiah((e.vehicleDebt ?? 0) + (e.cardDebt ?? 0) + (e.otherDebt ?? 0))}/bln` },
            ]}
          />
        </ReviewSection>
        <ReviewSection icon={HouseIcon} title="Properti" ok={propertyOk} onEdit={() => edit(3)}>
          <SummaryRows
            size="sm"
            rows={[
              { k: 'Jenis pembelian', v: pr.purchaseType === 'used_from_owner' ? 'Rumah bekas dari pemilik' : 'Rumah baru dari developer' },
              { k: pr.purchaseType === 'used_from_owner' ? 'Penjual' : 'Developer', v: (pr.purchaseType === 'used_from_owner' ? pr.sellerName : pr.developerName) || '—' },
              { k: 'Properti', v: `${labelOf(PROPERTY_TYPES, pr.propertyType)} · ${pr.city ?? ''}` },
              { k: 'Harga properti', v: rupiah(pr.price) },
            ]}
          />
        </ReviewSection>
        <ReviewSection icon={HandCoinsIcon} title="Pinjaman" ok={loanOk} onEdit={() => edit(4)}>
          <SummaryRows
            size="sm"
            rows={[
              { k: 'Uang muka (DP)', v: pr.price ? `${rupiah(l.downPayment)} (${percentRatio(l.downPayment / pr.price)})` : '—' },
              { k: 'Jumlah pinjaman', v: rupiah(l.amount) },
              { k: 'Tenor', v: tenorLabel(l.tenorMonths) },
            ]}
          />
        </ReviewSection>
        <ReviewSection icon={FileTextIcon} title="Dokumen" ok={docsOk} onEdit={() => edit(5)}>
          <div className="flex flex-wrap gap-2">
            {app.requiredDocuments.map((d) => {
              const ok = ['uploaded', 'verified'].includes(app.documents[d.type]?.status)
              return (
                <span key={d.type} className={cn('rounded-full px-3 py-1.5 text-[13px] font-bold', ok ? 'bg-success-bg text-success' : d.required ? 'bg-danger-bg text-danger-strong' : 'bg-muted text-ink-3')}>
                  {ok ? `✓ ${d.label}` : d.required ? `✕ ${d.label}` : `${d.label} · opsional`}
                </span>
              )
            })}
          </div>
        </ReviewSection>
        <ReviewSection icon={LandmarkIcon} title="Program Dipilih" ok={!!s} onEdit={() => go('/apply/primary/6', { state: { from: 'review' } })}>
          <SummaryRows
            size="sm"
            rows={
              s
                ? [
                    { k: 'Bank', v: s.bankName },
                    { k: 'Program', v: `${s.productName} · ${percentBps(s.fixedRateBps)}` },
                    { k: 'Plafon', v: rupiah(s.loanAmount) },
                    { k: 'Tenor', v: tenorLabel(s.tenorMonths) },
                    { k: 'Cicilan estimasi', v: `${rupiah(s.estimatedPayment)}/bln`, strong: true },
                    s.paymentAfterFixed && { k: 'Setelah fixed (estimasi)', v: `${rupiah(s.paymentAfterFixed)}/bln`, tone: 'warn' },
                  ]
                : [{ k: 'Program', v: 'Belum dipilih', tone: 'mute' }]
            }
          />
        </ReviewSection>
      </div>

      <Panel>
        <h2 className="text-[17px] font-extrabold">Persetujuan</h2>
        <CheckboxField label="Data yang saya berikan benar dan dapat dipertanggungjawabkan." checked={consents.dataAccuracy} onChange={(v) => setConsents((c) => ({ ...c, dataAccuracy: v }))} />
        <CheckboxField label={`Saya setuju data saya dikirim ke ${s?.bankName ?? 'bank yang dipilih'} untuk pengajuan ini.`} checked={consents.sendToBank} onChange={(v) => setConsents((c) => ({ ...c, sendToBank: v }))} />
        {error && (
          <Notice tone="bad" role="alert" title="Pengajuan belum terkirim" action={error.code === 'BANK_PRODUCT_EXPIRED' ? <Link to="/apply/primary/6" className="text-[13px] font-bold text-primary underline">Bandingkan ulang program</Link> : null}>
            {error.message}
          </Notice>
        )}
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-card px-6 py-[22px] shadow-card">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1 text-[13px] leading-5 text-ink-3">
          <span>Pengajuan ini hanya dikirim ke satu bank/program{s ? `: ${s.bankName}` : ''}. Setelah submit, data tidak bisa diubah kecuali diminta bank.</span>
          <Disclaimer>Semua angka adalah estimasi, bukan persetujuan kredit.</Disclaimer>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={submit} aria-disabled={!canSubmit || pending} aria-busy={pending} className={!canSubmit ? 'bg-border text-ink-3 hover:bg-border' : ''}>
            {pending && <Spinner />}
            {pending ? 'Mengirim…' : 'Submit Pengajuan'}
          </Button>
          {!allOk && <span className="text-xs text-warning-text">Lengkapi bagian bertanda ⚠ dulu.</span>}
          {allOk && !canSubmit && <span className="text-xs text-warning-text">Centang kedua persetujuan untuk submit.</span>}
        </div>
      </div>
    </div>
  )
}
