# Graph Report - .  (2026-10-06)

## Corpus Check
- 148 files · ~186,178 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1221 nodes · 3699 edges · 82 communities (65 shown, 17 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 221 edges (avg confidence: 0.85)
- Token cost: 568,073 input · 0 output

## Community Hubs (Navigation)
- Finance Engine & Milestones
- Shared UI & Dialogs
- Wizard 3-Phase Specs & Meta
- Frontend Functional Spec
- Primary Details Step
- Widget Catalog & Charts
- AI Workflow & Commands
- Home Dashboard Data
- Mortgage Setup Validation
- Dashboard Layout Grid
- Form Fields
- Primary Wizard & Uploads
- Financial Calculation Spec
- State Machines & Amortization
- Mock API Core
- App Routing & Pages
- Home Page States
- Primary Compare & Simulator
- Architecture & Delivery Spec
- Dashboard Widgets
- Mock DB & Seed
- Program Pages & Take Over
- shadcn Config
- Dev Dependencies
- App Shell & Auth
- Setup Wizard Progress
- Milestone Frame & Insights
- Runtime Dependencies
- Activity & Reminder Widgets
- Widget Gallery Spec
- Master Prompt & Mock Rules
- Application Flow & Matching
- Oxlint Config
- Simulation & Break-even
- Dev Panel & API Tests
- My KPR Navigation
- Mock API Helpers
- Widget Body & Lock
- npm Scripts
- Document Rules
- jsconfig Paths
- Alert UI
- Tabs UI
- Package Metadata
- API Error Handling
- Refinancing Icon A
- Service Image 1
- Service Image 2
- KPR Card Illustration
- Card Overview Illustration
- Auth Cover Image
- KPR Primary Icon A
- Multiguna Icon A
- KPR Primary Icon B
- Multiguna Icon B
- Take Over Icon A
- No-KPR Empty State
- Service Image 3
- Badge UI
- cn Utility Dep
- Refinancing Icon B
- lucide-react Dep
- react-grid-layout Dep
- react-icons Dep
- react-is Dep
- react-router-dom Dep
- shadcn Dep
- Favicon & Brand Color
- Take Over Icon B
- Know-Warn-Act Principle
- Conceptual Data Model
- Basis Points Convention

## God Nodes (most connected - your core abstractions)
1. `02 Frontend Functional Spec` - 71 edges
2. `rupiah()` - 58 edges
3. `react` - 50 edges
4. `createMockApi()` - 45 edges
5. `dateShort()` - 44 edges
6. `useResource()` - 42 edges
7. `Button()` - 36 edges
8. `toMoney()` - 36 edges
9. `deriveMortgage()` - 35 edges
10. `percentBps()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `Aggregate home contract (api.home.get: state, priority_reason, cards)` --semantically_similar_to--> `deriveMortgage()`  [INFERRED] [semantically similar]
  ruangkpr-docs/04-MOCK-API-JSON-CONTRACT.md → src/domains/mortgages/derive.js
- `Property contract (estimated_equity, ltv_bps, is_official_appraisal)` --shares_data_with--> `calculatePropertyMetrics()`  [INFERRED]
  ruangkpr-docs/04-MOCK-API-JSON-CONTRACT.md → src/calculations/finance.js
- `rupiahApprox()` --implements--> `Ballpark rounding (floor to Rp10 jt with ±)`  [INFERRED]
  src/lib/format.js → docs/superpowers/specs/2026-10-01-primary-wizard-3-tahap-design.md
- `resolveMonthlyDueDate()` --implements--> `Due-date month addition with end-of-month clamp`  [INFERRED]
  src/calculations/dates.js → ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md
- `CalculationError` --implements--> `CalculationError`  [INFERRED]
  src/calculations/finance.js → ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify-first slash command workflow (build/fix/review)** — _claude_commands_build_build_command, _claude_commands_fix_fix_command, _claude_commands_review_review_command, claude_graphify_context_retrieval [INFERRED 0.95]
- **Mock-first data boundary rules** — claude_mock_first_architecture, claude_api_boundary, claude_mockdb_localstorage_boundary [EXTRACTED 1.00]
- **Definition of Done verification checks** — claude_npm_run_lint, claude_vitest, claude_npm_run_build, claude_playwright [EXTRACTED 1.00]
- **Approved visual prototype modules** — ruangkpr_app__standalone__shell_template, ruangkpr_app__standalone__pengajuan_module, ruangkpr_app__standalone__pantau_module, ruangkpr_app__standalone__takeover_module, ruangkpr_app__standalone__simulasi_tab [EXTRACTED 1.00]
- **Home lifecycle render states and priority** — ruangkpr_docs_02_frontend_functional_spec_home_fresh, ruangkpr_docs_02_frontend_functional_spec_home_application_draft, ruangkpr_docs_02_frontend_functional_spec_home_mortgage_setup_draft, ruangkpr_docs_02_frontend_functional_spec_home_in_process, ruangkpr_docs_02_frontend_functional_spec_home_rejected, ruangkpr_docs_02_frontend_functional_spec_home_monitoring_normal, ruangkpr_docs_02_frontend_functional_spec_home_near_floating, ruangkpr_docs_02_frontend_functional_spec_home_already_floating, ruangkpr_docs_02_frontend_functional_spec_home_partial_error, ruangkpr_docs_02_frontend_functional_spec_home_render_priority, ruangkpr_docs_01_master_prd_home_render_priority [EXTRACTED 1.00]
- **Amortization schedule generation and reconciliation** — ruangkpr_docs_03_financial_calculation_spec_generateamortizationschedule, ruangkpr_docs_03_financial_calculation_spec_validaterateperiods, ruangkpr_docs_03_financial_calculation_spec_rate_period_shape, ruangkpr_docs_03_financial_calculation_spec_payment_reset_policy, ruangkpr_docs_03_financial_calculation_spec_rounding_policy, ruangkpr_docs_03_financial_calculation_spec_reconciliation_invariants, ruangkpr_docs_03_financial_calculation_spec_due_date_clamping [EXTRACTED 1.00]
- **Take Over / Top-up decision math (costs, net saving, break-even, top-up)** — ruangkpr_docs_03_financial_calculation_spec_calculatetakeoverscenario, ruangkpr_docs_03_financial_calculation_spec_calculatetopupscenario, ruangkpr_docs_03_financial_calculation_spec_cost_treatment, ruangkpr_docs_03_financial_calculation_spec_cumulative_net_saving, ruangkpr_docs_03_financial_calculation_spec_break_even_status, ruangkpr_docs_03_financial_calculation_spec_topup_definitions, ruangkpr_docs_02_frontend_functional_spec_opt_program_detail [INFERRED 0.85]
- **Shared milestone / insight-grid pattern across Primary, Take Over and KPR setup** — src_components_shared_milestone_milestonepanel, src_components_shared_milestone_insightgrid, src_domains_applications_primarymilestone_primarymilestone, src_domains_optimize_takeovermilestone_takeovermilestone, src_domains_mortgages_mortgagesetupwizard_reminderstep [EXTRACTED 1.00]
- **3-phase front-loaded wizard progress (Primary, Take Over, KPR setup, Home draft cards)** — src_domains_applications_meta_phaseprogress, src_domains_applications_meta_primaryprogress, src_domains_applications_meta_takeoverprogress, src_domains_applications_meta_draftprogress, src_domains_mortgages_setupmeta_setup_percent, src_components_shared_progress_wizardprogress, docs_superpowers_specs_2026_10_01_primary_wizard_3_tahap_design_front_loaded_percent [EXTRACTED 1.00]
- **Complete-later flow for a minimal reminder-only KPR** — docs_superpowers_specs_2026_10_01_kpr_berjalan_3_step_design_lengkapi_nanti, docs_superpowers_specs_2026_10_01_kpr_berjalan_3_step_design_rate_type_unknown, src_domains_mortgages_setupmeta_progressgap, src_domains_mortgages_derive_healthscore, src_domains_optimize_goalstartpage_goalstartpage [EXTRACTED 1.00]
- **Fixed-to-floating early warning flow (reminder milestones -> home warning card -> activity -> explore Take Over signal)** — ruangkpr_docs_01_master_prd_fixed_to_floating_warning, ruangkpr_docs_04_mock_api_json_contract_reminders_contract, ruangkpr_docs_04_mock_api_json_contract_aggregate_home_contract, ruangkpr_docs_04_mock_api_json_contract_activities_contract, ruangkpr_docs_04_mock_api_json_contract_explore_contract [INFERRED 0.85]
- **Existing data/components feeding Home dashboard widgets** — src_domains_mortgages_derive_derivemortgage, src_domains_mortgages_amortizationpages, src_calculations_finance_calculatepropertymetrics, src_components_shared_progress_timeline, ruangkpr_docs_01_master_prd_home_monitoring_dashboard [EXTRACTED 1.00]
- **Simulate-then-apply decision flow (Explore -> simulation with break-even -> save or apply one draft)** — ruangkpr_docs_01_master_prd_simulation_vs_application, ruangkpr_docs_01_master_prd_take_over_flow, ruangkpr_docs_01_master_prd_break_even_formula, ruangkpr_docs_04_mock_api_json_contract_simulations_contract, ruangkpr_docs_04_mock_api_json_contract_explore_contract [INFERRED 0.85]

## Communities (82 total, 17 thin omitted)

### Community 0 - "Finance Engine & Milestones"
Cohesion: 0.06
Nodes (88): Empty-data-tolerant derive.js, Primary Milestone 1: Affordability insights, Primary Milestone 2: Matching programs insights, Milestone insight screen, Milestone via location.state + replace navigation, Open bank program eligibility rule, Take Over Milestone 1: Tahap 1 selesai, addDays() (+80 more)

### Community 1 - "Shared UI & Dialogs"
Cohesion: 0.11
Nodes (27): Div-based stacked bar chart pattern (role=img), react, ConfirmDialog(), FormDialog(), HouseIllustration(), Chip(), CHIP_TONES, Disclaimer() (+19 more)

### Community 2 - "Wizard 3-Phase Specs & Meta"
Cohesion: 0.08
Nodes (41): Plan: Setup KPR Berjalan 3 Step, Full edit mode only for active KPR, Plan: Wizard Take Over & Refinancing 3 Tahap, Spec: Setup KPR Berjalan 3 Step (Reminder Floating), Derived sisa pinjaman (never asked), KPR Berjalan 3-Step Reminder Setup, Lengkapi nanti (complete-later prompts), Mock API mortgage rules (saveSetupStep/update/activate) (+33 more)

### Community 3 - "Frontend Functional Spec"
Cohesion: 0.07
Nodes (44): Multiguna requirement framework (property-secured loan), Refinancing + Top-up requirement framework, Visual baseline (Plus Jakarta Sans, #003DA5, #F4F6FA, Command Center header), 02 Frontend Functional Spec, Accessibility contract, ACT-01 Activity list, Responsive app shell & navigation (sidebar ≥1024px, bottom nav <768px), AUTH-02 OTP verification (+36 more)

### Community 4 - "Primary Details Step"
Cohesion: 0.12
Nodes (38): HIGHLIGHT_ON_REJECT, initialValues(), PrimaryDetailsStep(), PURCHASE, SAMPLE, SECTIONS, stepValues(), TENORS (+30 more)

### Community 5 - "Widget Catalog & Charts"
Cohesion: 0.09
Nodes (33): Widget catalog expansion 9 to 23, Widget categories (Grafik, Angka penting, Timeline & Pipeline, Pengingat & Aktivitas), ARTICLES, AmortizationWidget(), StatWidget(), BalanceProjectionWidget(), FILL, PaymentSplitWidget() (+25 more)

### Community 6 - "AI Workflow & Commands"
Cohesion: 0.10
Nodes (35): Build Command (/build), Fix Command (/fix), Root Cause, Smallest Safe Change, Review Checklist (architecture, a11y, states, boundaries, tests), Review Command (/review), AI Coding Workflow, API Boundary (src/data/api.js), Definition of Done (+27 more)

### Community 7 - "Home Dashboard Data"
Cohesion: 0.08
Nodes (20): Query: data for Home dashboard widgets (charts, pipeline), Home widget data sources (deriveMortgage outputs, mortgage fields, explore, activities, simulation snapshot), Explore with active mortgage (Take Over floating/opportunity signals), Fixed-to-floating early warning (H-90/60/30/14/7), Home monitoring dashboard (Health, Next Payment, Warning, Progress, Opportunity; no charts by default), KPR Health composite score (DTI, LTV, rate risk, loan progress), Notification reliability (idempotent scheduling, dedupe per event/milestone/channel), Product principles (show less, progressive disclosure, estimate is not approval, no silent submission) (+12 more)

### Community 8 - "Mortgage Setup Validation"
Cohesion: 0.17
Nodes (30): floatingPreview(), loanPreview(), LoanStep(), RateStep, useSave(), validateProperty(), blank(), filledOnly() (+22 more)

### Community 9 - "Dashboard Layout Grid"
Cohesion: 0.15
Nodes (27): addWidget(), CATEGORIES, clamp(), COLS, compact(), DEFAULT_LAYOUT, GAP, GRID_MIN_WIDTH (+19 more)

### Community 10 - "Form Fields"
Cohesion: 0.13
Nodes (23): CheckboxField(), DateField(), describedBy(), ErrorSummary(), FormGrid(), MoneyField(), NumberField(), RadioCards() (+15 more)

### Community 11 - "Primary Wizard & Uploads"
Cohesion: 0.10
Nodes (23): ProgressBar(), UploadRow(), VIEW, HEADERS, PHASE_LABELS, GROUPS, HealthAside(), KNOWS (+15 more)

### Community 12 - "Financial Calculation Spec"
Cohesion: 0.18
Nodes (31): Calculation & display rules, MYKPR-03 Amortization page, Shared format & validation rules (integer Rupiah, NIK 16 digits, tenor 12–360, due day 1–31, 5MB uploads), 03 Financial Calculation Spec, Break-even status (reached / not_reached / no_monthly_benefit) + sustained break-even, calculateAnnuityPayment(), calculateDti(), calculateFloatingImpact() (+23 more)

### Community 13 - "State Machines & Amortization"
Cohesion: 0.09
Nodes (30): Amortization schedule (summary, annual stacked chart, monthly/yearly table, financial invariants), Application state machine (draft -> submitted -> ... -> disbursed; rejected/cancelled), Home render priority (rejected > in-process > draft > setup draft > warning > floating > normal > fresh), Existing KPR setup wizard (6 steps: Data KPR, Bunga & Cicilan, Properti, Keuangan, Reminder, Review), Mortgage state (draft -> active -> closed), Partial-data state (missing property value or rate/outstanding), Payment-changed accuracy branch (no single-rate reverse engineering), Rate periods (fixed -> fixed -> floating; ordered, no overlap/gap) (+22 more)

### Community 14 - "Mock API Core"
Cohesion: 0.15
Nodes (28): CANCELLABLE, clone(), createMockApi(), fail(), failures, findApp(), findMortgage(), isEmail() (+20 more)

### Community 15 - "App Routing & Pages"
Cohesion: 0.12
Nodes (27): Legacy 6-step draft compatibility (no schema migration), GuestOnly(), RequireAuth(), router, NotFoundPage(), ActivityPage(), groupLabel(), ApplicationTracker() (+19 more)

### Community 16 - "Home Page States"
Cohesion: 0.11
Nodes (22): SuccessDialog(), PanelTitle(), DraftChecklist(), keptDataNote(), productName(), resumePath(), OtherDraftNotice(), RejectedActions() (+14 more)

### Community 17 - "Primary Compare & Simulator"
Cohesion: 0.18
Nodes (27): heroFor(), Tracker(), CapacityHero(), ELIGIBILITY, PrimaryCompareStep(), ProgramSimulator(), SORTS, OpportunityWidget() (+19 more)

### Community 18 - "Architecture & Delivery Spec"
Cohesion: 0.10
Nodes (27): Frontend-first delivery scope (Vite+React JS, shadcn/ui, mock API, pure JS calc engine), Minimum frontend folder structure (src/features/…), API adapter boundary (mockApi / httpApi, same contract), Aggregate home contract (api.home.get: state, priority_reason, cards), Adapter contract tests minimum (18 checks against mockApi and httpApi), createMockApi() and __control.failNext (dev-only mock controls), Named fixture scenarios and deterministic clock (fresh, mortgage_active_h90, ...), 05 Frontend Architecture & Delivery Plan (+19 more)

### Community 19 - "Dashboard Widgets"
Cohesion: 0.11
Nodes (23): Skeleton(), ReviewStep(), AgendaWidget(), EXTRA_ROWS, LockedPreview(), MyKprWidget(), NextPaymentWidget(), OutstandingWidget() (+15 more)

### Community 20 - "Mock DB & Seed"
Cohesion: 0.14
Nodes (24): loadDb(), resetDb(), saveDb(), STORAGE_KEY, activity(), base(), CLOCK, createSeed() (+16 more)

### Community 21 - "Program Pages & Take Over"
Cohesion: 0.13
Nodes (21): Take Over Milestone 2: Baseline 'Tahap 2 selesai' banner, TAKEOVER_SORTS, BankMark(), EstimateTag(), HeroCard(), LoadingCards(), StatTile(), Slider() (+13 more)

### Community 22 - "shadcn Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 23 - "Dev Dependencies"
Cohesion: 0.10
Nodes (21): jsdom, oxlint, devDependencies, jsdom, oxlint, @playwright/test, tailwindcss, @tailwindcss/vite (+13 more)

### Community 24 - "App Shell & Auth"
Cohesion: 0.19
Nodes (15): AppShell(), Brand(), NAV, PageHeader(), unreadLabel(), api, PHASE_LABELS, LEGAL (+7 more)

### Community 25 - "Setup Wizard Progress"
Cohesion: 0.12
Nodes (15): UnsavedChangesGuard(), RateField(), StatusStepper(), stepPercent(), Timeline(), useTween(), WizardProgress(), KNOWS (+7 more)

### Community 26 - "Milestone Frame & Insights"
Cohesion: 0.22
Nodes (18): Shared milestone frame, InsightGrid(), MilestonePanel(), AffordabilityInsights(), MatchInsights(), PrimaryMilestone(), DTI_ZONE, DtiWidget() (+10 more)

### Community 27 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (19): canvas-confetti, class-variance-authority, motion, dependencies, canvas-confetti, class-variance-authority, motion, radix-ui (+11 more)

### Community 28 - "Activity & Reminder Widgets"
Cohesion: 0.16
Nodes (12): FieldError(), WIDGET_VIEWS, LastSimulationWidget(), ReadingWidget(), RecentActivityWidget(), RemindersWidget(), pickArticles(), simulationSummary() (+4 more)

### Community 29 - "Widget Gallery Spec"
Cohesion: 0.17
Nodes (15): Spec: Widget Catalog & Tambah Widget Gallery, Locked widget (Data belum lengkap), Charts opt-in only; default board chart-free, PRD §11.1 No charts on Home, Recharts 3 lazy-loaded chart widgets, Tambah widget gallery with live preview, contentZoom(), defaultCellSize() (+7 more)

### Community 30 - "Master Prompt & Mock Rules"
Cohesion: 0.18
Nodes (17): 01 Master PRD: RuangKPR, Mock API async operations list, Mock API rules (300–800ms latency, no optimistic critical mutations, versioned localStorage key), 04 Mock API JSON Contract, 06 Claude Code Master Prompt, Architecture rules (single mockApi/httpApi adapter, no fetch/localStorage in UI), Definition of Done (master prompt), Final report format (no fabricated success) (+9 more)

### Community 31 - "Application Flow & Matching"
Cohesion: 0.19
Nodes (14): Application tracker and rejected recovery (clone to other bank / retry same bank), Bank product data governance (versioned, effective dates, stale threshold), KPR Primary application flow (5 steps: product, data, documents, compare, review & submit), One application = one bank/program, Payment capacity formula (safe payment = ratio_config x income; default 35%), Rule-based bank product matching and recommendation label, Security, privacy, consent and compliance requirements, HOME-04 Application in process (+6 more)

### Community 33 - "Oxlint Config"
Cohesion: 0.18
Nodes (10): ignorePatterns, plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, dist, oxc (+2 more)

### Community 35 - "Simulation & Break-even"
Cohesion: 0.22
Nodes (10): Break-even formula (moving_cost / monthly_benefit), Calculation engine requirements (annuity, solve-for-rate, rate periods, DTI/LTV, take over costs), Deterministic financial math (AI never produces authoritative numbers), Simulation separated from application (Simpan Simulasi vs Ajukan Sekarang), Take Over flow (baseline, total moving cost, break-even, old KPR settlement tracker), Binding implementation notes, OPT-08 Program Detail Simulation, UI integration notes (form adapter → bps/integer, Intl id-ID formatting, standard disclaimer) (+2 more)

### Community 36 - "Dev Panel & API Tests"
Cohesion: 0.20
Nodes (6): DevPanel(), FAILABLE, mockControls, api, DEFAULT_REMINDERS, SCENARIOS

### Community 37 - "My KPR Navigation"
Cohesion: 0.22
Nodes (9): Navigation: Home | My KPR | Explore | Activity | Profile, My KPR tabs (Overview | Payment | Rate | Property), No false integration claims (manual payment is user-recorded), MYKPR-01 Overview, MYKPR-02 Payment (manual Tandai Pembayaran), MYKPR-05 Property, MYKPR-04 Rate, Payments list and mark-paid (manual_user_recorded, bank_confirmed:false) (+1 more)

### Community 39 - "Mock API Helpers"
Cohesion: 0.31
Nodes (9): activeMortgageOf(), completeApplication(), decorate(), mortgageFromApplication(), newApplication(), nextId(), nowIso(), pushActivity() (+1 more)

### Community 40 - "Widget Body & Lock"
Cohesion: 0.33
Nodes (5): WIDGET, WIDGET_VIEWS, LockedWidget(), WidgetBoundary, sampleWidgetProps()

### Community 41 - "npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, e2e, lint, preview, test, test:watch

### Community 43 - "Document Rules"
Cohesion: 0.29
Nodes (7): ACCEPTED_EXTENSIONS, ACCEPTED_TYPES, doc(), DOC_LABELS, MAX_FILE_BYTES, requiredDocuments(), primaryApplication()

### Community 44 - "jsconfig Paths"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, jsx, paths, include, src

### Community 47 - "Package Metadata"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 49 - "Refinancing Icon A"
Cohesion: 0.67
Nodes (4): 3D Glossy Blue/Red Service Icon Style, Refinancing Service Icon, Bank-to-Bank Transfer Metaphor (Take Over KPR), Refinancing Service

### Community 50 - "Service Image 1"
Cohesion: 0.83
Nodes (4): Loan Comparison Table (Laptop), Mortgage Estimate Charts (Tablet), Self-Service Mortgage (KPR) Planning at Home, Service Image 1 (Home Mortgage Planning Photo)

### Community 51 - "Service Image 2"
Cohesion: 0.67
Nodes (4): Service Image 2: Home Financial Planning Photo, Home Mortgage (KPR) Budget Planning, Spreadsheet and Calculator Loan Analysis, Warm Residential Lifestyle Photography Style

### Community 52 - "KPR Card Illustration"
Cohesion: 0.67
Nodes (3): KPR Card Illustration (house icon with notification bell), KPR (Kredit Pemilikan Rumah / Home Mortgage), Mortgage Notification / Reminder Badge

### Community 53 - "Card Overview Illustration"
Cohesion: 1.00
Nodes (3): Card Overview Illustration (card-overview.webp), Navy and Red Brand Accent Palette, Residential Street Scene (modern homes row)

### Community 54 - "Auth Cover Image"
Cohesion: 1.00
Nodes (3): Auth Screen Hero Visual, Auth Cover Image (cover-auth.webp), New Home Ownership / Move-in Moment

### Community 55 - "KPR Primary Icon A"
Cohesion: 0.67
Nodes (3): KPR Primary Service Icon (256px), Blue Glossy 3D Service Icon Style, KPR (Home Ownership Loan) Service

### Community 56 - "Multiguna Icon A"
Cohesion: 0.67
Nodes (3): Multiguna Service Icon (256px), Kredit Multiguna (Home-Equity Multipurpose Loan), Glossy 3D Service Icon Style (blue house, red accents)

### Community 57 - "KPR Primary Icon B"
Cohesion: 0.67
Nodes (3): Blue Gradient 3D Service Icon Style, Home Ownership / Mortgage (KPR) Metaphor, KPR Primary Service Icon (house with key)

### Community 58 - "Multiguna Icon B"
Cohesion: 0.67
Nodes (3): Kredit Multiguna (home-equity / multipurpose loan), Multiguna Service Icon (house + coins + safe), 3D Glossy Service Icon Style (blue/red/gold palette)

### Community 59 - "Take Over Icon A"
Cohesion: 0.67
Nodes (3): Take Over Service Icon (take-over.webp), RE/MAX Red-Blue Brand Palette, Take Over KPR Service

### Community 60 - "No-KPR Empty State"
Cohesion: 0.67
Nodes (3): No KPR Page Illustration (house with SALE sign), Empty State Illustration Pattern (no KPR applications), RE/MAX Balloon Logo and Blue/Red/White Brand Palette

### Community 61 - "Service Image 3"
Cohesion: 0.67
Nodes (3): Home Purchase / Renovation Planning, Service Image 3 - Couple Reviewing Floor Plans, Warm Lifestyle Imagery Style

## Ambiguous Edges - Review These
- `Minimum frontend folder structure (src/features/…)` → `05 Frontend Architecture & Delivery Plan`  [AMBIGUOUS]
  ruangkpr-docs/02-FRONTEND-FUNCTIONAL-SPEC.md · relation: conceptually_related_to
- `05 Frontend Architecture & Delivery Plan` → `01 Master PRD: RuangKPR`  [AMBIGUOUS]
  ruangkpr-docs/05-FRONTEND-ARCHITECTURE-DELIVERY.md · relation: cites

## Knowledge Gaps
- **221 isolated node(s):** `$schema`, `oxc`, `dist`, `src/components/ui`, `react/rules-of-hooks` (+216 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Minimum frontend folder structure (src/features/…)` and `05 Frontend Architecture & Delivery Plan`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `05 Frontend Architecture & Delivery Plan` and `01 Master PRD: RuangKPR`?**
  _Edge tagged AMBIGUOUS (relation: cites) - confidence is low._
- **Why does `react` connect `Shared UI & Dialogs` to `Primary Details Step`, `Widget Catalog & Charts`, `AI Workflow & Commands`, `Dashboard Layout Grid`, `Form Fields`, `Primary Wizard & Uploads`, `Home Page States`, `Primary Compare & Simulator`, `Program Pages & Take Over`, `App Shell & Auth`, `Setup Wizard Progress`, `Milestone Frame & Insights`, `Activity & Reminder Widgets`, `Widget Gallery Spec`, `Alert Dialog UI`, `Oxlint Config`, `Dialog UI`, `Dev Panel & API Tests`, `Table UI`, `Widget Body & Lock`, `Card UI`, `Alert UI`, `Tabs UI`, `Badge UI`, `Radio Group UI`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `02 Frontend Functional Spec` connect `Frontend Functional Spec` to `Simulation & Break-even`, `My KPR Navigation`, `Financial Calculation Spec`, `State Machines & Amortization`, `Architecture & Delivery Spec`, `Master Prompt & Mock Rules`, `Application Flow & Matching`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `deriveMortgage()` connect `Finance Engine & Milestones` to `Shared UI & Dialogs`, `Widget Catalog & Charts`, `Home Dashboard Data`, `Widget Body & Lock`, `Mortgage Setup Validation`, `App Routing & Pages`, `Home Page States`, `Primary Compare & Simulator`, `Architecture & Delivery Spec`, `Setup Wizard Progress`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `dist` to the rest of the system?**
  _221 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Finance Engine & Milestones` be split into smaller, more focused modules?**
  _Cohesion score 0.060570762958648806 - nodes in this community are weakly interconnected._