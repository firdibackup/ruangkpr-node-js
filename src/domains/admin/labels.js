// Display names for admin audit events and edited fields (data keys stay in the data layer's vocabulary).
import { CERTIFICATES, GENDERS, MARITAL, OCCUPATIONS, PROPERTY_TYPES, dateShort, labelOf, percentBps, rupiah } from '@/lib/format'
import { APPLICANT_COLUMNS } from './coverLetter'

export const ACTION_LABEL = {
  // A user's own edits (user_changes, written by database triggers).
  profile: 'Ubah profil',
  finance: 'Ubah keuangan',
  'mortgage.activate': 'Aktifkan pemantauan KPR',
  'mortgage.update': 'Ubah data KPR',
  'payment.mark': 'Tandai pembayaran',
  'payment.unmark': 'Batalkan tanda pembayaran',
  'user.profile.update': 'Ubah profil',
  'user.finance.update': 'Ubah keuangan',
  'application.transition': 'Ubah status pengajuan',
  'application.note': 'Catatan internal',
  'application.document_review': 'Periksa dokumen',
  'application.stage_note': 'Info untuk user',
  'application.cover_letter': 'Surat pengantar',
  'product.create': 'Buat draft produk',
  'product.update': 'Ubah produk',
  'product.publish': 'Terbitkan produk',
  'product.archive': 'Arsipkan produk',
  'bank.create': 'Tambah bank',
  'bank.update': 'Ubah bank',
  'article.create': 'Buat draft artikel',
  'article.update': 'Ubah artikel',
  'article.publish': 'Terbitkan artikel',
  'article.archive': 'Arsipkan artikel',
  'report.export': 'Unduh laporan CSV',
  'config.update': 'Ubah konfigurasi',
  'health.publish': 'Terbitkan formula KPR Health',
  'health.rollback': 'Pulihkan formula KPR Health',
}

export const FIELD_LABEL = {
  fullName: 'Nama',
  nik: 'NIK',
  birthPlace: 'Tempat lahir',
  birthDate: 'Tanggal lahir',
  gender: 'Jenis kelamin',
  maritalStatus: 'Status perkawinan',
  address: 'Alamat',
  phone: 'Nomor ponsel',
  email: 'Email',
  occupation: 'Pekerjaan',
  companyName: 'Perusahaan',
  jobTitle: 'Jabatan',
  workYears: 'Lama bekerja',
  workMonths: 'Tambahan bulan kerja',
  monthlyIncome: 'Penghasilan bulanan',
  jointIncome: 'Gabung penghasilan pasangan',
  partnerIncome: 'Penghasilan pasangan',
  vehicleDebt: 'Cicilan kendaraan',
  cardDebt: 'Kartu kredit / paylater',
  otherDebt: 'Pinjaman lain',
  note: 'Catatan',
  name: 'Nama',
  mark: 'Kode',
  active: 'Status aktif',
  bank: 'Bank',
  productTypes: 'Jenis',
  scheme: 'Skema',
  ratePeriods: 'Bunga',
  fees: 'Biaya',
  eligibility: 'Syarat',
  effectiveFrom: 'Berlaku dari',
  effectiveUntil: 'Berlaku sampai',
  lastVerifiedAt: 'Tanggal verifikasi',
  title: 'Judul',
  slug: 'Slug',
  tag: 'Tag',
  icon: 'Ikon',
  summary: 'Ringkasan',
  minutes: 'Menit baca',
  body: 'Isi',
  payment: 'Pengingat pembayaran',
  fixedExpiry: 'Pengingat masa fixed',
  channels: 'Kanal',
  maxFileMb: 'Ukuran maksimal',
  formats: 'Format file',
  whatsapp: 'Nomor WhatsApp CS',
  bookingUrl: 'Link konsultasi live',
  calendarId: 'Calendar ID Google',
  from: 'Dari',
  to: 'Sampai',
  productType: 'Jenis produk',
  bankName: 'Bank',
  rows: 'Jumlah baris',
  status: 'Status',
  version: 'Versi',
  productName: 'Produk',
  originalPrincipal: 'Pinjaman awal',
  originalTenorMonths: 'Tenor awal',
  startDate: 'Mulai (akad)',
  dueDay: 'Tanggal jatuh tempo',
  currentPayment: 'Cicilan',
  outstandingPrincipal: 'Sisa pokok',
  remainingTenorMonths: 'Sisa tenor',
  currentRateBps: 'Bunga',
  currentRateType: 'Jenis bunga',
  fixedUntil: 'Fixed berakhir',
  estimatedFloatingRateBps: 'Estimasi floating',
  'property.type': 'Jenis properti',
  'property.address': 'Alamat properti',
  'property.city': 'Kota properti',
  'property.landArea': 'Luas tanah',
  'property.buildingArea': 'Luas bangunan',
  'property.certificateType': 'Sertifikat',
  'property.certificateOwner': 'Pemilik sertifikat',
  'property.estimatedValue': 'Estimasi nilai properti',
  'property.valueAsOf': 'Nilai per',
  'property.disputed': 'Sengketa',
  'reminders.payment': 'Pengingat pembayaran',
  'reminders.fixedExpiry': 'Pengingat masa fixed',
  'reminders.channels': 'Kanal reminder',
  dueDate: 'Jatuh tempo',
  amount: 'Nominal',
  paidAt: 'Tanggal bayar',
  document: 'Dokumen',
  result: 'Hasil',
  message: 'Pesan',
  schedule: 'Jadwal',
  officeName: 'Kantor RE/MAX',
  logoLabel: 'Nama di bawah logo',
  maName: 'Marketing Associate',
  maId: 'No. ID RE/MAX',
  boName: 'Business Owner',
  feeAccount: 'Rekening marketing fee',
  customerName: 'Nama nasabah',
  propertyAddress: 'Alamat properti',
  loanAmount: 'Besarnya KPR',
  takeoverAmount: 'Take over KPR lama',
  topupAmount: 'Top-up',
  submittedDate: 'Tanggal pengajuan',
  salesOfficer: 'Sales Officer',
  applicantColumn: 'Kolom pemohon',
  checked: 'Checklist dokumen',
}

// Times read in WIB (open question §12 Q5 recommends Asia/Jakarta for the backend too).
export const at = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

export const CHANNEL_LABEL ={ inApp: 'In-app', email: 'Email', whatsapp: 'WhatsApp' }

const MONEY = ['monthlyIncome', 'partnerIncome', 'vehicleDebt', 'cardDebt', 'otherDebt', 'originalPrincipal', 'currentPayment', 'outstandingPrincipal', 'property.estimatedValue', 'amount', 'loanAmount', 'takeoverAmount', 'topupAmount']
const DATES = ['birthDate', 'startDate', 'fixedUntil', 'property.valueAsOf', 'dueDate', 'paidAt', 'submittedDate']
const CHOICES = {
  gender: GENDERS,
  maritalStatus: MARITAL,
  occupation: OCCUPATIONS,
  'property.type': PROPERTY_TYPES,
  'property.certificateType': CERTIFICATES,
  scheme: [{ value: 'conventional', label: 'Konvensional' }, { value: 'sharia', label: 'Syariah' }],
  currentRateType: [{ value: 'fixed', label: 'Fixed' }, { value: 'floating', label: 'Floating' }],
  applicantColumn: APPLICANT_COLUMNS,
}
const UNIT = { originalTenorMonths: 'bulan', remainingTenorMonths: 'bulan', workYears: 'tahun', workMonths: 'bulan', 'property.landArea': 'm²', 'property.buildingArea': 'm²' }

// One edited value as people read it ("Rp850.000.000", "5,50%", "H-7, H-3"); empty reads "–".
export function formatValue(key, v) {
  if (v == null || v === '') return '–'
  if (MONEY.includes(key)) return rupiah(v)
  if (DATES.includes(key)) return dateShort(v)
  if (key.endsWith('RateBps')) return percentBps(v)
  if (CHOICES[key]) return labelOf(CHOICES[key], v)
  if (UNIT[key]) return `${v} ${UNIT[key]}`
  if (key === 'dueDay') return `tanggal ${v}`
  if (key === 'schedule') return `${dateShort(v.date)} ${v.time} · ${v.location}`
  if (key === 'reminders.payment' || key === 'reminders.fixedExpiry') return v.length ? v.map((d) => `H-${d}`).join(', ') : 'Tidak ada'
  if (key === 'reminders.channels') return Object.keys(CHANNEL_LABEL).filter((k) => v[k]).map((k) => CHANNEL_LABEL[k]).join(', ') || 'Tidak ada'
  if (key === 'checked') return `${v.length} baris`
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak'
  return String(v)
}

export const PRODUCT_TYPES = [
  { value: 'primary', label: 'KPR Primary' },
  { value: 'takeover', label: 'Take Over' },
]

export const fieldList = (keys) => keys.map((k) => FIELD_LABEL[k] ?? k).join(', ')
