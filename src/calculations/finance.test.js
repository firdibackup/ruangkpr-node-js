import { describe, expect, it } from 'vitest'
import {
  CalculationError,
  calculateAnnuityPayment,
  calculateDti,
  calculateFloatingImpact,
  calculateMaxPrincipal,
  calculateOutstanding,
  calculatePaymentCapacity,
  calculatePropertyMetrics,
  calculateTakeoverScenario,
  calculateTopupScenario,
  generateAmortizationSchedule,
  solveAnnualRateBps,
  validateRatePeriods,
} from './finance'

const codeOf = (fn) => {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(CalculationError)
    return e.code
  }
  throw new Error('expected CalculationError')
}

const fullFixed = (termMonths, annualRateBps) => [{ startMonth: 0, endMonth: termMonths - 1, annualRateBps, rateType: 'fixed', estimated: false }]

function expectReconciled(schedule, principal) {
  const { rows, totals } = schedule
  expect(totals.principal).toBe(principal)
  expect(totals.payment).toBe(totals.principal + totals.interest)
  expect(rows.at(-1).closingBalance).toBe(0)
  rows.forEach((r, i) => {
    expect(r.payment).toBe(r.principal + r.interest)
    expect(r.closingBalance).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(r.payment)).toBe(true)
    if (i > 0) expect(r.openingBalance).toBe(rows[i - 1].closingBalance)
  })
}

describe('annuity', () => {
  it('F01 anuitas 5,50%', () => {
    const r = calculateAnnuityPayment({ principal: 415_000_000, annualRateBps: 550, termMonths: 183 })
    expect(r.payment).toBe(3_355_115)
    expect(Math.abs(r.rawPayment - 3_355_115.387106027)).toBeLessThan(0.01)
  })
  it('F02 anuitas 0%', () => {
    const r = calculateAnnuityPayment({ principal: 120_000_000, annualRateBps: 0, termMonths: 120 })
    expect(r.payment).toBe(1_000_000)
    expect(r.rawPayment).toBe(1_000_000)
  })
  it('A03 tenor 1 = principal + one month interest', () => {
    const r = calculateAnnuityPayment({ principal: 12_000_000, annualRateBps: 1200, termMonths: 1 })
    expect(r.payment).toBe(12_120_000)
  })
  it('A04 very small rate stays finite and close to zero-rate', () => {
    const r = calculateAnnuityPayment({ principal: 120_000_000, annualRateBps: 1, termMonths: 120 })
    expect(Number.isFinite(r.rawPayment)).toBe(true)
    expect(Math.abs(r.payment - 1_000_000)).toBeLessThan(1_000)
  })
  it('A05 / V01–V03 invalid inputs throw structured errors', () => {
    expect(codeOf(() => calculateAnnuityPayment({ principal: 0, annualRateBps: 550, termMonths: 12 }))).toBe('OUT_OF_RANGE')
    expect(codeOf(() => calculateAnnuityPayment({ principal: 1_000_000, annualRateBps: -1, termMonths: 12 }))).toBe('OUT_OF_RANGE')
    expect(codeOf(() => calculateAnnuityPayment({ principal: 1_000_000, annualRateBps: 550, termMonths: 0 }))).toBe('OUT_OF_RANGE')
    expect(codeOf(() => calculateAnnuityPayment({ principal: NaN, annualRateBps: 550, termMonths: 12 }))).toBe('NOT_FINITE')
    expect(codeOf(() => calculateAnnuityPayment({ principal: 2 ** 60, annualRateBps: 550, termMonths: 12 }))).toBe('NOT_SAFE_INTEGER')
    expect(codeOf(() => calculateAnnuityPayment({ principal: 'Rp 1.000.000', annualRateBps: 550, termMonths: 12 }))).toBe('INVALID_TYPE')
    expect(codeOf(() => calculateAnnuityPayment({ principal: 1_000_000, annualRateBps: '5,50', termMonths: 12 }))).toBe('INVALID_TYPE')
  })
})

describe('outstanding', () => {
  const base = { originalPrincipal: 600_000_000, annualRateBps: 550, originalTermMonths: 240 }
  it('F03 fixture', () => {
    const r = calculateOutstanding({ ...base, paidMonths: 57 })
    expect(r.outstanding).toBe(510_515_794)
    expect(r.remainingMonths).toBe(183)
  })
  it('O01 k=0 equals principal, O02 k=n is zero', () => {
    expect(calculateOutstanding({ ...base, paidMonths: 0 }).outstanding).toBe(600_000_000)
    expect(calculateOutstanding({ ...base, paidMonths: 240 }).outstanding).toBe(0)
  })
  it('O04 payment too low, O05 k>n', () => {
    expect(codeOf(() => calculateOutstanding({ ...base, paidMonths: 10, contractualPayment: 2_000_000 }))).toBe('PAYMENT_TOO_LOW')
    expect(codeOf(() => calculateOutstanding({ ...base, paidMonths: 241 }))).toBe('OUT_OF_RANGE')
  })
})

describe('solve rate', () => {
  it('F04 round-trip 5,5%', () => {
    const raw = solveAnnualRateBps({ principal: 600_000_000, payment: 4_127_323.8471554075, termMonths: 240 })
    expect(raw.annualRateBps).toBe(550)
    expect(Math.abs(raw.residualPayment)).toBeLessThanOrEqual(0.5)
    expect(raw.estimated).toBe(true)
    const int = solveAnnualRateBps({ principal: 600_000_000, payment: 4_127_324, termMonths: 240 })
    expect(int.annualRateBps).toBe(550)
    expect(Math.abs(int.residualPayment)).toBeLessThanOrEqual(0.5)
  })
  it('S02 exact 0%', () => {
    expect(solveAnnualRateBps({ principal: 120_000_000, payment: 1_000_000, termMonths: 120 }).annualRateBps).toBe(0)
  })
  it('S03/S04 not bracketed', () => {
    expect(codeOf(() => solveAnnualRateBps({ principal: 120_000_000, payment: 900_000, termMonths: 120 }))).toBe('RATE_NOT_BRACKETED')
    expect(codeOf(() => solveAnnualRateBps({ principal: 120_000_000, payment: 9_000_000, termMonths: 120 }))).toBe('RATE_NOT_BRACKETED')
  })
  it('S05 payment ever changed is rejected', () => {
    expect(codeOf(() => solveAnnualRateBps({ principal: 600_000_000, payment: 4_127_324, termMonths: 240, paymentEverChanged: true }))).toBe('UNSUPPORTED_SCENARIO')
  })
  it('S06 deterministic', () => {
    const input = { principal: 500_000_000, payment: 5_000_000, termMonths: 240 }
    expect(solveAnnualRateBps(input)).toEqual(solveAnnualRateBps(input))
  })
})

describe('rate periods', () => {
  const fixedThenFloating = [
    { startMonth: 0, endMonth: 59, annualRateBps: 550, rateType: 'fixed', estimated: false },
    { startMonth: 60, endMonth: 182, annualRateBps: 900, rateType: 'floating', estimated: true },
  ]
  it('R01/R02 valid', () => {
    expect(validateRatePeriods({ termMonths: 120, ratePeriods: fullFixed(120, 550) })).toHaveLength(1)
    expect(validateRatePeriods({ termMonths: 183, ratePeriods: fixedThenFloating })).toHaveLength(2)
  })
  it('R03 gap, R04 overlap, R05 not covering, R06 floating not estimated', () => {
    const gap = [fixedThenFloating[0], { ...fixedThenFloating[1], startMonth: 61 }]
    const overlap = [fixedThenFloating[0], { ...fixedThenFloating[1], startMonth: 59 }]
    const short = [fixedThenFloating[0], { ...fixedThenFloating[1], endMonth: 150 }]
    const notEstimated = [fixedThenFloating[0], { ...fixedThenFloating[1], estimated: false }]
    for (const ratePeriods of [gap, overlap, short, notEstimated]) {
      expect(codeOf(() => validateRatePeriods({ termMonths: 183, ratePeriods }))).toBe('INVALID_PERIODS')
    }
  })
})

describe('amortization', () => {
  it('F10 zero-rate schedule invariants', () => {
    const s = generateAmortizationSchedule({ principal: 12_000_000, termMonths: 12, ratePeriods: fullFixed(12, 0) })
    expect(s.rows).toHaveLength(12)
    s.rows.forEach((r) => expect(r.payment).toBe(1_000_000))
    expect(s.totals).toEqual({ principal: 12_000_000, interest: 0, payment: 12_000_000, endingBalance: 0 })
  })
  it('F11 payment resets at new rate period', () => {
    const s = generateAmortizationSchedule({
      principal: 120_000_000,
      termMonths: 24,
      ratePeriods: [
        { startMonth: 0, endMonth: 11, annualRateBps: 500, rateType: 'fixed', estimated: false },
        { startMonth: 12, endMonth: 23, annualRateBps: 900, rateType: 'floating', estimated: true },
      ],
    })
    expect(s.rows).toHaveLength(24)
    expect(s.rows[0].periodChanged).toBe(false)
    expect(s.rows[12].periodChanged).toBe(true)
    expect(s.rows[12].estimatedRate).toBe(true)
    expect(s.rows[12].payment).toBeGreaterThan(s.rows[11].payment)
    expectReconciled(s, 120_000_000)
  })
  it('first row matches the documented example (F01 inputs)', () => {
    const s = generateAmortizationSchedule({ principal: 415_000_000, termMonths: 183, ratePeriods: fullFixed(183, 550), startDate: '2026-10-22' })
    expect(s.rows[0]).toMatchObject({ dueDate: '2026-10-22', payment: 3_355_115, principal: 1_453_032, interest: 1_902_083, closingBalance: 413_546_968 })
    expectReconciled(s, 415_000_000)
  })
  it('AM03/AM04 invariants hold across a principal × rate × tenor grid', () => {
    for (const principal of [1_000_000, 415_000_000, 1_000_000_000]) {
      for (const annualRateBps of [0, 1, 550, 900, 2000]) {
        for (const termMonths of [1, 12, 183, 360]) {
          expectReconciled(generateAmortizationSchedule({ principal, termMonths, ratePeriods: fullFixed(termMonths, annualRateBps) }), principal)
        }
      }
    }
  })
  it('AM05 does not mutate input', () => {
    const ratePeriods = fullFixed(12, 550)
    const snapshot = structuredClone(ratePeriods)
    generateAmortizationSchedule({ principal: 12_000_000, termMonths: 12, ratePeriods })
    expect(ratePeriods).toEqual(snapshot)
  })
  it('AM06/AM07 due day 31 clamps to end of February (leap and non-leap)', () => {
    const s = generateAmortizationSchedule({ principal: 12_000_000, termMonths: 4, ratePeriods: fullFixed(4, 550), startDate: '2027-12-31' })
    expect(s.rows.map((r) => r.dueDate)).toEqual(['2027-12-31', '2028-01-31', '2028-02-29', '2028-03-31'])
    const s2 = generateAmortizationSchedule({ principal: 12_000_000, termMonths: 3, ratePeriods: fullFixed(3, 550), startDate: '2026-12-31' })
    expect(s2.rows[2].dueDate).toBe('2027-02-28')
  })
  it('yearly aggregation keeps opening/closing and sums', () => {
    const s = generateAmortizationSchedule({ principal: 415_000_000, termMonths: 183, ratePeriods: fullFixed(183, 550), startDate: '2026-10-22' })
    expect(s.yearly[0].year).toBe('2026')
    expect(s.yearly[0].openingBalance).toBe(415_000_000)
    expect(s.yearly.reduce((t, y) => t + y.principal, 0)).toBe(415_000_000)
    expect(s.yearly.at(-1).closingBalance).toBe(0)
  })
})

describe('dti / capacity / property', () => {
  it('F05 DTI', () => {
    const r = calculateDti({ monthlyIncome: 15_000_000, mortgagePayment: 4_250_000, otherMonthlyDebt: 1_500_000 })
    expect(r.totalMonthlyDebt).toBe(5_750_000)
    expect(Math.abs(r.dtiRatio - 0.38333333333333336)).toBeLessThan(1e-12)
    expect(Math.round(r.dtiRatio * 1000) / 10).toBe(38.3)
  })
  it('D03 income 0', () => {
    expect(codeOf(() => calculateDti({ monthlyIncome: 0, mortgagePayment: 1 }))).toBe('DIVISION_BY_ZERO')
  })
  it('capacity uses configurable ratio', () => {
    expect(calculatePaymentCapacity({ monthlyIncome: 15_000_000, existingDebt: 1_500_000 })).toMatchObject({ safePayment: 5_250_000, remainingCapacity: 3_750_000 })
  })
  it('max principal round-trips with the annuity payment; no capacity gives 0', () => {
    for (const [payment, annualRateBps, termMonths] of [[3_750_000, 550, 360], [2_000_000, 725, 120], [1_000_000, 0, 60]]) {
      const principal = calculateMaxPrincipal({ payment, annualRateBps, termMonths })
      const back = calculateAnnuityPayment({ principal, annualRateBps, termMonths }).payment
      expect(back).toBeLessThanOrEqual(payment)
      expect(payment - back).toBeLessThanOrEqual(1)
    }
    expect(calculateMaxPrincipal({ payment: 3_750_000, annualRateBps: 550, termMonths: 360 })).toBe(660_456_611)
    expect(calculateMaxPrincipal({ payment: 0, annualRateBps: 550, termMonths: 360 })).toBe(0)
    expect(calculateMaxPrincipal({ payment: -250_000, annualRateBps: 550, termMonths: 360 })).toBe(0)
  })
  it('F06 property metrics, P02 negative equity, P03 zero value', () => {
    const r = calculatePropertyMetrics({ propertyValue: 850_000_000, outstanding: 415_000_000 })
    expect(r.equity).toBe(435_000_000)
    expect(Math.abs(r.ltvRatio - 0.48823529411764705)).toBeLessThan(1e-12)
    const neg = calculatePropertyMetrics({ propertyValue: 400_000_000, outstanding: 415_000_000 })
    expect(neg.equity).toBe(-15_000_000)
    expect(neg.ltvRatio).toBeGreaterThan(1)
    expect(codeOf(() => calculatePropertyMetrics({ propertyValue: 0, outstanding: 1 }))).toBe('DIVISION_BY_ZERO')
  })
})

describe('floating impact', () => {
  it('F07 increase', () => {
    expect(calculateFloatingImpact({ outstanding: 415_000_000, remainingMonths: 183, currentAnnualRateBps: 550, nextAnnualRateBps: 900 })).toMatchObject({
      currentPayment: 3_355_115,
      estimatedNextPayment: 4_176_585,
      monthlyDelta: 821_470,
      direction: 'increase',
      estimated: true,
    })
  })
  it('F02/F03 decrease and same', () => {
    expect(calculateFloatingImpact({ outstanding: 415_000_000, remainingMonths: 183, currentAnnualRateBps: 900, nextAnnualRateBps: 550 }).direction).toBe('decrease')
    expect(calculateFloatingImpact({ outstanding: 415_000_000, remainingMonths: 183, currentAnnualRateBps: 550, nextAnnualRateBps: 550 })).toMatchObject({ monthlyDelta: 0, direction: 'same' })
  })
})

describe('take over', () => {
  it('F09 constant-payment break-even', () => {
    const r = calculateTakeoverScenario({
      current: { payments: Array(60).fill(5_000_000) },
      proposed: { payments: Array(60).fill(4_050_000) },
      costs: [{ code: 'all', amount: 20_995_000, treatment: 'upfront', estimated: true }],
    })
    expect(r.firstMonthBenefit).toBe(950_000)
    expect(r.breakEven).toEqual({ status: 'reached', month: 23 })
    expect(r.netSaving).toBe(36_005_000)
  })
  it('T02 no monthly benefit never yields a positive break-even', () => {
    const r = calculateTakeoverScenario({
      current: { payments: Array(60).fill(4_000_000) },
      proposed: { payments: Array(60).fill(4_100_000) },
      costs: [{ code: 'all', amount: 10_000_000, treatment: 'upfront' }],
    })
    expect(r.breakEven).toEqual({ status: 'no_monthly_benefit', month: null })
    expect(r.netSaving).toBeLessThan(0)
  })
  it('T03 compares to the longest tenor', () => {
    const r = calculateTakeoverScenario({ current: { payments: Array(120).fill(5_000_000) }, proposed: { payments: Array(240).fill(3_000_000) } })
    expect(r.horizonMonths).toBe(240)
    expect(r.netSaving).toBe(120 * 5_000_000 - 240 * 3_000_000)
  })
  it('T05 financed and deducted costs are not subtracted again', () => {
    const r = calculateTakeoverScenario({
      current: { payments: [5_000_000] },
      proposed: { payments: [4_000_000] },
      costs: [
        { code: 'provision', amount: 5_000_000, treatment: 'financed' },
        { code: 'admin', amount: 1_000_000, treatment: 'deducted' },
      ],
    })
    expect(r.netSaving).toBe(1_000_000)
    expect(r.costs.totalEconomicCost).toBe(6_000_000)
  })
  it('T06 saving turns negative later: sustained break-even is null', () => {
    const r = calculateTakeoverScenario({
      current: { payments: [...Array(12).fill(5_000_000), ...Array(12).fill(4_000_000)] },
      proposed: { payments: Array(24).fill(4_500_000) },
      costs: [{ code: 'all', amount: 1_000_000, treatment: 'upfront' }],
    })
    expect(r.breakEven.status).toBe('reached')
    expect(r.sustainedBreakEvenMonth).toBeNull()
  })
})

describe('top-up', () => {
  it('F08 top-up maximum', () => {
    const r = calculateTopupScenario({
      propertyValue: 850_000_000,
      maxLtvBps: 7000,
      oldOutstanding: 421_500_000,
      newLoanAmount: 550_000_000,
      deductedCosts: [{ code: 'all', amount: 20_000_000 }],
      requestedTopup: 100_000_000,
    })
    expect(r).toMatchObject({ maxLoanByCollateral: 595_000_000, maxGrossTopup: 173_500_000, grossTopup: 128_500_000, netTopup: 108_500_000, withinLtv: true, meetsRequestedTopup: true, fundingGap: -8_500_000, estimated: true })
    expect(Math.abs(r.newLtvRatio - 0.6470588235294118)).toBeLessThan(1e-12)
  })
  it('U02–U05 edge cases', () => {
    const base = { propertyValue: 850_000_000, maxLtvBps: 7000, oldOutstanding: 421_500_000 }
    expect(calculateTopupScenario({ ...base, newLoanAmount: 421_500_000 }).grossTopup).toBe(0)
    expect(calculateTopupScenario({ ...base, newLoanAmount: 600_000_000 }).withinLtv).toBe(false)
    const insufficient = calculateTopupScenario({ ...base, newLoanAmount: 430_000_000, deductedCosts: [{ code: 'fees', amount: 20_000_000 }] })
    expect(insufficient.netTopup).toBe(-11_500_000)
    expect(insufficient.status).toBe('insufficient')
    expect(calculateTopupScenario({ ...base, newLoanAmount: 500_000_000, requestedTopup: 100_000_000 }).fundingGap).toBe(21_500_000)
  })
})
