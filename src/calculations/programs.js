// Rule-based bank-product matching and simulation (PRD §9.8, §15; doc 03 §13–14).
// Pure: callers pass `asOf`. Used by the mock adapter (compare/simulation) and by sliders (realtime detail).
import { CAPACITY_RATIO_BPS, OLD_BANK_POLICY, STALE_AFTER_DAYS } from '@/data/catalog'
import { addMonths, daysUntil, nextDueDate, parseIsoDate } from './dates'
import {
  calculateAnnuityPayment,
  calculateMaxPrincipal,
  calculateOutstanding,
  calculatePaymentCapacity,
  calculateTakeoverScenario,
  calculateTopupScenario,
  generateAmortizationSchedule,
} from './finance'

export const isStale = (product, asOf) => daysUntil({ fromDate: product.lastVerifiedAt, targetDate: asOf }) > STALE_AFTER_DAYS
export const isAvailable = (product, asOf) => product.status === 'published' && product.effectiveFrom <= asOf && asOf <= product.effectiveUntil

export function ageOn(birthDate, date) {
  const b = parseIsoDate(birthDate)
  const d = parseIsoDate(date)
  if (!b || !d) return null
  return d.year - b.year - (d.month < b.month || (d.month === b.month && d.day < b.day) ? 1 : 0)
}

export function productRatePeriods(product, termMonths) {
  const fixed = product.ratePeriods.find((p) => p.type === 'fixed')
  const floating = product.ratePeriods.find((p) => p.type === 'floating')
  const fixedMonths = Math.min(fixed.durationMonths, termMonths)
  const periods = [{ startMonth: 0, endMonth: fixedMonths - 1, annualRateBps: fixed.rateBps, rateType: 'fixed', estimated: false }]
  if (fixedMonths < termMonths) {
    periods.push({ startMonth: fixedMonths, endMonth: termMonths - 1, annualRateBps: floating.rateBps, rateType: 'floating', estimated: true })
  }
  return { periods, fixedMonths, fixedRateBps: fixed.rateBps, floatingRateBps: floating.rateBps }
}

export function simulateLoan({ product, principal, termMonths }) {
  const { periods, fixedMonths, fixedRateBps, floatingRateBps } = productRatePeriods(product, termMonths)
  const schedule = generateAmortizationSchedule({ principal, termMonths, ratePeriods: periods })
  return {
    payment: schedule.rows[0].payment,
    paymentAfterFixed: fixedMonths < termMonths ? schedule.rows[fixedMonths].payment : null,
    payments: schedule.rows.map((r) => r.payment),
    fixedMonths,
    fixedRateBps,
    floatingRateBps,
    totalPayment: schedule.totals.payment,
    totalInterest: schedule.totals.interest,
  }
}

const RANK = { estimated_eligible: 0, needs_review: 1, not_eligible: 2 }

function eligibilityFromDti(dtiRatio, maxDtiBps) {
  const max = maxDtiBps / 10_000
  if (dtiRatio <= max) return 'estimated_eligible'
  return dtiRatio <= max + 0.05 ? 'needs_review' : 'not_eligible'
}

export function evaluatePrimaryProduct({ product, input, asOf }) {
  const e = product.eligibility
  const excluded = []
  if (input.monthlyIncome < e.minimumIncome) excluded.push('Penghasilan di bawah minimum program')
  if (input.occupation && !e.occupations.includes(input.occupation)) excluded.push('Jenis pekerjaan belum didukung program')
  if (input.propertyType && !e.propertyTypes.includes(input.propertyType)) excluded.push('Jenis properti belum didukung program')
  if (input.loanAmount / input.propertyPrice > e.maximumLtvBps / 10_000) excluded.push('Uang muka di bawah batas minimum program')
  if (input.tenorMonths > e.maximumTenorMonths) excluded.push('Tenor melebihi batas program')
  const age = input.birthDate ? ageOn(input.birthDate, asOf) : null
  if (age !== null && (age < e.minimumAge || age + input.tenorMonths / 12 > e.maximumAgeAtMaturity)) {
    excluded.push('Usia saat pengajuan atau saat lunas di luar batas program')
  }
  const sim = simulateLoan({ product, principal: input.loanAmount, termMonths: input.tenorMonths })
  const provision = Math.round((input.loanAmount * product.fees.provisionBps) / 10_000)
  const fees = { provision, admin: product.fees.admin, total: provision + product.fees.admin }
  const dtiRatio = (sim.payment + input.existingDebt) / input.monthlyIncome
  return {
    productId: product.id,
    productVersion: product.version,
    product,
    bank: product.bank,
    name: product.name,
    lastVerifiedAt: product.lastVerifiedAt,
    stale: isStale(product, asOf),
    excluded,
    ...sim,
    payments: undefined,
    fees,
    totalCost: sim.totalPayment + fees.total,
    dtiRatio,
    maxDtiBps: product.eligibility.maximumDtiBps,
    eligibility: eligibilityFromDti(dtiRatio, product.eligibility.maximumDtiBps),
  }
}

export const PRIMARY_SORTS = {
  total: { label: 'Total pembayaran terendah', compare: (a, b) => a.totalCost - b.totalCost },
  cicilan: { label: 'Cicilan terendah', compare: (a, b) => a.payment - b.payment },
  biaya: { label: 'Biaya awal terendah', compare: (a, b) => a.fees.total - b.fees.total },
  fixed: { label: 'Fixed terlama', compare: (a, b) => b.fixedMonths - a.fixedMonths || a.totalCost - b.totalCost },
}

export function comparePrimaryPrograms({ products, input, asOf, sort = 'total', ratioBps = CAPACITY_RATIO_BPS }) {
  const capacity = calculatePaymentCapacity({ monthlyIncome: input.monthlyIncome, existingDebt: input.existingDebt, ratioBps })
  const evaluated = products
    .filter((p) => p.productTypes.includes('primary') && isAvailable(p, asOf))
    .map((product) => evaluatePrimaryProduct({ product, input, asOf }))
  const items = evaluated
    .filter((x) => !x.excluded.length)
    .map((x) => ({ ...x, withinCapacity: x.payment <= capacity.remainingCapacity }))
    .sort(PRIMARY_SORTS[sort].compare)
  const recommended = items.find((x) => x.eligibility === 'estimated_eligible' && x.withinCapacity && !x.stale)
  return {
    asOf,
    sort,
    capacity,
    items: items.map((x) => ({ ...x, recommended: x === recommended })),
    excluded: evaluated.filter((x) => x.excluded.length).map((x) => ({ productId: x.productId, bank: x.bank, name: x.name, reasons: x.excluded })),
  }
}

// What the profile alone can borrow, before a property is picked (Primary wizard milestone 1).
// Property type and LTV are unknown yet, so only income, occupation and age open a program.
// Uses the fixed rate over the full tenor: the first payment `comparePrimaryPrograms` checks against capacity.
export function primaryAffordability({ products, input, asOf, ratioBps = CAPACITY_RATIO_BPS }) {
  const capacity = calculatePaymentCapacity({ monthlyIncome: input.monthlyIncome, existingDebt: input.existingDebt, ratioBps })
  const age = input.birthDate ? ageOn(input.birthDate, asOf) : null
  const open = products
    .filter((p) => p.productTypes.includes('primary') && isAvailable(p, asOf))
    .map((product) => {
      const e = product.eligibility
      const tenorMonths = age === null ? e.maximumTenorMonths : Math.min(e.maximumTenorMonths, (e.maximumAgeAtMaturity - age) * 12)
      const ok = input.monthlyIncome >= e.minimumIncome && (!input.occupation || e.occupations.includes(input.occupation)) && (age === null || age >= e.minimumAge) && tenorMonths >= 12
      return ok && { product, tenorMonths }
    })
    .filter(Boolean)
  let best = null
  if (capacity.remainingCapacity > 0) {
    for (const { product, tenorMonths } of open) {
      const fixedRateBps = product.ratePeriods.find((p) => p.type === 'fixed').rateBps
      const principal = calculateMaxPrincipal({ payment: capacity.remainingCapacity, annualRateBps: fixedRateBps, termMonths: tenorMonths })
      if (principal > (best?.principal ?? 0)) {
        const maxLtvBps = product.eligibility.maximumLtvBps
        best = { principal, priceMax: Math.floor((principal * 10_000) / maxLtvBps), tenorMonths, fixedRateBps, maxLtvBps }
      }
    }
  }
  return { capacity, openCount: open.length, best }
}

// ---------- Take Over + Top-up ----------

// What staying costs: the recorded payment until fixed ends, then an estimated floating annuity.
export function takeoverBaseline({ outstanding, rateBps, rateType, fixedUntil, floatingRateBps, remainingMonths, currentPayment, penaltyBps, dueDay, asOf }) {
  const firstDue = nextDueDate({ today: asOf, dueDay })
  let fixedMonths = remainingMonths
  if (rateType === 'fixed' && fixedUntil && floatingRateBps) {
    fixedMonths = 0
    while (fixedMonths < remainingMonths && addMonths(firstDue, fixedMonths, dueDay) <= fixedUntil) fixedMonths++
  }
  const payments = Array(fixedMonths).fill(currentPayment)
  if (fixedMonths < remainingMonths) {
    const { outstanding: balance } = calculateOutstanding({
      originalPrincipal: outstanding,
      annualRateBps: rateBps,
      originalTermMonths: remainingMonths,
      paidMonths: fixedMonths,
      contractualPayment: currentPayment,
    })
    const next = balance > 0 ? calculateAnnuityPayment({ principal: balance, annualRateBps: floatingRateBps, termMonths: remainingMonths - fixedMonths }).payment : 0
    payments.push(...Array(remainingMonths - fixedMonths).fill(next))
  }
  const penaltyEstimated = penaltyBps == null
  const appliedPenaltyBps = penaltyEstimated ? OLD_BANK_POLICY.penaltyBps : penaltyBps
  const penalty = Math.round((outstanding * appliedPenaltyBps) / 10_000)
  const totalPayment = payments.reduce((s, p) => s + p, 0)
  return {
    outstanding,
    rateBps,
    rateType,
    remainingMonths,
    currentPayment,
    payments,
    fixedMonthsLeft: rateType === 'fixed' && fixedMonths < remainingMonths ? fixedMonths : null,
    exit: {
      penaltyBps: appliedPenaltyBps,
      penalty,
      penaltyEstimated,
      admin: OLD_BANK_POLICY.admin,
      total: penalty + OLD_BANK_POLICY.admin,
    },
    totalPayment,
    totalInterest: Math.max(0, totalPayment - outstanding),
    payoffDate: addMonths(firstDue, remainingMonths - 1, dueDay),
  }
}

const roundUpTo = (x, step) => Math.ceil(x / step) * step
const roundDownTo = (x, step) => Math.floor(x / step) * step

export function evaluateTakeoverProduct({ product, baseline, input, asOf, plafonOverride = null, tenorMonthsOverride = null }) {
  const topup = input.mode === 'topup'
  const tenorMonths = tenorMonthsOverride ?? input.tenorMonths
  const f = product.fees
  const fixedFees = f.admin + f.appraisal + f.notary + f.insurance
  const prov = f.provisionBps / 10_000
  const maxPlafon = input.propertyValue ? roundDownTo((input.propertyValue * product.eligibility.maximumLtvBps) / 10_000, 5_000_000) : null
  const needFor = (cash) => roundUpTo(cash / (1 - prov), 5_000_000)

  let principal = baseline.outstanding
  let minPlafon = baseline.outstanding
  if (topup) {
    minPlafon = needFor(baseline.outstanding + fixedFees + baseline.exit.total)
    const wanted = needFor(baseline.outstanding + input.requestedTopup + fixedFees + baseline.exit.total)
    const upper = Math.max(minPlafon, maxPlafon ?? wanted)
    principal = Math.min(Math.max(plafonOverride ?? Math.min(wanted, upper), minPlafon), upper)
  }
  const provision = Math.round(principal * prov)
  const treatment = topup ? 'deducted' : 'upfront'
  const costs = [
    { code: 'old_bank_penalty', rateBps: baseline.exit.penaltyBps, amount: baseline.exit.penalty, treatment, estimated: baseline.exit.penaltyEstimated },
    { code: 'old_bank_admin', amount: baseline.exit.admin, treatment, estimated: true },
    { code: 'provision', rateBps: f.provisionBps, amount: provision, treatment, estimated: false },
    { code: 'admin', amount: f.admin, treatment, estimated: false },
    { code: 'appraisal', amount: f.appraisal, treatment, estimated: true },
    { code: 'notary', amount: f.notary, treatment, estimated: true },
    { code: 'insurance', amount: f.insurance, treatment, estimated: true },
  ]
  const sim = simulateLoan({ product, principal, termMonths: tenorMonths })
  const comparison = calculateTakeoverScenario({ current: { payments: baseline.payments }, proposed: { payments: sim.payments }, costs })
  const topupResult =
    topup && input.propertyValue
      ? calculateTopupScenario({
          propertyValue: input.propertyValue,
          maxLtvBps: product.eligibility.maximumLtvBps,
          oldOutstanding: baseline.outstanding,
          newLoanAmount: principal,
          deductedCosts: costs,
          requestedTopup: input.requestedTopup,
        })
      : null

  const dtiRatio = (sim.payment + input.otherDebt) / input.monthlyIncome
  const reasons = []
  let eligibility = eligibilityFromDti(dtiRatio, product.eligibility.maximumDtiBps)
  if (eligibility !== 'estimated_eligible') reasons.push(`Rasio cicilan di atas batas ${product.eligibility.maximumDtiBps / 100}% ${product.bank.name}`)
  const purposeOk = !topup || product.eligibility.purposes.includes(input.purpose)
  if (!purposeOk) {
    eligibility = 'not_eligible'
    reasons.unshift(`Tujuan dana belum sesuai kebijakan ${product.bank.name}`)
  }
  const withinLtv = maxPlafon === null ? null : principal <= maxPlafon
  if (withinLtv === false) {
    eligibility = 'not_eligible'
    reasons.push(`Plafon melebihi LTV maksimal ${product.eligibility.maximumLtvBps / 100}%`)
  }
  if (maxPlafon === null && eligibility === 'estimated_eligible') {
    eligibility = 'needs_review'
    reasons.push('Nilai properti belum diisi, LTV belum dapat dicek')
  }
  if (input.disputed && eligibility === 'estimated_eligible') {
    eligibility = 'needs_review'
    reasons.push('Properti bersengketa perlu pemeriksaan manual')
  }
  if (tenorMonths > product.eligibility.maximumTenorMonths) {
    eligibility = 'not_eligible'
    reasons.push('Tenor melebihi batas program')
  }
  const upfront = comparison.costs.upfront
  return {
    productId: product.id,
    productVersion: product.version,
    product,
    bank: product.bank,
    name: product.name,
    lastVerifiedAt: product.lastVerifiedAt,
    stale: isStale(product, asOf),
    mode: input.mode,
    tenorMonths,
    principal,
    minPlafon,
    maxPlafon,
    payment: sim.payment,
    paymentAfterFixed: sim.paymentAfterFixed,
    fixedMonths: sim.fixedMonths,
    fixedRateBps: sim.fixedRateBps,
    floatingRateBps: sim.floatingRateBps,
    totalPayment: sim.totalPayment,
    totalInterest: sim.totalInterest,
    costs,
    feesTotal: comparison.costs.totalEconomicCost,
    monthlyDiff: comparison.firstMonthBenefit,
    breakEven: comparison.breakEven,
    sustainedBreakEvenMonth: comparison.sustainedBreakEvenMonth,
    netSaving: comparison.netSaving,
    horizonMonths: comparison.horizonMonths,
    topup: topupResult,
    ltvRatio: input.propertyValue ? principal / input.propertyValue : null,
    dtiRatio,
    maxDtiBps: product.eligibility.maximumDtiBps,
    eligibility,
    reasons,
    purposeOk,
    paymentWithinCap: !input.maxPayment || sim.payment <= input.maxPayment,
    upfrontCosts: upfront,
    totalCost: sim.totalPayment + comparison.costs.totalEconomicCost,
  }
}

const gapOf = (x) => (x.topup ? Math.max(0, x.topup.fundingGap) : 0)

export const TAKEOVER_SORTS = {
  total: { label: 'Biaya total terendah', compare: (a, b) => a.totalCost - b.totalCost },
  cicilan: { label: 'Cicilan terendah', compare: (a, b) => a.payment - b.payment },
  fixed: { label: 'Fixed terlama', compare: (a, b) => b.fixedMonths - a.fixedMonths || a.totalCost - b.totalCost },
  bunga: { label: 'Total bunga terendah', compare: (a, b) => a.totalInterest - b.totalInterest },
  // Top-up order (doc 02 OPT-07): eligible → funds met → within comfort → costs → total → longer fixed.
  rekomendasi: {
    label: 'Rekomendasi',
    compare: (a, b) =>
      RANK[a.eligibility] - RANK[b.eligibility] ||
      (gapOf(a) > 0) - (gapOf(b) > 0) ||
      !a.paymentWithinCap - !b.paymentWithinCap ||
      a.feesTotal - b.feesTotal ||
      a.totalCost - b.totalCost ||
      b.fixedMonths - a.fixedMonths,
  },
}

export const GOAL_SORT = { lower_payment: 'cicilan', longer_fixed: 'fixed', shorter_tenor: 'total', lower_interest: 'bunga' }

export function defaultTakeoverSort(input) {
  return input.mode === 'topup' ? 'rekomendasi' : (GOAL_SORT[input.goal] ?? 'total')
}

export function compareTakeoverPrograms({ products, baseline, input, asOf, sort }) {
  const activeSort = sort ?? defaultTakeoverSort(input)
  const items = products
    .filter((p) => p.productTypes.includes('takeover') && isAvailable(p, asOf))
    .map((product) => evaluateTakeoverProduct({ product, baseline, input, asOf }))
    .sort(TAKEOVER_SORTS[activeSort].compare)
  const fresh = items.filter((x) => !x.stale)
  let match
  if (input.mode === 'topup') {
    const best = [...fresh].sort(TAKEOVER_SORTS.rekomendasi.compare)[0]
    match = best && best.eligibility === 'estimated_eligible' && gapOf(best) === 0 ? best : undefined
  } else {
    match = fresh.filter((x) => x.eligibility !== 'not_eligible').sort(TAKEOVER_SORTS[GOAL_SORT[input.goal] ?? 'total'].compare)[0]
  }
  return { asOf, sort: activeSort, items: items.map((x) => ({ ...x, recommended: x === match })) }
}
