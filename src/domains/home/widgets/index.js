import { lazy } from 'react'
import { WIDGET_VIEWS as SUMMARY_VIEWS } from '../dashboardWidgets'
import { ReadingWidget, RecentActivityWidget, RemindersWidget } from './activity'
import { DtiWidget, EquityWidget, InterestLeftWidget } from './figures'
import { FixedCountdownWidget, JourneyWidget, PaymentHistoryWidget } from './timeline'

// View for every catalog widget. The chart widgets share one lazily loaded chunk, so Recharts is only
// downloaded once a chart is on the board or shown in the gallery.
const chart = (name) => lazy(() => import('./charts').then((mod) => ({ default: mod[name] })))

export const WIDGET_VIEWS = {
  ...SUMMARY_VIEWS,
  balanceProjection: chart('BalanceProjectionWidget'),
  amortizationChart: chart('AmortizationChartWidget'),
  floatingImpact: chart('FloatingImpactWidget'),
  paymentSplit: chart('PaymentSplitWidget'),
  yearlyBreakdown: chart('YearlyBreakdownWidget'),
  interestLeft: InterestLeftWidget,
  equity: EquityWidget,
  dti: DtiWidget,
  journey: JourneyWidget,
  fixedCountdown: FixedCountdownWidget,
  paymentHistory: PaymentHistoryWidget,
  reminders: RemindersWidget,
  recentActivity: RecentActivityWidget,
  reading: ReadingWidget,
}
