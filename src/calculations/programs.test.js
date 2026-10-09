import { describe, expect, it } from 'vitest'
import { BANK_PRODUCTS } from '@/data/catalog'
import { comparePrimaryPrograms, compareTakeoverPrograms, evaluateTakeoverProduct, isStale, primaryAffordability, takeoverBaseline } from './programs'

const asOf = '2026-09-28'
const primaryInput = {
  loanAmount: 450_000_000,
  tenorMonths: 240,
  propertyPrice: 500_000_000,
  propertyType: 'landed_house',
  occupation: 'private_employee',
  birthDate: '1996-04-12',
  monthlyIncome: 15_000_000,
  existingDebt: 1_500_000,
}

describe('primary compare', () => {
  it('returns every matching product, one recommendation, and capacity from the 35% policy', () => {
    const r = comparePrimaryPrograms({ products: BANK_PRODUCTS, input: primaryInput, asOf })
    expect(r.items.length).toBe(2) // XYZ requires 15% DP (LTV 85%) → excluded at 90% LTV
    expect(r.excluded.map((x) => x.bank.name)).toEqual(['Bank XYZ'])
    expect(r.capacity.remainingCapacity).toBe(3_750_000)
    expect(r.items.filter((x) => x.recommended)).toHaveLength(1)
    expect(JSON.stringify(r)).not.toMatch(/secondary/i)
  })
  it('programs over capacity stay visible with a warning flag', () => {
    const r = comparePrimaryPrograms({ products: BANK_PRODUCTS, input: { ...primaryInput, monthlyIncome: 9_000_000 }, asOf })
    expect(r.items.length).toBeGreaterThan(0)
    expect(r.items.some((x) => !x.withinCapacity)).toBe(true)
    expect(r.items.filter((x) => x.recommended && !x.withinCapacity)).toHaveLength(0)
  })
  it('income below every minimum gives a no-match result with reasons', () => {
    const r = comparePrimaryPrograms({ products: BANK_PRODUCTS, input: { ...primaryInput, monthlyIncome: 3_000_000 }, asOf })
    expect(r.items).toHaveLength(0)
    expect(r.excluded.every((x) => x.reasons.includes('Penghasilan di bawah minimum program'))).toBe(true)
  })
  it('stale product data never gets the recommendation label', () => {
    const stale = BANK_PRODUCTS.map((p) => (p.id === 'bpr_abc_primary_fix5_v4' ? { ...p, lastVerifiedAt: '2026-07-01' } : p))
    const r = comparePrimaryPrograms({ products: stale, input: primaryInput, asOf, sort: 'cicilan' })
    const abc = r.items.find((x) => x.bank.name === 'Bank ABC')
    expect(abc.stale).toBe(true)
    expect(abc.recommended).toBe(false)
  })
})

describe('primary affordability (milestone 1)', () => {
  const afford = (input) => primaryAffordability({ products: BANK_PRODUCTS, input: { ...primaryInput, ...input }, asOf })
  it('sample profile opens every primary program and picks the largest loan', () => {
    const r = afford({})
    expect(r.capacity.remainingCapacity).toBe(3_750_000)
    expect(r.openCount).toBe(3)
    expect(r.best).toMatchObject({ principal: 660_456_611, tenorMonths: 360, fixedRateBps: 550, maxLtvBps: 9000 })
    expect(r.best.priceMax).toBe(733_840_678)
  })
  it('age caps the tenor at the maturity limit', () => {
    const r = afford({ birthDate: '1976-04-12' }) // 50 → 10–15 years left
    expect(r.openCount).toBe(3)
    expect(r.best.tenorMonths).toBe(180)
    expect(r.best.principal).toBeLessThan(afford({}).best.principal)
  })
  it('other debts over the 35% limit leave no loan room', () => {
    const r = afford({ existingDebt: 6_000_000 })
    expect(r.capacity.remainingCapacity).toBeLessThan(0)
    expect(r.openCount).toBe(3)
    expect(r.best).toBeNull()
  })
  it('income below every minimum opens nothing', () => {
    const r = afford({ monthlyIncome: 3_000_000, existingDebt: 0 })
    expect(r.openCount).toBe(0)
    expect(r.best).toBeNull()
  })
})

describe('take over / top-up', () => {
  const baseline = takeoverBaseline({
    outstanding: 421_500_000,
    rateBps: 1050,
    rateType: 'floating',
    remainingMonths: 181,
    currentPayment: 5_000_000,
    penaltyBps: null,
    dueDay: 12,
    asOf,
  })
  const input = { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180, propertyValue: 750_000_000, monthlyIncome: 15_000_000, otherDebt: 1_500_000, requestedTopup: 0 }

  it('baseline uses the recorded payment and estimated exit costs', () => {
    expect(baseline.payments).toHaveLength(181)
    expect(baseline.exit).toMatchObject({ penalty: 8_430_000, penaltyEstimated: true, admin: 1_000_000 })
    expect(isStale(BANK_PRODUCTS.find((p) => p.bank.id === 'bnk_ghi'), asOf)).toBe(true)
  })
  it('take over keeps principal = outstanding and reports break-even from cash flow', () => {
    const r = compareTakeoverPrograms({ products: BANK_PRODUCTS, baseline, input, asOf })
    expect(r.items).toHaveLength(3)
    r.items.forEach((x) => expect(x.principal).toBe(421_500_000))
    const best = r.items.find((x) => x.recommended)
    expect(best.stale).toBe(false)
    expect(best.monthlyDiff).toBeGreaterThan(0)
    expect(best.breakEven.status).toBe('reached')
  })
  it('no monthly benefit → no positive break-even', () => {
    const cheap = takeoverBaseline({ ...baseline, outstanding: 421_500_000, rateBps: 500, rateType: 'floating', remainingMonths: 181, currentPayment: 3_400_000, penaltyBps: 0, dueDay: 12, asOf })
    const product = BANK_PRODUCTS.find((p) => p.id === 'bpr_ghi_takeover_fix10_v1')
    const r = evaluateTakeoverProduct({ product, baseline: cheap, input, asOf })
    expect(r.monthlyDiff).toBeLessThanOrEqual(0)
    expect(r.breakEven.month).toBeNull()
  })
  it('top-up funds the payoff + request within LTV and reports the gap honestly', () => {
    const topupInput = { ...input, mode: 'topup', requestedTopup: 100_000_000, purpose: 'renovation', tenorMonths: 240 }
    const r = compareTakeoverPrograms({ products: BANK_PRODUCTS, baseline, input: topupInput, asOf })
    const xyz = r.items.find((x) => x.bank.id === 'bnk_xyz')
    expect(xyz.principal).toBeGreaterThan(421_500_000)
    expect(xyz.topup.withinLtv).toBe(true)
    expect(xyz.topup.netTopup).toBeGreaterThanOrEqual(100_000_000)
    const ghi = r.items.find((x) => x.bank.id === 'bnk_ghi') // 70% LTV cap → cannot fund everything
    expect(ghi.topup.fundingGap).toBeGreaterThan(0)
    const def = r.items.find((x) => x.bank.id === 'bnk_def')
    expect(compareTakeoverPrograms({ products: BANK_PRODUCTS, baseline, input: { ...topupInput, purpose: 'business' }, asOf }).items.find((x) => x.bank.id === 'bnk_def').eligibility).toBe('not_eligible')
    expect(def.purposeOk).toBe(true)
  })
})
