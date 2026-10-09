// Pure validators for the monitoring setup (doc 02 MON-01…MON-05). Values are form strings.
import { countDueDatesBetween } from '@/calculations/dates'
import { solveAnnualRateBps } from '@/calculations/finance'
import { bpsInput, toBps, toInt, toMoney } from '@/lib/format'

const minLen = (v, n) => String(v ?? '').trim().length >= n
const blank = (v) => String(v ?? '').trim() === ''

// Optional forms filled after activation (Data properti, the income pop-up on Home): only `required` keys must be
// filled; any other field is checked only once something is typed, so saving never blocks on a field left empty.
export const filledOnly = (errors, v, required = []) => Object.fromEntries(Object.entries(errors).filter(([k]) => required.includes(k) || !blank(v[k])))

const rateError = (v, required = true) => {
  const bps = toBps(v)
  if (bps === null) return required || String(v ?? '').trim() ? 'Isi bunga 0,01–30%.' : ''
  return bps > 0 && bps <= 3000 ? '' : 'Isi bunga 0,01–30%.'
}

export const FIXED_PASSED = 'Tanggal ini sudah lewat, berarti bunga kamu sudah floating.'

// Sisa tenor from tenor awal and tanggal akad, for "Tidak tahu sisa pokok". Null until both are valid.
export function remainingFromStart(v, today) {
  const tenor = toInt(v.originalTenorMonths)
  const due = toInt(v.dueDay)
  if (!(tenor > 0) || !v.startDate || v.startDate > today || !(due >= 1 && due <= 31)) return null
  return tenor - countDueDatesBetween({ startDate: v.startDate, today, dueDay: due })
}

// Bunga solved from pinjaman awal, cicilan and tenor awal, as a form string ('' when it can't be). Only true while
// cicilan never changed since akad (PRD 15.2), so never for floating.
export function impliedRate(v, rateType) {
  const principal = toMoney(v.originalPrincipal)
  const payment = toMoney(v.currentPayment)
  const termMonths = toInt(v.originalTenorMonths)
  if (rateType === 'floating' || !(principal > 0) || !(payment > 0) || !(termMonths >= 12 && termMonths <= 360)) return ''
  try {
    const { annualRateBps } = solveAnnualRateBps({ principal, payment, termMonths, maxAnnualRateBps: 3000 })
    return annualRateBps > 0 ? bpsInput(annualRateBps) : ''
  } catch {
    return ''
  }
}

export const RATE_AUTO_HINT = 'Dihitung otomatis dari pinjaman awal, cicilan, dan tenor awal. Ubah jika berbeda dengan surat akad.'

// A field impliedRate reads changed (prev → next): an empty or still auto-filled bunga follows; a typed one is kept.
export function withImpliedRate(prev, next, rateKey, typeKey) {
  const auto = prev[rateKey] === '' || prev[rateKey] === impliedRate(prev, prev[typeKey])
  return auto ? { ...next, [rateKey]: impliedRate(next, next[typeKey]) } : next
}

// Setup step 1: everything reminders and amortization need. rateStatus: 'fixed' | 'floating'.
export function validateLoanStep(v, { today }) {
  const e = {}
  if (!v.bankName) e.bankName = 'Pilih bank.'
  if (v.bankName === 'Bank lainnya' && !minLen(v.bankOther, 2)) e.bankOther = 'Isi nama bank.'
  if (!v.scheme) e.scheme = 'Pilih jenis KPR.'
  const principal = toMoney(v.originalPrincipal)
  if (!(principal > 0)) e.originalPrincipal = 'Isi jumlah pinjaman awal.'
  if (!(toMoney(v.currentPayment) > 0)) e.currentPayment = 'Isi cicilan bulanan.'
  const tenor = toInt(v.originalTenorMonths)
  if (!(tenor >= 12 && tenor <= 360)) e.originalTenorMonths = 'Tenor harus 12–360 bulan.'
  if (!v.startDate) e.startDate = 'Pilih tanggal akad.'
  else if (v.startDate > today) e.startDate = 'Tanggal akad tidak boleh di masa depan.'
  const due = toInt(v.dueDay)
  if (!(due >= 1 && due <= 31)) e.dueDay = 'Isi tanggal 1–31.'

  if (!v.rateStatus) e.rateStatus = 'Pilih jenis bunga.'
  const r = rateError(v.currentRate)
  if (r) e.currentRate = r
  if (v.rateStatus === 'fixed') {
    if (!v.fixedUntil) e.fixedUntil = 'Pilih tanggal fixed berakhir.'
    else if (v.fixedUntil <= today) e.fixedUntil = FIXED_PASSED
    // Amortization after the fixed period needs it; an estimate is fine.
    const f = rateError(v.floatingRate)
    if (f) e.floatingRate = f
  }

  if (!v.knowsOutstanding) e.knowsOutstanding = 'Pilih salah satu.'
  if (v.knowsOutstanding === 'yes') {
    const out = toMoney(v.outstandingPrincipal)
    if (!(out > 0)) e.outstandingPrincipal = 'Isi sisa pokok saat ini.'
    else if (principal > 0 && out > principal) e.outstandingPrincipal = 'Sisa pokok tidak boleh lebih besar dari pinjaman awal.'
    const rem = toInt(v.remainingTenorMonths)
    if (!(rem >= 1 && rem <= (tenor || 360))) e.remainingTenorMonths = `Sisa tenor harus 1–${tenor || 360} bulan.`
  }
  if (v.knowsOutstanding === 'no' && !e.startDate && !e.originalTenorMonths && remainingFromStart(v, today) <= 0) {
    e.startDate = 'Tanggal akad dan tenor menunjukkan KPR sudah selesai.'
  }
  return e
}

// Setup step 2, Properti section (optional as a whole). The value may be left empty.
export function validatePropertyStep(v) {
  const e = {}
  if (!v.type) e.type = 'Pilih jenis properti.'
  if (!v.city) e.city = 'Pilih kota/kabupaten.'
  if (!minLen(v.address, 5)) e.address = 'Isi alamat properti.'
  if (v.type !== 'apartment' && !(toInt(v.landArea) > 0)) e.landArea = 'Isi luas tanah.'
  if (!(toInt(v.buildingArea) > 0)) e.buildingArea = 'Isi luas bangunan.'
  if (!v.certificateType) e.certificateType = 'Pilih status sertifikat.'
  if (!minLen(v.certificateOwner, 2)) e.certificateOwner = 'Isi nama pemilik sertifikat.'
  const value = toMoney(v.estimatedValue)
  if (value !== null && !(value > 0)) e.estimatedValue = 'Isi nilai lebih dari 0, atau kosongkan.'
  return e
}

export function validateReminders(r) {
  const e = {}
  if (!r.payment.length) e.payment = 'Pilih minimal satu jadwal pengingat pembayaran.'
  if (!r.channels.inApp && !r.channels.email) e.channels = 'Pilih minimal satu kanal.'
  return e
}
