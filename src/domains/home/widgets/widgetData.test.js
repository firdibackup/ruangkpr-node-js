import { describe, expect, it } from 'vitest'
import { ARTICLES } from '@/data/articles'
import { createSeed } from '@/data/seed'
import { deriveMortgage } from '@/domains/mortgages/derive'
import { WIDGETS } from '../dashboardLayout'
import {
  balanceProjection,
  fixedMilestones,
  journeySteps,
  nextPaymentSplit,
  paymentCalendar,
  pickArticles,
  remainingInterest,
  sampleWidgetProps,
  tenorProgress,
  upcomingReminders,
  widgetLock,
  yearlyBreakdown,
  yearStarts,
} from './widgetData'

const scenario = (id, patch = {}) => {
  const db = createSeed(id)
  const m = { ...db.mortgages[0], ...patch }
  return { m, d: deriveMortgage(m, db.clock), clock: db.clock }
}
const locked = ({ m, d }) => WIDGETS.filter((w) => widgetLock(w.id, m, d)).map((w) => w.id)

describe('widgetLock', () => {
  it('locks nothing when the KPR data is complete', () => {
    expect(locked(scenario('mortgage_active_normal'))).toEqual([])
    expect(locked(scenario('mortgage_active_floating'))).toEqual([])
    const sample = sampleWidgetProps(createSeed('mortgage_active_normal').clock)
    expect(locked(sample)).toEqual([]) // locked previews always render a full example
  })

  it('names the missing data and the one action that unlocks it', () => {
    const noValue = scenario('mortgage_partial_property')
    expect(locked(noValue)).toEqual(['opportunity', 'equity'])
    expect(widgetLock('equity', noValue.m, noValue.d)).toMatchObject({ reason: 'Butuh nilai properti', action: { kind: 'property' } })

    const noIncome = scenario('mortgage_active_normal', { finance: {} })
    expect(locked(noIncome)).toEqual(['opportunity', 'health', 'dti'])
    expect(widgetLock('dti', noIncome.m, noIncome.d).action.kind).toBe('income')

    const noEstimate = scenario('mortgage_partial_rate')
    expect(widgetLock('floatingImpact', noEstimate.m, noEstimate.d).reason).toBe('Butuh estimasi bunga floating')

    const noBalance = scenario('mortgage_active_normal', { outstandingPrincipal: null })
    expect(widgetLock('balanceProjection', noBalance.m, noBalance.d)).toMatchObject({ reason: 'Butuh sisa pokok', action: { kind: 'route' } })
    expect(widgetLock('progress', noBalance.m, noBalance.d).action.kind).toBe('route')

    const unknownRate = scenario('mortgage_active_normal', { currentRateType: null })
    expect(widgetLock('fixedCountdown', unknownRate.m, unknownRate.d).reason).toBe('Butuh jenis bunga')

    const sharia = scenario('mortgage_active_normal', { scheme: 'sharia' })
    expect(widgetLock('interestLeft', sharia.m, sharia.d)).toMatchObject({ reason: 'Belum untuk KPR syariah', action: null })
  })
})

describe('widget data', () => {
  const normal = scenario('mortgage_active_normal')

  it('projects the balance from today down to zero', () => {
    const points = balanceProjection(normal.d)
    expect(points[0]).toEqual({ label: 'Kini', balance: normal.m.outstandingPrincipal })
    expect(points.at(-1).balance).toBe(0)
    expect(points.every((p, i) => i === 0 || p.balance <= points[i - 1].balance)).toBe(true)
  })

  it('sums the remaining interest and splits the next installment', () => {
    const { interest, share, perMonth } = remainingInterest(normal.d)
    expect(interest).toBe(normal.d.schedule.totals.interest)
    expect(share).toBeGreaterThan(0)
    expect(share).toBeLessThan(1)
    expect(perMonth).toBeGreaterThan(0)
    const next = nextPaymentSplit(normal.d)
    expect(next.dueDate).toBe(normal.d.nextDue)
    expect(next.principal + next.interest).toBe(next.payment)
    expect(yearlyBreakdown(normal.d)).toHaveLength(10)
    const rows = normal.d.schedule.rows
    const ticks = yearStarts(rows)
    expect(ticks[0]).toBe(rows[0].dueDate)
    expect(ticks.slice(1).every((t) => t.slice(5, 7) === '01')).toBe(true)
    expect(ticks).toHaveLength(normal.d.schedule.yearly.length)
  })

  it('places the journey: tenor year, periods, and payoff', () => {
    expect(tenorProgress(normal.m, normal.clock)).toMatchObject({ year: 5, years: 20 })
    expect(journeySteps(normal.m, normal.d).map((s) => s.state)).toEqual(['done', 'current', 'estimate', 'todo'])
    const floating = scenario('mortgage_active_floating')
    expect(journeySteps(floating.m, floating.d).map((s) => s.state)).toEqual(['done', 'done', 'current', 'todo'])
  })

  it('marks fixed-end milestones already reached', () => {
    const h90 = scenario('mortgage_active_h90')
    const reached = fixedMilestones(h90.m, h90.d).filter((x) => x.passed).map((x) => x.days)
    expect(reached).toEqual([90])
  })

  it('reads the payment calendar and the next reminders', () => {
    expect(paymentCalendar(normal.m, normal.d, normal.clock).map((x) => x.state)).toEqual(['untracked', 'untracked', 'paid', 'upcoming', 'upcoming', 'upcoming'])
    expect(upcomingReminders(normal.m, normal.d, normal.clock).map((x) => x.label)).toEqual(['Cicilan H-7', 'Cicilan H-3', 'Cicilan H-1'])
  })

  it('picks reading that fits the rate situation', () => {
    expect(pickArticles(ARTICLES, normal.d).map((a) => a.slug)).toEqual(['fixed-vs-floating', 'refinancing-vs-multiguna'])
    expect(pickArticles(ARTICLES, scenario('mortgage_active_floating').d)[0].slug).toBe('break-even-take-over')
  })
})
