import { describe, expect, it } from 'vitest'
import { HEALTH_V1, deriveMortgage, healthScore, mortgageAsOf, rateMode } from './derive'

const today = '2026-09-28'
// What the 3-step setup can leave behind: bank, cicilan, jatuh tempo, and "Belum tahu" for the rate type.
const minimal = { id: 'mtg_min', status: 'active', bankName: 'Bank ABC', currentPayment: 4_127_324, dueDay: 22, currentRateType: null, payments: [] }

describe('derive with reminder-only data', () => {
  it('an unknown rate type is not read as a healthy normal rate', () => {
    expect(rateMode({ currentRateType: null }, today)).toEqual({ mode: null, daysUntilFixedEnd: null })
  })

  it('pelunasan progress is unknown without the original principal, not 0%', () => {
    expect(deriveMortgage(minimal, today).paidRatio).toBeNull()
    expect(deriveMortgage({ ...minimal, originalPrincipal: 600_000_000, outstandingPrincipal: 450_000_000 }, today).paidRatio).toBe(0.25)
  })

  it('KPR Health has no score (not NaN) when no component is known', () => {
    expect(healthScore({ dtiRatio: null, ltvRatio: null, mode: null, daysUntilFixedEnd: null, paidRatio: null })).toMatchObject({ score: null, partial: true, label: 'Belum lengkap', tone: 'mute' })
    expect(deriveMortgage(minimal, today).health.score).toBeNull()
  })

  it('payment history still lists due dates without an akad date', () => {
    expect(deriveMortgage(minimal, today).dueWindow).toEqual(['2026-09-22', '2026-10-22', '2026-11-22'])
  })

  it('the akad day is not the next installment', () => {
    const fresh = { ...minimal, startDate: today, dueDay: 28 }
    expect(deriveMortgage(fresh, today)).toMatchObject({ nextDue: '2026-10-28', paymentAlert: null })
  })

  it('Home nudges from H-7 (warn), turns red on the due day and for a due missed since activation', () => {
    const tracked = { ...minimal, activatedAt: '2026-09-15T08:00:00.000Z', payments: [{ dueDate: '2026-09-22', status: 'paid' }] }
    expect(deriveMortgage(tracked, '2026-10-14').paymentAlert).toBeNull()
    expect(deriveMortgage(tracked, '2026-10-15').paymentAlert).toEqual({ due: '2026-10-22', days: 7, tone: 'warn' })
    expect(deriveMortgage(tracked, '2026-10-22').paymentAlert).toEqual({ due: '2026-10-22', days: 0, tone: 'bad' })
    expect(deriveMortgage(tracked, '2026-10-25').paymentAlert).toEqual({ due: '2026-10-22', days: -3, tone: 'bad' })
    // A due before activation could not be recorded here, so it is not flagged as late.
    expect(deriveMortgage({ ...tracked, activatedAt: '2026-09-28T08:00:00.000Z', payments: [] }, today).paymentAlert).toBeNull()
  })
})

describe('sisa pokok as of today', () => {
  // The reported case: 400 jt at 5,5% over 240 months, typed from the bank on 13 Oct 2026, due on the 5th.
  // Expected balances are closed-form annuity values B(k) = P·(1+r)^k − A·((1+r)^k − 1)/r, not the app's schedule.
  const loan = { ...minimal, scheme: 'conventional', originalPrincipal: 400_000_000, currentPayment: 2_751_549, currentRateType: 'floating', currentRateBps: 550, startDate: '2026-10-05', dueDay: 5, outstandingPrincipal: 400_000_000, remainingTenorMonths: 240, outstandingEstimated: false, outstandingAsOf: '2026-10-13' }

  it('marking a payment moves nothing; the balance drops once its due date has passed', () => {
    const marked = { ...loan, payments: [{ dueDate: '2026-11-05', status: 'paid' }] }
    expect(mortgageAsOf(marked, '2026-10-13')).toMatchObject({ outstandingPrincipal: 400_000_000, remainingTenorMonths: 240 })
    expect(mortgageAsOf(marked, '2026-11-05')).toMatchObject({ outstandingPrincipal: 400_000_000, remainingTenorMonths: 240 }) // due today: still to pay
    expect(mortgageAsOf(marked, '2026-11-06')).toMatchObject({ outstandingPrincipal: 399_081_784, remainingTenorMonths: 239, outstandingProjected: true })
    expect(mortgageAsOf(loan, '2026-11-06')).toMatchObject({ outstandingPrincipal: 399_081_784, remainingTenorMonths: 239 })
  })

  it('six months on, progress, LTV and the payoff date follow the moved balance instead of restarting from it', () => {
    expect(deriveMortgage(loan, '2026-10-13').estimatedEndDate).toBe('2046-10-05')
    const d = deriveMortgage({ ...loan, property: { estimatedValue: 500_000_000 } }, '2027-04-13')
    expect(mortgageAsOf(loan, '2027-04-13')).toMatchObject({ outstandingPrincipal: 394_427_190, remainingTenorMonths: 234 })
    expect(d.estimatedEndDate).toBe('2046-10-05') // used to slide to 2047-04-05
    expect(d.schedule.rows[0]).toMatchObject({ dueDate: '2027-05-05', openingBalance: 394_427_190 })
    expect(d.paidRatio).toBeCloseTo(0.013932025, 9)
    expect(d.property.ltvRatio).toBeCloseTo(0.78885438, 8)
  })

  it('a fixed rate without a floating estimate still moves at its fixed rate', () => {
    const fixed = { ...loan, currentRateType: 'fixed', fixedUntil: '2029-10-05', estimatedFloatingRateBps: null }
    expect(mortgageAsOf(fixed, '2026-12-06')).toMatchObject({ outstandingPrincipal: 398_159_360, remainingTenorMonths: 238 })
  })

  it('a loan past its last installment is paid off, and its pages still derive', () => {
    const last = { ...loan, outstandingPrincipal: 5_000_000, remainingTenorMonths: 2 }
    expect(mortgageAsOf(last, '2027-01-06')).toMatchObject({ outstandingPrincipal: 0, remainingTenorMonths: 0 })
    expect(deriveMortgage(last, '2027-01-06')).toMatchObject({ paidRatio: 1, estimatedEndDate: null })
  })

  it('without a saved date: counted from activation, or from the akad for a KPR opened by an application', () => {
    const { outstandingAsOf: _saved, ...legacy } = loan
    expect(mortgageAsOf({ ...legacy, activatedAt: '2026-10-13T03:00:00.000Z' }, '2026-11-06').outstandingPrincipal).toBe(399_081_784)
    expect(mortgageAsOf({ ...legacy, source: 'application', activatedAt: '2026-11-20T03:00:00.000Z' }, '2026-11-21').outstandingPrincipal).toBe(399_081_784)
    expect(mortgageAsOf(legacy, '2027-04-13').outstandingPrincipal).toBe(400_000_000) // no date at all: left as saved
  })

  it('sharia: the tenor counts down, the balance stays as entered (never the annuity formula)', () => {
    expect(mortgageAsOf({ ...loan, scheme: 'sharia' }, '2026-12-06')).toMatchObject({ outstandingPrincipal: 400_000_000, remainingTenorMonths: 238 })
  })

  it('a copy already moved to today is not moved twice; a replaced loan is not aged', () => {
    const served = mortgageAsOf(loan, '2027-04-13')
    expect(mortgageAsOf(served, '2027-04-13')).toEqual(served)
    expect(deriveMortgage(served, '2027-04-13').schedule.rows[0].openingBalance).toBe(394_427_190)
    expect(mortgageAsOf({ ...loan, status: 'replaced' }, '2027-04-13').outstandingPrincipal).toBe(400_000_000)
  })
})

describe('after the fixed period ends', () => {
  // Estimated on 13 Oct 2026; fixed 5,5% until 13 Oct 2028, then an estimated 12%; jatuh tempo tgl 28.
  // 4.258.770 is the closed-form annuity at 12% over the 215 months left at the first floating installment.
  const m = { ...minimal, scheme: 'conventional', originalPrincipal: 400_000_000, currentPayment: 2_751_549, currentRateType: 'fixed', currentRateBps: 550, fixedUntil: '2028-10-13', estimatedFloatingRateBps: 1200, startDate: '2026-09-01', dueDay: 28, outstandingPrincipal: 399_081_750, remainingTenorMonths: 239, outstandingEstimated: true, outstandingAsOf: '2026-10-13', finance: { monthlyIncome: 15_000_000, vehicleDebt: 1_000_000 } }

  it('the cicilan and bunga in effect, and the DTI, switch to the floating estimate; before that they are the saved ones', () => {
    expect(deriveMortgage(m, '2026-10-13')).toMatchObject({ payment: 2_751_549, rateBps: 550, termsEstimated: false })
    const d = deriveMortgage(m, '2028-11-01')
    expect(d).toMatchObject({ mode: 'floating', payment: 4_258_770, rateBps: 1200, previousPayment: 2_751_549, termsEstimated: true })
    expect(d.dti.dtiRatio).toBeCloseTo((4_258_770 + 1_000_000) / 15_000_000, 10)
    expect(d.health.components.find((c) => c.key === 'dti').score).toBe(62)
  })

  it('without a floating estimate the rate in effect is unknown instead of the old fixed one', () => {
    expect(deriveMortgage({ ...m, estimatedFloatingRateBps: null }, '2028-11-01')).toMatchObject({ rateBps: null, termsEstimated: true })
  })

  it('a KPR saved as floating keeps its own figures', () => {
    const floating = { ...m, currentRateType: 'floating', currentRateBps: 900, fixedUntil: null, estimatedFloatingRateBps: null, previousFixedPayment: 2_500_000 }
    expect(deriveMortgage(floating, '2028-11-01')).toMatchObject({ payment: 2_751_549, rateBps: 900, previousPayment: 2_500_000, termsEstimated: false })
  })
})

describe('KPR Health formula versions', () => {
  // The formula as written before versioning: the oracle version 1 must reproduce exactly.
  function legacyHealth({ dtiRatio, ltvRatio, mode, daysUntilFixedEnd, paidRatio }) {
    const band = (value, steps) => steps.find(([limit]) => value <= limit)[1]
    const scores = [
      dtiRatio == null ? null : band(dtiRatio, [[0.3, 90], [0.35, 75], [0.4, 62], [0.5, 40], [Infinity, 20]]),
      ltvRatio == null ? null : band(ltvRatio, [[0.5, 90], [0.7, 75], [0.8, 60], [1, 40], [Infinity, 20]]),
      mode == null ? null : mode === 'floating' ? 50 : band(daysUntilFixedEnd ?? Infinity, [[90, 58], [365, 75], [Infinity, 90]]),
      paidRatio == null ? null : Math.min(100, Math.round(50 + 70 * paidRatio)),
    ]
    const known = scores.filter((s) => s !== null)
    const score = known.length ? Math.round(known.reduce((s, x) => s + x, 0) / known.length) : null
    return [score, scores, score == null ? 'Belum lengkap' : score >= 80 ? 'Sehat' : score >= 60 ? 'Perlu perhatian' : 'Berisiko']
  }

  it('version 1 gives the same scores as the formula before versioning, band edges included', () => {
    const modes = [[null, null], ['floating', null], ['warning', 30], ['normal', null], ...[-5, 0, 1, 90, 91, 365, 366, 1000].map((d) => ['normal', d])]
    for (const dtiRatio of [null, 0, 0.1, 0.3, 0.30001, 0.35, 0.36, 0.4, 0.45, 0.5, 0.51, 0.8, 1.2])
      for (const ltvRatio of [null, 0.3, 0.5, 0.7, 0.75, 0.8, 1, 1.5])
        for (const [mode, daysUntilFixedEnd] of modes)
          for (const paidRatio of [null, 0, 0.2, 0.5, 1]) {
            const input = { dtiRatio, ltvRatio, mode, daysUntilFixedEnd, paidRatio }
            const h = healthScore(input, HEALTH_V1)
            expect([h.score, h.components.map((c) => c.score), h.label]).toEqual(legacyHealth(input))
          }
  })

  it('a later version re-weights and re-labels the same inputs, and says which version scored them', () => {
    const input = { dtiRatio: 0.45, ltvRatio: 0.5, mode: 'normal', daysUntilFixedEnd: 400, paidRatio: 0.5 }
    expect(healthScore(input)).toMatchObject({ score: 76, label: 'Perlu perhatian', tone: 'warn', version: 1 }) // (40 + 90 + 90 + 85) / 4
    const v2 = { version: 2, params: { ...HEALTH_V1.params, weights: { dti: 3, ltv: 1, rate: 1, progress: 1 }, labels: { healthy: 85, attention: 50 } } }
    const h = healthScore(input, v2)
    expect(h).toMatchObject({ score: 64, label: 'Perlu perhatian', version: 2 }) // (40×3 + 90 + 90 + 85) / 6
    expect(h.components.map((c) => c.tone)).toEqual(['bad', 'ok', 'ok', 'ok'])
    // Weight 0 keeps the component on screen but out of the score.
    const noProgress = { version: 3, params: { ...HEALTH_V1.params, weights: { ...HEALTH_V1.params.weights, progress: 0 } } }
    expect(healthScore(input, noProgress)).toMatchObject({ score: 73, partial: false })
    expect(deriveMortgage(minimal, today, v2).health.version).toBe(2)
  })
})
