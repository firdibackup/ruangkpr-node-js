import { describe, expect, it } from 'vitest'
import { calculatorDraftData, parseCalculatorHandoff } from './calculatorHandoff'
import { createMockApi, mockControls } from '@/data/mockApi'
import { calculatorGaps, calculatorNextPath } from './calculatorFlow'

const fields = { source: 'maxi-calculator', v: '1', mode: 'primary', bankId: 'bank-test', productId: 'product-test', productVersion: '1', price: '1000000000', downPayment: '200000000', months: '144', income: '25000000', otherDebt: '1000000', additionalCosts: '2000000', outstanding: '500000000', remainingMonths: '120', currentRate: '8.5', currentPayment: '0', fixedMonthsLeft: '12', currentFloatingRate: '11', penaltyRate: '2', exitAdmin: '1000000', requestedCash: '150000000', purpose: 'renovation' }
const query = (patch = {}) => '?' + new URLSearchParams({ ...fields, ...patch }).toString()

describe('calculator handoff', () => {
  it('maps primary price, DP, principal, income and arbitrary tenor', () => {
    const data = calculatorDraftData(parseCalculatorHandoff(query()), '2026-10-23')
    expect(data.loan).toEqual({ downPayment: 200000000, amount: 800000000, tenorMonths: 144 })
    expect(data.employment).toMatchObject({ monthlyIncome: 25000000, otherDebt: 1000000 })
    expect(data.oldLoan).toBeUndefined()
  })
  it.each(['takeover', 'topup'])('maps %s old mortgage without confusing destination bank with old bank', mode => {
    const data = calculatorDraftData(parseCalculatorHandoff(query({ mode })), '2026-10-23')
    expect(data.oldLoan).toMatchObject({ outstanding: 500000000, rateBps: 850, remainingMonths: 120, fixedUntil: '2027-10-23' })
    expect(data.oldLoan.currentPayment).toBeGreaterThan(0)
    expect(data.oldLoan.bankName).toBeUndefined()
    expect(data.goal.requestedTopup).toBe(mode === 'topup' ? 150000000 : 0)
    expect(data.goal.mode).toBe(mode)
  })
  it.each([{ mode: 'bad' }, { v: '2' }, { price: 'NaN' }, { months: '0' }, { downPayment: '1000000000' }, { mode: 'topup', purpose: '<script>' }])('rejects malformed inputs %j', patch => {
    expect(() => parseCalculatorHandoff(query(patch))).toThrow()
  })
  it('opens bank selection, retries idempotently, and protects existing drafts', async () => {
    mockControls.reset('fresh')
    const api = createMockApi({ latencyMs: 0 })
    const app = await api.applications.create({ calculatorSearch: query() })
    expect(app.currentStep).toBe(5)
    expect(app.data.loan.amount).toBe(800000000)
    expect(app.selection).toBeFalsy()
    expect((await api.applications.create({ calculatorSearch: query() })).id).toBe(app.id)
    await expect(api.applications.create({ calculatorSearch: query({ price: '1100000000' }) })).rejects.toMatchObject({ code: 'ACTIVE_DRAFT_EXISTS' })
  })
  it.each(['primary', 'takeover', 'topup'])('shows %s quotes with unknown income and defers personal data', async mode => {
    mockControls.reset('fresh')
    const api = createMockApi({ latencyMs: 0 })
    const productId = mode === 'primary' ? 'bpr_abc_primary_fix5_v4' : 'bpr_xyz_takeover_fix5_v3'
    let app = await api.applications.create({ calculatorSearch: query({ mode, income: '0', bankId: mode === 'primary' ? 'bnk_abc' : 'bnk_xyz', productId }) })
    expect(calculatorNextPath(app)).toContain(productId)
    const sim = mode === 'primary'
      ? await api.bankProducts.compare({ applicationId: app.id })
      : await api.simulations.run({ source: { type: 'application', id: app.id }, input: app.data.goal })
    const item = sim.items.find(x => x.productId === productId)
    expect(item.payment).toBeGreaterThan(0)
    expect(item.dtiRatio).toBeNull()
    expect(item.eligibility).toBe('needs_review')
    expect(item.recommended).toBe(false)
    app = mode === 'primary'
      ? await api.applications.selectProgram(app.id, { bankProductId: productId, loanAmount: app.data.loan.amount, tenorMonths: app.data.loan.tenorMonths })
      : await api.simulations.apply({ bankProductId: productId, tenorMonths: item.tenorMonths, plafon: item.principal })
    expect(calculatorNextPath(app)).toBe(mode === 'primary' ? '/apply/primary/3' : '/optimize/2')
    expect(calculatorGaps(app, '2026-10-23')).toContain(mode === 'primary' ? '/apply/primary/1' : '/optimize/1')
    const saved = await api.applications.saveStep(app.id, { step: 1, values: { employment: { monthlyIncome: 100000000 } } })
    expect(saved.selection?.bankProductId).toBe(productId)
    await expect(api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: true } })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })
  it('refreshes the selected bank quote automatically after a loan edit', async () => {
    mockControls.reset('fresh')
    const api = createMockApi({ latencyMs: 0 })
    const app = await api.applications.create({ calculatorSearch: query({ income: '0', bankId: 'bnk_abc', productId: 'bpr_abc_primary_fix5_v4' }) })
    const selected = await api.applications.selectProgram(app.id, { bankProductId: 'bpr_abc_primary_fix5_v4', loanAmount: 800000000, tenorMonths: 144 })
    const saved = await api.applications.saveStep(app.id, { step: 4, values: { loan: { amount: 700000000 } } })
    expect(saved.selection.bankProductId).toBe(selected.selection.bankProductId)
    expect(saved.selection.loanAmount).toBe(700000000)
    expect(saved.selection.estimatedPayment).toBeLessThan(selected.selection.estimatedPayment)
    expect(saved.data.calculator.preferredProductId).toBe('bpr_abc_primary_fix5_v4')
  })
  it.each(['takeover', 'topup'])('refreshes %s balances and costs without clearing the confirmed bank', async mode => {
    mockControls.reset('fresh')
    const api = createMockApi({ latencyMs: 0 })
    const productId = 'bpr_xyz_takeover_fix5_v3'
    const app = await api.applications.create({ calculatorSearch: query({ mode, income: '0', bankId: 'bnk_xyz', productId }) })
    const sim = await api.simulations.run({ source: { type: 'application', id: app.id }, input: app.data.goal })
    const item = sim.items.find(x => x.productId === productId)
    const selected = await api.simulations.apply({ bankProductId: productId, tenorMonths: item.tenorMonths, plafon: item.principal })
    const saved = await api.applications.saveStep(app.id, { step: 2, values: { oldLoan: { outstanding: 400000000, penaltyBps: 300 } } })
    expect(saved.selection.bankProductId).toBe(productId)
    expect(saved.selection.loanAmount).toBeLessThan(selected.selection.loanAmount)
    expect(saved.selection.estimatedPayment).toBeLessThan(selected.selection.estimatedPayment)
    expect(saved.selection.feesTotal).not.toBe(selected.selection.feesTotal)
    expect(saved.data.calculator.bankConfirmed).toBe(true)
    const incomeSaved = await api.applications.saveStep(app.id, { step: 1, values: { employment: { monthlyIncome: 1000000 } } })
    expect(incomeSaved.selection.bankProductId).toBe(productId)
  })
})
