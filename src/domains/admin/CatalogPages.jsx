import { useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleCheckIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { OCCUPATIONS, PROPERTY_TYPES, PURPOSES, bpsInput, dateShort, intInput, moneyInput, rupiah, toBps, toInt, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { CheckboxField, DateField, FieldError, FormGrid, MoneyField, NumberField, RateField, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { ConfirmDialog, FormDialog } from '@/components/shared/dialogs'
import { Chip, ErrorPanel, Notice, PageSkeleton, Panel, PanelTitle, Spinner, SummaryRows } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminHeader } from './shared'

const head = 'text-xs font-bold text-ink-3'
const TYPE_LABEL = { primary: 'KPR Primary', takeover: 'Take Over' }
const PRODUCT_STATUS = { draft: ['Draft', 'mute'], published: ['Terbit', 'ok'], archived: ['Diarsipkan', 'mute'] }

function ProductStatus({ status }) {
  const [label, tone] = PRODUCT_STATUS[status] ?? [status, 'mute']
  return (
    <Chip tone={tone} className="shrink-0 whitespace-nowrap">
      {label}
    </Chip>
  )
}

// Banks & Products share one nav item; these tabs switch between the two lists.
function CatalogTabs() {
  const tab = ({ isActive }) => cn('flex min-h-11 items-center rounded-full px-4 text-sm transition-colors', isActive ? 'bg-secondary font-bold text-primary' : 'font-semibold text-ink-3 hover:bg-muted')
  return (
    <nav aria-label="Katalog" className="flex gap-1.5">
      <NavLink to="/admin/products" className={tab}>
        Produk
      </NavLink>
      <NavLink to="/admin/banks" className={tab}>
        Bank
      </NavLink>
    </nav>
  )
}

export function ProductListPage() {
  const [status, setStatus] = useState('')
  const { data, error, reload } = useResource(() => api.admin.products.list({ status: status || undefined }), [status])
  return (
    <>
      <AdminHeader
        title="Banks & Products"
        subtitle="Produk yang dipakai pencocokan program. Draft dan revisi baru tampil ke user setelah diterbitkan."
        actions={
          <Button asChild size="sm">
            <Link to="/admin/products/new">
              <PlusIcon aria-hidden />
              Produk baru
            </Link>
          </Button>
        }
      />
      <CatalogTabs />
      <div className="max-w-xs">
        <SelectField label="Status" placeholder="Semua" value={status} onChange={setStatus} options={Object.entries(PRODUCT_STATUS).map(([value, [label]]) => ({ value, label }))} />
      </div>
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <Panel>
          <p className="text-sm font-semibold text-ink-3">{data.length} produk</p>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada produk dengan status ini.</p>
          ) : (
            <Table aria-label="Daftar produk">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={head}>Produk</TableHead>
                  <TableHead className={head}>Jenis</TableHead>
                  <TableHead className={head}>Status</TableHead>
                  <TableHead className={head}>Berlaku sampai</TableHead>
                  <TableHead className={head}>Verifikasi data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="min-w-52 py-3 whitespace-normal">
                      <span className="flex flex-col">
                        <Link to={`/admin/products/${p.id}`} className="w-fit font-bold text-primary underline-offset-4 hover:underline">
                          {p.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {p.bankName}
                          {p.version > 0 && ` · versi ${p.version}`}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-ink-2">{p.productTypes.map((t) => TYPE_LABEL[t]).join(', ')}</TableCell>
                    <TableCell className="py-3">
                      <span className="flex flex-wrap gap-1.5">
                        <ProductStatus status={p.status} />
                        {p.hasPendingRevision && (
                          <Chip tone="warn" className="whitespace-nowrap">
                            Revisi belum terbit
                          </Chip>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-ink-2 tabular">{p.effectiveUntil ? dateShort(p.effectiveUntil) : '—'}</TableCell>
                    <TableCell className="py-3">
                      {p.stale ? (
                        <Chip tone="warn" className="whitespace-nowrap">
                          Data usang
                        </Chip>
                      ) : (
                        <span className="text-ink-2 tabular">{p.lastVerifiedAt ? dateShort(p.lastVerifiedAt) : '—'}</span>
                      )}
                    </TableCell>
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

// Catalog shape ⇄ form strings. Keys match the data layer's field errors.
function toForm(c = {}) {
  const fixed = c.ratePeriods?.find((p) => p.type === 'fixed')
  const floating = c.ratePeriods?.find((p) => p.type === 'floating')
  const el = c.eligibility ?? {}
  const fees = c.fees ?? {}
  return {
    bankId: c.bank?.id ?? '',
    name: c.name ?? '',
    productTypes: c.productTypes ?? ['primary'],
    scheme: c.scheme ?? 'conventional',
    fixedMonths: intInput(fixed?.durationMonths),
    fixedRateBps: bpsInput(fixed?.rateBps),
    floatingRateBps: bpsInput(floating?.rateBps),
    provisionBps: bpsInput(fees.provisionBps),
    admin: moneyInput(fees.admin),
    appraisal: moneyInput(fees.appraisal),
    notary: moneyInput(fees.notary),
    insurance: moneyInput(fees.insurance),
    maximumDtiBps: bpsInput(el.maximumDtiBps),
    maximumLtvBps: bpsInput(el.maximumLtvBps),
    maximumTenorMonths: intInput(el.maximumTenorMonths),
    minimumIncome: moneyInput(el.minimumIncome),
    minimumAge: intInput(el.minimumAge),
    maximumAgeAtMaturity: intInput(el.maximumAgeAtMaturity),
    occupations: el.occupations ?? [],
    propertyTypes: el.propertyTypes ?? [],
    purposes: el.purposes ?? [],
    effectiveFrom: c.effectiveFrom ?? '',
    effectiveUntil: c.effectiveUntil ?? '',
    lastVerifiedAt: c.lastVerifiedAt ?? '',
  }
}

function fromForm(f) {
  const primary = f.productTypes.includes('primary')
  const takeover = f.productTypes.includes('takeover')
  return {
    bankId: f.bankId,
    name: f.name,
    productTypes: f.productTypes,
    scheme: f.scheme,
    ratePeriods: [
      { type: 'fixed', durationMonths: toInt(f.fixedMonths), rateBps: toBps(f.fixedRateBps) },
      { type: 'floating', durationMonths: null, rateBps: toBps(f.floatingRateBps), estimated: true },
    ],
    fees: { provisionBps: toBps(f.provisionBps), admin: toMoney(f.admin), ...(takeover && { appraisal: toMoney(f.appraisal), notary: toMoney(f.notary), insurance: toMoney(f.insurance) }) },
    eligibility: {
      maximumDtiBps: toBps(f.maximumDtiBps),
      maximumLtvBps: toBps(f.maximumLtvBps),
      maximumTenorMonths: toInt(f.maximumTenorMonths),
      ...(primary && { minimumIncome: toMoney(f.minimumIncome), minimumAge: toInt(f.minimumAge), maximumAgeAtMaturity: toInt(f.maximumAgeAtMaturity), occupations: f.occupations, propertyTypes: f.propertyTypes }),
      ...(takeover && { purposes: f.purposes }),
    },
    effectiveFrom: f.effectiveFrom || null,
    effectiveUntil: f.effectiveUntil || null,
    lastVerifiedAt: f.lastVerifiedAt || null,
  }
}

// A row of checkboxes over a value list (types, occupations, property types, top-up purposes).
function CheckGroup({ legend, options, value, onChange, error }) {
  return (
    <fieldset className="flex flex-col gap-1 sm:col-span-2">
      <legend className="mb-2 text-sm font-semibold text-ink-2">{legend}</legend>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {options.map((o) => (
          <CheckboxField key={o.value} label={o.label} checked={value.includes(o.value)} onChange={(on) => onChange(on ? [...value, o.value] : value.filter((x) => x !== o.value))} />
        ))}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </fieldset>
  )
}

export function ProductFormPage() {
  const { productId } = useParams()
  const { data, error, reload, setData } = useResource(() => (productId ? api.admin.products.get(productId) : api.admin.banks.list().then((banks) => ({ banks, content: {} }))), [productId])
  if (!data) {
    return (
      <>
        <AdminHeader title={productId ? 'Detail produk' : 'Produk baru'} back="/admin/products" />
        {error ? <ErrorPanel onRetry={reload} title={error.code === 'RESOURCE_NOT_FOUND' ? 'Produk tidak ditemukan.' : undefined} /> : <PageSkeleton />}
      </>
    )
  }
  // Keyed by the loaded product, not the URL: while a new id loads, the previous data is still on screen.
  return <ProductForm key={data.product?.id ?? 'new'} data={data} setData={setData} />
}

function ProductForm({ data, setData }) {
  const navigate = useNavigate()
  const p = data.product
  const [saved, setSaved] = useState(() => toForm(data.content))
  const [f, setF] = useState(saved)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [reason, setReason] = useState('')
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(saved)
  const archived = p?.status === 'archived'
  const err = (k) => fieldErrors[k]
  const primary = f.productTypes.includes('primary')
  const takeover = f.productTypes.includes('takeover')
  const issueCount = p ? Object.keys(data.issues).length : 0

  const applyDetail = (d) => {
    setData(d)
    const next = toForm(d.content)
    setSaved(next)
    setF(next)
    setFieldErrors({})
    return d
  }
  const asErrors = (e) => Object.fromEntries((e.fieldErrors ?? []).map((x) => [x.field, x.message]))
  const save = async () => {
    setSaving(true)
    try {
      if (!p) {
        const d = await api.admin.products.create({ values: fromForm(f) })
        toast('Draft produk tersimpan.')
        navigate(`/admin/products/${d.product.id}`, { replace: true })
        return
      }
      applyDetail(await api.admin.products.update(p.id, { values: fromForm(f), expectedVersion: p.rev }))
      toast(p.status === 'published' ? 'Revisi tersimpan. Terbitkan agar berlaku.' : 'Draft produk tersimpan.')
    } catch (e) {
      setFieldErrors(asErrors(e))
      if (!e.fieldErrors?.length) toast(e.message)
    } finally {
      setSaving(false)
    }
  }
  // Publishing sends unsaved edits first, so the admin never publishes something other than what is on screen.
  const publish = async () => {
    let d = data
    if (dirty) d = applyDetail(await api.admin.products.update(p.id, { values: fromForm(f), expectedVersion: p.rev }))
    try {
      applyDetail(await api.admin.products.publish(p.id, { reason, expectedVersion: d.product.rev }))
    } catch (e) {
      setFieldErrors(asErrors(e))
      throw e
    }
    toast('Produk terbit dan dipakai pencocokan.')
  }
  const archive = async () => {
    applyDetail(await api.admin.products.archive(p.id, { reason, expectedVersion: p.rev }))
    toast('Produk diarsipkan.')
  }
  const statusLine = p && (p.status === 'published' ? `Terbit · versi ${p.version}` : p.status === 'archived' ? 'Diarsipkan' : 'Draft')

  return (
    <>
      <AdminHeader title={p ? p.name : 'Produk baru'} subtitle={p ? `${p.bankName} · ${statusLine}` : 'Isi bertahap; draft belum tampil ke user.'} back="/admin/products" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="flex min-w-0 flex-col gap-6"
        >
          <fieldset disabled={archived} className="flex min-w-0 flex-col gap-6">
            <Panel>
              <PanelTitle>Info dasar</PanelTitle>
              <FormGrid>
                <SelectField label="Bank" required value={f.bankId} onChange={set('bankId')} options={data.banks.map((b) => ({ value: b.id, label: b.active ? b.name : `${b.name} (nonaktif)` }))} error={err('bankId')} />
                <TextField label="Nama produk" required value={f.name} onChange={set('name')} error={err('name')} />
                <CheckGroup legend="Jenis produk" options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} value={f.productTypes} onChange={set('productTypes')} error={err('productTypes')} />
                <SelectField label="Skema" value={f.scheme} onChange={set('scheme')} options={[{ value: 'conventional', label: 'Konvensional' }, { value: 'sharia', label: 'Syariah' }]} error={err('scheme')} />
              </FormGrid>
            </Panel>
            <Panel>
              <PanelTitle sub="Bunga floating selalu ditandai estimasi untuk user.">Bunga</PanelTitle>
              <FormGrid>
                <NumberField label="Masa fixed" suffix="bulan" value={f.fixedMonths} onChange={set('fixedMonths')} error={err('fixedMonths')} />
                <RateField label="Bunga fixed" value={f.fixedRateBps} onChange={set('fixedRateBps')} error={err('fixedRateBps')} />
                <RateField label="Estimasi bunga floating" value={f.floatingRateBps} onChange={set('floatingRateBps')} error={err('floatingRateBps')} />
              </FormGrid>
            </Panel>
            <Panel>
              <PanelTitle>Biaya</PanelTitle>
              <FormGrid>
                <TextField label="Provisi" suffix="% dari plafon" inputMode="decimal" placeholder="1,00" value={f.provisionBps} onChange={set('provisionBps')} error={err('provisionBps')} />
                <MoneyField label="Biaya administrasi" value={f.admin} onChange={set('admin')} error={err('admin')} />
                {takeover && (
                  <>
                    <MoneyField label="Biaya appraisal" value={f.appraisal} onChange={set('appraisal')} error={err('appraisal')} />
                    <MoneyField label="Biaya notaris" value={f.notary} onChange={set('notary')} error={err('notary')} />
                    <MoneyField label="Biaya asuransi" value={f.insurance} onChange={set('insurance')} error={err('insurance')} />
                  </>
                )}
              </FormGrid>
            </Panel>
            <Panel>
              <PanelTitle>Syarat</PanelTitle>
              <FormGrid>
                <TextField label="DTI maksimal" suffix="%" inputMode="decimal" value={f.maximumDtiBps} onChange={set('maximumDtiBps')} error={err('maximumDtiBps')} />
                <TextField label="LTV maksimal" suffix="%" inputMode="decimal" value={f.maximumLtvBps} onChange={set('maximumLtvBps')} error={err('maximumLtvBps')} />
                <NumberField label="Tenor maksimal" suffix="bulan" value={f.maximumTenorMonths} onChange={set('maximumTenorMonths')} error={err('maximumTenorMonths')} />
                {primary && (
                  <>
                    <MoneyField label="Penghasilan minimum" value={f.minimumIncome} onChange={set('minimumIncome')} error={err('minimumIncome')} />
                    <NumberField label="Usia minimum" suffix="tahun" value={f.minimumAge} onChange={set('minimumAge')} error={err('minimumAge')} />
                    <NumberField label="Usia maksimal saat lunas" suffix="tahun" value={f.maximumAgeAtMaturity} onChange={set('maximumAgeAtMaturity')} error={err('maximumAgeAtMaturity')} />
                    <CheckGroup legend="Pekerjaan yang diterima" options={OCCUPATIONS} value={f.occupations} onChange={set('occupations')} error={err('occupations')} />
                    <CheckGroup legend="Jenis properti" options={PROPERTY_TYPES} value={f.propertyTypes} onChange={set('propertyTypes')} error={err('propertyTypes')} />
                  </>
                )}
                {takeover && <CheckGroup legend="Tujuan top-up yang diterima" options={PURPOSES} value={f.purposes} onChange={set('purposes')} error={err('purposes')} />}
              </FormGrid>
            </Panel>
            <Panel>
              <PanelTitle sub="Data lebih dari 30 hari sejak verifikasi ditandai usang dan kehilangan label rekomendasi.">Masa berlaku</PanelTitle>
              <FormGrid>
                <DateField label="Berlaku dari" value={f.effectiveFrom} onChange={set('effectiveFrom')} error={err('effectiveFrom')} />
                <DateField label="Berlaku sampai" value={f.effectiveUntil} onChange={set('effectiveUntil')} error={err('effectiveUntil')} />
                <DateField label="Data diverifikasi" value={f.lastVerifiedAt} onChange={set('lastVerifiedAt')} error={err('lastVerifiedAt')} />
              </FormGrid>
            </Panel>
          </fieldset>
          {!archived && (
            <Button type="submit" className="w-fit" disabled={saving || (p && !dirty)} aria-busy={saving}>
              {saving && <Spinner />}
              Simpan draft
            </Button>
          )}
        </form>

        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
          {p && (
            <Panel>
              <PanelTitle>Status</PanelTitle>
              {p.status === 'published' && <Notice tone="info">Produk ini tampil di pencocokan. Perubahan disimpan sebagai revisi dan baru berlaku setelah diterbitkan.</Notice>}
              {p.hasPendingRevision && <Notice tone="warn" title="Ada revisi yang belum terbit." />}
              {archived && <Notice tone="muted">Produk diarsipkan: tidak tampil di pencocokan. Pengajuan lama tetap menyimpan datanya.</Notice>}
              {!archived && issueCount > 0 && (
                <Notice tone="warn" title="Belum bisa diterbitkan">
                  {issueCount} data masih perlu dilengkapi. Simpan, lalu cek pesan di setiap bagian.
                </Notice>
              )}
              {!archived && issueCount === 0 && (p.status === 'draft' || p.hasPendingRevision) && <Notice tone="ok" icon={CircleCheckIcon} title="Siap diterbitkan." />}
              {!archived && (
                <div className="flex flex-wrap gap-3">
                  {(p.status === 'draft' || p.hasPendingRevision || dirty) && (
                    <Button size="sm" onClick={() => setConfirm('publish')}>
                      Terbitkan
                    </Button>
                  )}
                  <Button size="sm" variant="destructive-soft" onClick={() => setConfirm('archive')}>
                    Arsipkan
                  </Button>
                </div>
              )}
            </Panel>
          )}
          {p && !archived && <PreviewPanel product={p} values={fromForm(f)} />}
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null)
            setReason('')
          }
        }}
        destructive={confirm === 'archive'}
        title={confirm === 'archive' ? 'Arsipkan produk ini?' : 'Terbitkan produk ini?'}
        body={confirm === 'archive' ? 'Produk berhenti tampil di pencocokan. Pengajuan yang sudah memilihnya tidak berubah.' : 'Produk langsung dipakai pencocokan program untuk semua user.'}
        confirmLabel={confirm === 'archive' ? 'Ya, arsipkan' : 'Ya, terbitkan'}
        confirmDisabled={reason.trim().length < 5}
        onConfirm={confirm === 'archive' ? archive : publish}
      >
        <TextAreaField label="Alasan" required rows={2} value={reason} onChange={setReason} hint="Masuk ke audit log (minimal 5 karakter)." />
      </ConfirmDialog>
    </>
  )
}

function PreviewPanel({ product, values }) {
  const typical = product.productTypes.includes('primary') ? { principal: '500000000', tenor: '240' } : { principal: '400000000', tenor: '180' }
  const [principal, setPrincipal] = useState(typical.principal)
  const [tenor, setTenor] = useState(typical.tenor)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.admin.products.preview(product.id, { principal: toMoney(principal), termMonths: toInt(tenor), values }))
    } catch (e) {
      setResult(null)
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel>
      <PanelTitle sub="Memakai engine yang sama dengan pencocokan user, dari isi form saat ini.">Simulasi</PanelTitle>
      <div className="grid grid-cols-1 gap-4">
        <MoneyField label="Plafon simulasi" value={principal} onChange={setPrincipal} />
        <NumberField label="Tenor simulasi" suffix="bulan" value={tenor} onChange={setTenor} />
      </div>
      <Button variant="outline" size="sm" className="w-fit" onClick={run} disabled={busy} aria-busy={busy}>
        {busy && <Spinner />}
        Hitung simulasi
      </Button>
      {error && (
        <Notice tone="bad" role="alert">
          {error.fieldErrors?.length ? error.fieldErrors.map((x) => x.message).join(' ') : error.message}
        </Notice>
      )}
      {result && (
        <SummaryRows
          rows={[
            { k: `Cicilan masa fixed (${result.fixedMonths} bulan)`, v: rupiah(result.payment) },
            result.paymentAfterFixed != null && { k: 'Cicilan setelah fixed (estimasi)', v: rupiah(result.paymentAfterFixed) },
            { k: 'Total pembayaran', v: rupiah(result.totalPayment) },
          ]}
        />
      )}
    </Panel>
  )
}

export function BankListPage() {
  const { data, error, reload, setData } = useResource(() => api.admin.banks.list())
  const [editing, setEditing] = useState(null)
  return (
    <>
      <AdminHeader
        title="Banks & Products"
        subtitle="Bank nonaktif tidak ikut pencocokan, termasuk semua produknya."
        actions={
          <Button size="sm" onClick={() => setEditing({})}>
            <PlusIcon aria-hidden />
            Tambah bank
          </Button>
        }
      />
      <CatalogTabs />
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <Panel>
          <Table aria-label="Daftar bank">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={head}>Bank</TableHead>
                <TableHead className={head}>Produk terbit</TableHead>
                <TableHead className={head}>Status</TableHead>
                <TableHead className={head}>
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="py-3">
                    <span className="flex flex-col">
                      <span className="font-bold">{b.name}</span>
                      <span className="text-xs text-muted-foreground">Kode {b.mark}</span>
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-ink-2 tabular">
                    {b.published} dari {b.products}
                  </TableCell>
                  <TableCell className="py-3">
                    <Chip tone={b.active ? 'ok' : 'mute'} className="whitespace-nowrap">
                      {b.active ? 'Aktif' : 'Nonaktif'}
                    </Chip>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button variant="neutral" size="xs" onClick={() => setEditing(b)}>
                      Ubah
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
      {editing && (
        <BankDialog
          bank={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setData((list) => (list.some((b) => b.id === saved.id) ? list.map((b) => (b.id === saved.id ? { ...b, ...saved } : b)) : [...list, { ...saved, products: 0, published: 0 }]))
            setEditing(null)
            toast('Bank tersimpan.')
          }}
        />
      )}
    </>
  )
}

function BankDialog({ bank, onClose, onSaved }) {
  const isNew = !bank.id
  const [v, setV] = useState({ name: bank.name ?? '', mark: bank.mark ?? '', active: bank.active ?? true })
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldError = (k) => error?.fieldErrors?.find((x) => x.field === k)?.message
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(isNew ? await api.admin.banks.create({ values: v, reason }) : await api.admin.banks.update(bank.id, { values: v, reason, expectedVersion: bank.version }))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }
  return (
    <FormDialog open onOpenChange={(open) => !open && !saving && onClose()} title={isNew ? 'Tambah bank' : `Ubah ${bank.name}`}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <FormGrid>
          <TextField label="Nama bank" required value={v.name} onChange={(x) => setV({ ...v, name: x })} error={fieldError('name')} />
          <TextField label="Kode bank" required maxLength={5} hint="2–5 huruf, tampil di logo bank." value={v.mark} onChange={(x) => setV({ ...v, mark: x.toUpperCase() })} error={fieldError('mark')} />
        </FormGrid>
        {!isNew && <CheckboxField label="Bank aktif (produknya ikut pencocokan)" checked={v.active} onChange={(x) => setV({ ...v, active: x })} />}
        <TextAreaField label="Alasan perubahan" required rows={2} value={reason} onChange={setReason} error={fieldError('reason')} />
        {error && !error.fieldErrors?.length && (
          <Notice tone="bad" role="alert">
            {error.code === 'CONFLICT_VERSION' ? 'Data bank sudah berubah. Tutup, muat ulang, lalu ulangi.' : error.message}
          </Notice>
        )}
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          Simpan bank
        </Button>
      </form>
    </FormDialog>
  )
}
