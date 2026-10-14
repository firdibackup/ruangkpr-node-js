// Display-only formatting. Never parse these strings back into numbers for calculations.
import { parseIsoDate } from '@/calculations/dates'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const EMPTY = 'Belum tersedia'

export function rupiah(n) {
  if (n == null || !Number.isFinite(n)) return EMPTY
  const s = `Rp${Math.abs(Math.round(n)).toLocaleString('id-ID')}`
  return n < 0 ? `−${s}` : s
}

export const signedRupiah = (n) => (n > 0 ? `+${rupiah(n)}` : rupiah(n))

export function rupiahShort(n) {
  if (n == null || !Number.isFinite(n)) return EMPTY
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (a >= 1e9) return `${sign}Rp${(Math.round(a / 1e7) / 100).toLocaleString('id-ID')} M`
  if (a >= 1e6) return `${sign}Rp${(Math.round(a / 1e5) / 10).toLocaleString('id-ID')} jt`
  if (a >= 1e3) return `${sign}Rp${Math.round(a / 1e3).toLocaleString('id-ID')} rb`
  return `${sign}Rp${a}`
}

// Plafon, house price and remaining interest read as a ballpark: floored to Rp10 jt (callers keep exact Rupiah).
export const rupiahApprox = (n) => `± ${rupiahShort(n >= 1e7 ? Math.floor(n / 1e7) * 1e7 : n)}`

export const percentBps = (bps, digits = 2) =>
  bps == null ? EMPTY : `${(bps / 100).toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

// Ratios display with one decimal, rounded per doc 03 §2.2.
// Whole-percent progress; a start that would round to "0%" reads "< 1%".
export const percentProgress = (ratio) => (ratio > 0 && ratio < 0.005 ? '< 1%' : `${Math.round(ratio * 100)}%`)

export const percentRatio = (ratio, digits = 1) =>
  ratio == null || !Number.isFinite(ratio) ? EMPTY : `${(Math.round(ratio * 10 ** (digits + 2)) / 10 ** digits).toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

export function dateLong(iso) {
  const d = parseIsoDate(String(iso ?? '').slice(0, 10))
  return d ? `${d.day} ${MONTHS[d.month - 1]} ${d.year}` : EMPTY
}

export function dateShort(iso) {
  const d = parseIsoDate(String(iso ?? '').slice(0, 10))
  return d ? `${d.day} ${MONTHS_SHORT[d.month - 1]} ${d.year}` : EMPTY
}

export function dayMonth(iso) {
  const d = parseIsoDate(String(iso ?? '').slice(0, 10))
  return d ? `${d.day} ${MONTHS_SHORT[d.month - 1]}` : ''
}

export function monthYear(iso) {
  const d = parseIsoDate(String(iso ?? '').slice(0, 10))
  return d ? `${MONTHS_SHORT[d.month - 1]} ${d.year}` : EMPTY
}

export const monthName = (iso) => {
  const d = parseIsoDate(String(iso ?? '').slice(0, 10))
  return d ? MONTHS[d.month - 1] : ''
}

export function tenorLabel(months) {
  if (!months) return EMPTY
  const y = Math.floor(months / 12)
  const m = months % 12
  if (!y) return `${m} bulan`
  return m ? `${y} tahun ${m} bulan` : `${y} tahun`
}

export const daysLabel = (days) => (days === 0 ? 'hari ini' : days === 1 ? 'besok' : `${days} hari lagi`)

// ---- form input helpers (string ⇄ domain) ----
export const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '')
export const thousands = (v) => {
  const d = digitsOnly(v)
  return d ? Number(d).toLocaleString('id-ID') : ''
}
export const toMoney = (v) => {
  const d = digitsOnly(v)
  if (!d) return null
  const n = Number(d)
  return Number.isSafeInteger(n) ? n : null
}
export const toInt = (v) => (digitsOnly(v) === '' ? null : Number(digitsOnly(v)))
export const moneyInput = (n) => (n == null ? '' : String(n))
export const intInput = (n) => (n == null ? '' : String(n))

// "5,50" → 550 bps. Returns null for empty/invalid input.
export function toBps(v) {
  const s = String(v ?? '').trim().replace(',', '.')
  if (!s || !/^\d+(\.\d{1,2})?$/.test(s)) return null
  return Math.round(Number(s) * 100)
}
export const bpsInput = (bps) => (bps == null ? '' : (bps / 100).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export const initials = (name) =>
  String(name ?? '')
    .trim()
    .split(/\s+/)[0]
    ?.charAt(0)
    .toUpperCase() || 'R'
export const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || ''

export const maskNik = (nik) => (nik && nik.length === 16 ? `${nik.slice(0, 4)}********${nik.slice(-4)}` : EMPTY)
export const maskEmail = (email) => {
  const [name, domain] = String(email).split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

// ---- enum labels ----
export const OCCUPATIONS = [
  { value: 'private_employee', label: 'Karyawan Swasta' },
  { value: 'civil_servant', label: 'PNS / BUMN' },
  { value: 'military_police', label: 'TNI / Polri' },
  { value: 'entrepreneur', label: 'Wiraswasta' },
  { value: 'professional', label: 'Profesional' },
  { value: 'freelancer', label: 'Freelancer' },
]
export const MARITAL = [
  { value: 'single', label: 'Belum Menikah' },
  { value: 'married', label: 'Menikah' },
  { value: 'divorced', label: 'Cerai Hidup' },
  { value: 'widowed', label: 'Cerai Mati' },
]
export const GENDERS = [
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
]
export const PROPERTY_TYPES = [
  { value: 'landed_house', label: 'Rumah Tapak' },
  { value: 'apartment', label: 'Apartemen' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'shophouse', label: 'Ruko' },
]
export const CERTIFICATES = [
  { value: 'shm', label: 'SHM' },
  { value: 'shgb', label: 'SHGB' },
  { value: 'strata', label: 'Strata Title (SHMSRS)' },
  { value: 'other', label: 'Girik / lainnya' },
]
export const CITIES = ['Kota Bekasi', 'Kab. Bekasi', 'Kota Depok', 'Kota Tangerang', 'Kota Tangerang Selatan', 'Kab. Bogor', 'Kota Bogor', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Barat', 'Jakarta Utara', 'Jakarta Pusat', 'Kota Bandung', 'Kota Surabaya', 'Lainnya'].map((c) => ({ value: c, label: c }))
export const BANKS = ['Bank ABC', 'BCA', 'Bank Mandiri', 'BRI', 'BNI', 'BTN', 'CIMB Niaga', 'Bank lainnya'].map((b) => ({ value: b, label: b }))
export const PURPOSES = [
  { value: 'renovation', label: 'Renovasi Rumah' },
  { value: 'education', label: 'Pendidikan' },
  { value: 'business', label: 'Modal Usaha' },
  { value: 'debt_consolidation', label: 'Konsolidasi Utang' },
  { value: 'other', label: 'Kebutuhan Lain' },
]
export const GOALS = [
  { value: 'lower_payment', label: 'Cicilan bulanan lebih ringan' },
  { value: 'longer_fixed', label: 'Fixed rate lebih lama' },
  { value: 'shorter_tenor', label: 'Tenor lebih pendek' },
  { value: 'lower_interest', label: 'Total bunga lebih kecil' },
]

export const labelOf = (list, value) => list.find((x) => x.value === value)?.label ?? (value || EMPTY)
