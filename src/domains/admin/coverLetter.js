// Surat Pengantar Aplikasi KPR (spec 2026-10-16): when it can be printed, the bank form's checklist rows, the prefill
// from an application, and what a saved letter holds. mockApi and the admin page share these.
import { parseIsoDate } from '@/calculations/dates'

export const PRINTABLE_STATUSES = ['bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed']

export const APPLICANT_COLUMNS = [
  { value: 'employee', label: 'Pegawai' },
  { value: 'entrepreneur', label: 'Pengusaha' },
  { value: 'professional', label: 'Profesional' },
]
const COLUMN_OF = { civil_servant: 'employee', private_employee: 'employee', contract_employee: 'employee', entrepreneur: 'entrepreneur', freelancer: 'professional' }

// Office defaults kept in Configuration (config.coverLetter); a new letter starts from them.
export const OFFICE_FIELDS = ['officeName', 'maName', 'maId', 'boName', 'feeAccount']
export const DEFAULT_OFFICE = Object.fromEntries(OFFICE_FIELDS.map((k) => [k, '']))
export const officeInput = (v = {}) => Object.fromEntries(OFFICE_FIELDS.map((k) => [k, String(v[k] ?? '').trim()]))
export const officeIssues = (v) => Object.fromEntries(OFFICE_FIELDS.filter((k) => v[k].length > 160).map((k) => [k, 'Maksimal 160 karakter.']))

// `docs` names the RuangKPR documents behind a row, per product (Take Over + Top-up reads `takeover`). A row starts
// ticked when all of them are verified; a row without them is ticked by hand.
const row = (key, label, docs = {}) => ({ key, label, docs })
const APPLICANT_ROWS = [
  row('app_ktp_kk', 'Fotokopi KTP dan Kartu Keluarga (suami dan istri)', { primary: ['ktp'], takeover: ['ktp', 'family_card'] }),
  row('app_marriage', 'Copy Akta Nikah / Cerai / Kematian / Perjanjian Pranikah', { takeover: ['marriage_document'] }),
  row('app_npwp', 'Copy NPWP / SPT PPh 21 Pribadi', { primary: ['npwp'], takeover: ['npwp'] }),
  row('app_savings', 'Copy Rek. Tabungan / Giro terakhir', { takeover: ['bank_statement'] }),
  row('app_income', 'Asli Surat Keterangan Kerja dan Slip Gaji', { primary: ['income_proof'], takeover: ['income_proof'] }),
  row('app_license', 'Copy Surat Izin Praktek'),
  row('app_company', 'Fotokopi Akta Pendirian Perusahaan dan perubahannya, NPWP, SIUP, TDP **'),
  row('app_property', 'Surat Pemesanan Rumah (untuk rumah baru) atau Sertifikat, IMB, Denah Bangunan, AJB dan PBB (untuk rumah second)', { primary: ['property_document'], takeover: ['certificate'] }),
]
const HOUSE_ROWS = [
  row('house_certificate', 'Copy sertifikat HM / HGB', { takeover: ['certificate'] }),
  row('house_permit', 'Copy IMB', { takeover: ['building_permit'] }),
  row('house_plan', 'Copy Denah Bangunan'),
  row('house_ajb', 'Copy Akte Jual Beli', { takeover: ['sale_purchase_agreement'] }),
  row('house_pbb', 'Copy PBB Terakhir', { takeover: ['land_tax'] }),
]
const SELLER_ROWS = [
  row('seller_ktp', 'Copy KTP Penjual'),
  row('seller_spouse_ktp', 'Copy KTP istri/suami Penjual'),
  row('seller_kk', 'Copy Kartu Keluarga Penjual'),
  row('seller_marriage', 'Copy Akta Nikah Penjual'),
  row('seller_npwp', 'Copy NPWP Penjual'),
  row('seller_death', 'Copy Akta Kematian dan Keterangan Waris (jika Penjual meninggal)'),
]
const OLD_LOAN_ROWS = [
  row('old_agreement', 'Copy Akad Kredit Lama', { takeover: ['old_loan_agreement'] }),
  row('old_outstanding', 'Surat Keterangan Sisa Pokok', { takeover: ['outstanding_letter'] }),
  row('old_payment', 'Bukti Angsuran Terakhir', { takeover: ['latest_payment_proof'] }),
  row('old_payoff', 'Informasi Pelunasan / Penalti', { takeover: ['payoff_info'] }),
]
const FUND_PLAN_ROW = row('topup_plan', 'Rencana Penggunaan Dana', { takeover: ['fund_plan'] })

export const variantOf = (app) => (app.productType === 'primary' ? 'primary' : app.optimizationMode === 'topup' ? 'topup' : 'takeover')

export function letterRows(variant) {
  const second = variant === 'primary' ? { title: 'Dokumen Penjual', rows: SELLER_ROWS } : { title: 'Dokumen KPR Lama', rows: variant === 'topup' ? [...OLD_LOAN_ROWS, FUND_PLAN_ROW] : OLD_LOAN_ROWS }
  return { applicant: APPLICANT_ROWS, house: HOUSE_ROWS, second }
}
const allRows = (variant) => {
  const r = letterRows(variant)
  return [...r.applicant, ...r.house, ...r.second.rows]
}

// The day the application went to the bank, in WIB.
const wibDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso))

// A letter nobody saved yet: the application's own data (the submitted snapshot) and the office defaults.
export function prefillLetter({ app, data, userName, office }) {
  const variant = variantOf(app)
  const group = variant === 'primary' ? 'primary' : 'takeover'
  const verified = (type) => app.documents?.[type]?.status === 'verified'
  const loanAmount = app.selection?.loanAmount ?? null
  const outstanding = data.oldLoan?.outstanding ?? 0
  const forwarded = app.statusHistory?.find((h) => h.status === 'bank_processing')?.at
  return {
    ...officeInput(office),
    customerName: data.personal?.fullName || userName,
    propertyAddress: data.property?.address ?? '',
    bankName: app.selection?.bankName ?? '',
    loanAmount,
    ...(variant === 'topup' && { takeoverAmount: outstanding, topupAmount: Math.max(0, (loanAmount ?? 0) - outstanding) }),
    submittedDate: forwarded ? wibDate(forwarded) : '',
    salesOfficer: '',
    applicantColumn: COLUMN_OF[data.employment?.occupation] ?? 'employee',
    checked: allRows(variant)
      .filter((r) => r.docs[group]?.every(verified))
      .map((r) => r.key),
  }
}

const TEXT_FIELDS = ['maName', 'maId', 'officeName', 'customerName', 'propertyAddress', 'bankName', 'salesOfficer', 'boName', 'feeAccount']
const REQUIRED = {
  maName: 'Isi nama Marketing Associate.',
  maId: 'Isi No. ID RE/MAX.',
  officeName: 'Isi kantor RE/MAX.',
  customerName: 'Isi nama nasabah.',
  propertyAddress: 'Isi alamat properti.',
  bankName: 'Isi nama bank.',
  boName: 'Isi nama Business Owner.',
  feeAccount: 'Isi rekening marketing fee.',
}
const amount = (x) => (Number.isInteger(x) ? x : null)

// What a save stores: trimmed text, whole-Rupiah amounts, and only this letter's checklist rows, in form order.
export function letterInput(variant, v = {}) {
  const checked = Array.isArray(v.checked) ? v.checked : []
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, String(v[k] ?? '').trim()])),
    loanAmount: amount(v.loanAmount),
    ...(variant === 'topup' && { takeoverAmount: amount(v.takeoverAmount), topupAmount: amount(v.topupAmount) }),
    submittedDate: String(v.submittedDate ?? ''),
    applicantColumn: String(v.applicantColumn ?? ''),
    checked: allRows(variant)
      .map((r) => r.key)
      .filter((k) => checked.includes(k)),
  }
}

export function letterIssues(l) {
  const e = {}
  for (const [k, message] of Object.entries(REQUIRED)) if (!l[k]) e[k] = message
  for (const k of TEXT_FIELDS) {
    const max = k === 'propertyAddress' ? 300 : 160
    if (!e[k] && l[k].length > max) e[k] = `Maksimal ${max} karakter.`
  }
  if (!(Number.isInteger(l.loanAmount) && l.loanAmount > 0)) e.loanAmount = 'Isi nominal KPR yang diajukan.'
  for (const k of ['takeoverAmount', 'topupAmount']) if (k in l && !(Number.isInteger(l[k]) && l[k] >= 0)) e[k] = 'Isi nominal (boleh 0).'
  if (!parseIsoDate(l.submittedDate)) e.submittedDate = 'Pilih tanggal pengajuan.'
  if (!APPLICANT_COLUMNS.some((c) => c.value === l.applicantColumn)) e.applicantColumn = 'Pilih kolom pemohon.'
  return e
}
