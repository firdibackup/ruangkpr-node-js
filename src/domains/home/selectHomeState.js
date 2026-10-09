import { rateMode } from '@/domains/mortgages/derive'

export const IN_PROCESS = ['submitted', 'docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad']

// The one application the user is working on: not completed and not a rejected row already cloned/retried.
export function activeApplication(applications = []) {
  return applications.find((a) => a.status !== 'disbursed' && !(a.status === 'rejected' && a.superseded)) ?? null
}

// Home priority (PRD §5.4, docs 04/05): rejected > in process > application draft > mortgage setup draft >
// active near floating > active floating > active normal/partial > fresh. Pure: `now` is explicit.
export function selectHomeState(snapshot, now) {
  const app = activeApplication(snapshot.applications)
  const mortgages = snapshot.mortgages ?? []
  const active = mortgages.find((m) => m.status === 'active') ?? null
  const draft = mortgages.find((m) => m.status === 'draft') ?? null
  const result = (state, extra = {}) => ({ state, application: app, mortgage: active ?? draft, activeMortgage: active, ...extra })

  if (app?.status === 'rejected') return result('application_rejected')
  if (app && IN_PROCESS.includes(app.status)) return result('application_in_process')
  if (app?.status === 'draft') return result('application_draft')
  if (draft) return result('mortgage_setup_draft')
  if (active) {
    const { mode } = rateMode(active, now)
    if (mode === 'warning') return result('mortgage_active_warning')
    if (mode === 'floating') return result('mortgage_active_floating')
    return result(active.property?.estimatedValue > 0 ? 'mortgage_active_normal' : 'mortgage_active_partial')
  }
  return result('fresh')
}
