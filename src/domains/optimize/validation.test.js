import { describe, expect, it } from 'vitest'
import { calculateMaxPrincipal } from '@/calculations/finance'
import { FIXED_PASSED } from '@/domains/mortgages/validation'
import { oldLoanFormValues, outstandingEstimate, takeoverGaps, validateOldLoan } from './validation'

const today = '2026-09-28'
const loan = {
  bankName: 'Bank ABC', productName: '', originalPrincipal: '600000000', currentPayment: '4127324', originalTenorMonths: '240', startDate: '2021-12-22', dueDay: '22',
  rate: '5,50', rateType: 'fixed', fixedUntil: '2026-12-22', floatingRate: '9,00', knowsOutstanding: 'no', outstanding: '', remainingMonths: '', penalty: '',
}

describe('old loan (Take Over step 2)', () => {
  it('asks bunga and jenis bunga whatever the answer on sisa pokok', () => {
    expect(validateOldLoan(loan, { today })).toEqual({})
    const e = validateOldLoan({ ...loan, rate: '', rateType: '' }, { today })
    expect(Object.keys(e).sort()).toEqual(['rate', 'rateType'])
    expect(validateOldLoan({ ...loan, fixedUntil: '' }, { today }).fixedUntil).toBeTruthy()
    expect(validateOldLoan({ ...loan, fixedUntil: '2026-09-01' }, { today }).fixedUntil).toBe(FIXED_PASSED)
    expect(validateOldLoan({ ...loan, floatingRate: '' }, { today })).toEqual({}) // optional
  })

  it('official figures must fit the loan; an estimate needs a loan that is not finished', () => {
    const official = { ...loan, knowsOutstanding: 'yes', outstanding: '510000000', remainingMonths: '183' }
    expect(validateOldLoan(official, { today })).toEqual({})
    expect(validateOldLoan({ ...official, outstanding: '700000000' }, { today }).outstanding).toBeTruthy()
    expect(validateOldLoan({ ...official, remainingMonths: '241' }, { today }).remainingMonths).toBeTruthy()
    expect(validateOldLoan({ ...loan, originalTenorMonths: '12', startDate: '2021-12-22' }, { today }).startDate).toMatch(/sudah selesai/)
    expect(validateOldLoan({ ...loan, rate: '1,00' }, { today }).rate).toMatch(/terlalu rendah/) // estimate > pinjaman awal
  })

  it('estimates sisa pokok from cicilan, bunga and sisa tenor', () => {
    expect(outstandingEstimate(loan, today)).toEqual({ remaining: 183, outstanding: calculateMaxPrincipal({ payment: 4_127_324, annualRateBps: 550, termMonths: 183 }) })
    expect(outstandingEstimate({ ...loan, rate: '' }, today)).toBeNull()
  })

  it('a draft saved before Jenis bunga was asked reopens step 2', () => {
    const oldLoan = { bankName: 'Bank ABC', originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22, rateBps: 550, rateType: null, outstanding: 510_000_000, remainingMonths: 183, source: 'estimate' }
    expect(takeoverGaps({ oldLoan }, { today, mode: 'takeover' })).toContain('/optimize/2')
    const filled = { ...oldLoan, rateType: 'fixed', fixedUntil: '2026-12-22' }
    expect(validateOldLoan(oldLoanFormValues(filled), { today })).toEqual({})
  })
})

describe('debts on Pekerjaan (no Kemampuan bayar form)', () => {
  const employment = { occupation: 'private_employee', companyName: 'PT Nusantara', jobTitle: 'Engineer', workYears: 4, workMonths: 6, monthlyIncome: 15_000_000, jointIncome: false }
  const gaps = (finance) => takeoverGaps({ employment, finance }, { today, mode: 'takeover' })

  it('asks missing debts on Pekerjaan, and never a step 3 form', () => {
    expect(gaps({})).toContain('/optimize/1/pekerjaan')
    const debts = { vehicleDebt: 0, cardDebt: 0, otherDebt: 0 }
    expect(gaps(debts)).not.toContain('/optimize/1/pekerjaan')
    expect(gaps(debts)).not.toContain('/optimize/3')
  })
})
