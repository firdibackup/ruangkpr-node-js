---
type: "query"
date: "2026-10-05T10:49:00.826394+00:00"
question: "Data apa saja yang cocok dan berguna untuk widget dashboard Home (grafik, pipeline)?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["deriveMortgage()", "AmortizationPages.jsx", "Home monitoring dashboard (Health, Next Payment, Warning, Progress, Opportunity; no charts)", "calculatePropertyMetrics() (LTV, equity)", "Timeline()"]
---

# Q: Data apa saja yang cocok dan berguna untuk widget dashboard Home (grafik, pipeline)?

## Answer

Expanded from original query via vocab: [mortgage, derive, amortization, schedule, payments, health, floating, opportunity, equity, chart, timeline, tracker]. Widget data all exists already: deriveMortgage() (mode, daysUntilFixedEnd, milestone, nextDue, schedule rows with principal/interest/closingBalance, estimatedEndDate, dti, property equity/ltvRatio, paidRatio, floatingImpact, health components), mortgage fields (rateHistory, payments, reminders, property, finance), explore.get opportunity + education, activities.list, snapshot.simulation. PRD 01 §11.1 says No charts on Home (enforced by mortgage-monitoring.spec.js). Existing chart pattern: div-based stacked bars in AmortizationPages.jsx (role=img); Timeline() in shared/progress.jsx used by RateTab.

## Outcome

- Signal: useful

## Source Nodes

- deriveMortgage()
- AmortizationPages.jsx
- Home monitoring dashboard (Health, Next Payment, Warning, Progress, Opportunity; no charts)
- calculatePropertyMetrics() (LTV, equity)
- Timeline()