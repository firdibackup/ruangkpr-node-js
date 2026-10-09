// Pure derivations for an active mortgage (no storage, caller passes `asOf`).
import { addDays, addMonths, daysUntil, nextDueDate } from '@/calculations/dates'
import { calculateDti, calculateFloatingImpact, calculatePropertyMetrics, generateAmortizationSchedule } from '@/calculations/finance'

export const WARNING_WINDOW_DAYS = 90
// Home asks the user to mark a payment from H-7; earlier marking stays on the Payment tab.
const PAYMENT_ALERT_DAYS = 7

// First due date on/after today; the akad day itself is never an installment.
const firstDue = (m, asOf) => nextDueDate({ today: m.startDate >= asOf ? addDays(m.startDate, 1) : asOf, dueDay: m.dueDay })

// Forward-looking schedule from today's outstanding. Returns { missing } instead of a fake table.
export function buildScheduleInput(m, asOf) {
  // Sharia products are not annuity interest loans; never force them into this formula (doc 05 §11.2).
  if (m.scheme === 'sharia') return { missing: ['Metode perhitungan KPR syariah belum didukung'] }
  const missing = []
  if (!(m.outstandingPrincipal > 0)) missing.push('Sisa pokok')
  if (!(m.remainingTenorMonths > 0)) missing.push('Sisa tenor')
  if (!(m.currentRateBps > 0)) missing.push('Bunga saat ini')
  if (missing.length) return { missing }

  const startDate = firstDue(m, asOf)
  const termMonths = m.remainingTenorMonths
  const fixedEndsInTerm = m.currentRateType === 'fixed' && m.fixedUntil && m.fixedUntil < addMonths(startDate, termMonths - 1, m.dueDay)
  if (!fixedEndsInTerm) {
    return { startDate, termMonths, ratePeriods: [{ startMonth: 0, endMonth: termMonths - 1, annualRateBps: m.currentRateBps, rateType: m.currentRateType, estimated: false }] }
  }
  if (!(m.estimatedFloatingRateBps > 0)) return { missing: ['Estimasi bunga floating setelah fixed'] }
  let fixedMonths = 0
  while (addMonths(startDate, fixedMonths, m.dueDay) <= m.fixedUntil) fixedMonths++
  const ratePeriods = []
  if (fixedMonths > 0) ratePeriods.push({ startMonth: 0, endMonth: fixedMonths - 1, annualRateBps: m.currentRateBps, rateType: 'fixed', estimated: false })
  ratePeriods.push({ startMonth: fixedMonths, endMonth: termMonths - 1, annualRateBps: m.estimatedFloatingRateBps, rateType: 'floating', estimated: true })
  return { startDate, termMonths, ratePeriods, fixedMonths }
}

export function buildSchedule(m, asOf) {
  const input = buildScheduleInput(m, asOf)
  if (input.missing) return { schedule: null, missing: input.missing, error: null }
  try {
    const schedule = generateAmortizationSchedule({ principal: m.outstandingPrincipal, termMonths: input.termMonths, ratePeriods: input.ratePeriods, startDate: input.startDate, dueDay: m.dueDay })
    return { schedule, missing: [], error: null, fixedMonths: input.fixedMonths ?? null }
  } catch (error) {
    return { schedule: null, missing: [], error }
  }
}

export function rateMode(m, asOf) {
  // "Belum tahu" in setup: no floating reminder and no made-up "normal" rate score.
  if (!m.currentRateType) return { mode: null, daysUntilFixedEnd: null }
  if (m.currentRateType === 'floating' || (m.fixedUntil && m.fixedUntil < asOf)) return { mode: 'floating', daysUntilFixedEnd: null }
  if (!m.fixedUntil) return { mode: 'normal', daysUntilFixedEnd: null }
  const days = daysUntil({ fromDate: asOf, targetDate: m.fixedUntil })
  return { mode: days > 0 && days <= WARNING_WINDOW_DAYS ? 'warning' : 'normal', daysUntilFixedEnd: days }
}

export const FIXED_MILESTONES = [90, 60, 30, 14, 7]

export function nextMilestone(days) {
  return FIXED_MILESTONES.filter((h) => days <= h).at(-1) ?? null
}

// KPR Health formula, version 1 (admin plan §4.7). Later versions are published from the admin console and reach
// pages through the dashboard snapshot (`config.health`); version 1 stays the default. Limits are bps of a ratio
// (DTI, LTV) or days (fixed period left); `upTo: null` is the open last band. JSON-safe on purpose (no Infinity).
export const HEALTH_V1 = {
  version: 1,
  params: {
    dti: [{ upTo: 3000, score: 90 }, { upTo: 3500, score: 75 }, { upTo: 4000, score: 62 }, { upTo: 5000, score: 40 }, { upTo: null, score: 20 }],
    ltv: [{ upTo: 5000, score: 90 }, { upTo: 7000, score: 75 }, { upTo: 8000, score: 60 }, { upTo: 10_000, score: 40 }, { upTo: null, score: 20 }],
    rate: { floating: 50, fixedDays: [{ upTo: 90, score: 58 }, { upTo: 365, score: 75 }, { upTo: null, score: 90 }] },
    progress: { base: 50, perPaid: 70 },
    weights: { dti: 1, ltv: 1, rate: 1, progress: 1 },
    labels: { healthy: 80, attention: 60 },
  },
}

// Provisional KPR Health (PRD §11.2, open question #7): documented thresholds, not a bank credit score.
// Missing components are reported as null and the overall score is marked partial — never a fake zero.
export function healthScore({ dtiRatio, ltvRatio, mode, daysUntilFixedEnd, paidRatio }, config = HEALTH_V1) {
  const p = config.params
  const band = (value, steps, scale = 1) => steps.find((s) => s.upTo === null || value <= s.upTo / scale).score
  const toneOf = (score) => (score >= p.labels.healthy ? 'ok' : score >= p.labels.attention ? 'warn' : 'bad')
  const components = [
    { key: 'dti', name: 'Beban cicilan', score: dtiRatio == null ? null : band(dtiRatio, p.dti, 10_000) },
    { key: 'ltv', name: 'Nilai properti', score: ltvRatio == null ? null : band(ltvRatio, p.ltv, 10_000) },
    { key: 'rate', name: 'Risiko bunga', score: mode == null ? null : mode === 'floating' ? p.rate.floating : band(daysUntilFixedEnd ?? Infinity, p.rate.fixedDays) },
    { key: 'progress', name: 'Progres pinjaman', score: paidRatio == null ? null : Math.min(100, Math.round(p.progress.base + p.progress.perPaid * paidRatio)) },
  ].map((c) => ({ ...c, tone: c.score === null ? 'mute' : toneOf(c.score) }))
  const known = components.filter((c) => c.score !== null)
  const counted = known.filter((c) => p.weights[c.key] > 0)
  if (!counted.length) return { score: null, partial: true, label: 'Belum lengkap', tone: 'mute', components, version: config.version }
  const weight = counted.reduce((s, c) => s + p.weights[c.key], 0)
  const score = Math.round(counted.reduce((s, c) => s + c.score * p.weights[c.key], 0) / weight)
  return {
    score,
    partial: known.length < components.length,
    label: score >= p.labels.healthy ? 'Sehat' : score >= p.labels.attention ? 'Perlu perhatian' : 'Berisiko',
    tone: toneOf(score),
    components,
    version: config.version,
  }
}

// First due date on/after today that the user has not marked as paid.
export function nextUnpaidDue(m, asOf) {
  const paid = new Set((m.payments ?? []).filter((p) => p.status === 'paid').map((p) => p.dueDate))
  let due = firstDue(m, asOf)
  while (paid.has(due)) due = addMonths(due, 1, m.dueDay)
  return due
}

// Months shown in payment history around the next due, the ones the user may mark paid now
// (last month if still unpaid, up to ~1 month ahead), and the one Home nudges about: a due missed
// since activation first (earlier ones could not be recorded here), else the next one from H-7.
function paymentWindow(m, asOf, nextDue) {
  const paid = new Set((m.payments ?? []).filter((p) => p.status === 'paid').map((p) => p.dueDate))
  const dueWindow = [addMonths(nextDue, -1, m.dueDay), nextDue, addMonths(nextDue, 1, m.dueDay)].filter((x) => !m.startDate || x > m.startDate)
  const payableDues = dueWindow.filter((x) => !paid.has(x) && x <= addDays(asOf, 31))
  const due = payableDues.find((x) => x < asOf && x >= (m.activatedAt?.slice(0, 10) ?? '')) ?? nextDue
  const days = daysUntil({ fromDate: asOf, targetDate: due })
  return { dueWindow, payableDues, paymentAlert: days > PAYMENT_ALERT_DAYS ? null : { due, days, tone: days > 0 ? 'warn' : 'bad' } }
}

// `healthConfig`: the published KPR Health version from the snapshot; pages that show no score leave it out.
export function deriveMortgage(m, asOf, healthConfig) {
  const { mode, daysUntilFixedEnd } = rateMode(m, asOf)
  const nextDue = nextUnpaidDue(m, asOf)
  const { schedule, missing, error, fixedMonths } = buildSchedule(m, asOf)
  const f = m.finance ?? {}
  const income = (f.monthlyIncome ?? 0) + (f.jointIncome ? f.partnerIncome ?? 0 : 0)
  const otherDebt = (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0)
  const dti = income > 0 ? calculateDti({ monthlyIncome: income, mortgagePayment: m.currentPayment, otherMonthlyDebt: otherDebt }) : null
  const value = m.property?.estimatedValue ?? null
  const property = value > 0 && m.outstandingPrincipal >= 0 ? calculatePropertyMetrics({ propertyValue: value, outstanding: m.outstandingPrincipal ?? 0 }) : null
  // Unknown (null), not 0%, until both the original principal and today's balance are known.
  const paidRatio = m.originalPrincipal > 0 && m.outstandingPrincipal != null ? Math.min(1, Math.max(0, (m.originalPrincipal - m.outstandingPrincipal) / m.originalPrincipal)) : null

  let floatingImpact = null
  if (mode !== 'floating' && schedule && fixedMonths != null && fixedMonths < schedule.rows.length) {
    const resetRow = schedule.rows[fixedMonths]
    floatingImpact = {
      ...calculateFloatingImpact({ outstanding: resetRow.openingBalance, remainingMonths: schedule.rows.length - fixedMonths, currentAnnualRateBps: m.currentRateBps, nextAnnualRateBps: m.estimatedFloatingRateBps }),
      resetDate: resetRow.dueDate,
    }
  }
  return {
    mode,
    daysUntilFixedEnd,
    milestone: mode === 'warning' ? nextMilestone(daysUntilFixedEnd) : null,
    nextDue,
    daysToNextDue: daysUntil({ fromDate: asOf, targetDate: nextDue }),
    ...paymentWindow(m, asOf, nextDue),
    schedule,
    scheduleMissing: missing,
    scheduleError: error,
    firstRow: schedule?.rows[0] ?? null,
    estimatedEndDate: schedule?.rows.at(-1).dueDate ?? null,
    dti,
    income,
    otherDebt,
    property,
    partialProperty: !(value > 0),
    paidRatio,
    floatingImpact,
    health: healthScore({ dtiRatio: dti?.dtiRatio ?? null, ltvRatio: property?.ltvRatio ?? null, mode, daysUntilFixedEnd, paidRatio }, healthConfig),
  }
}
