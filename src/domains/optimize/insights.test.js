import { describe, expect, it } from 'vitest'
import { applicationHealth, dtiTone, goalConditions, simulationTeaser } from './insights'

const clock = '2026-09-30'
const data = {
  employment: { monthlyIncome: 15_000_000 },
  oldLoan: { originalPrincipal: 500_000_000, outstanding: 400_000_000, currentPayment: 5_000_000, rateBps: 1050, rateType: 'floating', remainingMonths: 180, dueDay: 12 },
  finance: { vehicleDebt: 1_000_000, cardDebt: 500_000, otherDebt: 0 },
  property: { estimatedValue: 800_000_000 },
}

describe('applicationHealth', () => {
  it('scores DTI, live LTV, rate and progress from wizard data', () => {
    const h = applicationHealth(data, clock, 800_000_000)
    expect(h.dtiRatio).toBeCloseTo(6_500_000 / 15_000_000)
    expect(h.ltvRatio).toBe(0.5)
    expect(h.rate.mode).toBe('floating')
    expect(h.paidRatio).toBe(0.2)
    expect(h.partial).toBe(false)
  })

  it('marks the score partial when the rate type is unknown (estimate path) or no property value', () => {
    const h = applicationHealth({ ...data, oldLoan: { ...data.oldLoan, rateType: null } }, clock, null)
    expect(h.components.find((c) => c.key === 'rate').score).toBeNull()
    expect(h.ltvRatio).toBeNull()
    expect(h.partial).toBe(true)
  })
})

describe('goalConditions', () => {
  it('computes exit costs, top-up headroom and payment room', () => {
    const c = goalConditions(data, clock)
    expect(c.exitCosts).toBeGreaterThan(0)
    expect(c.maxLoanByCollateral).toBe(560_000_000)
    expect(c.maxGrossTopup).toBe(160_000_000)
    expect(c.safePayment).toBe(5_250_000 - 1_500_000)
    expect(c.paymentRoom).toBe(3_750_000 - 5_000_000) // already above the 35% guideline
  })

  it('leaves top-up figures null without a property value', () => {
    const c = goalConditions({ ...data, property: {} }, clock)
    expect(c.maxLoanByCollateral).toBeNull()
    expect(c.maxGrossTopup).toBeNull()
  })

  it('prices staying with the old bank for the phase 1 milestone', () => {
    const c = goalConditions(data, clock)
    expect(c.totalInterest).toBe(500_000_000) // 180 × Rp5 jt − Rp400 jt sisa pokok
    expect(c.payoffDate).toBe('2041-09-12')
  })

  it('still prices staying on the estimate path, where the rate type is unknown', () => {
    const c = goalConditions({ ...data, oldLoan: { ...data.oldLoan, rateType: null } }, clock)
    expect(c.rate.mode).toBeNull()
    expect(c.totalInterest).toBe(500_000_000)
  })

  it('leaves staying costs null until the old loan is complete', () => {
    const c = goalConditions({ ...data, oldLoan: { originalPrincipal: 500_000_000 } }, clock)
    expect(c.totalInterest).toBeNull()
    expect(c.payoffDate).toBeNull()
  })
})

describe('simulationTeaser', () => {
  const item = (monthlyDiff, fundingGap = null) => ({ monthlyDiff, topup: fundingGap == null ? null : { fundingGap } })

  it('take over: the biggest monthly cut, or says nothing lowers the payment', () => {
    expect(simulationTeaser({ items: [item(350_000), item(850_000), item(-100_000)], input: { mode: 'takeover' } })).toBe('3 program cocok · cicilan bisa turun hingga Rp850 rb/bln')
    expect(simulationTeaser({ items: [item(0), item(-100_000)], input: { mode: 'takeover' } })).toBe('2 program cocok · belum ada yang menurunkan cicilan')
  })

  it('top-up: counts programs that cover the requested funds', () => {
    const input = { mode: 'topup', requestedTopup: 100_000_000 }
    expect(simulationTeaser({ items: [item(0, -5_000_000), item(0, 0), item(0, 20_000_000)], input })).toBe('3 program cocok · 2 memenuhi kebutuhan dana Rp100 jt')
    expect(simulationTeaser({ items: [item(0, 20_000_000), item(0)], input })).toBe('2 program cocok · belum ada yang memenuhi kebutuhan dana')
  })

  it('says so when no program matches', () => {
    expect(simulationTeaser({ items: [], input: { mode: 'topup', requestedTopup: 100_000_000 } })).toBe('Belum ada program yang cocok')
  })
})

describe('dtiTone', () => {
  it('uses the 35% guideline and the 45% ceiling some banks accept', () => {
    expect([null, 0.35, 0.36, 0.45, 0.46].map(dtiTone)).toEqual([undefined, 'ok', 'warn', 'warn', 'bad'])
  })
})
