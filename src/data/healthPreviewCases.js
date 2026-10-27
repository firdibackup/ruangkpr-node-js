import { addDays, addMonths } from '@/calculations/dates'
import { calculateAnnuityPayment } from '@/calculations/finance'

// Admin calibration cases, independent of demo accounts and anchored to the current date.
export function healthPreviewCases(clock) {
  const currentPayment = calculateAnnuityPayment({ principal: 600_000_000, annualRateBps: 550, termMonths: 240 }).payment
  const m = {
    status: 'active', currentPayment, currentRateType: 'fixed', currentRateBps: 550,
    outstandingPrincipal: 500_000_000, outstandingAsOf: clock, remainingTenorMonths: 200,
    originalPrincipal: 600_000_000, originalTenorMonths: 240, startDate: addMonths(clock, -40), dueDay: 22,
    fixedUntil: addDays(clock, 365), estimatedFloatingRateBps: 900, rateHistory: [], payments: [],
    finance: { monthlyIncome: 15_000_000, vehicleDebt: 1_000_000, cardDebt: 500_000, otherDebt: 0 },
    property: { estimatedValue: 850_000_000, valueAsOf: clock },
  }
  return [
    { key: 'mortgage_active_normal', label: 'KPR fixed, kondisi normal', m },
    { key: 'mortgage_active_h90', label: 'Fixed berakhir < 90 hari', m: { ...m, fixedUntil: addDays(clock, 60) } },
    { key: 'mortgage_active_floating', label: 'Sudah floating', m: { ...m, currentRateType: 'floating', currentRateBps: 900, fixedUntil: addDays(clock, -30) } },
    { key: 'mortgage_partial_property', label: 'Nilai properti belum diisi', m: { ...m, property: { estimatedValue: null } } },
    { key: 'high_dti', label: 'Rasio cicilan 48% (sintetis)', m: { ...m, finance: { ...m.finance, monthlyIncome: Math.round((currentPayment + 1_500_000) / 0.48) } } },
    { key: 'high_ltv', label: 'LTV 92% (sintetis)', m: { ...m, property: { ...m.property, estimatedValue: Math.round(m.outstandingPrincipal / 0.92) } } },
  ]
}
