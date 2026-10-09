// Required-document metadata per product (doc 02 PRI-03, OPT-10). The API attaches this to each
// application so the UI renders from metadata instead of hard-coding "all banks need X".

// Formats an admin may allow (admin plan §4.7). The extension decides: browsers report MIME types unevenly.
export const UPLOAD_FORMATS = {
  jpg: { extensions: ['jpg', 'jpeg'], mime: 'image/jpeg' },
  png: { extensions: ['png'], mime: 'image/png' },
  pdf: { extensions: ['pdf'], mime: 'application/pdf' },
}
// Shipped limits; the live ones come from the snapshot (`config.upload`).
export const DEFAULT_UPLOAD = { maxFileMb: 5, formats: ['jpg', 'png', 'pdf'] }

const formatList = (formats) => {
  const names = formats.map((f) => f.toUpperCase())
  return names.length < 3 ? names.join(' atau ') : `${names.slice(0, -1).join(', ')}, atau ${names.at(-1)}`
}
export const uploadHint = (rules = DEFAULT_UPLOAD) => `${formatList(rules.formats)} · maks ${rules.maxFileMb}MB`
export const acceptOf = (rules = DEFAULT_UPLOAD) => rules.formats.flatMap((f) => [...UPLOAD_FORMATS[f].extensions.map((e) => `.${e}`), UPLOAD_FORMATS[f].mime]).join(',')

// One rule for the page's pre-check and the API, so both say the same words.
export function uploadProblem(file, rules = DEFAULT_UPLOAD) {
  const ext = /\.([^.]+)$/.exec(file.name)?.[1].toLowerCase()
  if (!rules.formats.some((f) => UPLOAD_FORMATS[f].extensions.includes(ext))) return { code: 'FILE_TYPE_UNSUPPORTED', status: 415, message: `Format tidak didukung. Gunakan ${formatList(rules.formats)}.` }
  if (file.size > rules.maxFileMb * 1024 * 1024) return { code: 'FILE_TOO_LARGE', status: 413, message: `Ukuran file lebih dari ${rules.maxFileMb}MB. Kompres dulu, lalu coba lagi.` }
  return null
}

export const DOC_LABELS = {
  ktp: 'KTP',
  npwp: 'NPWP',
  income_proof: 'Slip Gaji / Bukti Penghasilan',
  property_document: 'Dokumen Properti',
  additional: 'Dokumen Tambahan',
  family_card: 'Kartu Keluarga',
  marriage_document: 'Buku Nikah',
  bank_statement: 'Rekening Koran 3 Bulan',
  old_loan_agreement: 'Akad Kredit Lama',
  outstanding_letter: 'Surat Keterangan Sisa Pokok',
  latest_payment_proof: 'Bukti Cicilan Terakhir',
  payoff_info: 'Informasi Penalti / Payoff',
  certificate: 'Sertifikat',
  building_permit: 'PBG / IMB',
  land_tax: 'PBB Terakhir',
  sale_purchase_agreement: 'PPJB / AJB',
  fund_plan: 'Rencana Penggunaan Dana',
}

const doc = (type, required, hint = '', group = null) => ({ type, label: DOC_LABELS[type], required, hint, group })

export function requiredDocuments(app) {
  if (app.productType === 'primary') {
    const used = app.data?.property?.purchaseType === 'used_from_owner'
    return [
      doc('ktp', true, 'Foto KTP asli, terbaca jelas'),
      doc('npwp', true, 'Kartu NPWP atau bukti lapor'),
      doc('income_proof', true, 'Slip gaji 3 bulan terakhir'),
      doc('property_document', true, used ? 'AJB / sertifikat / dokumen penjual yang tersedia' : 'SPR / PPJB dari developer'),
      doc('additional', false, 'KK, surat nikah, atau lainnya'),
    ]
  }
  const married = app.data?.personal?.maritalStatus === 'married'
  const cert = app.data?.property?.certificateType
  return [
    doc('ktp', true, '', 'identity'),
    doc('family_card', true, '', 'identity'),
    doc('npwp', true, '', 'identity'),
    ...(married ? [doc('marriage_document', true, '', 'identity')] : []),
    doc('income_proof', true, '', 'identity'),
    doc('bank_statement', true, '', 'identity'),
    doc('old_loan_agreement', true, '', 'old_loan'),
    doc('outstanding_letter', true, '', 'old_loan'),
    doc('latest_payment_proof', true, '', 'old_loan'),
    doc('payoff_info', false, '', 'old_loan'),
    { ...doc('certificate', true, '', 'property'), label: `Sertifikat${cert ? ` (${cert.toUpperCase()})` : ''}` },
    doc('building_permit', true, '', 'property'),
    doc('land_tax', true, '', 'property'),
    doc('sale_purchase_agreement', false, '', 'property'),
    ...(app.optimizationMode === 'topup' ? [doc('fund_plan', false, 'mis. RAB renovasi', 'topup')] : []),
  ]
}
