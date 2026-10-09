// Pure validators for the Take Over + Top-up flow (doc 02 OPT-01…OPT-05).
import { calculateMaxPrincipal } from '@/calculations/finance'
import { BANKS, bpsInput, intInput, moneyInput, toBps, toInt, toMoney } from '@/lib/format'
import { validateEmployment, validatePersonal } from '@/domains/applications/validation'
import { FIXED_PASSED, remainingFromStart } from '@/domains/mortgages/validation'

const minLen = (v, n) => String(v ?? '').trim().length >= n

// The Primary employment rules without the debts, which are optional in the KPR setup and the profile.
export function validateEmploymentBasic(v) {
  const { vehicleDebt: _a, cardDebt: _b, otherDebt: _c, ...rest } = validateEmployment({ ...v, vehicleDebt: '0', cardDebt: '0', otherDebt: '0' })
  return rest
}

// Step 2: the old loan. Bunga and masa fixed are contract facts, always asked; only sisa pokok may be estimated.
export function validateOldLoan(v, { today }) {
  const e = {}
  if (!v.bankName) e.bankName = 'Pilih bank asal.'
  const p0 = toMoney(v.originalPrincipal)
  const pay = toMoney(v.currentPayment)
  if (!(p0 > 0)) e.originalPrincipal = 'Isi pinjaman KPR awal.'
  if (!(pay > 0)) e.currentPayment = 'Isi cicilan bulanan saat ini.'
  else if (p0 > 0 && pay >= p0) e.currentPayment = 'Cicilan harus lebih kecil dari pinjaman awal.'
  const n = toInt(v.originalTenorMonths)
  if (!(n >= 12 && n <= 360)) e.originalTenorMonths = 'Tenor harus 12–360 bulan.'
  if (!v.startDate) e.startDate = 'Pilih tanggal akad.'
  else if (v.startDate > today) e.startDate = 'Tanggal akad tidak boleh di masa depan.'
  const due = toInt(v.dueDay)
  if (!(due >= 1 && due <= 31)) e.dueDay = 'Isi tanggal 1–31.'

  const r = toBps(v.rate)
  if (!(r > 0 && r <= 3000)) e.rate = 'Isi bunga 0,01–30%.'
  if (!v.rateType) e.rateType = 'Pilih jenis bunga.'
  if (v.rateType === 'fixed') {
    if (!v.fixedUntil) e.fixedUntil = 'Pilih tanggal fixed berakhir.'
    else if (v.fixedUntil <= today) e.fixedUntil = FIXED_PASSED
    if (String(v.floatingRate ?? '').trim() && !(toBps(v.floatingRate) > 0)) e.floatingRate = 'Isi bunga 0,01–30%.'
  }

  if (!v.knowsOutstanding) e.knowsOutstanding = 'Pilih salah satu.'
  if (v.knowsOutstanding === 'yes') {
    const out = toMoney(v.outstanding)
    if (!(out > 0)) e.outstanding = 'Isi sisa pokok saat ini.'
    else if (p0 > 0 && out > p0) e.outstanding = 'Sisa pokok tidak boleh lebih besar dari pinjaman awal.'
    const rem = toInt(v.remainingMonths)
    if (!(rem >= 1 && rem <= (n || 360))) e.remainingMonths = `Sisa tenor harus 1–${n || 360} bulan.`
  }
  if (v.knowsOutstanding === 'no' && !e.startDate && !e.originalTenorMonths && !e.dueDay) {
    const est = outstandingEstimate(v, today)
    if (remainingFromStart(v, today) <= 0) e.startDate = 'Tanggal akad dan tenor menunjukkan KPR sudah selesai.'
    // An amortizing loan never owes more than it started with, so this only happens when bunga or cicilan is off.
    else if (est && p0 > 0 && est.outstanding > p0) e.rate = 'Bunga terlalu rendah untuk cicilan ini. Cek lagi bunga dan cicilan.'
  }
  if (String(v.penalty ?? '').trim()) {
    const p = toBps(v.penalty)
    if (p === null || p > 1000) e.penalty = 'Maksimal 10%.'
  }
  return e
}

// Saved old loan → form strings. Shared by the form and takeoverGaps, so a gap means "this form would not pass".
export function oldLoanFormValues(o = {}) {
  const official = o.source === 'official'
  return {
    bankName: !o.bankName ? '' : BANKS.some((b) => b.value === o.bankName) ? o.bankName : 'Bank lainnya',
    productName: o.productName ?? '',
    originalPrincipal: moneyInput(o.originalPrincipal),
    currentPayment: moneyInput(o.currentPayment),
    originalTenorMonths: intInput(o.originalTenorMonths),
    startDate: o.startDate ?? '',
    dueDay: intInput(o.dueDay),
    rate: bpsInput(o.rateBps),
    rateType: o.rateType ?? '',
    fixedUntil: o.fixedUntil ?? '',
    floatingRate: bpsInput(o.floatingRateBps),
    knowsOutstanding: official ? 'yes' : o.source === 'estimate' ? 'no' : '',
    outstanding: official ? moneyInput(o.outstanding) : '',
    remainingMonths: official ? intInput(o.remainingMonths) : '',
    penalty: bpsInput(o.penaltyBps),
  }
}

// "Tidak tahu sisa pokok": what the payment still covers at this rate over the remaining tenor, as in the KPR
// Berjalan setup. Valid whether or not the payment ever changed: banks re-amortize at each rate change.
export function outstandingEstimate(v, today) {
  const remaining = remainingFromStart(v, today)
  const payment = toMoney(v.currentPayment)
  const rateBps = toBps(v.rate)
  if (!(remaining > 0) || !(payment > 0) || !(rateBps > 0 && rateBps <= 3000)) return null
  return { remaining, outstanding: calculateMaxPrincipal({ payment, annualRateBps: rateBps, termMonths: remaining }) }
}

export function validateGoal(v) {
  const e = {}
  if (!v.mode) {
    e.mode = 'Pilih tujuan pengajuan.'
    return e
  }
  if (v.mode === 'takeover' && !v.goal) e.goal = 'Pilih tujuan utama.'
  if (!v.tenorMonths) e.tenorMonths = 'Pilih tenor baru.'
  if (v.mode === 'topup') {
    if (!(toMoney(v.requestedTopup) > 0)) e.requestedTopup = 'Isi dana tambahan yang dibutuhkan.'
    if (!v.purpose) e.purpose = 'Pilih tujuan penggunaan dana.'
    if (v.purpose === 'other' && !minLen(v.purposeOther, 3)) e.purposeOther = 'Jelaskan kebutuhan dana.'
  }
  if (String(v.maxPayment ?? '').trim() && !(toMoney(v.maxPayment) > 0)) e.maxPayment = 'Nominal tidak valid.'
  return e
}

export function validateTakeoverProperty(v, { mode }) {
  const e = {}
  if (!v.propertyType) e.propertyType = 'Pilih jenis properti.'
  if (!v.city) e.city = 'Pilih kota/kabupaten.'
  if (!minLen(v.address, 5)) e.address = 'Isi alamat properti.'
  if (v.propertyType !== 'apartment' && !(toInt(v.landArea) > 0)) e.landArea = 'Isi luas tanah.'
  if (!(toInt(v.buildingArea) > 0)) e.buildingArea = 'Isi luas bangunan.'
  if (!v.certificateType) e.certificateType = 'Pilih status sertifikat.'
  if (!minLen(v.certificateOwner, 2)) e.certificateOwner = 'Isi nama pemilik sertifikat.'
  if (mode === 'topup' && !(toMoney(v.estimatedValue) > 0)) e.estimatedValue = 'Nilai properti wajib untuk menghitung Top-up.'
  if (!v.disputed) e.disputed = 'Pilih salah satu.'
  return e
}


// Take Over draft data from a monitored KPR plus the reusable profile. Shared by the API (draft creation) and the
// start page, which needs the same gaps before any draft exists.
export function takeoverDataFromMortgage(m, { personal, employment, goal }) {
  const pr = m.property ?? {}
  const f = m.finance ?? {}
  return {
    personal,
    employment: { ...employment, monthlyIncome: f.monthlyIncome ?? null },
    oldLoan: {
      bankName: m.bankName,
      productName: m.productName,
      originalPrincipal: m.originalPrincipal,
      currentPayment: m.currentPayment,
      originalTenorMonths: m.originalTenorMonths,
      startDate: m.startDate,
      dueDay: m.dueDay,
      outstanding: m.outstandingPrincipal,
      rateBps: m.currentRateBps,
      rateType: m.currentRateType,
      fixedUntil: m.fixedUntil,
      floatingRateBps: m.estimatedFloatingRateBps,
      remainingMonths: m.remainingTenorMonths,
      penaltyBps: null,
      source: m.outstandingEstimated ? 'estimate' : 'official',
    },
    goal,
    property: { propertyType: pr.type, city: pr.city, address: pr.address, landArea: pr.landArea, buildingArea: pr.buildingArea, certificateType: pr.certificateType, certificateOwner: pr.certificateOwner, estimatedValue: pr.estimatedValue ?? null, disputed: pr.disputed === true },
    finance: { vehicleDebt: f.vehicleDebt ?? 0, cardDebt: f.cardDebt ?? 0, otherDebt: f.otherDebt ?? 0 },
  }
}

// Data steps whose saved data would not pass their own form yet, in wizard order. A draft applied from a monitored KPR
// jumps straight to Dokumen, so these are asked before Dokumen and checked again at submit.
export function takeoverGaps(data, { today, mode }) {
  const { personal = {}, employment = {}, oldLoan = {}, finance = {}, property = {} } = data
  const disputed = property.disputed == null ? '' : property.disputed ? 'yes' : 'no'
  return [
    ['/optimize/1', validatePersonal(personal, { today })],
    // Take Over keeps the debts in `finance`; they are asked on the Pekerjaan form.
    ['/optimize/1/pekerjaan', validateEmployment({ ...employment, vehicleDebt: finance.vehicleDebt, cardDebt: finance.cardDebt, otherDebt: finance.otherDebt })],
    ['/optimize/2', validateOldLoan(oldLoanFormValues(oldLoan), { today })],
    ['/optimize/4', validateTakeoverProperty({ ...property, disputed }, { mode })],
  ]
    .filter(([, errors]) => Object.keys(errors).length)
    .map(([path]) => path)
}

// Gaps of a Take Over started from the monitored KPR (start page, Home shortcuts): bank choices wait for these.
export function mortgageTakeoverGaps(m, snap, mode) {
  const data = takeoverDataFromMortgage(m, { personal: snap.profile ?? {}, employment: { ...snap.profile, ...snap.finance }, goal: {} })
  return takeoverGaps(data, { today: snap.clock, mode })
}

// Default goal from the monitored KPR: Explore's opportunity and Home's direct program lists. Top-up uses the
// start page's defaults (Rp100 jt for renovation, tenor ≥ 20 years).
export function defaultTakeoverGoal(m, mode = 'takeover') {
  const tenorMonths = Math.min(300, Math.max(60, Math.round(m.remainingTenorMonths / 12) * 12))
  return mode === 'topup'
    ? { mode, goal: null, tenorMonths: Math.max(240, tenorMonths), requestedTopup: 100_000_000, purpose: 'renovation' }
    : { mode, goal: 'lower_payment', tenorMonths }
}
