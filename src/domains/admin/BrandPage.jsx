import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRightIcon, CircleCheckIcon, EyeIcon, ImageIcon, RotateCcwIcon, TriangleAlertIcon } from 'lucide-react'
import { api } from '@/data/api'
import { LOGO_UPLOAD, acceptOf, uploadHint, uploadProblem } from '@/data/documentRules'
import { brand } from '@/brand/brand'
import { BrandIdentity } from '@/brand/BrandIdentity'
import { loadFonts, previewBrand, setPublishedBrand, useLiveBrand } from '@/brand/live'
import { DEFAULT_SETTINGS, FONTS, HEX_HINT, STEPS, brandIssues, brandVars, isHex } from '@/brand/theme'
import { useResource } from '@/lib/hooks'
import { dateLong, intInput, toInt } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { FieldError, NumberField, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { Chip, ErrorPanel, Notice, PageSkeleton, Panel, PanelTitle } from '@/components/shared/ui'
import { ReasonDialog } from './ConfigurationPage'
import { AdminHeader } from './shared'

const COLORS = [
  ['primary', 'Warna utama', 'Tombol utama, teks penting, hero. Dibuat cukup gelap agar teks putih terbaca.'],
  ['secondary', 'Warna pendamping', 'Link, tagline, tile potensi hemat.'],
  ['accent', 'Aksen CTA', 'Tombol CTA di permukaan gelap, fokus keyboard, chart.'],
  ['neutral', 'Warna teks', 'Teks dan kontrol di atas latar putih/terang: judul, paragraf, border, placeholder.'],
]
const STATUS_COLORS = [
  ['success', 'Sukses', 'Badge dan pesan berhasil.'],
  ['warning', 'Peringatan', 'Badge dan pesan perlu perhatian.'],
  ['danger', 'Bahaya', 'Badge, pesan gagal, dan validasi error.'],
  ['info', 'Info', 'Badge dan pesan informasi.'],
]
const ALL_COLORS = [...COLORS, ...STATUS_COLORS]
const BRAND_PALETTES = ['primary', 'secondary', 'accent', 'neutral']
const STATUS_PALETTES = ['success', 'warning', 'danger', 'info']
const PALETTE_LABEL = { primary: 'Utama', secondary: 'Pendamping', accent: 'Aksen', neutral: 'Netral', success: 'Sukses', warning: 'Peringatan', danger: 'Bahaya', info: 'Info' }
const FILES = [
  ['logo', 'Logo utama', brand.logo, 'Logo lengkap dengan nama, horizontal ±3:1, latar transparan. Ditampilkan proporsional di header.'],
  ['favicon', 'Favicon', brand.favicon, 'Ikon persegi tanpa tulisan kecil, untuk tab browser.'],
  ['logoWhite', 'Logo putih', brand.logoWhite, 'Logo versi putih, horizontal ±3:1, untuk materi berlatar gelap.'],
]
const FONT_OPTIONS = FONTS.map((f) => ({ value: f, label: f }))

const pick = ({ colors, overrides, fonts, cardRadius, logo, favicon }) => ({ colors, overrides, fonts, cardRadius, logo, favicon })
// Files cannot be compared as JSON: a chosen file always counts as a change.
const comparable = (s) => JSON.stringify({ ...s, logo: s.logo instanceof Blob ? 'new' : (s.logo?.path ?? null), favicon: s.favicon instanceof Blob ? 'new' : (s.favicon?.path ?? null) })
const asErrors = (e) => Object.fromEntries((e.fieldErrors ?? []).map((x) => [x.field, x.message]))
const paletteOf = (overrides, p) => STEPS.map((s) => overrides[`${p}-${s}`]).filter(Boolean)
const hexList = (text) => text.match(/#?[0-9a-f]{6}\b/gi)?.map((h) => `#${h.replace('#', '').toLowerCase()}`) ?? []

// While previewing a draft, staff walk the user pages with it; the bar brings them back (App.jsx).
export function BrandPreviewBar({ onBack }) {
  if (!useLiveBrand().preview) return null
  return (
    <div role="status" className="fixed right-3 bottom-[76px] z-[60] flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-2 rounded-2xl bg-inverse py-2 pr-2 pl-4 text-sm text-inverse-foreground shadow-pop lg:bottom-4">
      <EyeIcon className="size-4 shrink-0" aria-hidden />
      <span className="font-semibold">Pratinjau draft brand · hanya kamu yang melihat</span>
      <Button size="xs" variant="inverse" onClick={onBack}>
        Kembali ke editor
      </Button>
      <Button size="xs" variant="ghost" className="text-inverse-foreground hover:bg-white/10" onClick={() => previewBrand(null)}>
        Akhiri
      </Button>
    </div>
  )
}

function ColorField({ name, label, hint, value, fallback, onChange, error }) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="color"
        aria-label={`Pilih ${label.toLowerCase()}`}
        value={isHex(value) ? value : fallback}
        onChange={(e) => onChange(e.target.value)}
        className="mt-[27px] size-[54px] shrink-0 cursor-pointer rounded-lg border border-input bg-field p-1"
      />
      <div className="min-w-0 flex-1">
        <TextField label={label} name={name} value={value} onChange={(v) => onChange(v.trim())} hint={hint} error={error} maxLength={7} />
      </div>
    </div>
  )
}

function Scale({ label, colors }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <div className="grid grid-cols-11 gap-1" role="img" aria-label={`Skala ${label}: ${colors.join(', ')}`}>
        {colors.map((c, i) => (
          <span key={STEPS[i]} title={`${STEPS[i]} · ${c}`} className="h-8 rounded-md ring-1 ring-black/5" style={{ background: c }} />
        ))}
      </div>
    </div>
  )
}

// Paste a designer's eleven shades (50 → 950); empty goes back to the generated scale.
function ShadesField({ palette, overrides, onChange }) {
  const [text, setText] = useState(() => paletteOf(overrides, palette).join(' '))
  const count = hexList(text).length
  const error = text.trim() && count !== STEPS.length ? `Butuh ${STEPS.length} warna hex, terbaca ${count}.` : null
  const change = (v) => {
    setText(v)
    const list = hexList(v)
    if (!v.trim() || list.length === STEPS.length) onChange(palette, v.trim() ? list : null)
  }
  return <TextAreaField label={`Shade ${PALETTE_LABEL[palette]} (50 → 950)`} rows={2} value={text} onChange={change} error={error} hint="Tempel 11 hex dari desainer, dipisah spasi atau koma. Kosongkan untuk memakai skala otomatis." optional />
}

function FileRow({ k, label, fallback, hint, value, onChange }) {
  const input = useRef(null)
  const [error, setError] = useState(null)
  const url = useMemo(() => (value instanceof Blob ? URL.createObjectURL(value) : (value?.url ?? fallback)), [value, fallback])
  useEffect(() => () => value instanceof Blob && URL.revokeObjectURL(url), [value, url])
  const pickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = uploadProblem(file, LOGO_UPLOAD)
    setError(problem?.message ?? null)
    if (!problem) onChange(k, file)
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <img
        src={url}
        alt={`Pratinjau ${label.toLowerCase()}`}
        className={`${k === 'favicon' ? 'size-16' : 'h-16 w-40'} ${k === 'logoWhite' ? 'bg-inverse' : 'bg-white'} shrink-0 rounded-xl object-contain p-2 ring-1 ring-border`}
      />
      <div className="flex min-w-0 flex-1 basis-[200px] flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-[13px] text-muted-foreground">
          {value ? (value instanceof Blob ? `${value.name} (belum disimpan)` : 'File unggahan') : `Bawaan ${brand.name}`} · {hint}
        </span>
        {error && <FieldError>{error}</FieldError>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <ImageIcon aria-hidden />
          {value ? 'Ganti' : 'Unggah'}
        </Button>
        {value && (
          <Button type="button" variant="neutral" size="sm" onClick={() => onChange(k, null)}>
            Pakai bawaan
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept={acceptOf(LOGO_UPLOAD)} className="sr-only" tabIndex={-1} onChange={pickFile} aria-hidden />
    </div>
  )
}

// The settings in force inside a box of their own ([data-brand-scope] recomputes every role from its palettes).
function Preview({ vars, logo }) {
  return (
    <div data-brand-scope inert style={vars} className="flex flex-col gap-3 rounded-card bg-background p-4 font-sans text-foreground ring-1 ring-border">
      <BrandIdentity logo={logo} />
      <section className="flex flex-col gap-3 rounded-card p-5 text-white hero-gradient">
        <h3 className="text-lg leading-6 font-extrabold">Pilih produk KPR yang sesuai kebutuhanmu.</h3>
        <Button size="sm" variant="inverse" className="w-fit">
          Mulai sekarang
          <ArrowRightIcon aria-hidden />
        </Button>
      </section>
      <section className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-card">
        <h3 className="text-base font-extrabold">Cicilan bulan ini</h3>
        <p className="text-[13px] text-muted-foreground">
          Jatuh tempo 22 Oktober · <span className="font-semibold text-link underline">Lihat detail</span>
        </p>
        <span className="flex h-12 items-center rounded-lg border border-input bg-field px-4 text-[15px] text-placeholder">nama@email.com</span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Bayar</Button>
          <Button size="sm" variant="secondary">
            Simulasi
          </Button>
          <Button size="sm" variant="outline">
            Batal
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="ok">Lunas</Chip>
          <Chip tone="warn">Segera</Chip>
          <Chip tone="bad">Terlambat</Chip>
          <Chip tone="info">Info</Chip>
        </div>
        <div className="flex h-16 items-end gap-1.5" aria-hidden>
          {[40, 55, 48, 70, 62, 80].map((h, i) => (
            <span key={i} className="flex-1 overflow-hidden rounded-t-md" style={{ height: `${h}%` }}>
              <span className="block h-1/3 bg-chart-interest" />
              <span className="block h-2/3 bg-chart-principal" />
            </span>
          ))}
        </div>
      </section>
      <div className="flex flex-col gap-0.5 rounded-xl px-4 py-3 text-white opp-gradient">
        <span className="text-[11px] font-extrabold tracking-[0.4px] uppercase">Potensi hemat</span>
        <span className="text-lg font-extrabold">Rp715 rb / bulan</span>
      </div>
    </div>
  )
}

function BrandEditor({ data, onSaved }) {
  const navigate = useNavigate()
  const base = data.draft ?? data.published ?? DEFAULT_SETTINGS
  const [s, setS] = useState(() => pick(base))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'publish' | 'reset'
  const dirty = comparable(pick(s)) !== comparable(pick(base))

  // Typing a colour passes through invalid hex; meanwhile the preview shows the saved colour in its place.
  const valid = ALL_COLORS.every(([k]) => isHex(s.colors[k]))
  const vars = useMemo(() => brandVars({ ...s, colors: Object.fromEntries(ALL_COLORS.map(([k]) => [k, isHex(s.colors[k]) ? s.colors[k] : base.colors[k]])) }), [s, base])
  const issues = useMemo(() => brandIssues(vars), [vars])
  useEffect(() => loadFonts([s.fonts.body, s.fonts.heading], 'brand-fonts-editor'), [s.fonts.body, s.fonts.heading])
  useEffect(() => () => loadFonts([], 'brand-fonts-editor'), [])

  const live = data.published && data.draft && data.published.version === data.draft.version
  const logo = useMemo(() => (s.logo instanceof Blob ? URL.createObjectURL(s.logo) : (s.logo?.url ?? brand.logo)), [s.logo])
  useEffect(() => () => s.logo instanceof Blob && URL.revokeObjectURL(logo), [s.logo, logo])

  // The engine may use a darker step so text stays readable; say which.
  const used = { primary: vars['--primary'], accent: vars['--cta'] }
  const hintOf = (k, hint) => (valid && used[k] && used[k] !== s.colors[k] ? `${hint} Dipakai ${used[k]} agar teks tetap terbaca.` : hint)

  // A new base colour drops the pasted shades of its own palette.
  const setColor = (k, v) =>
    setS((x) => ({
      ...x,
      colors: { ...x.colors, [k]: v.toLowerCase() },
      overrides: Object.fromEntries(Object.entries(x.overrides).filter(([key]) => !key.startsWith(`${k}-`))),
    }))
  const setShades = (p, list) =>
    setS((x) => ({
      ...x,
      overrides: { ...Object.fromEntries(Object.entries(x.overrides).filter(([key]) => !key.startsWith(`${p}-`))), ...(list ? Object.fromEntries(list.map((h, i) => [`${p}-${STEPS[i]}`, h])) : {}) },
    }))
  const setFile = (k, v) => setS((x) => ({ ...x, [k]: v }))

  // Field errors land under their fields; the reason dialogs show any other error themselves.
  const run = async (op, done) => {
    setSaving(true)
    try {
      const result = await op()
      onSaved(result)
      setErrors({})
      done(result)
    } catch (e) {
      setErrors(asErrors(e))
      throw e
    } finally {
      setSaving(false)
    }
  }
  const saveDraft = () =>
    run(
      () => api.admin.brand.saveDraft({ settings: pick(s), expectedVersion: data.draft?.version ?? 0 }),
      (r) => {
        setS(pick(r.draft))
        toast('Draft brand tersimpan.')
      },
    ).catch((e) => !e.fieldErrors?.length && toast.error(e.message ?? 'Draft gagal disimpan. Coba lagi.'))
  const publish = (reason) =>
    run(
      () => api.admin.brand.publish({ reason, expectedVersion: data.draft.version }),
      (r) => {
        setPublishedBrand(r.published)
        previewBrand(null)
        toast('Brand terbit untuk semua pengunjung.')
      },
    )
  const reset = (reason) =>
    run(
      () => api.admin.brand.reset({ reason }),
      () => {
        setPublishedBrand(null)
        previewBrand(null)
        setS(pick(DEFAULT_SETTINGS))
        toast('Brand kembali ke tampilan default.')
      },
    )
  const preview = () => {
    previewBrand(pick(data.draft))
    navigate('/')
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel>
          <PanelTitle sub="Pilih warna utama, pendamping, aksen, dan teks; skala 50–950 dibuat otomatis dan peran UI dipetakan agar teks tetap terbaca.">Warna</PanelTitle>
          {COLORS.map(([k, label, hint]) => (
            <ColorField key={k} name={`colors.${k}`} label={label} hint={hintOf(k, hint)} value={s.colors[k]} fallback={base.colors[k]} onChange={(v) => setColor(k, v)} error={errors[`colors.${k}`] ?? (!isHex(s.colors[k]) ? HEX_HINT : null)} />
          ))}
          <div className="flex flex-col gap-3">
            {BRAND_PALETTES.map((p) => (
              <Scale key={p} label={PALETTE_LABEL[p]} colors={STEPS.map((step) => vars[`--palette-${p}-${step}`])} />
            ))}
          </div>
          <details className="group rounded-xl bg-muted px-4 py-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-primary">Lanjutan: shade presisi dari desainer</summary>
            <div className="flex flex-col gap-4 pt-2">
              <p className="text-[13px] text-muted-foreground">Shade yang ditempel menggantikan hasil otomatis. Mengubah warna dasar menghapus shade palet itu.</p>
              {BRAND_PALETTES.map((p) => (
                <ShadesField key={`${p}-${paletteOf(s.overrides, p).join()}`} palette={p} overrides={s.overrides} onChange={setShades} />
              ))}
              {errors.overrides && <FieldError>{errors.overrides}</FieldError>}
            </div>
          </details>
        </Panel>

        <Panel>
          <PanelTitle sub="Badge, pesan, dan border status. Dicek kontras sama seperti warna lain.">Warna status</PanelTitle>
          {STATUS_COLORS.map(([k, label, hint]) => (
            <ColorField key={k} name={`colors.${k}`} label={label} hint={hintOf(k, hint)} value={s.colors[k]} fallback={base.colors[k]} onChange={(v) => setColor(k, v)} error={errors[`colors.${k}`] ?? (!isHex(s.colors[k]) ? HEX_HINT : null)} />
          ))}
          <div className="flex flex-col gap-3">
            {STATUS_PALETTES.map((p) => (
              <Scale key={p} label={PALETTE_LABEL[p]} colors={STEPS.map((step) => vars[`--palette-${p}-${step}`])} />
            ))}
          </div>
          <details className="group rounded-xl bg-muted px-4 py-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-primary">Lanjutan: shade presisi dari desainer</summary>
            <div className="flex flex-col gap-4 pt-2">
              <p className="text-[13px] text-muted-foreground">Shade yang ditempel menggantikan hasil otomatis. Mengubah warna dasar menghapus shade palet itu.</p>
              {STATUS_PALETTES.map((p) => (
                <ShadesField key={`${p}-${paletteOf(s.overrides, p).join()}`} palette={p} overrides={s.overrides} onChange={setShades} />
              ))}
            </div>
          </details>
        </Panel>

        <Panel>
          <PanelTitle sub="Font Google dengan bobot 400–800. Ukuran teks tidak berubah.">Tipografi</PanelTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField label="Font teks" value={s.fonts.body} onChange={(v) => setS((x) => ({ ...x, fonts: { ...x.fonts, body: v } }))} options={FONT_OPTIONS} error={errors['fonts.body']} />
            <SelectField label="Font judul" value={s.fonts.heading} onChange={(v) => setS((x) => ({ ...x, fonts: { ...x.fonts, heading: v } }))} options={FONT_OPTIONS} error={errors['fonts.heading']} />
          </div>
        </Panel>

        <Panel>
          <PanelTitle sub="Sudut kartu dan panel. Tombol tetap berbentuk pil.">Radius kartu</PanelTitle>
          <NumberField label="Radius" suffix="px" value={intInput(s.cardRadius)} onChange={(v) => setS((x) => ({ ...x, cardRadius: toInt(v) }))} hint={`0–40 px. Bawaan file ${DEFAULT_SETTINGS.cardRadius} px.`} error={errors.cardRadius} />
        </Panel>

        <Panel>
          <PanelTitle sub={`${uploadHint(LOGO_UPLOAD)}. Gunakan logo berwarna untuk header berlatar terang. Nama brand: ${brand.name}.`}>Logo &amp; favicon</PanelTitle>
          {FILES.map(([k, label, fallback, hint]) => (
            <FileRow key={k} k={k} label={label} fallback={fallback} hint={hint} value={s[k]} onChange={setFile} />
          ))}
        </Panel>

        <Panel>
          <PanelTitle sub="Dicek dengan WCAG AA: teks 4.5:1, kontrol dan indikator 3:1. Publish ditolak selama ada yang kurang.">Keterbacaan</PanelTitle>
          {issues.length ? (
            <Notice tone="warn" icon={TriangleAlertIcon} title={`${issues.length} pasangan warna kurang kontras`}>
              <ul className="list-disc pl-4">
                {issues.map((i) => (
                  <li key={`${i.fg}-${i.bg}`}>
                    {i.label}: {i.ratio.toFixed(2)}:1 (minimal {i.min}:1)
                  </li>
                ))}
              </ul>
            </Notice>
          ) : (
            <Notice tone="ok" icon={CircleCheckIcon} title="Semua teks dan kontrol terbaca." />
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-6">
        <Panel>
          <PanelTitle sub={live ? 'Draft ini yang sedang tayang.' : data.published ? `Tayang sejak ${dateLong(data.published.publishedAt)} oleh ${data.published.publishedBy}.` : 'Pengunjung melihat logo dan gaya bawaan Maxi.'}>Pratinjau</PanelTitle>
          <Preview vars={vars} logo={logo} />
          <div className="flex flex-col gap-2.5">
            <Button disabled={!dirty || !valid || saving} onClick={saveDraft}>
              Simpan draft
            </Button>
            <Button variant="outline" disabled={dirty || !data.draft} onClick={preview}>
              <EyeIcon aria-hidden />
              Pratinjau di seluruh situs
            </Button>
            <Button variant="secondary" disabled={dirty || !data.draft || live || issues.length > 0} onClick={() => setConfirm('publish')}>
              Publish
            </Button>
            {dirty && <p className="text-[13px] text-muted-foreground">Simpan draft dulu untuk pratinjau dan publish.</p>}
            {(data.draft || data.published) && (
              <Button variant="ghost" onClick={() => setConfirm('reset')}>
                <RotateCcwIcon aria-hidden />
                Kembalikan ke default
              </Button>
            )}
          </div>
        </Panel>
      </div>

      <ReasonDialog
        open={confirm === 'publish'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Publish brand?"
        reasonAction="brand.publish"
        body="Warna, font, radius, logo, dan favicon ini langsung dipakai semua pengunjung."
        confirmLabel="Ya, publish"
        onConfirm={publish}
      />
      <ReasonDialog
        open={confirm === 'reset'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Kembalikan ke default?"
        reasonAction="brand.reset"
        body="Draft dan brand yang tayang dihapus. Semua pengunjung kembali melihat logo, favicon, warna, dan tipografi bawaan Maxi."
        confirmLabel="Ya, kembalikan"
        onConfirm={reset}
      />
    </div>
  )
}

// Brand settings for every visitor (spec 2026-10-20 brand CMS): draft → preview on the whole site → publish.
export function BrandPage() {
  const { data, error, reload, setData } = useResource(() => api.admin.brand.get())
  return (
    <>
      <AdminHeader title="Brand" subtitle="Atur gaya Maxi: warna, font, radius kartu, logo horizontal, dan favicon. Simpan draft, pratinjau di seluruh situs, lalu publish." />
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && <BrandEditor data={data} onSaved={setData} />}
    </>
  )
}
