import { addMonths } from '@/calculations/dates'
import { calculateAnnuityPayment } from '@/calculations/finance'

export const HANDOFF_KEY = 'maxi.calculator-handoff.v1'
const MODES = ['primary', 'takeover', 'topup']

// URL input is untrusted. Only these fields may seed a new draft.
export function parseCalculatorHandoff(search) {
  if (typeof search !== 'string' || search.length > 6000) throw new Error('Data simulasi tidak valid.')
  const p = new URLSearchParams(search)
  if (p.get('source') !== 'maxi-calculator' || p.get('v') !== '1' || !MODES.includes(p.get('mode'))) throw new Error('Format simulasi tidak didukung.')
  const number = (key, min = 0, max = 1e13, integer = true) => {
    const raw = p.get(key)
    if (raw === null || !/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Data ${key} tidak valid.`)
    const n = Number(raw)
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`Data ${key} tidak valid.`)
    return n
  }
  const id = key => {
    const value = p.get(key) ?? ''
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(value)) throw new Error('Produk bank tidak valid.')
    return value
  }
  const data = { mode: p.get('mode'), bankId: id('bankId'), productId: id('productId'), productVersion: number('productVersion'), price: number('price', 1), months: number('months', 12, 360), income: number('income'), otherDebt: number('otherDebt'), additionalCosts: number('additionalCosts') }
  if (data.mode === 'primary') {
    data.downPayment = number('downPayment', 0, data.price - 1)
  } else {
    data.outstanding = number('outstanding', 1)
    data.remainingMonths = number('remainingMonths', 1, 360)
    data.currentRate = number('currentRate', 0, 100, false)
    data.currentPayment = number('currentPayment')
    data.fixedMonthsLeft = number('fixedMonthsLeft', 0, data.remainingMonths)
    data.currentFloatingRate = number('currentFloatingRate', 0, 100, false)
    data.penaltyRate = number('penaltyRate', 0, 100, false)
    data.exitAdmin = number('exitAdmin')
  }
  if (data.mode === 'topup') {
    data.requestedCash = number('requestedCash', 1)
    data.purpose = p.get('purpose')
    if (!['renovation', 'education', 'business', 'debt_consolidation', 'other'].includes(data.purpose)) throw new Error('Tujuan dana tidak valid.')
  }
  return data
}

export function calculatorDraftData(handoff, today) {
  const employment = { ...(handoff.income > 0 ? { monthlyIncome: handoff.income } : {}) }
  const calculator = { ...handoff, importedAt: today, flow: 'bank-first' }
  if (handoff.mode === 'primary') return {
    calculator, employment: { ...employment, vehicleDebt: 0, cardDebt: 0, otherDebt: handoff.otherDebt },
    property: { price: handoff.price },
    loan: { downPayment: handoff.downPayment, amount: handoff.price - handoff.downPayment, tenorMonths: handoff.months },
  }
  return {
    calculator, employment, finance: { vehicleDebt: 0, cardDebt: 0, otherDebt: handoff.otherDebt },
    property: { estimatedValue: handoff.price },
    oldLoan: {
      outstanding: handoff.outstanding, remainingMonths: handoff.remainingMonths,
      currentPayment: handoff.currentPayment || calculateAnnuityPayment({ principal: handoff.outstanding, annualRateBps: Math.round(handoff.currentRate * 100), termMonths: handoff.remainingMonths }).payment, rateBps: Math.round(handoff.currentRate * 100),
      rateType: handoff.fixedMonthsLeft > 0 ? 'fixed' : 'floating',
      fixedUntil: handoff.fixedMonthsLeft > 0 ? addMonths(today, handoff.fixedMonthsLeft) : null,
      floatingRateBps: Math.round(handoff.currentFloatingRate * 100), penaltyBps: Math.round(handoff.penaltyRate * 100),
      source: 'official',
    },
    goal: { mode: handoff.mode, goal: handoff.mode === 'takeover' ? 'lower_payment' : null, tenorMonths: handoff.months, requestedTopup: handoff.requestedCash ?? 0, purpose: handoff.purpose ?? null },
  }
}

export function pendingCalculatorHandoff() {
  try { return !!sessionStorage.getItem(HANDOFF_KEY) } catch { return false }
}
