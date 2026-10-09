import { useState } from 'react'
import { toast } from 'sonner'
import { BriefcaseIcon, GaugeIcon, HandCoinsIcon, HouseIcon, InfoIcon, LockIcon, UserIcon } from 'lucide-react'
import { api } from '@/data/api'
import { calculatePaymentCapacity } from '@/calculations/finance'
import { useForm } from '@/lib/hooks'
import { CITIES, GENDERS, MARITAL, OCCUPATIONS, PROPERTY_TYPES, intInput, moneyInput, percentRatio, rupiah, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { CheckboxField, DateField, ErrorSummary, FormGrid, MoneyField, NumberField, RadioCards, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { UnsavedChangesGuard } from '@/components/shared/dialogs'
import { Disclaimer, IconBox, Notice, Panel, Spinner } from '@/components/shared/ui'
import { Aside } from '@/domains/optimize/shared'
import { toEmployment, toPersonal, validateEmployment, validatePersonal, validatePrimaryLoan, validatePrimaryProperty } from './validation'

const TENORS = [5, 10, 15, 20, 25, 30].map((y) => ({ value: String(y * 12), label: `${y} tahun` }))
const PURCHASE = [
  { value: 'new_from_developer', label: 'Rumah baru dari developer', description: 'Dokumen properti: SPR / PPJB dari developer.' },
  { value: 'used_from_owner', label: 'Rumah bekas dari pemilik', description: 'Dokumen properti: AJB / sertifikat / dokumen penjual.' },
]
const HIGHLIGHT_ON_REJECT = ['monthlyIncome', 'vehicleDebt', 'cardDebt', 'otherDebt', 'downPayment', 'amount', 'tenorMonths']

// Wizard steps 1–4: one short section per step, all sharing one form shape.
const SECTIONS = {
  1: { title: 'Profil Pribadi', icon: UserIcon, validate: validatePersonal },
  2: { title: 'Data Pekerjaan & Penghasilan', icon: BriefcaseIcon, validate: validateEmployment },
  3: { title: 'Detail Properti', icon: HouseIcon, validate: validatePrimaryProperty },
  4: { title: 'Uang Muka & Pinjaman', icon: HandCoinsIcon, validate: validatePrimaryLoan },
}

function initialValues(data) {
  const { personal: p = {}, employment: e = {}, property: pr = {}, loan: l = {} } = data
  return {
    fullName: p.fullName ?? '',
    nik: p.nik ?? '',
    birthPlace: p.birthPlace ?? '',
    birthDate: p.birthDate ?? '',
    gender: p.gender ?? '',
    maritalStatus: p.maritalStatus ?? '',
    address: p.address ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    occupation: e.occupation ?? '',
    companyName: e.companyName ?? '',
    jobTitle: e.jobTitle ?? '',
    workYears: intInput(e.workYears),
    workMonths: intInput(e.workMonths),
    monthlyIncome: moneyInput(e.monthlyIncome),
    jointIncome: e.jointIncome ?? false,
    partnerIncome: moneyInput(e.partnerIncome),
    vehicleDebt: moneyInput(e.vehicleDebt),
    cardDebt: moneyInput(e.cardDebt),
    otherDebt: moneyInput(e.otherDebt),
    purchaseType: pr.purchaseType ?? '',
    developerName: pr.developerName ?? '',
    sellerName: pr.sellerName ?? '',
    propertyType: pr.propertyType ?? '',
    propertyAddress: pr.address ?? '',
    city: pr.city ?? '',
    price: moneyInput(pr.price),
    downPayment: moneyInput(l.downPayment),
    amount: moneyInput(l.amount),
    amountEdited: l.amountEdited ?? false,
    tenorMonths: l.tenorMonths ? String(l.tenorMonths) : '',
    savings: moneyInput(l.savings),
  }
}

function stepValues(step, v) {
  if (step === 1) return { personal: toPersonal(v) }
  if (step === 2) return { employment: toEmployment(v) }
  const price = toMoney(v.price)
  const dp = toMoney(v.downPayment)
  if (step === 3) {
    return {
      property: {
        purchaseType: v.purchaseType,
        developerName: v.purchaseType === 'new_from_developer' ? v.developerName.trim() : null,
        sellerName: v.purchaseType === 'used_from_owner' ? v.sellerName.trim() || null : null,
        propertyType: v.propertyType,
        address: v.propertyAddress.trim(),
        city: v.city,
        price,
      },
      // Loan stays Harga − DP until the user edits it (PRD §9.4), so a new price carries over.
      ...(!v.amountEdited && dp !== null && price > dp ? { loan: { amount: price - dp } } : {}),
    }
  }
  return { loan: { downPayment: dp, amount: toMoney(v.amount), amountEdited: v.amountEdited, tenorMonths: Number(v.tenorMonths), savings: toMoney(v.savings) } }
}

const SAMPLE = {
  fullName: 'Firdi Audi', nik: '3174012345678901', birthPlace: 'Bekasi', birthDate: '1996-04-12', gender: 'male', maritalStatus: 'single',
  address: 'Jl. Melati No. 12, Jaka Setia, Bekasi Selatan', phone: '081234567890', email: 'firdi.audi@email.com',
  occupation: 'private_employee', companyName: 'PT Nusantara Digital', jobTitle: 'Product Designer', workYears: '4', workMonths: '6',
  monthlyIncome: '15000000', vehicleDebt: '1000000', cardDebt: '500000', otherDebt: '0', developerName: 'PT Griya Asri Sejahtera',
  propertyType: 'landed_house', propertyAddress: 'Rumah Griya Asri Blok C2 No. 8, Bekasi', city: 'Kota Bekasi', price: '500000000', downPayment: '100000000', amount: '400000000', tenorMonths: '240',
}

// `app` is null only on step 1 of a fresh application: the draft is created on the first save.
export function PrimaryDetailsStep({ step, app, snapshot, onCreated, onSaved, fromReview, go }) {
  const section = SECTIONS[step]
  const { clock, profile = {}, user } = snapshot
  const form = useForm(initialValues(app?.data ?? { personal: { ...profile, fullName: profile.fullName ?? user?.name } }), (v) => section.validate(v, { today: clock }))
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const v = form.values
  const fixMode = !!app?.lastRejection && (step === 2 || step === 4)
  const b = (k) => ({ ...form.bind(k), highlight: fixMode && HIGHLIGHT_ON_REJECT.includes(k) })

  const setMoney = (k) => (val) => {
    const next = { ...v, [k]: val }
    if (k === 'downPayment' && !v.amountEdited) {
      const price = toMoney(next.price)
      const dp = toMoney(val)
      next.amount = price && dp !== null && price > dp ? String(price - dp) : ''
    }
    if (k === 'amount') next.amountEdited = true
    form.setValues(next)
  }
  const setPurchase = (val) => form.setValues({ ...v, purchaseType: val, developerName: val === 'new_from_developer' ? v.developerName : '', sellerName: val === 'used_from_owner' ? v.sellerName : '' })

  const income = (toMoney(v.monthlyIncome) ?? 0) + (v.jointIncome ? toMoney(v.partnerIncome) ?? 0 : 0)
  const debts = (toMoney(v.vehicleDebt) ?? 0) + (toMoney(v.cardDebt) ?? 0) + (toMoney(v.otherDebt) ?? 0)
  const capacity = income > 0 ? calculatePaymentCapacity({ monthlyIncome: income, existingDebt: debts }) : null
  const price = toMoney(v.price)
  const dp = toMoney(v.downPayment)
  const self = v.occupation === 'entrepreneur' || v.occupation === 'freelancer'
  const savedPurchase = app?.data?.property?.purchaseType
  const dropsPropertyDoc = step === 3 && savedPurchase && v.purchaseType !== savedPurchase && app.documents?.property_document
  // Property edits from Review continue to the loan step, since the price drives the loan.
  const backToReview = fromReview && step !== 3

  const entered = (n) => (n == null ? { v: 'Belum diisi', tone: 'mute' } : { v: rupiah(n) })
  const room = capacity && Math.max(0, capacity.remainingCapacity)
  const roomRow = capacity && { k: 'Sisa kapasitas cicilan', v: `${rupiah(room)}/bln`, tone: room > 0 ? 'ok' : 'bad', strong: true }
  const aside = {
    1: <Aside icon={LockIcon} title="Data kamu aman" note="Data tidak dikirim ke bank sebelum kamu memilih satu program, memberi persetujuan, dan menekan Submit." />,
    2: (
      <Aside
        icon={GaugeIcon}
        tone={capacity && !room ? 'warn' : 'info'}
        title="Kapasitas cicilan aman"
        rows={capacity ? [{ k: 'Penghasilan', v: `${rupiah(income)}/bln` }, { k: 'Batas aman 35%', v: rupiah(capacity.safePayment) }, { k: 'Cicilan lain', v: rupiah(-debts) }, roomRow] : []}
        note={capacity ? 'Estimasi, bukan keputusan bank.' : 'Isi penghasilan bulanan untuk melihat kapasitas cicilan aman.'}
      />
    ),
    3: <Aside icon={InfoIcon} title="Kenapa kami tanya ini?" note="Jenis pembelian menentukan dokumen properti yang diminta di step Upload Dokumen. Harga properti jadi dasar uang muka dan jumlah pinjaman di step berikutnya." />,
    4: (
      <Aside
        icon={HandCoinsIcon}
        tone={capacity && !room ? 'warn' : 'info'}
        title="Ringkasan pinjaman"
        rows={[
          { k: 'Harga properti', ...entered(price) },
          { k: 'Uang muka', ...(price && dp !== null ? { v: `${rupiah(dp)} (${percentRatio(dp / price)})` } : entered(dp)) },
          { k: 'Jumlah pinjaman', ...entered(toMoney(v.amount)), strong: true },
          roomRow,
        ]}
        note="Cicilan tiap program dihitung di step Bandingkan Program Bank. Semua angka estimasi, bukan keputusan bank."
      />
    ),
  }[step]

  const onSubmit = form.submit(async (values) => {
    setSaving(true)
    setApiError('')
    try {
      let target = app
      if (!target) {
        target = await api.applications.create({ productType: 'primary' })
        onCreated(target)
      }
      const saved = await api.applications.saveStep(target.id, { step, values: stepValues(step, values) })
      form.markClean()
      onSaved(saved)
      toast('Tersimpan otomatis.')
      // Saving the last screen of a phase (2 / 4) opens its milestone insight first.
      if (!fromReview) go(`/apply/primary/${step + 1}`, step === 2 || step === 4 ? { state: { milestone: step / 2 } } : undefined)
      else if (!backToReview) go('/apply/primary/4', { state: { from: 'review' } })
      else go(saved.selection ? '/apply/primary/7' : '/apply/primary/6')
    } catch (e) {
      setApiError(e.message)
    } finally {
      setSaving(false)
    }
  })

  return (
    // Same two-column shape as the Take Over form; the aside drops below the form under 1280px, where the sidebar leaves too little width.
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <UnsavedChangesGuard when={form.dirty && !saving} />
        {fixMode && (
          <Notice tone="warn" role="status" title="Perbaiki data sebelum ajukan ulang">
            {app.lastRejection.displayReason} Cek penghasilan, cicilan lain, uang muka, atau kecilkan jumlah pinjaman. Field terkait ditandai kuning.
          </Notice>
        )}
        <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
        {import.meta.env.DEV && (
          <div className="flex justify-end">
            <button type="button" onClick={() => form.setValues({ ...v, ...SAMPLE, purchaseType: v.purchaseType || 'new_from_developer', amountEdited: false })} className="text-xs font-bold text-muted-foreground underline">
              Isi data contoh
            </button>
          </div>
        )}

        <Panel as="fieldset" className="gap-5 sm:p-7">
          <legend className="contents">
            <span className="flex items-center gap-3">
              <IconBox icon={section.icon} />
              <span className="text-lg font-extrabold">{section.title}</span>
            </span>
          </legend>
          <FormGrid>
            {step === 1 && (
              <>
                <TextField label="Nama Lengkap (sesuai KTP)" placeholder="Firdi Audi" autoComplete="name" span {...b('fullName')} />
                <TextField label="NIK" placeholder="16 digit angka" inputMode="numeric" maxLength={16} {...b('nik')} onChange={(x) => form.set('nik', x.replace(/\D/g, '').slice(0, 16))} />
                <TextField label="Tempat Lahir" placeholder="Bekasi" {...b('birthPlace')} />
                <DateField label="Tanggal Lahir" max={clock} {...b('birthDate')} />
                <RadioCards label="Jenis Kelamin" options={GENDERS} {...b('gender')} />
                <SelectField label="Status Perkawinan" options={MARITAL} {...b('maritalStatus')} />
                <TextAreaField label="Alamat sesuai KTP" placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan, kota" span {...b('address')} />
                <TextField label="Nomor Ponsel" placeholder="0812 3456 7890" inputMode="tel" autoComplete="tel" {...b('phone')} />
                <TextField label="Email" placeholder="nama@email.com" type="email" autoComplete="email" {...b('email')} />
              </>
            )}
            {step === 2 && (
              <>
                <SelectField label="Jenis Pekerjaan" options={OCCUPATIONS} other="Tulis jenis pekerjaan" span {...b('occupation')} />
                <TextField label={self ? 'Nama Usaha' : 'Nama Perusahaan'} placeholder="PT Nusantara Digital" {...b('companyName')} />
                <TextField label={self ? 'Bidang Usaha' : 'Jabatan'} placeholder="Product Designer" {...b('jobTitle')} />
                <NumberField label="Lama Bekerja (tahun)" placeholder="4" suffix="tahun" {...b('workYears')} />
                <NumberField label="Lama Bekerja (bulan)" placeholder="6" suffix="bulan" {...b('workMonths')} />
                <MoneyField label="Penghasilan Bulanan (gross)" placeholder="15.000.000" span {...b('monthlyIncome')} />
                <CheckboxField label="Gabungkan pendapatan dengan pasangan" boxed span checked={v.jointIncome} onChange={(x) => form.setValues({ ...v, jointIncome: x, partnerIncome: x ? v.partnerIncome : '' })} />
                {v.jointIncome && <MoneyField label="Penghasilan Pasangan" placeholder="8.000.000" hint="Dijumlahkan dengan penghasilanmu." span {...b('partnerIncome')} />}
                <MoneyField label="Cicilan Kendaraan" placeholder="0" hint="Isi 0 kalau tidak ada." {...b('vehicleDebt')} />
                <MoneyField label="Kartu Kredit / Paylater" placeholder="0" hint="Isi 0 kalau tidak ada." {...b('cardDebt')} />
                <MoneyField label="Pinjaman Lain" placeholder="0" hint="Isi 0 kalau tidak ada." span {...b('otherDebt')} />
              </>
            )}
            {step === 3 && (
              <>
                <RadioCards label="Jenis pembelian" options={PURCHASE} span {...b('purchaseType')} onChange={setPurchase} />
                {v.purchaseType === 'new_from_developer' && <TextField label="Nama Developer" placeholder="PT Griya Asri Sejahtera" span {...b('developerName')} />}
                {v.purchaseType === 'used_from_owner' && <TextField label="Nama Penjual" optional placeholder="Budi Santoso" span {...b('sellerName')} />}
                <SelectField label="Jenis Properti" options={PROPERTY_TYPES} hint="Tidak menjamin program bank menerima jenis properti ini." {...b('propertyType')} />
                <SelectField label="Kota / Kabupaten" options={CITIES} {...b('city')} />
                <TextAreaField label="Alamat Properti" placeholder="Rumah Griya Asri Blok C2 No. 8, Bekasi" span {...b('propertyAddress')} />
                <MoneyField label="Harga Properti" placeholder="500.000.000" span {...b('price')} />
              </>
            )}
            {step === 4 && (
              <>
                <MoneyField label="Uang Muka (DP)" placeholder="100.000.000" hint={price && dp !== null && price > 0 ? `${percentRatio(dp / price)} dari harga properti ${rupiah(price)}` : `Harga properti ${rupiah(price)}.`} {...b('downPayment')} onChange={setMoney('downPayment')} />
                <MoneyField label="Jumlah Pinjaman" placeholder="400.000.000" hint={v.amountEdited ? 'Diubah manual. Maksimal Harga − DP.' : 'Otomatis dari Harga − DP. Bisa diubah manual.'} {...b('amount')} onChange={setMoney('amount')} />
                <SelectField label="Tenor" options={TENORS} placeholder="Pilih tenor" {...b('tenorMonths')} />
                <MoneyField label="Dana tabungan / dana siap pakai" optional placeholder="0" {...b('savings')} />
              </>
            )}
          </FormGrid>
          {dropsPropertyDoc && (
            <Notice tone="warn" role="status" title="Dokumen properti akan direset">
              Dokumen untuk rumah baru dan bekas berbeda, jadi dokumen properti yang sudah diunggah dihapus saat kamu simpan. Data lain tetap tersimpan.
            </Notice>
          )}
          {step === 2 && (
            <div className="flex items-center gap-2 text-xs leading-[18px] text-ink-3">
              <LockIcon className="size-3.5 text-success" aria-hidden />
              Data kamu hanya digunakan untuk proses pengajuan KPR yang kamu setujui.
            </div>
          )}
        </Panel>

        {apiError && <Notice tone="bad" role="alert" title="Belum tersimpan">{apiError} Data yang kamu isi tetap ada.</Notice>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="neutral" onClick={() => go(fromReview ? '/apply/primary/7' : step === 1 ? '/' : `/apply/primary/${step - 1}`)}>
            Kembali
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            {form.hasErrors && <span className="text-center text-xs text-muted-foreground">Lengkapi semua field wajib untuk lanjut.</span>}
            <Button type="submit" disabled={saving} aria-busy={saving} className={form.hasErrors ? 'bg-border text-ink-3 hover:bg-border' : ''}>
              {saving && <Spinner />}
              {saving ? 'Menyimpan…' : backToReview ? 'Simpan & kembali ke Review' : 'Simpan & Lanjutkan'}
            </Button>
          </div>
        </div>
        {step > 1 && <Disclaimer>Mengubah data pinjaman, harga, atau penghasilan setelah memilih program akan mereset pilihan program agar dibandingkan ulang.</Disclaimer>}
      </div>
      {aside}
    </form>
  )
}
