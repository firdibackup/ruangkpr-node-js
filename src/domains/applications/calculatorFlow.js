import { validateEmployment, validatePersonal, validatePrimaryLoan, validatePrimaryProperty } from './validation'
import { takeoverGaps, validateGoal } from '@/domains/optimize/validation'

export const isCalculatorFlow = app => app?.data?.calculator?.flow === 'bank-first'
export const CALCULATOR_PHASES = ['Pilihan Bank', 'Lengkapi Data', 'Dokumen & Kirim']

export function calculatorPaths(app) {
  return app.productType === 'primary'
    ? ['/apply/primary/5', '/apply/primary/3', '/apply/primary/4', '/apply/primary/1', '/apply/primary/2', '/apply/primary/6', '/apply/primary/7']
    : ['/optimize/programs', '/optimize/2', '/optimize/4', '/optimize/5', '/optimize/1', '/optimize/1/pekerjaan', '/optimize/6', '/optimize/7']
}

export function calculatorGaps(app, today) {
  const d = app.data
  if (app.productType !== 'primary') {
    const gaps = takeoverGaps(d, { today, mode: app.optimizationMode })
    if (Object.keys(validateGoal(d.goal ?? {})).length) gaps.push('/optimize/5')
    return calculatorPaths(app).filter(path => gaps.includes(path))
  }
  const { personal = {}, employment = {}, property = {}, loan = {} } = d
  return [
    [3, validatePrimaryProperty({ ...property, propertyAddress: property.address })],
    [4, validatePrimaryLoan({ ...loan, price: property.price })],
    [1, validatePersonal(personal, { today })],
    [2, validateEmployment(employment)],
  ].filter(([, errors]) => Object.keys(errors).length).map(([step]) => `/apply/primary/${step}`)
}

export function calculatorProgramPath(app) {
  const c = app.data.calculator
  const id = c.preferredProductId ?? c.productId
  if (!c.preferredProductId && c.productMatched === false) return app.productType === 'primary' ? '/apply/primary/5' : '/optimize/programs'
  return app.productType === 'primary' ? `/apply/primary/5/${id}` : `/optimize/programs/${id}`
}

export function calculatorNextPath(app, today = new Date().toISOString().slice(0, 10)) {
  if (!app.data.calculator.bankConfirmed) return calculatorProgramPath(app)
  const gap = calculatorGaps(app, today)[0]
  if (gap) return gap
  if (!app.selection) return calculatorProgramPath(app)
  const review = app.currentStep >= 7
  return app.productType === 'primary' ? `/apply/primary/${review ? 7 : 6}` : `/optimize/${review ? 7 : 6}`
}

export function calculatorBackPath(app, path) {
  const paths = calculatorPaths(app)
  return paths[Math.max(0, paths.indexOf(path) - 1)]
}

export function calculatorProgress(app, path) {
  const paths = calculatorPaths(app)
  const index = Math.max(0, paths.indexOf(path))
  const phase = index === 0 ? 1 : index >= paths.length - 2 ? 3 : 2
  return { phase, label: CALCULATOR_PHASES[phase - 1], position: phase, percent: Math.round(index / paths.length * 100) }
}
