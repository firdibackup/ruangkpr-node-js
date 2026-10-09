import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRightIcon, RotateCcwIcon } from 'lucide-react'
import { api } from '@/data/api'
import { UPLOAD_FORMATS, uploadHint } from '@/data/documentRules'
import { useResource } from '@/lib/hooks'
import { dateLong, dateShort, intInput, toInt } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckboxField, FieldError, NumberField, TextAreaField } from '@/components/shared/fields'
import { ConfirmDialog } from '@/components/shared/dialogs'
import { Chip, ErrorPanel, PageSkeleton, Panel, PanelTitle, Spinner } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ReminderSettingsForm } from '@/domains/mortgages/ReminderSettingsForm'
import { validateReminders } from '@/domains/mortgages/validation'
import { AdminHeader } from './shared'

const head = 'text-xs font-bold text-ink-3'
const asErrors = (e) => Object.fromEntries((e.fieldErrors ?? []).map((x) => [x.field, x.message]))

// Configuration goes live for every user at once, so each change is confirmed with a reason for the audit log.
function ReasonDialog({ open, onOpenChange, title, body, confirmLabel, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setReason('')
        onOpenChange(v)
      }}
      destructive={false}
      title={title}
      body={body}
      confirmLabel={confirmLabel}
      confirmDisabled={reason.trim().length < 5}
      onConfirm={() => onConfirm(reason)}
    >
      <TextAreaField label="Alasan" required rows={2} value={reason} onChange={setReason} hint="Masuk ke audit log (minimal 5 karakter)." />
    </ConfirmDialog>
  )
}

function RemindersPanel({ data, onSaved }) {
  const [saved, setSaved] = useState(data.config.reminders)
  const [value, setValue] = useState(saved)
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(saved)
  const review = () => {
    const e = validateReminders(value)
    setErrors(e)
    if (!Object.keys(e).length) setConfirming(true)
  }
  const save = async (reason) => {
    try {
      const d = await api.admin.config.update('reminders', { values: value, reason, expectedVersion: data.config.version })
      onSaved(d)
      setSaved(d.config.reminders)
      setValue(d.config.reminders)
      toast('Pengingat default tersimpan.')
    } catch (e) {
      setErrors(asErrors(e))
      throw e
    }
  }
  return (
    <Panel>
      <PanelTitle sub="Pilihan awal saat user menambahkan KPR. Pengingat yang sudah disimpan user tidak ikut berubah.">Pengingat default</PanelTitle>
      <ReminderSettingsForm value={value} onChange={setValue} isFixed errors={errors} />
      <Button className="w-fit" disabled={!dirty} onClick={review}>
        Simpan pengingat default
      </Button>
      <ReasonDialog open={confirming} onOpenChange={setConfirming} title="Simpan pengingat default?" body="Berlaku untuk KPR yang diatur setelah ini." confirmLabel="Ya, simpan" onConfirm={save} />
    </Panel>
  )
}

function UploadPanel({ data, onSaved }) {
  const [saved, setSaved] = useState(data.config.upload)
  const [f, setF] = useState(() => ({ maxFileMb: intInput(saved.maxFileMb), formats: saved.formats }))
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const values = { maxFileMb: toInt(f.maxFileMb), formats: Object.keys(UPLOAD_FORMATS).filter((k) => f.formats.includes(k)) }
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)
  const toggle = (k) => (on) => setF((x) => ({ ...x, formats: on ? [...x.formats, k] : x.formats.filter((y) => y !== k) }))
  const review = () => {
    const e = {
      ...(!(values.maxFileMb >= 1 && values.maxFileMb <= 20) && { maxFileMb: 'Isi ukuran 1–20 MB.' }),
      ...(!values.formats.length && { formats: 'Pilih minimal satu format.' }),
    }
    setErrors(e)
    if (!Object.keys(e).length) setConfirming(true)
  }
  const save = async (reason) => {
    try {
      const d = await api.admin.config.update('upload', { values, reason, expectedVersion: data.config.version })
      onSaved(d)
      setSaved(d.config.upload)
      toast('Batas unggah tersimpan.')
    } catch (e) {
      setErrors(asErrors(e))
      throw e
    }
  }
  return (
    <Panel>
      <PanelTitle sub="Dicek di halaman user sebelum mengunggah dan lagi saat file diterima: dokumen pengajuan dan bukti pembayaran.">Unggah dokumen</PanelTitle>
      <NumberField label="Ukuran maksimal" suffix="MB per file" value={f.maxFileMb} onChange={(v) => setF((x) => ({ ...x, maxFileMb: v }))} error={errors.maxFileMb} hint="1–20 MB." />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink-2">Format yang diterima</legend>
        <div className="flex flex-wrap gap-x-6">
          {Object.keys(UPLOAD_FORMATS).map((k) => (
            <CheckboxField key={k} label={k.toUpperCase()} checked={f.formats.includes(k)} onChange={toggle(k)} />
          ))}
        </div>
        {errors.formats && <FieldError>{errors.formats}</FieldError>}
      </fieldset>
      <p className="text-sm text-ink-3">
        Yang dibaca user sekarang: <span className="font-semibold text-ink-2">{uploadHint(saved)}</span>
      </p>
      <Button className="w-fit" disabled={!dirty} onClick={review}>
        Simpan batas unggah
      </Button>
      <ReasonDialog open={confirming} onOpenChange={setConfirming} title="Simpan batas unggah?" body="Langsung berlaku untuk semua unggahan berikutnya." confirmLabel="Ya, simpan" onConfirm={save} />
    </Panel>
  )
}

// Settings that apply to every user (admin plan §4.7). KPR Health has its own versioned editor.
export function ConfigurationPage() {
  const { data, error, reload, setData } = useResource(() => api.admin.config.get())
  return (
    <>
      <AdminHeader title="Configuration" subtitle="Berlaku untuk semua user. Setiap perubahan butuh alasan dan tercatat di audit log." />
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <RemindersPanel data={data} onSaved={setData} />
          <div className="flex min-w-0 flex-col gap-6">
            <UploadPanel data={data} onSaved={setData} />
            <Panel>
              <PanelTitle sub="Ambang dan bobot skor. Setiap perubahan terbit sebagai versi baru, jadi versi lama bisa dipulihkan.">KPR Health</PanelTitle>
              <p className="text-sm text-ink-2">
                Versi {data.health.version} berlaku sejak {dateLong(data.health.publishedAt)}.
              </p>
              <Button asChild variant="outline" size="sm" className="w-fit">
                <Link to="/admin/configuration/health">
                  Atur formula KPR Health
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            </Panel>
          </div>
        </div>
      )}
    </>
  )
}

// ---- KPR Health formula (versioned) ----
const COMPONENT = { dti: 'Beban cicilan', ltv: 'Nilai properti', rate: 'Risiko bunga', progress: 'Progres pinjaman' }
const pctIn = (bps) => (bps === null ? null : intInput(bps / 100))
const bandsIn = (list, toIn) => list.map((b) => ({ upTo: b.upTo === null ? null : toIn(b.upTo), score: intInput(b.score) }))
const toForm = (p) => ({
  dti: bandsIn(p.dti, pctIn),
  ltv: bandsIn(p.ltv, pctIn),
  floating: intInput(p.rate.floating),
  fixedDays: bandsIn(p.rate.fixedDays, intInput),
  base: intInput(p.progress.base),
  perPaid: intInput(p.progress.perPaid),
  weights: Object.fromEntries(Object.entries(p.weights).map(([k, w]) => [k, intInput(w)])),
  healthy: intInput(p.labels.healthy),
  attention: intInput(p.labels.attention),
})
// An empty box becomes -1: out of range, so the API names the section instead of reading it as "open".
const n = (v) => toInt(v) ?? -1
const bandsOut = (list, scale) => list.map((b) => ({ upTo: b.upTo === null ? null : n(b.upTo) * scale, score: n(b.score) }))
const fromForm = (f) => ({
  dti: bandsOut(f.dti, 100),
  ltv: bandsOut(f.ltv, 100),
  rate: { floating: n(f.floating), fixedDays: bandsOut(f.fixedDays, 1) },
  progress: { base: n(f.base), perPaid: n(f.perPaid) },
  weights: Object.fromEntries(Object.entries(f.weights).map(([k, w]) => [k, n(w)])),
  labels: { healthy: n(f.healthy), attention: n(f.attention) },
})

function NumInput({ label, value, onChange, suffix }) {
  return (
    <span className="flex items-center gap-2">
      <Input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="h-11 w-16 bg-field text-right text-[15px] font-semibold tabular sm:w-20 md:text-[15px]"
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </span>
  )
}

// Rising limits, one score each; the last row is open ("lebih dari" the limit above it).
function BandTable({ name, limitHead, unit, rows, onChange, error }) {
  return (
    <div className="flex flex-col gap-2">
      <Table aria-label={name}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={head}>{limitHead}</TableHead>
            <TableHead className={`${head} text-right`}>Skor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell className="py-2">
                {b.upTo === null ? (
                  <span className="text-sm font-semibold text-ink-2">
                    Lebih dari {rows[i - 1].upTo || '…'}
                    {unit}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="hidden text-sm text-ink-3 sm:inline">sampai</span>
                    <NumInput label={`${name}: batas baris ${i + 1}`} value={b.upTo} onChange={(v) => onChange(i, 'upTo', v)} suffix={unit.trim()} />
                  </span>
                )}
              </TableCell>
              <TableCell className="py-2">
                <span className="flex justify-end">
                  <NumInput label={`${name}: skor baris ${i + 1}`} value={b.score} onChange={(v) => onChange(i, 'score', v)} />
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

const signed = (d) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0')
// The number carries the tone, the label says it in words.
const TONE_TEXT = { ok: 'text-success', warn: 'text-warning-text', bad: 'text-danger', mute: 'text-muted-foreground' }
const ScoreCell = ({ s }) => (
  <span className="flex flex-col">
    <span className={`text-[15px] font-extrabold tabular ${TONE_TEXT[s.tone]}`}>{s.score ?? '—'}</span>
    <span className="text-xs text-muted-foreground">{s.label}</span>
  </span>
)

function PreviewTable({ preview }) {
  return (
    <Table aria-label="Dampak ke contoh">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={head}>Contoh</TableHead>
          <TableHead className={head}>v{preview.activeVersion}</TableHead>
          <TableHead className={head}>Draft</TableHead>
          <TableHead className={`${head} text-right`}>Selisih</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {preview.items.map((x) => (
          <TableRow key={x.key}>
            <TableCell className="min-w-36 py-3 whitespace-normal text-ink-2">{x.label}</TableCell>
            <TableCell className="py-3">
              <ScoreCell s={x.before} />
            </TableCell>
            <TableCell className="py-3">
              <ScoreCell s={x.after} />
            </TableCell>
            <TableCell className="py-3 text-right font-bold tabular">{x.before.score == null || x.after.score == null ? '—' : signed(x.after.score - x.before.score)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function VersionHistory({ data, onRollback }) {
  return (
    <ul aria-label="Riwayat versi" className="flex flex-col">
      {data.versions.map((v) => (
        <li key={v.version} className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-bold">
              v{v.version}
              {v.version === data.active.version && <Chip tone="ok">Aktif</Chip>}
              {v.rollbackOf && <span className="text-xs font-semibold text-ink-3">dipulihkan dari v{v.rollbackOf}</span>}
            </span>
            <span className="text-[13px] text-ink-2">“{v.reason}”</span>
            <span className="text-xs text-muted-foreground">
              {dateShort(v.publishedAt)}
              {v.publishedBy && ` · oleh ${v.publishedBy.name}`}
            </span>
          </span>
          {v.version !== data.active.version && (
            <Button size="sm" variant="neutral" onClick={() => onRollback(v.version)}>
              <RotateCcwIcon aria-hidden />
              Pulihkan
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function HealthEditor({ data, setData }) {
  const active = data.active
  const next = active.version + 1
  const [f, setF] = useState(() => toForm(active.params))
  const [errors, setErrors] = useState({})
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'publish' | version number to restore
  const params = fromForm(f)
  const draftKey = JSON.stringify(params)
  const dirty = draftKey !== JSON.stringify(active.params)
  const previewed = preview?.key === draftKey
  const setBand = (key) => (i, field, v) => setF((x) => ({ ...x, [key]: x[key].map((b, j) => (j === i ? { ...b, [field]: v } : b)) }))
  const set = (key) => (v) => setF((x) => ({ ...x, [key]: v }))

  const runPreview = async () => {
    setPreviewing(true)
    try {
      setPreview({ key: draftKey, ...(await api.admin.health.preview({ params })) })
      setErrors({})
    } catch (e) {
      setErrors(asErrors(e))
      if (!e.fieldErrors?.length) toast(e.message)
    } finally {
      setPreviewing(false)
    }
  }
  const publish = async (reason) => {
    const d = await api.admin.health.publish({ params, reason, expectedVersion: active.version })
    setData(d)
    toast(`Formula versi ${d.active.version} sudah dipakai untuk semua user.`)
  }
  const rollback = async (reason) => {
    const d = await api.admin.health.rollback({ toVersion: confirm, reason, expectedVersion: active.version })
    setData(d)
    toast(`v${confirm} dipulihkan sebagai versi ${d.active.version}.`)
  }

  return (
    <>
      <AdminHeader title="Formula KPR Health" subtitle={`Versi ${active.version} berlaku sejak ${dateLong(active.publishedAt)}. Skor ini bukan skor kredit.`} back="/admin/configuration" />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelTitle sub="Rasio semua cicilan terhadap penghasilan.">Beban cicilan</PanelTitle>
            <BandTable name="Beban cicilan" limitHead="Rasio cicilan" unit="%" rows={f.dti} onChange={setBand('dti')} error={errors.dti} />
          </Panel>
          <Panel>
            <PanelTitle sub="LTV: sisa pokok dibagi estimasi nilai rumah.">Nilai properti</PanelTitle>
            <BandTable name="Nilai properti" limitHead="LTV" unit="%" rows={f.ltv} onChange={setBand('ltv')} error={errors.ltv} />
          </Panel>
          <Panel>
            <PanelTitle sub="Bunga floating, atau sisa masa fixed.">Risiko bunga</PanelTitle>
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-ink-2">
              Sudah floating
              <NumInput label="Risiko bunga: skor floating" value={f.floating} onChange={set('floating')} />
            </span>
            <BandTable name="Risiko bunga" limitHead="Fixed berakhir dalam" unit=" hari" rows={f.fixedDays} onChange={setBand('fixedDays')} error={errors.rate} />
          </Panel>
          <Panel>
            <PanelTitle sub="Skor = dasar + tambahan × porsi pokok yang sudah lunas, maksimal 100.">Progres pinjaman</PanelTitle>
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-ink-2">
              Skor dasar
              <NumInput label="Progres pinjaman: skor dasar" value={f.base} onChange={set('base')} />
            </span>
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-ink-2">
              Tambahan saat pokok lunas 100%
              <NumInput label="Progres pinjaman: tambahan" value={f.perPaid} onChange={set('perPaid')} />
            </span>
            {errors.progress && <FieldError>{errors.progress}</FieldError>}
          </Panel>
          <Panel>
            <PanelTitle sub="Skor akhir = rata-rata berbobot dari komponen yang datanya ada. Bobot 0 = tampil tapi tidak dihitung.">Bobot dan label</PanelTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(COMPONENT).map(([k, name]) => (
                <span key={k} className="flex items-center justify-between gap-3 text-sm font-semibold text-ink-2">
                  {name}
                  <NumInput label={`Bobot ${name}`} value={f.weights[k]} onChange={(v) => setF((x) => ({ ...x, weights: { ...x.weights, [k]: v } }))} />
                </span>
              ))}
            </div>
            {errors.weights && <FieldError>{errors.weights}</FieldError>}
            <div className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-ink-2">
                Sehat mulai skor
                <NumInput label="Sehat mulai skor" value={f.healthy} onChange={set('healthy')} />
              </span>
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-ink-2">
                Perlu perhatian mulai skor
                <NumInput label="Perlu perhatian mulai skor" value={f.attention} onChange={set('attention')} />
              </span>
            </div>
            {errors.labels && <FieldError>{errors.labels}</FieldError>}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6">
          <Panel>
            <PanelTitle sub="Skor contoh di versi yang berlaku dibanding isian di kiri. Belum ada yang tersimpan.">Pratinjau</PanelTitle>
            {previewed ? <PreviewTable preview={preview} /> : <p className="text-sm text-muted-foreground">{dirty ? 'Ada perubahan yang belum dipratinjau.' : 'Ubah angka di kiri, lalu pratinjau dampaknya.'}</p>}
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="neutral" onClick={runPreview} disabled={!dirty || previewing} aria-busy={previewing}>
                {previewing && <Spinner />}
                Pratinjau dampak
              </Button>
              <Button size="sm" onClick={() => setConfirm('publish')} disabled={!dirty || !previewed}>
                Terbitkan versi {next}
              </Button>
            </div>
          </Panel>
          <Panel>
            <PanelTitle sub="Versi tidak pernah diubah. Memulihkan versi lama menerbitkannya lagi sebagai versi baru.">Riwayat versi</PanelTitle>
            <VersionHistory data={data} onRollback={setConfirm} />
          </Panel>
        </div>
      </div>
      <ReasonDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === 'publish' ? `Terbitkan versi ${next}?` : `Pulihkan v${confirm} sebagai versi ${next}?`}
        body="Skor KPR Health semua user langsung dihitung dengan formula ini."
        confirmLabel={confirm === 'publish' ? 'Ya, terbitkan' : 'Ya, pulihkan'}
        onConfirm={confirm === 'publish' ? publish : rollback}
      />
    </>
  )
}

export function HealthConfigPage() {
  const { data, error, reload, setData } = useResource(() => api.admin.health.get())
  if (!data) {
    return (
      <>
        <AdminHeader title="Formula KPR Health" back="/admin/configuration" />
        {error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />}
      </>
    )
  }
  // Keyed by the version in force: publishing or restoring starts the editor from the new one.
  return <HealthEditor key={data.active.version} data={data} setData={setData} />
}
