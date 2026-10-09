import { describe, expect, it } from 'vitest'
import { deriveMortgage, healthScore, nextMilestone, rateMode } from './derive'
import { FIXED_PASSED, filledOnly, impliedRate, remainingFromStart, validateLoanStep, validatePropertyStep, validateReminders, withImpliedRate } from './validation'
import { createSeed } from '@/data/seed'

const today = '2026-09-28'

describe('mortgage setup validation', () => {
  const loan = {
    bankName: 'Bank ABC', bankOther: '', scheme: 'conventional', originalPrincipal: '600000000', currentPayment: '4127324', originalTenorMonths: '240', startDate: '2021-12-22', dueDay: '22',
    rateStatus: 'fixed', currentRate: '5,50', fixedUntil: '2026-12-22', floatingRate: '9,00', knowsOutstanding: 'no', outstandingPrincipal: '', remainingTenorMonths: '',
  }

  it('step 1 requires the KPR data reminders and amortization need', () => {
    expect(validateLoanStep(loan, { today })).toEqual({})
    const empty = Object.fromEntries(Object.keys(loan).map((k) => [k, '']))
    expect(Object.keys(validateLoanStep(empty, { today })).sort()).toEqual(['bankName', 'currentPayment', 'currentRate', 'dueDay', 'knowsOutstanding', 'originalPrincipal', 'originalTenorMonths', 'rateStatus', 'scheme', 'startDate'].sort())
    expect(validateLoanStep({ ...loan, dueDay: '32' }, { today }).dueDay).toBeTruthy()
    expect(validateLoanStep({ ...loan, bankName: 'Bank lainnya', bankOther: 'B' }, { today }).bankOther).toBeTruthy()
    expect(validateLoanStep({ ...loan, startDate: '2026-10-01' }, { today }).startDate).toBeTruthy()
  })

  it('fixed needs a future end date and a floating estimate; floating needs neither', () => {
    expect(validateLoanStep({ ...loan, fixedUntil: '' }, { today }).fixedUntil).toBeTruthy()
    expect(validateLoanStep({ ...loan, fixedUntil: '2026-09-01' }, { today }).fixedUntil).toBe(FIXED_PASSED)
    expect(validateLoanStep({ ...loan, floatingRate: '' }, { today }).floatingRate).toBeTruthy()
    expect(validateLoanStep({ ...loan, rateStatus: 'floating', fixedUntil: '', floatingRate: '' }, { today })).toEqual({})
  })

  it('sisa pokok: official figures are checked; otherwise sisa tenor comes from tenor awal and tanggal akad', () => {
    expect(remainingFromStart(loan, today)).toBe(183)
    expect(validateLoanStep({ ...loan, originalTenorMonths: '12', startDate: '2020-01-01' }, { today }).startDate).toBeTruthy() // already paid off
    const official = { ...loan, knowsOutstanding: 'yes' }
    expect(Object.keys(validateLoanStep(official, { today }))).toEqual(['outstandingPrincipal', 'remainingTenorMonths'])
    expect(validateLoanStep({ ...official, outstandingPrincipal: '700000000', remainingTenorMonths: '183' }, { today }).outstandingPrincipal).toBeTruthy()
    expect(validateLoanStep({ ...official, outstandingPrincipal: '415000000', remainingTenorMonths: '183' }, { today })).toEqual({})
  })

  it('step 2 property: details required when filled in, the value may stay empty', () => {
    const property = { type: 'landed_house', city: 'Kota Bekasi', address: 'Griya Asri Blok C2', landArea: '72', buildingArea: '45', certificateType: 'shm', certificateOwner: 'Firdi Audi', estimatedValue: '', disputed: 'no' }
    expect(validatePropertyStep(property)).toEqual({})
    expect(validatePropertyStep({ ...property, type: 'apartment', landArea: '' })).toEqual({})
    expect(validatePropertyStep({ ...property, estimatedValue: '0' }).estimatedValue).toBeTruthy()
    expect(Object.keys(validatePropertyStep({ ...property, address: '', certificateOwner: '' }))).toEqual(['address', 'certificateOwner'])
  })

  it('filledOnly: only the required keys must be filled; other fields are checked once typed', () => {
    const errors = { fullName: 'a', nik: 'b', email: 'c' }
    expect(filledOnly(errors, { fullName: '', nik: '', email: '' }, ['fullName'])).toEqual({ fullName: 'a' })
    expect(filledOnly(errors, { fullName: 'Firdi', nik: '123', email: '' }, ['fullName'])).toEqual({ fullName: 'a', nik: 'b' })
    expect(filledOnly(validatePropertyStep({ type: '', city: '', address: '', landArea: '0', buildingArea: '', certificateType: '', certificateOwner: '', estimatedValue: '' }), { landArea: '0' })).toEqual({ landArea: expect.any(String) })
  })

  it('reminders need one payment offset and one channel', () => {
    expect(validateReminders({ payment: [], channels: { inApp: false, email: false } })).toMatchObject({ payment: expect.any(String), channels: expect.any(String) })
  })

  it('bunga is auto-filled from pinjaman, cicilan and tenor until typed, and never for floating', () => {
    const blank = { ...loan, currentRate: '', rateStatus: '' }
    const step = (prev, patch) => withImpliedRate(prev, { ...prev, ...patch }, 'currentRate', 'rateStatus')
    expect(impliedRate(loan, 'fixed')).toBe('5,50')
    expect(impliedRate(loan, 'floating')).toBe('')
    expect(impliedRate({ ...loan, currentPayment: '2000000' }, 'fixed')).toBe('') // below pinjaman / tenor: no positive rate
    const auto = step(blank, { currentPayment: '4127324' })
    expect(auto.currentRate).toBe('5,50')
    expect(step(auto, { currentPayment: '4500000' }).currentRate).not.toBe('5,50') // still auto: follows cicilan
    expect(step(auto, { rateStatus: 'floating' }).currentRate).toBe('') // payment may have changed: not guessed
    expect(step({ ...auto, currentRate: '6,25' }, { currentPayment: '4500000' }).currentRate).toBe('6,25') // typed: kept
  })
})

describe('mortgage derivations', () => {
  it('H-90 window and milestones', () => {
    expect(rateMode({ currentRateType: 'fixed', fixedUntil: '2026-12-22' }, today)).toEqual({ mode: 'warning', daysUntilFixedEnd: 85 })
    expect(rateMode({ currentRateType: 'fixed', fixedUntil: '2026-12-27' }, today).mode).toBe('warning') // exactly 90 days
    expect(rateMode({ currentRateType: 'fixed', fixedUntil: '2026-12-28' }, today).mode).toBe('normal') // 91 days
    expect(rateMode({ currentRateType: 'fixed', fixedUntil: '2026-09-01' }, today).mode).toBe('floating') // fixed already ended
    expect([nextMilestone(85), nextMilestone(60), nextMilestone(7)]).toEqual([90, 60, 7])
  })
  it('active warning fixture reconciles schedule and flags the floating transition as estimate', () => {
    const [m] = createSeed('mortgage_active_h90').mortgages
    const d = deriveMortgage(m, today)
    const rows = d.schedule.rows
    expect(rows[0].dueDate).toBe('2026-10-22')
    expect(d.schedule.totals.principal).toBe(m.outstandingPrincipal)
    expect(rows.at(-1).closingBalance).toBe(0)
    const transition = rows.find((r) => r.periodChanged)
    expect(transition).toMatchObject({ dueDate: '2027-01-22', rateType: 'floating', estimatedRate: true })
    expect(d.floatingImpact.direction).toBe('increase')
  })
  it('missing floating estimate gives partial state instead of a fake table', () => {
    const [m] = createSeed('mortgage_partial_rate').mortgages
    const d = deriveMortgage(m, today)
    expect(d.schedule).toBeNull()
    expect(d.scheduleMissing).toContain('Estimasi bunga floating setelah fixed')
  })
  it('health is partial (not zero) when property value is missing', () => {
    const h = healthScore({ dtiRatio: 0.38, ltvRatio: null, mode: 'normal', daysUntilFixedEnd: 200, paidRatio: 0.2 })
    expect(h.partial).toBe(true)
    expect(h.components.find((c) => c.key === 'ltv').score).toBeNull()
    expect(h.score).toBeGreaterThan(0)
  })
})
