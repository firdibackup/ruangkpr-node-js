// Take Over wizard insights built only from what the user already entered (steps 1–4).
// Anything that cannot be computed yet is null — shown as "belum dapat dihitung", never a fake number.
import { CalculationError, calculateDti, calculatePaymentCapacity, calculatePropertyMetrics, calculateTopupScenario } from '@/calculations/finance'
import { takeoverBaseline } from '@/calculations/programs'
import { healthScore, rateMode } from '@/domains/mortgages/derive'
import { rupiahShort } from '@/lib/format'

// Same bands as the program list: 35% is the usual bank guideline, some banks accept up to 45%.
export const dtiTone = (r) => (r == null ? undefined : r <= 0.35 ? 'ok' : r <= 0.45 ? 'warn' : 'bad')

const incomeOf = (e = {}) => (e.monthlyIncome ?? 0) + (e.jointIncome ? e.partnerIncome ?? 0 : 0)
const debtOf = (f = {}) => (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0)
// Drafts saved before Jenis bunga was asked have no rate type: report it as unknown instead of assuming fixed.
const rateOf = (o, clock) => (o.rateType ? rateMode({ currentRateType: o.rateType, fixedUntil: o.fixedUntil }, clock) : { mode: null, daysUntilFixedEnd: null })

function calc(fn) {
  try {
    return fn()
  } catch (e) {
    if (e instanceof CalculationError) return null
    throw e
  }
}

// Same provisional score as the monitored-mortgage KPR Health; propertyValue is passed live from the form.
// healthConfig: the snapshot's published version (version 1 when left out).
export function applicationHealth({ employment, oldLoan: o = {}, finance }, clock, propertyValue, healthConfig) {
  const income = incomeOf(employment)
  const dti = income > 0 && o.currentPayment > 0 ? calc(() => calculateDti({ monthlyIncome: income, mortgagePayment: o.currentPayment, otherMonthlyDebt: debtOf(finance) })) : null
  const property = propertyValue > 0 && o.outstanding > 0 ? calc(() => calculatePropertyMetrics({ propertyValue, outstanding: o.outstanding })) : null
  const rate = rateOf(o, clock)
  const paidRatio = o.originalPrincipal > 0 && o.outstanding >= 0 ? Math.min(1, Math.max(0, (o.originalPrincipal - o.outstanding) / o.originalPrincipal)) : 0
  const health = healthScore({ dtiRatio: dti?.dtiRatio ?? null, ltvRatio: property?.ltvRatio ?? null, mode: rate.mode, daysUntilFixedEnd: rate.daysUntilFixedEnd, paidRatio }, healthConfig)
  return { ...health, dtiRatio: dti?.dtiRatio ?? null, ltvRatio: property?.ltvRatio ?? null, rate, paidRatio }
}

// Financial picture per goal option (Take Over only vs + Top-up), before any bank product is involved.
export function goalConditions({ employment, oldLoan: o = {}, finance: f = {}, property: p = {} }, clock) {
  const income = incomeOf(employment)
  const otherDebt = debtOf(f)
  const loanReady = o.outstanding > 0 && o.remainingMonths > 0 && o.currentPayment > 0
  const baseline = loanReady ? calc(() => takeoverBaseline({ ...o, asOf: clock })) : null
  const capacity = income > 0 ? calc(() => calculatePaymentCapacity({ monthlyIncome: income, existingDebt: otherDebt })) : null
  const value = p.estimatedValue
  // Conservative 70% LTV reference, same as the Properti step; per-bank limits apply in the program list.
  const topup =
    value > 0 && o.outstanding > 0
      ? calc(() => calculateTopupScenario({ propertyValue: value, maxLtvBps: 7000, oldOutstanding: o.outstanding, newLoanAmount: Math.max(o.outstanding, Math.floor(value * 0.7)) }))
      : null
  return {
    outstanding: o.outstanding ?? null,
    exitCosts: baseline?.exit.total ?? null,
    // What staying costs (phase 1 milestone): interest left and payoff month at the recorded payment.
    totalInterest: baseline?.totalInterest ?? null,
    payoffDate: baseline?.payoffDate ?? null,
    dtiRatio: income > 0 && o.currentPayment > 0 ? (o.currentPayment + otherDebt) / income : null,
    rate: rateOf(o, clock),
    maxLoanByCollateral: topup?.maxLoanByCollateral ?? null,
    maxGrossTopup: topup?.maxGrossTopup ?? null,
    // Max mortgage payment within the 35% guideline after other debts, and what is left above today's payment.
    safePayment: capacity?.remainingCapacity ?? null,
    paymentRoom: capacity && o.currentPayment > 0 ? capacity.remainingCapacity - o.currentPayment : null,
  }
}

// Phase 2 milestone teaser on Baseline: one line from the simulation already loaded there.
export function simulationTeaser({ items, input }) {
  const n = items.length
  if (!n) return 'Belum ada program yang cocok'
  if (input.mode === 'topup') {
    const funded = items.filter((x) => x.topup && x.topup.fundingGap <= 0).length
    return funded ? `${n} program cocok · ${funded} memenuhi kebutuhan dana ${rupiahShort(input.requestedTopup)}` : `${n} program cocok · belum ada yang memenuhi kebutuhan dana`
  }
  const cut = Math.max(0, ...items.map((x) => x.monthlyDiff))
  return cut > 0 ? `${n} program cocok · cicilan bisa turun hingga ${rupiahShort(cut)}/bln` : `${n} program cocok · belum ada yang menurunkan cicilan`
}
