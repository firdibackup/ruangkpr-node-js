// RuangKPR calculation engine — see ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md.
// Pure functions only: explicit inputs, integer Rupiah, integer basis points, no Date.now/DOM/locale.
import { addMonths, parseIsoDate } from './dates'

export class CalculationError extends Error {
  constructor(code, field, message) {
    super(message)
    this.name = 'CalculationError'
    this.code = code
    this.field = field
  }
}

const fail = (code, field, message) => {
  throw new CalculationError(code, field, message)
}

function assertNumber(value, field) {
  if (typeof value !== 'number') fail('INVALID_TYPE', field, `${field} harus berupa angka.`)
  if (!Number.isFinite(value)) fail('NOT_FINITE', field, `${field} tidak valid.`)
}

function assertInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  assertNumber(value, field)
  if (!Number.isSafeInteger(value)) fail('NOT_SAFE_INTEGER', field, `${field} harus bilangan bulat.`)
  if (value < min || value > max) fail('OUT_OF_RANGE', field, `${field} di luar rentang yang diizinkan.`)
}

const assertMoney = (value, field, positive = false) => assertInteger(value, field, { min: positive ? 1 : 0 })

export const roundMoney = (x) => Math.round(x)
export const monthlyRateOf = (annualRateBps) => annualRateBps / 10_000 / 12

// Stable annuity for tiny rates (log1p/expm1). Accepts fractional rates for the solver.
function rawAnnuity(principal, monthlyRate, months) {
  if (monthlyRate === 0) return principal / months
  return (principal * monthlyRate) / -Math.expm1(-months * Math.log1p(monthlyRate))
}

export function calculateAnnuityPayment({ principal, annualRateBps, termMonths }) {
  assertMoney(principal, 'principal', true)
  assertInteger(annualRateBps, 'annualRateBps')
  assertInteger(termMonths, 'termMonths', { min: 1 })
  const monthlyRate = monthlyRateOf(annualRateBps)
  const rawPayment = rawAnnuity(principal, monthlyRate, termMonths)
  return { payment: roundMoney(rawPayment), rawPayment, monthlyRate }
}

export function calculateOutstanding({ originalPrincipal, annualRateBps, originalTermMonths, paidMonths, contractualPayment }) {
  assertMoney(originalPrincipal, 'originalPrincipal', true)
  assertInteger(annualRateBps, 'annualRateBps')
  assertInteger(originalTermMonths, 'originalTermMonths', { min: 1 })
  assertInteger(paidMonths, 'paidMonths', { max: originalTermMonths })
  const r = monthlyRateOf(annualRateBps)
  let payment = rawAnnuity(originalPrincipal, r, originalTermMonths)
  if (contractualPayment !== undefined) {
    assertNumber(contractualPayment, 'contractualPayment')
    if (paidMonths < originalTermMonths && contractualPayment <= originalPrincipal * r) {
      fail('PAYMENT_TOO_LOW', 'contractualPayment', 'Cicilan tidak menutup bunga bulanan.')
    }
    payment = contractualPayment
  }
  let rawOutstanding
  if (r === 0) rawOutstanding = originalPrincipal - payment * paidMonths
  else {
    const growthMinusOne = Math.expm1(paidMonths * Math.log1p(r))
    rawOutstanding = originalPrincipal * (growthMinusOne + 1) - (payment * growthMinusOne) / r
  }
  if (Math.abs(rawOutstanding) <= 0.5) rawOutstanding = 0
  if (rawOutstanding < 0) fail('OUT_OF_RANGE', 'contractualPayment', 'Cicilan melebihi sisa pokok untuk periode ini.')
  return { outstanding: roundMoney(rawOutstanding), rawOutstanding, paidMonths, remainingMonths: originalTermMonths - paidMonths }
}

// Bounded bisection. Only valid when the installment has never changed since akad.
export function solveAnnualRateBps({
  principal,
  payment,
  termMonths,
  minAnnualRateBps = 0,
  maxAnnualRateBps = 5000,
  tolerancePayment = 0.5,
  maxIterations = 100,
  paymentEverChanged = false,
}) {
  if (paymentEverChanged) {
    fail('UNSUPPORTED_SCENARIO', 'paymentEverChanged', 'Cicilan pernah berubah. Gunakan sisa pokok resmi dari bank.')
  }
  assertMoney(principal, 'principal', true)
  assertNumber(payment, 'payment')
  if (payment <= 0) fail('OUT_OF_RANGE', 'payment', 'Cicilan harus lebih dari 0.')
  assertInteger(termMonths, 'termMonths', { min: 1 })
  assertInteger(minAnnualRateBps, 'minAnnualRateBps')
  assertInteger(maxAnnualRateBps, 'maxAnnualRateBps', { min: minAnnualRateBps })

  const paymentAt = (bps) => rawAnnuity(principal, monthlyRateOf(bps), termMonths)
  let low = minAnnualRateBps
  let high = maxAnnualRateBps
  if (payment < paymentAt(low) - tolerancePayment || payment > paymentAt(high) + tolerancePayment) {
    fail('RATE_NOT_BRACKETED', 'payment', 'Cicilan dan pinjaman awal tidak konsisten, jadi bunga tidak bisa diestimasi.')
  }
  if (low === 0 && Math.abs(payment - principal / termMonths) <= tolerancePayment) {
    return { annualRateBps: 0, rawAnnualRateBps: 0, iterations: 0, residualPayment: payment - principal / termMonths, estimated: true }
  }
  for (let i = 1; i <= maxIterations; i++) {
    const mid = (low + high) / 2
    const paymentMid = paymentAt(mid)
    if (Math.abs(paymentMid - payment) <= tolerancePayment || high - low <= 0.0001) {
      return { annualRateBps: Math.round(mid), rawAnnualRateBps: mid, iterations: i, residualPayment: paymentMid - payment, estimated: true }
    }
    if (paymentMid > payment) high = mid
    else low = mid
  }
  fail('NO_CONVERGENCE', 'payment', 'Bunga tidak dapat diestimasi.')
}

const RATE_TYPES = ['fixed', 'floating']

export function validateRatePeriods({ termMonths, ratePeriods }) {
  assertInteger(termMonths, 'termMonths', { min: 1 })
  if (!Array.isArray(ratePeriods) || ratePeriods.length === 0) {
    fail('INVALID_PERIODS', 'ratePeriods', 'Periode bunga belum diisi.')
  }
  const periods = [...ratePeriods].map((p) => ({ ...p })).sort((a, b) => a.startMonth - b.startMonth)
  periods.forEach((p, i) => {
    assertInteger(p.startMonth, 'startMonth')
    assertInteger(p.endMonth, 'endMonth')
    assertInteger(p.annualRateBps, 'annualRateBps')
    if (!RATE_TYPES.includes(p.rateType)) fail('INVALID_PERIODS', 'rateType', 'Jenis bunga tidak dikenal.')
    if (p.endMonth < p.startMonth) fail('INVALID_PERIODS', 'endMonth', 'Periode berakhir sebelum mulai.')
    const expectedStart = i === 0 ? 0 : periods[i - 1].endMonth + 1
    if (p.startMonth < expectedStart) fail('INVALID_PERIODS', 'ratePeriods', 'Periode bunga tumpang tindih (overlap).')
    if (p.startMonth > expectedStart) fail('INVALID_PERIODS', 'ratePeriods', 'Ada jeda di antara periode bunga.')
    if (p.rateType === 'floating' && p.startMonth > 0 && p.estimated !== true) {
      fail('INVALID_PERIODS', 'estimated', 'Bunga floating di masa depan wajib ditandai estimasi.')
    }
  })
  if (periods.at(-1).endMonth !== termMonths - 1) {
    fail('INVALID_PERIODS', 'ratePeriods', 'Periode bunga belum menutup seluruh tenor.')
  }
  return periods
}

// Rows are integer Rupiah. Balances stay unrounded internally; each row shows rounded balances and
// principal = opening − closing, interest = payment − principal. This keeps every invariant exact:
// Σprincipal = opening principal, payment = principal + interest per row, next opening = previous closing,
// final balance 0 (last row pays the remaining balance).
export function generateAmortizationSchedule({ principal, termMonths, ratePeriods, startDate = null, dueDay }) {
  assertMoney(principal, 'principal', true)
  const periods = validateRatePeriods({ termMonths, ratePeriods })
  const start = startDate ? parseIsoDate(startDate) : null
  if (startDate && !start) fail('INVALID_TYPE', 'startDate', 'Tanggal mulai tidak valid.')
  const day = dueDay ?? start?.day

  const rows = []
  let balance = principal
  let rawPayment = 0
  let periodIndex = 0
  for (let m = 0; m < termMonths && balance > 0; m++) {
    while (periods[periodIndex].endMonth < m) periodIndex++
    const period = periods[periodIndex]
    const r = monthlyRateOf(period.annualRateBps)
    if (period.startMonth === m) rawPayment = rawAnnuity(balance, r, termMonths - m)
    const rawInterest = balance * r
    const rawPrincipal = rawPayment - rawInterest
    if (rawPrincipal <= 0) fail('PAYMENT_TOO_LOW', 'ratePeriods', 'Cicilan tidak menutup bunga bulanan.')
    const isLast = m === termMonths - 1 || rawPrincipal >= balance
    const opening = roundMoney(balance)
    const closingRaw = isLast ? 0 : balance - rawPrincipal
    const closing = roundMoney(closingRaw)
    const rowPrincipal = opening - closing
    const payment = isLast ? rowPrincipal + roundMoney(rawInterest) : roundMoney(rawPayment)
    rows.push({
      month: m + 1,
      dueDate: startDate ? addMonths(startDate, m, day) : null,
      annualRateBps: period.annualRateBps,
      rateType: period.rateType,
      estimatedRate: period.estimated === true,
      periodChanged: m > 0 && period.startMonth === m,
      openingBalance: opening,
      payment,
      principal: rowPrincipal,
      interest: payment - rowPrincipal,
      closingBalance: closing,
    })
    balance = closingRaw
  }

  const totals = rows.reduce(
    (t, r) => ({ principal: t.principal + r.principal, interest: t.interest + r.interest, payment: t.payment + r.payment }),
    { principal: 0, interest: 0, payment: 0 },
  )
  return {
    rows,
    yearly: aggregateScheduleByYear(rows),
    totals: { ...totals, endingBalance: rows.at(-1).closingBalance },
    assumptions: periods.map(({ startMonth, endMonth, annualRateBps, rateType, estimated }) => ({
      startMonth,
      endMonth,
      annualRateBps,
      rateType,
      estimated: estimated === true,
    })),
  }
}

export function aggregateScheduleByYear(rows) {
  const years = []
  rows.forEach((row, i) => {
    const key = row.dueDate ? row.dueDate.slice(0, 4) : `Tahun ${Math.floor(i / 12) + 1}`
    let y = years.at(-1)
    if (!y || y.year !== key) {
      y = { year: key, openingBalance: row.openingBalance, payment: 0, principal: 0, interest: 0, minRateBps: row.annualRateBps, maxRateBps: row.annualRateBps, containsTransition: false, containsEstimate: false }
      years.push(y)
    }
    y.payment += row.payment
    y.principal += row.principal
    y.interest += row.interest
    y.closingBalance = row.closingBalance
    y.minRateBps = Math.min(y.minRateBps, row.annualRateBps)
    y.maxRateBps = Math.max(y.maxRateBps, row.annualRateBps)
    y.containsTransition ||= row.periodChanged
    y.containsEstimate ||= row.estimatedRate
  })
  return years
}

export function calculateDti({ monthlyIncome, mortgagePayment, otherMonthlyDebt = 0 }) {
  assertMoney(monthlyIncome, 'monthlyIncome')
  assertMoney(mortgagePayment, 'mortgagePayment')
  assertMoney(otherMonthlyDebt, 'otherMonthlyDebt')
  if (monthlyIncome === 0) fail('DIVISION_BY_ZERO', 'monthlyIncome', 'Penghasilan belum diisi.')
  const totalMonthlyDebt = mortgagePayment + otherMonthlyDebt
  return { totalMonthlyDebt, dtiRatio: totalMonthlyDebt / monthlyIncome }
}

// Safe-payment guidance. ratioBps is policy/config (default 35%), not a universal truth.
export function calculatePaymentCapacity({ monthlyIncome, existingDebt = 0, ratioBps = 3500 }) {
  assertMoney(monthlyIncome, 'monthlyIncome')
  assertMoney(existingDebt, 'existingDebt')
  assertInteger(ratioBps, 'ratioBps', { max: 10_000 })
  if (monthlyIncome === 0) fail('DIVISION_BY_ZERO', 'monthlyIncome', 'Penghasilan belum diisi.')
  const safePayment = roundMoney((monthlyIncome * ratioBps) / 10_000)
  return { safePayment, existingDebt, remainingCapacity: safePayment - existingDebt, ratioBps, estimated: true }
}

// Inverse annuity: the largest principal whose payment stays within `payment`. Floored, so its payment never exceeds it.
export function calculateMaxPrincipal({ payment, annualRateBps, termMonths }) {
  assertNumber(payment, 'payment')
  assertInteger(annualRateBps, 'annualRateBps')
  assertInteger(termMonths, 'termMonths', { min: 1 })
  if (payment <= 0) return 0
  return Math.floor(payment / rawAnnuity(1, monthlyRateOf(annualRateBps), termMonths))
}

export function calculatePropertyMetrics({ propertyValue, outstanding }) {
  assertMoney(propertyValue, 'propertyValue')
  assertMoney(outstanding, 'outstanding')
  if (propertyValue === 0) fail('DIVISION_BY_ZERO', 'propertyValue', 'Nilai properti belum diisi.')
  return { ltvRatio: outstanding / propertyValue, equity: propertyValue - outstanding }
}

export function calculateFloatingImpact({ outstanding, remainingMonths, currentAnnualRateBps, nextAnnualRateBps }) {
  const current = calculateAnnuityPayment({ principal: outstanding, annualRateBps: currentAnnualRateBps, termMonths: remainingMonths })
  const next = calculateAnnuityPayment({ principal: outstanding, annualRateBps: nextAnnualRateBps, termMonths: remainingMonths })
  const monthlyDelta = next.payment - current.payment
  return {
    currentPayment: current.payment,
    estimatedNextPayment: next.payment,
    monthlyDelta,
    relativeDelta: monthlyDelta / current.payment,
    direction: monthlyDelta > 0 ? 'increase' : monthlyDelta < 0 ? 'decrease' : 'same',
    estimated: true,
  }
}

const COST_TREATMENTS = ['upfront', 'financed', 'deducted']

function normalizeCosts(costs) {
  const items = costs.map((c) => {
    assertMoney(c.amount, `costs.${c.code}`)
    if (!COST_TREATMENTS.includes(c.treatment)) fail('INVALID_TYPE', 'treatment', 'Perlakuan biaya tidak dikenal.')
    return { ...c, estimated: c.estimated === true }
  })
  const sum = (t) => items.filter((c) => c.treatment === t).reduce((s, c) => s + c.amount, 0)
  const upfront = sum('upfront')
  const financed = sum('financed')
  const deducted = sum('deducted')
  return { upfront, financed, deducted, totalEconomicCost: upfront + financed + deducted, items }
}

// Cash-flow comparison without discounting. `current.payments` / `proposed.payments` are monthly integer arrays.
// Financed costs are already inside proposed payments and deducted costs reduce Top-up cash, so only
// upfront costs enter cumulative net saving (no double count).
export function calculateTakeoverScenario({ current, proposed, costs = [] }) {
  const cur = current.payments
  const prop = proposed.payments
  ;[...cur, ...prop].forEach((p) => assertMoney(p, 'payments'))
  if (!cur.length || !prop.length) fail('MISSING_REQUIRED', 'payments', 'Jadwal pembayaran belum lengkap.')
  const costSummary = normalizeCosts(costs)
  const horizonMonths = Math.max(cur.length, prop.length)

  let cumulative = -costSummary.upfront
  let benefitSoFar = 0
  let breakEvenMonth = null
  let lastNegativeMonth = cumulative < 0 ? 0 : -1
  for (let t = 1; t <= horizonMonths; t++) {
    const benefit = (cur[t - 1] ?? 0) - (prop[t - 1] ?? 0)
    cumulative += benefit
    benefitSoFar += benefit
    if (breakEvenMonth === null && cumulative >= 0 && benefitSoFar > 0) breakEvenMonth = t
    if (cumulative < 0) lastNegativeMonth = t
  }
  const firstMonthBenefit = cur[0] - prop[0]
  const breakEven =
    breakEvenMonth !== null
      ? { status: 'reached', month: breakEvenMonth }
      : { status: firstMonthBenefit <= 0 ? 'no_monthly_benefit' : 'not_reached', month: null }
  const sustainedBreakEvenMonth =
    breakEvenMonth !== null && cumulative >= 0 ? Math.max(breakEvenMonth, lastNegativeMonth + 1) : null

  const summarize = (payments) => ({
    firstPayment: payments[0],
    termMonths: payments.length,
    totalPayment: payments.reduce((s, p) => s + p, 0),
  })
  return {
    current: summarize(cur),
    proposed: summarize(prop),
    costs: costSummary,
    firstMonthBenefit,
    breakEven,
    sustainedBreakEvenMonth,
    netSaving: cumulative,
    horizonMonths,
    estimated: true,
  }
}

export function calculateTopupScenario({ propertyValue, maxLtvBps, oldOutstanding, newLoanAmount, deductedCosts = [], requestedTopup = 0 }) {
  assertMoney(propertyValue, 'propertyValue', true)
  assertInteger(maxLtvBps, 'maxLtvBps', { max: 10_000 })
  assertMoney(oldOutstanding, 'oldOutstanding')
  assertMoney(newLoanAmount, 'newLoanAmount')
  assertMoney(requestedTopup, 'requestedTopup')
  if (newLoanAmount < oldOutstanding) fail('OUT_OF_RANGE', 'newLoanAmount', 'Plafon baru lebih kecil dari sisa pokok lama.')
  const deducted = deductedCosts.reduce((s, c) => {
    assertMoney(c.amount, `deductedCosts.${c.code}`)
    return s + c.amount
  }, 0)
  const maxLoanByCollateral = Math.floor((propertyValue * maxLtvBps) / 10_000)
  const grossTopup = newLoanAmount - oldOutstanding
  const netTopup = grossTopup - deducted
  return {
    maxLoanByCollateral,
    maxGrossTopup: Math.max(0, maxLoanByCollateral - oldOutstanding),
    grossTopup,
    deductedCosts: deducted,
    netTopup,
    newLtvRatio: newLoanAmount / propertyValue,
    withinLtv: newLoanAmount <= maxLoanByCollateral,
    meetsRequestedTopup: netTopup >= requestedTopup,
    fundingGap: requestedTopup - netTopup,
    status: netTopup < 0 ? 'insufficient' : 'ok',
    estimated: true,
  }
}
