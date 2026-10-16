import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PrinterIcon } from 'lucide-react'
import { api } from '@/data/api'
import { productName } from '@/domains/applications/meta'
import { useResource } from '@/lib/hooks'
import { dateLong, moneyInput, terbilang, toInt } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { DateField, MoneyField, RadioCards, TextAreaField, TextField } from '@/components/shared/fields'
import { ErrorPanel, PageSkeleton, Panel, PanelTitle, Spinner } from '@/components/shared/ui'
import { APPLICANT_COLUMNS } from './coverLetter'
import { AdminHeader } from './shared'

const MONEY_KEYS = ['loanAmount', 'takeoverAmount', 'topupAmount']
const asErrors = (e) => Object.fromEntries((e.fieldErrors ?? []).map((x) => [x.field, x.message]))
// The form keeps amounts as digit strings (MoneyField); the API and the sheet take whole Rupiah.
const toForm = (letter) => ({ ...letter, ...Object.fromEntries(MONEY_KEYS.filter((k) => k in letter).map((k) => [k, moneyInput(letter[k])])) })
const toValues = (form) => ({ ...form, ...Object.fromEntries(MONEY_KEYS.filter((k) => k in form).map((k) => [k, toInt(form[k])])) })
// The A4 sheet (210mm at 96 dpi) scales down to fit its column on screen. It stays at 65% or more so a checklist cell
// (68px) keeps a 44px target; narrower screens scroll instead.
const SHEET_PX = 794
function useFitZoom() {
  const ref = useRef(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setZoom(Math.max(0.65, Math.min(1, entry.contentRect.width / SHEET_PX))))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, zoom]
}
const LOAD_ERROR = { RESOURCE_NOT_FOUND: 'Pengajuan tidak ditemukan.', INVALID_STATE_TRANSITION: 'Surat pengantar tersedia setelah pengajuan diteruskan ke bank.' }

export function CoverLetterPage() {
  const { applicationId } = useParams()
  const back = `/admin/applications/${applicationId}`
  const { data, error, reload, setData } = useResource(() => api.admin.applications.coverLetter(applicationId), [applicationId])
  if (!data) {
    const known = LOAD_ERROR[error?.code]
    return (
      <>
        <AdminHeader title="Surat pengantar" back={back} />
        {error ? <ErrorPanel title={known} message={known ? null : undefined} onRetry={known ? undefined : reload} /> : <PageSkeleton />}
      </>
    )
  }
  return <CoverLetterEditor data={data} back={back} onSaved={setData} />
}

function CoverLetterEditor({ data, back, onSaved }) {
  const { application: app, variant, rows } = data
  const [form, setForm] = useState(() => toForm(data.letter))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [fitRef, zoom] = useFitZoom()
  const dirty = !data.saved || JSON.stringify(form) !== JSON.stringify(toForm(data.letter))
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const toggle = (key, on) => setForm((f) => ({ ...f, checked: on ? [...f.checked, key] : f.checked.filter((k) => k !== key) }))
  const save = async () => {
    setSaving(true)
    try {
      const d = await api.admin.applications.saveCoverLetter(app.id, { values: toValues(form) })
      onSaved(d)
      setForm(toForm(d.letter))
      setErrors({})
      return true
    } catch (e) {
      setErrors(asErrors(e))
      toast.error(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }
  const onSave = async () => {
    if (await save()) toast('Surat pengantar disimpan.')
  }
  // Printing saves first, so the paper always matches what is stored.
  const onPrint = async () => {
    if (!dirty || (await save())) window.print()
  }
  const text = (k, label, props = {}) => <TextField label={label} value={form[k]} onChange={set(k)} error={errors[k]} {...props} />
  const money = (k, label, props = {}) => <MoneyField label={label} value={form[k]} onChange={set(k)} error={errors[k]} {...props} />
  const loan = toInt(form.loanAmount)
  return (
    <>
      <div className="print:hidden">
        <AdminHeader
          title="Surat pengantar"
          subtitle={`${app.userName} · ${productName(app)}`}
          back={back}
          actions={
            <>
              <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={onSave}>
                {saving && <Spinner />}
                Simpan
              </Button>
              <Button size="sm" disabled={saving} onClick={onPrint}>
                <PrinterIcon aria-hidden />
                Cetak
              </Button>
            </>
          }
        />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] print:block">
        <Panel className="print:hidden">
          <PanelTitle sub="Terisi dari data pengajuan dan Konfigurasi. Centang dokumen langsung di surat.">Isian surat</PanelTitle>
          <Group legend="Marketing Associate">
            {text('maName', 'Nama Marketing Associate', { required: true })}
            {text('maId', 'No. ID RE/MAX', { required: true })}
            {text('officeName', 'Kantor RE/MAX', { required: true })}
            {text('logoLabel', 'Nama di bawah logo', { optional: true, hint: 'Mis. Eagle. Kosongkan bila tidak perlu.' })}
          </Group>
          <Group legend="Nasabah & pengajuan">
            {text('customerName', 'Nama nasabah', { required: true })}
            <TextAreaField label="Alamat properti (jaminan)" required value={form.propertyAddress} onChange={set('propertyAddress')} error={errors.propertyAddress} />
            {text('bankName', 'Bank', { required: true })}
            {money('loanAmount', 'Besarnya KPR yang diajukan', { required: true, hint: loan > 0 ? terbilang(loan) : undefined })}
            {variant === 'topup' && (
              <>
                {money('takeoverAmount', 'Take over KPR lama', { required: true })}
                {money('topupAmount', 'Top-up', { required: true })}
              </>
            )}
            <DateField label="Tanggal pengajuan" required value={form.submittedDate} onChange={set('submittedDate')} error={errors.submittedDate} />
            {text('salesOfficer', 'Sales Officer bank', { optional: true, hint: 'Kosongkan untuk ditulis tangan.' })}
            <RadioCards label="Kolom pemohon di checklist" value={form.applicantColumn} onChange={set('applicantColumn')} options={APPLICANT_COLUMNS} error={errors.applicantColumn} />
          </Group>
          <Group legend="Business Owner & fee">
            {text('boName', 'Nama Business Owner', { required: true })}
            <TextAreaField label="Rekening marketing fee" required value={form.feeAccount} onChange={set('feeAccount')} error={errors.feeAccount} />
          </Group>
        </Panel>
        <div ref={fitRef} className="min-w-0 overflow-x-auto rounded-card bg-muted p-4 print:overflow-visible print:bg-transparent print:p-0">
          <CoverLetterSheet letter={toValues(form)} variant={variant} rows={rows} onToggle={toggle} zoom={zoom} />
        </div>
      </div>
    </>
  )
}

function Group({ legend, children }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-sm font-bold text-ink-2">{legend}</legend>
      {children}
    </fieldset>
  )
}

const PRODUCT_LINE = { primary: 'KPR', takeover: 'KPR Take Over', topup: 'KPR Take Over + Top-up' }
const rp = (n) => (Number.isInteger(n) ? `Rp. ${n.toLocaleString('id-ID')},00` : 'Rp.')
const cell = 'border border-black px-1 py-0.5 align-middle'
const head = `${cell} bg-neutral-300 text-center font-bold`
const checkHead = `${head} w-[18mm]`

function Fact({ label, children }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>: {children}</dd>
    </>
  )
}

// On screen a checkbox in a 68px cell; on paper a √ when ticked.
function CheckCell({ label, checked, onToggle }) {
  return (
    <td className={`${cell} w-[18mm] p-0 text-center`}>
      <label className="flex min-h-[68px] cursor-pointer items-center justify-center print:min-h-0">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} aria-label={label} className="size-5 accent-black print:hidden" />
        {checked && <span className="hidden print:inline">√</span>}
      </label>
    </td>
  )
}

// The bank form as it prints on A4 (spec 2026-10-16 §2). A print document: it keeps the form's black-on-white look
// instead of the app's visual language.
function CoverLetterSheet({ letter: l, variant, rows, onToggle, zoom }) {
  const ticked = (key) => l.checked.includes(key)
  const houseRow = (r, i) => (
    <tr key={r.key}>
      <td className={`${cell} text-center`}>{i + 1}</td>
      <td className={cell}>{r.label}</td>
      <CheckCell label={`${r.label} — Rumah Bekas`} checked={ticked(r.key)} onToggle={(on) => onToggle(r.key, on)} />
    </tr>
  )
  return (
    <article
      aria-label="Pratinjau surat pengantar"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif', zoom }}
      className="mx-auto flex min-h-[297mm] w-[210mm] flex-col gap-[3mm] bg-white p-[12mm] text-[10pt] leading-snug text-black shadow-card [print-color-adjust:exact] print:min-h-0 print:w-full print:p-0 print:shadow-none print:[zoom:1]!"
    >
      <header className="flex items-center justify-between gap-4 border-b-2 border-black pb-[3mm]">
        <div className="flex shrink-0 flex-col items-start">
          <img src="/remax-logo.jpg" alt="RE/MAX" className="h-[11mm] w-auto" />
          {l.logoLabel && <span className="pl-[4.5mm] text-[13pt] leading-none font-extrabold">{l.logoLabel}</span>}
        </div>
        <h2 className="text-center text-[14pt] font-extrabold">SURAT PENGANTAR APLIKASI KPR</h2>
        <span className="max-w-[45mm] text-right text-[13pt] font-extrabold">{l.bankName}</span>
      </header>
      <p className="font-bold">Bersama surat ini kami :</p>
      <dl className="grid grid-cols-[55mm_1fr]">
        <Fact label="Nama Marketing Associate">{l.maName}</Fact>
        <Fact label="No. ID RE/MAX">{l.maId}</Fact>
        <Fact label="Dari kantor RE/MAX">{l.officeName}</Fact>
      </dl>
      <p className="font-bold">
        Mengajukan aplikasi {PRODUCT_LINE[variant]} – {l.bankName} untuk :
      </p>
      <dl className="grid grid-cols-[55mm_1fr]">
        <Fact label="Nama Nasabah">{l.customerName}</Fact>
        <Fact label="Alamat Properti (Jaminan)">{l.propertyAddress}</Fact>
        <Fact label="Besarnya KPR yang diajukan">
          {rp(l.loanAmount)}
          {l.loanAmount > 0 && <span className="block pl-[2mm]">({terbilang(l.loanAmount)})</span>}
        </Fact>
        {variant === 'topup' && (
          <>
            <Fact label="– Take over KPR lama">{rp(l.takeoverAmount)}</Fact>
            <Fact label="– Top-up">{rp(l.topupAmount)}</Fact>
          </>
        )}
        <Fact label="Tanggal Pengajuan">{l.submittedDate ? dateLong(l.submittedDate) : ''}</Fact>
      </dl>
      <p>
        Pengajuan ke Sales Officer {l.bankName} : {l.salesOfficer || '______________________'}
      </p>
      <p>
        <b>Kami sertakan kelengkapan dokumen sebagai berikut</b> : (<i>beri tanda √ pada data yang disertakan</i>)
      </p>
      <div style={{ fontFamily: '"Times New Roman", Times, serif' }} className="grid grid-cols-[63%_37%] items-start text-[8.5pt] leading-tight">
        <table className="w-full border-collapse">
          <caption className="sr-only">Dokumen aplikan</caption>
          <thead>
            <tr>
              <th className={head}>No.</th>
              <th className={head}>Dokumen Aplikan</th>
              {APPLICANT_COLUMNS.map((c) => (
                <th key={c.value} className={checkHead}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.applicant.map((r, i) => (
              <tr key={r.key}>
                <td className={`${cell} text-center`}>{i + 1}</td>
                <td className={cell}>{r.label}</td>
                {APPLICANT_COLUMNS.map((c) =>
                  c.value === l.applicantColumn ? (
                    <CheckCell key={c.value} label={`${r.label} — ${c.label}`} checked={ticked(r.key)} onToggle={(on) => onToggle(r.key, on)} />
                  ) : (
                    <td key={c.value} className={cell} />
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full border-collapse">
          <caption className="sr-only">Dokumen rumah</caption>
          <thead>
            <tr>
              <th className={head}>No.</th>
              <th className={head}>Dokumen Rumah</th>
              <th className={checkHead}>Rumah Bekas</th>
            </tr>
          </thead>
          <tbody>
            {rows.house.map(houseRow)}
            <tr>
              <th colSpan={3} scope="colgroup" className={head}>
                {rows.second.title}
              </th>
            </tr>
            {rows.second.rows.map(houseRow)}
          </tbody>
        </table>
      </div>
      <p className="text-[8.5pt] font-bold italic">**) untuk pengusaha dengan badan hukum PT</p>
      <div className="border border-black px-[2mm] py-[1mm]">
        <p>Mohon Marketing Fee dikirimkan ke :</p>
        <p className="whitespace-pre-line">{l.feeAccount}</p>
      </div>
      <div className="grid grid-cols-2 text-center">
        <p className="flex flex-col">
          <span className="invisible">Mengetahui,</span>
          <b>Marketing Associate RE/MAX</b>
          <span className="mt-[22mm]">
            ({l.maName} {l.officeName})
          </span>
        </p>
        <p className="flex flex-col">
          <span>Mengetahui,</span>
          <b>Business Owner RE/MAX</b>
          <span className="mt-[22mm]">({l.boName})</span>
        </p>
      </div>
      <p className="text-[8.5pt] font-bold">***surat keterangan ini harus disertai dengan stempel kantor RE/MAX &amp; Tuliskan Nama Jelas BO &amp; MA</p>
      <ul className="border border-black px-[2mm] py-[1mm] text-[8pt]">
        <li className="font-bold">☐ Serahkan 1 lembar asli dan kelengkapannya ke kantor cabang bersangkutan atau kepada PIC {l.bankName} yang telah ditunjuk</li>
        <li>☐ Simpan 1 lembar Copy sebagai bukti</li>
        <li>☐ Sebagai bukti ke RE/MAX Indonesia, mohon e-mail ke support@remax.co.id atau fax ke RE/MAX Indonesia, Attn : Business Operation Dept – Fax (021) 5151 392, dengan melampirkan fotocopy KTP</li>
      </ul>
    </article>
  )
}
