import { describe, expect, it } from 'vitest'
import { HEALTH_V1, deriveMortgage, healthScore, rateMode } from './derive'

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
