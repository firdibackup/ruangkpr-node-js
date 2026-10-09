import { addDays, addMonths } from '@/calculations/dates'
import { dateShort, monthYear, percentBps } from '@/lib/format'
import { deriveMortgage } from '@/domains/mortgages/derive'
import { progressGap } from '@/domains/mortgages/setupMeta'

// Pure data behind the Home widgets: whether a widget is locked by missing data, and what it shows.

const isFixed = (d) => d.mode === 'normal' || d.mode === 'warning'
const INCOME = { kind: 'income', label: 'Isi Penghasilan' }
const PROPERTY = { kind: 'property', label: 'Isi Nilai Properti' }
const KPR_DATA = { kind: 'route', to: '/monitoring/setup/1?edit=home', label: 'Lengkapi Data KPR' }
// `reason` is the gallery badge, `title` the sentence on the locked card, `action` the one step that unlocks it.
const lock = (need, purpose, action) => ({ reason: `Butuh ${need}`, title: `Lengkapi ${need} untuk ${purpose}.`, action })

function scheduleLock(m, d, purpose) {
  if (d.schedule) return null
  if (m.scheme === 'sharia') return { reason: 'Belum untuk KPR syariah', title: 'Perhitungan jadwal KPR syariah belum didukung.', action: null }
  return lock(d.scheduleMissing?.join(', ').toLowerCase() || 'data KPR', purpose, KPR_DATA)
}

// Locked widgets can't be added from the gallery; already placed ones show the lock until the data is there.
export function widgetLock(id, m, d) {
  const noIncome = !(d.income > 0)
  switch (id) {
    case 'health':
      return noIncome ? lock('penghasilan', 'membuka KPR Health', INCOME) : null
    case 'dti':
      return noIncome ? lock('penghasilan', 'melihat rasio cicilan kamu', INCOME) : null
    case 'opportunity':
      if (noIncome) return lock(d.partialProperty ? 'penghasilan dan nilai properti' : 'penghasilan', 'melihat potensi cicilan lebih ringan', INCOME)
      return d.partialProperty ? lock('nilai properti', 'melihat potensi dana cair', PROPERTY) : null
    case 'equity':
      return d.partialProperty ? lock('nilai properti', 'melihat equity rumah kamu', PROPERTY) : null
    case 'amortization':
      return scheduleLock(m, d, 'melihat jadwal cicilan berikutnya')
    case 'balanceProjection':
      return scheduleLock(m, d, 'melihat proyeksi sisa pokok')
    case 'amortizationChart':
      return scheduleLock(m, d, 'melihat grafik amortisasi')
    case 'paymentSplit':
      return scheduleLock(m, d, 'melihat komposisi cicilan')
    case 'yearlyBreakdown':
      return scheduleLock(m, d, 'melihat pokok dan bunga per tahun')
    case 'interestLeft':
      return scheduleLock(m, d, 'menghitung total bunga tersisa')
    case 'fixedCountdown':
      return d.mode === null ? lock('jenis bunga', 'menghitung sisa masa fixed', KPR_DATA) : null
    case 'floatingImpact':
      if (d.mode === null) return lock('jenis bunga', 'melihat dampak floating', KPR_DATA)
      if (d.mode === 'floating') return m.previousFixedPayment > 0 ? null : lock('cicilan fixed terakhir', 'membandingkan cicilan sebelum dan sesudah floating', KPR_DATA)
      if (!m.estimatedFloatingRateBps) return lock('estimasi bunga floating', 'melihat dampak setelah masa fixed', KPR_DATA)
      return scheduleLock(m, d, 'melihat dampak setelah masa fixed')
    case 'progress': {
      if (d.paidRatio != null) return null
      const gap = progressGap(m, 'home')
      return { reason: 'Butuh data pinjaman', title: 'Lengkapi data pinjaman untuk melihat progres pelunasan.', action: { kind: 'route', to: gap.to, label: gap.label } }
    }
    default:
      return null
  }
}

// Today's balance, then the balance at the end of each schedule year until it reaches zero.
export const balanceProjection = (d) => [{ label: 'Kini', balance: d.schedule.rows[0].openingBalance }, ...d.schedule.yearly.map((y) => ({ label: y.year, balance: y.closingBalance }))]

export function remainingInterest(d) {
  const { interest, payment } = d.schedule.totals
  return { interest, share: interest / payment, perMonth: Math.round(interest / d.schedule.rows.length) }
}

export const nextPaymentSplit = (d) => d.schedule.rows.find((r) => r.dueDate >= d.nextDue) ?? d.schedule.rows[0]

// Due date of each year's first installment: the year ticks of a monthly schedule chart.
export const yearStarts = (rows) => rows.filter((r, i) => i === 0 || r.dueDate.slice(0, 4) !== rows[i - 1].dueDate.slice(0, 4)).map((r) => r.dueDate)

export const yearlyBreakdown =(d, years = 10) => d.schedule.yearly.slice(0, years).map(({ year, principal, interest }) => ({ year, principal, interest }))

// Elapsed share of the original tenor, read as "year N of M".
export function tenorProgress(m, clock) {
  if (!(m.originalTenorMonths > 0)) return null
  const month = (iso) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7))
  const elapsed = Math.min(Math.max(month(clock) - month(m.startDate), 0), m.originalTenorMonths)
  const years = Math.ceil(m.originalTenorMonths / 12)
  return { year: Math.min(Math.floor(elapsed / 12) + 1, years), years, ratio: elapsed / m.originalTenorMonths }
}

// Akad → past rate periods → today's period (and the estimated floating one while fixed) → payoff.
export function journeySteps(m, d) {
  const rate = (type, bps) => `${type === 'fixed' ? 'Fixed' : 'Floating'} ${percentBps(bps)}`
  const steps = [{ label: 'Akad kredit', sub: m.bankName, date: dateShort(m.startDate), state: 'done' }]
  for (const p of m.rateHistory ?? []) {
    if (p.endDate) steps.push({ label: rate(p.type, p.rateBps), sub: `${dateShort(p.startDate)} – ${dateShort(p.endDate)}`, state: 'done' })
  }
  if (d.mode === null) steps.push({ label: 'Jenis bunga belum diketahui', sub: 'Saat ini', state: 'current' })
  else if (d.mode === 'floating') steps.push({ label: rate('floating', m.currentRateBps), sub: 'Saat ini', state: 'current' })
  else {
    steps.push({ label: rate('fixed', m.currentRateBps), sub: `Saat ini · sampai ${dateShort(m.fixedUntil)}`, state: 'current' })
    steps.push({ label: m.estimatedFloatingRateBps ? `Floating ± ${percentBps(m.estimatedFloatingRateBps)}` : 'Floating', sub: `Estimasi mulai ${dateShort(addDays(m.fixedUntil, 1))}`, state: 'estimate' })
  }
  steps.push({ label: 'Lunas', sub: d.estimatedEndDate ? 'Perkiraan' : 'Belum dapat dihitung', date: d.estimatedEndDate ? monthYear(d.estimatedEndDate) : undefined, state: 'todo' })
  return steps
}

export const FIXED_MILESTONES = [90, 60, 30, 14, 7]
export const fixedMilestones = (m, d) => FIXED_MILESTONES.map((days) => ({ days, passed: d.daysUntilFixedEnd <= days, reminded: (m.reminders?.fixedExpiry ?? []).includes(days) }))

// Three dues before the next one plus the next three: paid, unpaid (past and not marked), untracked
// (before monitoring started), or upcoming.
export function paymentCalendar(m, d, clock) {
  const paid = new Set((m.payments ?? []).filter((p) => p.status === 'paid').map((p) => p.dueDate))
  const tracked = m.activatedAt?.slice(0, 10) ?? clock
  return [-3, -2, -1, 0, 1, 2]
    .map((k) => addMonths(d.nextDue, k, m.dueDay))
    .filter((due) => due > m.startDate)
    .map((due) => ({ due, state: paid.has(due) ? 'paid' : due >= clock ? 'upcoming' : due < tracked ? 'untracked' : 'unpaid' }))
}

export function upcomingReminders(m, d, clock, limit = 3) {
  const r = m.reminders
  if (!r) return []
  const items = r.payment.map((n) => ({ date: addDays(d.nextDue, -n), label: n ? `Cicilan H-${n}` : 'Cicilan hari-H' }))
  if (isFixed(d) && m.fixedUntil) items.push(...r.fixedExpiry.map((n) => ({ date: addDays(m.fixedUntil, -n), label: `Akhir fixed H-${n}` })))
  return items
    .filter((x) => x.date >= clock)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}

const ARTICLE_FOR_MODE = { normal: 'fixed-vs-floating', warning: 'fixed-vs-floating', floating: 'break-even-take-over' }
export function pickArticles(articles, d, limit = 2) {
  const wanted = [ARTICLE_FOR_MODE[d.mode], d.property?.equity > 0 && 'refinancing-vs-multiguna'].map((slug) => articles.find((a) => a.slug === slug)).filter(Boolean)
  return [...new Set([...wanted, ...articles])].slice(0, limit)
}

// Example mortgage behind a locked widget's frosted preview; it is labelled "Data contoh" and never read as
// the user's own numbers.
const SAMPLE = {
  id: 'sample',
  status: 'active',
  bankName: 'Bank Contoh',
  productName: 'KPR Fixed 5 Tahun',
  scheme: 'conventional',
  originalPrincipal: 600_000_000,
  originalTenorMonths: 240,
  startDate: '2021-12-22',
  dueDay: 22,
  currentPayment: 4_127_324,
  outstandingPrincipal: 517_584_453,
  remainingTenorMonths: 183,
  currentRateBps: 550,
  currentRateType: 'fixed',
  fixedUntil: '2027-12-22',
  estimatedFloatingRateBps: 900,
  previousFixedPayment: null,
  rateHistory: [],
  property: { city: 'Kota Bekasi', estimatedValue: 850_000_000 },
  finance: { monthlyIncome: 15_000_000 },
  reminders: { payment: [7, 3, 1], fixedExpiry: [90, 60, 30, 14, 7], channels: { inApp: true, email: true, whatsapp: false } },
  payments: [],
  activatedAt: '2021-12-22',
  version: 1,
}
export const sampleWidgetProps = (clock) => ({ m: SAMPLE, d: deriveMortgage(SAMPLE, clock), clock, onAskIncome() {}, onAskProperty() {}, onMarkPaid() {}, onOpenPrograms() {} })
