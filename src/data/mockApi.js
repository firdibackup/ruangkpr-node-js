// Mock implementation of the API contract (doc 04). Async like a real backend, persists through mockDb,
// throws ApiError for expected failures. Financial math comes from src/calculations — never inline here.
import { addDays, addMonths, daysUntil, parseIsoDate } from '@/calculations/dates'
import { CalculationError, calculateMaxPrincipal } from '@/calculations/finance'
import { comparePrimaryPrograms, compareTakeoverPrograms, evaluateTakeoverProduct, isAvailable, isStale, primaryAffordability, simulateLoan, takeoverBaseline } from '@/calculations/programs'
import { normalizeLayout } from '@/domains/home/dashboardLayout'
import { IN_PROCESS, activeApplication } from '@/domains/home/selectHomeState'
import { FIXED_MILESTONES, HEALTH_V1, deriveMortgage, mortgageAsOf, nextMilestone, nextUnpaidDue, rateMode } from '@/domains/mortgages/derive'
import { defaultTakeoverGoal, takeoverDataFromMortgage, takeoverGaps, validateEmploymentBasic } from '@/domains/optimize/validation'
import { validatePersonal } from '@/domains/applications/validation'
import { STAGE_NOTE_STATUSES, STATUS_LABEL } from '@/domains/applications/meta'
import { filledOnly, validateReminders } from '@/domains/mortgages/validation'
import { CONSENT_TYPES, CONSENT_VERSION, validateChangePassword, validateEmail, validateLogin, validateNewPassword, validateRegister, validateWelcome } from '@/domains/session/validation'
import { dateLong, maskEmail, maskNik } from '@/lib/format'
import { ApiError } from './apiError'
import { ARTICLES } from './articles'
import { BANK_PRODUCTS } from './catalog'
import { DEFAULT_UPLOAD, DOC_LABELS, DOC_REJECT_REASONS, UPLOAD_FORMATS, rejectMessage, requiredDocuments, uploadProblem } from './documentRules'
import { loadDb, resetDb, saveDb } from './mockDb'
import { ACCOUNT_KEYS, DEFAULT_REMINDERS, DEMO_PASSWORD, GOOGLE_DEMO, SCENARIOS, createSeed, newAccount, pickAccount, staffAccount } from './seed'
import { STAFF, canOpen } from './roles'
import { TOURS } from './tours'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clone = (x) => (x === undefined ? x : structuredClone(x))
const fail = (code, message, status = 400, extra = {}) => {
  throw new ApiError({ code, message, ...extra }, { status })
}
// A remote store (supabaseStore) supplies real time and globally unique ids; the localStorage demo keeps its clock and sequence.
const nowIso = (db) => db.now?.() ?? `${db.clock}T${new Date().toISOString().slice(11)}`
const nextId = (db, prefix) => db.newId?.(prefix) ?? `${prefix}_${String((db.seq += 1)).padStart(6, '0')}`

const OTP_OK = '148260'
const OTP_WRONG = '000000'
const OTP_EXPIRED = '999999'
const OTP_COOLDOWN_MS = 60_000

const CANCELLABLE = ['draft', 'submitted', 'docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal']

const STATUS_COPY = {
  docs_verification: ['Dokumen sedang diverifikasi', 'Tim kami memeriksa kelengkapan dokumen kamu.'],
  bank_processing: ['Pengajuan masuk proses bank', 'Bank sedang menganalisis pengajuan kamu.'],
  appraisal: ['Appraisal properti dijadwalkan', 'Tim RuangKPR akan mengonfirmasi jadwal survei lewat WhatsApp.'],
  approved: ['Pengajuan disetujui', 'Angka final mengikuti offering letter dari bank.'],
  old_mortgage_settlement: ['Pelunasan KPR lama berjalan', 'Tetap bayar cicilan bank lama sampai ada konfirmasi pelunasan resmi.'],
  akad: ['Jadwal akad tersedia', 'Tanda tangani akad sesuai jadwal dari bank.'],
  disbursed: ['Pengajuan selesai', 'KPR baru kamu sudah aktif.'],
}

// The team's note for the user in the current stage (spec 2026-10-13 §1.2). Appraisal records the schedule agreed on
// WhatsApp; the other stages a message.
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
function stageNoteOf(status, { message, schedule }) {
  const text = String(message ?? '').trim()
  if (status === 'appraisal') {
    const s = schedule ?? {}
    const location = String(s.location ?? '').trim()
    failOnFields(
      {
        ...(!parseIsoDate(s.date) && { date: 'Pilih tanggal appraisal.' }),
        ...(!TIME.test(s.time ?? '') && { time: 'Isi jam appraisal.' }),
        ...((location.length < 3 || location.length > 200) && { location: 'Isi lokasi appraisal (3–200 karakter).' }),
        ...(text.length > 500 && { message: 'Catatan maksimal 500 karakter.' }),
      },
      'Lengkapi jadwal appraisal.',
    )
    return { message: text, schedule: { date: s.date, time: s.time, location } }
  }
  failOnFields(text.length < 5 || text.length > 500 ? { message: 'Tulis pesan untuk user (5–500 karakter).' } : {}, 'Lengkapi pesan untuk user.')
  return { message: text, schedule: null }
}

// ---------- dev-only failure injection (doc 04 §22.4) ----------
const failures = new Map()
let callSeq = 0 // numbers every adapter call when it starts
// An armed failure fails every call already in flight when it first fires, then disarms on the next one.
// StrictMode mounts every load effect twice in dev and keeps only the second result, so both must fail;
// a single click, or a retry started afterwards, still sees exactly one failure.
function maybeFail(name, seq) {
  const f = failures.get(name)
  if (!f) return
  if (f.firedUpTo !== undefined && seq > f.firedUpTo) {
    failures.delete(name)
    return
  }
  f.firedUpTo ??= callSeq
  fail(f.code, f.message, f.status, { retryable: f.retryable })
}

// ---------- helpers ----------
// Catalog the admin manages (admin plan §4.4). Until the first admin change it is the seeded BANK_PRODUCTS, so
// stored demo data needs no reset; the first write copies it into db.products / db.banks.
const catalogOf = (db) => db.products ?? BANK_PRODUCTS
const banksFrom = (products) => [...new Map(products.map((p) => [p.bank.id, { ...p.bank, active: true, version: 1 }])).values()]
const banksOf = (db) => db.banks ?? banksFrom(catalogOf(db))
function editableCatalog(db) {
  db.products ??= structuredClone(BANK_PRODUCTS)
  db.banks ??= banksFrom(db.products)
}

// What B2C matching sees: published products of active banks, without unpublished revisions
// (the stale_catalog demo flag ages lastVerifiedAt).
function productsOf(db) {
  const stale = db.flags?.staleProducts ?? {}
  const off = new Set(banksOf(db).filter((b) => !b.active).map((b) => b.id))
  return catalogOf(db)
    .filter((p) => p.status === 'published' && !off.has(p.bank.id))
    .map(({ pendingRevision: _draft, rev: _rev, ...p }) => (stale[p.id] ? { ...p, lastVerifiedAt: stale[p.id] } : p))
}

// `owner` is the account the event belongs to: the signed-in user by default, a stored account for admin moves.
function pushActivity(db, { type, category, title, body, action = null }, owner = db) {
  owner.activities.unshift({ id: nextId(db, 'act'), type, category, title, body, occurredAt: nowIso(db), readAt: null, action })
}

// null until the user customises the Home board; until then the board follows the default for their data.
const savedLayout = (db) => (Array.isArray(db.dashboardLayout) ? normalizeLayout(db.dashboardLayout) : null)

function decorate(app) {
  app.requiredDocuments = requiredDocuments(app)
  return app
}

function findApp(db, id) {
  const app = db.applications.find((a) => a.id === id)
  if (!app) fail('RESOURCE_NOT_FOUND', 'Pengajuan tidak ditemukan.', 404)
  return app
}

function findMortgage(db, id) {
  const m = db.mortgages.find((x) => x.id === id)
  if (!m) fail('RESOURCE_NOT_FOUND', 'Data KPR tidak ditemukan.', 404)
  return m
}

const activeMortgageOf = (db) => db.mortgages.find((m) => m.status === 'active') ?? null

// Verifying a contact signs into that contact's account. The signed-in account's data sits at the top level of
// db, so B2C operations never change; every other account waits in db.accounts.
function switchAccount(db, contact) {
  if (db.user?.contact === contact) return
  if (db.user) db.accounts.push(pickAccount(db))
  const i = db.accounts.findIndex((a) => a.user.contact === contact)
  const next = i < 0 ? (staffAccount(contact) ?? newAccount()) : db.accounts.splice(i, 1)[0]
  ACCOUNT_KEYS.forEach((k) => delete db[k])
  Object.assign(db, next)
}

// A verified email (OTP or Google) signs into its account; the account's own name wins over the provider's.
// Accounts that have not agreed to the current S&K and privacy text wait at /welcome (spec 2026-10-09 §3.1).
const consented = (db) => CONSENT_TYPES.every((t) => db.profile?.consents?.some((c) => c.type === t && c.version === CONSENT_VERSION))
function signInAs(db, contact, name = '') {
  switchAccount(db, contact)
  db.user = { role: 'user', createdAt: nowIso(db), name, ...db.user, id: db.user?.id ?? nextId(db, 'usr'), contact, contactType: 'email' }
  db.profile = { ...db.profile, fullName: db.profile?.fullName || db.user.name, email: db.profile?.email || contact }
  db.session = { status: consented(db) ? 'authenticated' : 'onboarding', verification: null }
}

function agree(db, name) {
  const at = nowIso(db)
  db.user = { ...db.user, name }
  db.profile = { ...db.profile, fullName: name, consents: CONSENT_TYPES.map((type) => ({ type, version: CONSENT_VERSION, acceptedAt: at })) }
  db.session = { status: 'authenticated', verification: null }
}

// Every account this browser knows: the signed-in one, the ones waiting in db.accounts, and the staff seats. A password
// lives in db.passwords (outside the accounts, so it survives switching); an account without one uses DEMO_PASSWORD.
const normalize = (email) => String(email ?? '').trim().toLowerCase()
const hasAccount = (db, email) => db.user?.contact === email || db.accounts.some((a) => a.user?.contact === email) || Boolean(staffAccount(email))
const passwordOf = (db, email) => db.passwords?.[email] ?? DEMO_PASSWORD
const setPassword = (db, email, password) => {
  db.passwords = { ...db.passwords, [email]: password }
}

// Admin operations run as the signed-in staff member, so every user account in this browser waits in db.accounts.
const userAccounts = (db) => db.accounts.filter((a) => !STAFF[a.user.role])

function findAccount(db, id) {
  const a = userAccounts(db).find((x) => x.user.id === id)
  if (!a) fail('RESOURCE_NOT_FOUND', 'User tidak ditemukan.', 404)
  return a
}

// Every admin mutation: a written reason, the version the admin saw, then one audit event (admin plan §6).
function requireReason(reason) {
  const message = 'Isi alasan perubahan (minimal 5 karakter).'
  if (String(reason ?? '').trim().length < 5) fail('VALIDATION_FAILED', message, 400, { fieldErrors: [{ field: 'reason', message }] })
}
function checkVersion(entity, expectedVersion) {
  if (expectedVersion !== (entity.version ?? 1)) fail('CONFLICT_VERSION', 'Data ini sudah diubah sejak kamu buka. Muat ulang lalu ulangi.', 409, { retryable: true })
}
const bumpVersion = (entity) => {
  entity.version = (entity.version ?? 1) + 1
}
// Only the fields that changed, before and after; null when nothing changed.
function changes(before = {}, after = {}, keys) {
  const k = keys.filter((x) => JSON.stringify(before[x] ?? null) !== JSON.stringify(after[x] ?? null))
  return k.length ? { before: Object.fromEntries(k.map((x) => [x, before[x] ?? null])), after: Object.fromEntries(k.map((x) => [x, after[x] ?? null])) } : null
}
const maskSensitive = (o) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'nik' && v ? maskNik(v) : v]))
function audit(db, { action, resource, reason = null, before = null, after = null }) {
  ;(db.auditLog ??= []).unshift({
    id: nextId(db, 'aud'),
    actor: { id: db.user.id, name: db.user.name, contact: db.user.contact },
    action,
    resource,
    reason: reason?.trim() ?? null,
    before: maskSensitive(before),
    after: maskSensitive(after),
    requestId: nextId(db, 'req'),
    occurredAt: nowIso(db),
  })
}
const failOnFields = (errors, message) => {
  const fieldErrors = Object.entries(errors).map(([field, msg]) => ({ field, message: msg }))
  if (fieldErrors.length) fail('VALIDATION_FAILED', message, 400, { fieldErrors })
}

// One source: KPR Health reads the mortgage copy, so profile finance and draft/active mortgages move together.
function applyFinance(owner, finance) {
  owner.finance = { ...owner.finance, ...finance }
  for (const m of owner.mortgages) if (m.status === 'draft' || m.status === 'active') m.finance = { ...m.finance, ...finance }
}

const PROFILE_FIELDS = ['fullName', 'nik', 'birthPlace', 'birthDate', 'gender', 'maritalStatus', 'address', 'phone', 'email', 'occupation', 'companyName', 'jobTitle', 'workYears', 'workMonths']
const FINANCE_FIELDS = ['monthlyIncome', 'jointIncome', 'partnerIncome', 'vehicleDebt', 'cardDebt', 'otherDebt']
const pickFields = (values, keys) => Object.fromEntries(Object.entries(values ?? {}).filter(([k]) => keys.includes(k)))

function userDetail(db, a) {
  const { nik, ...profile } = a.profile ?? {}
  return {
    asOf: db.clock,
    user: { id: a.user.id, name: a.user.name, contact: a.user.contact, contactType: a.user.contactType, createdAt: a.user.createdAt, version: a.user.version ?? 1 },
    profile: { ...profile, nikMasked: nik ? maskNik(nik) : null },
    finance: a.finance ?? {},
    applications: a.applications.map((app) => ({ id: app.id, productType: app.productType, optimizationMode: app.optimizationMode, status: app.status, bankName: app.selection?.bankName ?? null, productName: app.selection?.productName ?? null, submittedAt: app.submittedAt, updatedAt: app.updatedAt })),
    // Whole KPR doc as of today: the admin KPR page derives schedule, DTI, LTV and Health from it like My KPR does.
    mortgages: a.mortgages.map((m) => mortgageAsOf(m, db.clock)),
    health: (({ version, params }) => ({ version, params }))(activeHealth(db)),
    // Admin edits (with a reason) and the user's own edits, newest first. The user's own come from database triggers
    // (migration user_changes); the demo has no database, so its scenarios seed a few. The panels show the latest five,
    // the history page all of it. ponytail: the whole history in one answer; page it once one user has thousands.
    audit: [
      ...(db.auditLog ?? []).filter((e) => e.resource.type === 'user' && e.resource.id === a.user.id),
      ...(db.userChanges ?? []).filter((c) => c.userId === a.user.id).map((c) => ({ ...c, actor: { id: a.user.id, name: a.user.name, role: 'user' } })),
    ].sort((x, y) => y.occurredAt.localeCompare(x.occurredAt)),
  }
}

const userRow = ({ user, applications, mortgages }) => ({
  id: user.id,
  name: user.name,
  contact: user.contact,
  contactType: user.contactType,
  createdAt: user.createdAt,
  activeApplicationStatus: activeApplication(applications)?.status ?? null,
  hasActiveMortgage: mortgages.some((m) => m.status === 'active'),
})

const touch = (db, entity) => {
  entity.version = (entity.version ?? 0) + 1
  entity.updatedAt = nowIso(db)
}

// Profile part of the Primary input (steps 1–2): enough for the affordability milestone.
function profileInput(app) {
  const { employment: e = {}, personal = {} } = app.data
  if (!(e.monthlyIncome > 0)) fail('CALCULATION_INPUT_INCOMPLETE', 'Penghasilan bulanan belum diisi.', 400)
  return {
    occupation: e.occupation,
    birthDate: personal.birthDate,
    monthlyIncome: e.monthlyIncome + (e.jointIncome ? e.partnerIncome ?? 0 : 0),
    existingDebt: (e.vehicleDebt ?? 0) + (e.cardDebt ?? 0) + (e.otherDebt ?? 0),
  }
}

function primaryInput(app) {
  const { employment: e = {}, property: p = {}, loan: l = {} } = app.data
  if (!(e.monthlyIncome > 0) || !(p.price > 0) || !(l.amount > 0) || !(l.tenorMonths > 0)) {
    fail('CALCULATION_INPUT_INCOMPLETE', 'Lengkapi data pinjaman dan penghasilan dulu.', 400)
  }
  return { loanAmount: l.amount, tenorMonths: l.tenorMonths, propertyPrice: p.price, propertyType: p.propertyType, ...profileInput(app) }
}

// What prices or qualifies a program (profileInput, primaryInput, simulationSource): a change drops the chosen program.
// KTP data, company and job title keep it.
function pricingInputs(app) {
  const { employment: e = {}, finance: f = {}, property: p = {} } = app.data
  return JSON.stringify([
    app.data.loan,
    p.price,
    p.estimatedValue,
    p.disputed,
    app.data.oldLoan,
    app.data.goal,
    app.productType === 'primary' ? e.occupation : null,
    (e.monthlyIncome ?? 0) + (e.jointIncome ? e.partnerIncome ?? 0 : 0),
    (e.vehicleDebt ?? 0) + (e.cardDebt ?? 0) + (e.otherDebt ?? 0),
    (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0),
  ])
}

function selectionFrom(product, fields) {
  return { bankProductId: product.id, productVersion: product.version, bankName: product.bank.name, bankMark: product.bank.mark, productName: product.name, ...fields }
}

function prefilledPersonal(db) {
  const p = db.profile ?? {}
  return { fullName: p.fullName ?? db.user?.name ?? '', nik: p.nik ?? '', birthPlace: p.birthPlace ?? '', birthDate: p.birthDate ?? '', gender: p.gender ?? '', maritalStatus: p.maritalStatus ?? '', address: p.address ?? '', phone: p.phone ?? '', email: p.email ?? '' }
}

function prefilledEmployment(db) {
  const p = db.profile ?? {}
  const f = db.finance ?? {}
  return {
    occupation: p.occupation ?? '',
    companyName: p.companyName ?? '',
    jobTitle: p.jobTitle ?? '',
    workYears: p.workYears ?? null,
    workMonths: p.workMonths ?? null,
    monthlyIncome: f.monthlyIncome ?? null,
    jointIncome: f.jointIncome ?? false,
    partnerIncome: f.partnerIncome ?? null,
    vehicleDebt: f.vehicleDebt ?? null,
    cardDebt: f.cardDebt ?? null,
    otherDebt: f.otherDebt ?? null,
  }
}

// Reusable profile data is kept on the profile; applications keep their own snapshot on submit.
// The setup asks cicilan, bunga and sisa tenor, never sisa pokok. The estimate lives here, the one place every
// writer goes through, and is redone only when one of its inputs changed, so older estimates stay stable.
// An official figure (outstandingEstimated === false) wins until the user clears it.
const OUTSTANDING_INPUTS = ['currentPayment', 'currentRateBps', 'remainingTenorMonths']
function applyMortgageRules(m, before, values, clock) {
  // Sisa pokok and tenor sent from a form are today's figures; mortgageAsOf moves them on from this date. Edit Data KPR
  // sending back the moved balance it showed is no new bank figure: the saved one, its date and its label stay.
  const shown = mortgageAsOf(before, clock)
  if (shown.outstandingProjected && values.outstandingPrincipal === shown.outstandingPrincipal && values.remainingTenorMonths === shown.remainingTenorMonths) {
    Object.assign(m, { outstandingPrincipal: before.outstandingPrincipal, remainingTenorMonths: before.remainingTenorMonths, outstandingEstimated: before.outstandingEstimated })
  } else if ('outstandingPrincipal' in values || 'remainingTenorMonths' in values) m.outstandingAsOf = clock
  // A new due day keeps each marked payment in its month.
  if (before.dueDay && m.dueDay !== before.dueDay && m.payments) m.payments = m.payments.map((p) => ({ ...p, dueDate: addMonths(p.dueDate, 0, m.dueDay) }))
  if (m.currentRateType !== 'fixed') {
    m.fixedUntil = null
    m.estimatedFloatingRateBps = null
  }
  if (m.outstandingEstimated === false && m.outstandingPrincipal > 0) return
  if (!OUTSTANDING_INPUTS.some((k) => before[k] !== m[k]) && m.outstandingPrincipal != null) return
  const ready = m.currentPayment > 0 && m.currentRateBps > 0 && m.remainingTenorMonths > 0 && m.scheme !== 'sharia'
  m.outstandingPrincipal = ready ? calculateMaxPrincipal({ payment: m.currentPayment, annualRateBps: m.currentRateBps, termMonths: m.remainingTenorMonths }) : null
  m.outstandingEstimated = ready ? true : null
}

function syncProfile(db, values) {
  const { personal, employment } = values
  if (personal) db.profile = { ...db.profile, ...personal }
  if (employment) {
    const { occupation, companyName, jobTitle, workYears, workMonths } = employment
    db.profile = { ...db.profile, ...Object.fromEntries(Object.entries({ occupation, companyName, jobTitle, workYears, workMonths }).filter(([, v]) => v !== undefined)) }
  }
  // Income from Pekerjaan, plus the other installments Take Over keeps in its own `finance` section: the profile and
  // the monitored KPR (what KPR Health reads) take them together, as with a profile edit.
  const money = Object.fromEntries(Object.entries(pickFields({ ...employment, ...values.finance }, FINANCE_FIELDS)).filter(([, v]) => v !== undefined))
  if (Object.keys(money).length) applyFinance(db, money)
}

function newApplication(db, { productType, mode = null, source = 'cold', mortgageId = null, data }) {
  const app = {
    id: nextId(db, 'app'),
    productType,
    optimizationMode: productType === 'takeover' ? mode ?? 'takeover' : null,
    source,
    mortgageId,
    status: 'draft',
    currentStep: 1,
    stepCount: 7,
    data,
    documents: {},
    selection: null,
    consents: null,
    snapshot: null,
    statusHistory: [],
    pendingActions: [],
    rejection: null,
    excludedProductIds: [],
    superseded: false,
    version: 1,
    createdAt: nowIso(db),
    updatedAt: nowIso(db),
    submittedAt: null,
  }
  // Documents a cancelled application left behind (see cancel), the ones this product asks for.
  const types = requiredDocuments(app).map((d) => d.type)
  app.documents = freshDocuments(Object.fromEntries(Object.entries(db.kept?.documents ?? {}).filter(([t]) => types.includes(t))))
  db.applications.unshift(app)
  return decorate(app)
}

const docPaths = (documents) => Object.values(documents ?? {}).map((d) => d.path).filter(Boolean)

// From the akad's final terms when the team recorded them (doc 04 §9.1), else from the chosen program.
function mortgageFromApplication(db, app, base = {}, owner = db) {
  const ft = app.finalTerms
  const s = ft ? { ...app.selection, loanAmount: ft.loanAmount, tenorMonths: ft.tenorMonths, fixedRateBps: ft.fixedRateBps, fixedMonths: ft.fixedMonths, floatingRateBps: ft.floatingRateBps, estimatedPayment: ft.payment } : app.selection
  const start = ft?.akadDate ?? db.clock
  const dueDay = parseIsoDate(start).day
  const d = app.data
  const e = d.employment ?? {}
  const f = d.finance ?? {}
  return {
    id: nextId(db, 'mtg'),
    status: 'active',
    setupStep: 6,
    source: 'application',
    applicationId: app.id,
    bankName: s.bankName,
    productName: s.productName,
    scheme: 'conventional',
    originalPrincipal: s.loanAmount,
    originalTenorMonths: s.tenorMonths,
    startDate: start,
    dueDay,
    currentPayment: s.estimatedPayment,
    knowsOutstanding: true,
    outstandingPrincipal: s.loanAmount,
    remainingTenorMonths: s.tenorMonths,
    outstandingEstimated: false,
    paymentEverChanged: false,
    currentRateBps: s.fixedRateBps,
    currentRateType: 'fixed',
    fixedUntil: addMonths(start, s.fixedMonths, dueDay),
    estimatedFloatingRateBps: s.floatingRateBps,
    rateHistory: [],
    property: base.property ?? {
      type: d.property?.propertyType ?? 'landed_house',
      address: d.property?.address ?? '',
      city: d.property?.city ?? '',
      landArea: d.property?.landArea ?? null,
      buildingArea: d.property?.buildingArea ?? null,
      certificateType: d.property?.certificateType ?? null,
      certificateOwner: d.property?.certificateOwner ?? d.personal?.fullName ?? '',
      estimatedValue: d.property?.price ?? d.property?.estimatedValue ?? null,
      valueAsOf: db.clock,
      disputed: false,
      valueLater: false,
    },
    // KPR Health reads this copy: it starts from the profile's current finance, which may be newer than the application.
    finance: {
      ...(base.finance ?? {
        monthlyIncome: e.monthlyIncome ?? null,
        jointIncome: e.jointIncome ?? false,
        partnerIncome: e.partnerIncome ?? null,
        vehicleDebt: e.vehicleDebt ?? f.vehicleDebt ?? 0,
        cardDebt: e.cardDebt ?? f.cardDebt ?? 0,
        otherDebt: e.otherDebt ?? f.otherDebt ?? 0,
        routineExpenses: null,
        emergencyFund: null,
      }),
      ...pickFields(owner.finance, FINANCE_FIELDS),
    },
    reminders: base.reminders ?? structuredClone(configOf(db).reminders),
    payments: [],
    version: 1,
    activatedAt: nowIso(db),
  }
}

// Disbursement converts final akad terms into an active mortgage (doc 04 §23), never simulation values.
function completeApplication(db, app, owner = db) {
  if (app.productType === 'takeover') {
    const old = app.mortgageId ? owner.mortgages.find((m) => m.id === app.mortgageId) : activeMortgageOf(owner)
    if (old) old.status = 'replaced'
    owner.mortgages.unshift(mortgageFromApplication(db, app, old ? { property: old.property, finance: old.finance, reminders: old.reminders } : {}, owner))
    pushActivity(db, { type: 'application_completed', category: 'application', title: 'Take Over selesai', body: `KPR baru di ${app.selection.bankName} aktif. Pemantauan memakai data final akad.`, action: { label: 'Lihat KPR', route: '/my-kpr/overview' } }, owner)
    return
  }
  if (activeMortgageOf(owner)) {
    pushActivity(db, { type: 'application_completed', category: 'application', title: 'Pengajuan selesai', body: 'KPR baru belum dipantau otomatis karena MVP mendukung satu KPR aktif per akun.' }, owner)
    return
  }
  owner.mortgages.unshift(mortgageFromApplication(db, app, {}, owner))
  pushActivity(db, { type: 'application_completed', category: 'application', title: 'KPR kamu sudah aktif', body: `${app.selection.bankName} · ${app.selection.productName}. Reminder pembayaran otomatis aktif.`, action: { label: 'Lihat KPR', route: '/my-kpr/overview' } }, owner)
}

// Status matrix shared by the admin and the dev shortcuts (admin plan §4.3, doc 04 §9.1).
// additional_docs_requested waits on the user's re-upload, which returns it to docs_verification.
const NEXT_STATUS = {
  submitted: ['docs_verification'],
  docs_verification: ['additional_docs_requested', 'bank_processing'],
  bank_processing: ['appraisal', 'rejected'],
  appraisal: ['approved', 'rejected'],
  old_mortgage_settlement: ['akad'],
  akad: ['disbursed'],
}
const allowedTransitions = (app) => (app.status === 'approved' ? [app.productType === 'takeover' ? 'old_mortgage_settlement' : 'akad'] : (NEXT_STATUS[app.status] ?? []))

// Open question (admin plan §12 Q3): only the DTI code is confirmed; relevantStep is the step a retry reopens.
const REJECTION_CODES = {
  DTI_ABOVE_BANK_POLICY: { label: 'Rasio cicilan melebihi batas bank', relevantStep: { primary: 2, takeover: 3 } },
  BANK_POLICY_OTHER: { label: 'Kebijakan bank lainnya', relevantStep: {} },
}

// Final akad terms (proposed set, admin plan §12 Q1). The installment comes from the same engine as the simulation.
function finalTermsOf(ft = {}) {
  const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
  const e = {}
  if (!int(ft.loanAmount, 1, Number.MAX_SAFE_INTEGER)) e.loanAmount = 'Isi plafon final.'
  if (!int(ft.tenorMonths, 12, 360)) e.tenorMonths = 'Tenor 12–360 bulan.'
  if (!int(ft.fixedRateBps, 1, 3000)) e.fixedRateBps = 'Isi bunga fixed 0,01–30%.'
  if (!int(ft.fixedMonths, 1, ft.tenorMonths ?? 0)) e.fixedMonths = 'Masa fixed 1 bulan sampai tenor.'
  if (!int(ft.floatingRateBps, 1, 3000)) e.floatingRateBps = 'Isi estimasi bunga floating 0,01–30%.'
  if (!parseIsoDate(ft.akadDate)) e.akadDate = 'Pilih tanggal akad.'
  failOnFields(e, 'Lengkapi angka final akad.')
  const ratePeriods = [
    { type: 'fixed', durationMonths: ft.fixedMonths, rateBps: ft.fixedRateBps },
    { type: 'floating', durationMonths: null, rateBps: ft.floatingRateBps, estimated: true },
  ]
  const { payment } = simulateLoan({ product: { ratePeriods }, principal: ft.loanAmount, termMonths: ft.tenorMonths })
  return { loanAmount: ft.loanAmount, tenorMonths: ft.tenorMonths, fixedRateBps: ft.fixedRateBps, fixedMonths: ft.fixedMonths, floatingRateBps: ft.floatingRateBps, akadDate: ft.akadDate, payment }
}

// Admin document review (spec 2026-10-13 §1.1): "ok" verifies at once; a rejection waits on the document as a draft
// the user does not see until the team sends the revision request (transition to additional_docs_requested).
function applyReview(app, { documentType, result, reasonCode, note }, at) {
  if (app.status !== 'docs_verification') fail('INVALID_STATE_TRANSITION', 'Dokumen hanya bisa diperiksa saat verifikasi dokumen.', 409)
  const current = app.documents[documentType]
  if (!current || !['uploaded', 'verified'].includes(current.status)) fail('INVALID_STATE_TRANSITION', 'Dokumen ini belum diunggah.', 409)
  const { review: _draft, ...doc } = current
  if (result === 'ok') {
    app.documents[documentType] = { ...doc, status: 'verified' }
    return
  }
  if (result !== 'rejected') fail('VALIDATION_FAILED', 'Pilih Sesuai atau Tolak.', 400)
  const text = String(note ?? '').trim()
  failOnFields(
    {
      ...(!DOC_REJECT_REASONS.some((r) => r.value === reasonCode) && { reasonCode: 'Pilih alasan penolakan.' }),
      ...(reasonCode === 'other' && !text && { note: 'Tulis catatan untuk alasan Lainnya.' }),
      ...(text.length > 300 && { note: 'Catatan maksimal 300 karakter.' }),
    },
    'Lengkapi alasan penolakan.',
  )
  app.documents[documentType] = { ...doc, status: 'uploaded', review: { reasonCode, note: text, at } }
}

// A new attempt after a rejection keeps the files the user has, all waiting for the team's check again; a document the
// team asked to replace has to be uploaded anew. The database only accepts a submit made of such fresh uploads.
const freshDocuments = (documents) =>
  Object.fromEntries(
    Object.entries(documents ?? {})
      .filter(([, d]) => d.status === 'verified' || d.status === 'uploaded')
      .map(([t, { review: _draft, ...d }]) => [t, { ...d, status: 'uploaded', invalidReason: null }]),
  )

// One status move with every side effect the user sees: documents, pending actions, rejection, activity, and the
// active KPR on disbursement. The caller checks the reason/version and writes the audit event.
function transitionApplication(db, owner, app, { toStatus, metadata = {} }) {
  if (!allowedTransitions(app).includes(toStatus)) fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa dipindah ke status tersebut.', 409)
  if (toStatus === 'bank_processing') {
    if (app.pendingActions.length) fail('INVALID_STATE_TRANSITION', 'Masih ada dokumen yang menunggu diunggah ulang user.', 409)
    if (requiredDocuments(app).some((d) => d.required && app.documents[d.type]?.status !== 'verified')) fail('INVALID_STATE_TRANSITION', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.', 409)
    if (Object.values(app.documents).some((d) => d.review)) fail('INVALID_STATE_TRANSITION', 'Masih ada dokumen ditolak yang belum dikirim ke user.', 409)
  }
  const at = nowIso(db)
  if (toStatus === 'additional_docs_requested') {
    const rejected = Object.entries(app.documents).filter(([, d]) => d.review)
    if (!rejected.length) fail('VALIDATION_FAILED', 'Tolak minimal satu dokumen dulu.', 400)
    for (const [t, { review, ...doc }] of rejected) {
      const message = rejectMessage(review)
      app.documents[t] = { ...doc, status: 'needs_update', invalidReason: message }
      app.pendingActions.push({ id: nextId(db, 'pa'), type: 'document_update', documentType: t, message, requestedAt: at })
    }
    pushActivity(db, { type: 'additional_document_requested', category: 'application', title: 'Dokumen perlu diunggah ulang', body: `${rejected.map(([t]) => DOC_LABELS[t]).join(', ')} perlu diperbarui.`, action: { label: 'Upload sekarang', route: '/my-kpr/application' } }, owner)
  } else if (toStatus === 'rejected') {
    const code = REJECTION_CODES[metadata.code]
    const displayReason = String(metadata.displayReason ?? '').trim()
    failOnFields({ ...(!code && { code: 'Pilih alasan penolakan.' }), ...(displayReason.length < 5 && { displayReason: 'Tulis penjelasan untuk user (minimal 5 karakter).' }) }, 'Lengkapi alasan penolakan.')
    app.rejection = { code: metadata.code, displayReason, relevantStep: code.relevantStep[app.productType] ?? null, rejectedAt: at }
    pushActivity(db, { type: 'application_rejected', category: 'application', title: `Pengajuan ke ${app.selection?.bankName ?? 'bank'} belum disetujui`, body: displayReason, action: { label: 'Lihat pilihan', route: '/my-kpr/application' } }, owner)
  } else {
    if (toStatus === 'akad') app.finalTerms = finalTermsOf(metadata.finalTerms)
    const [title, body] = STATUS_COPY[toStatus]
    pushActivity(db, { type: 'application_status_changed', category: 'application', title, body, action: { label: 'Lihat status', route: '/my-kpr/application' } }, owner)
  }
  if (toStatus !== 'additional_docs_requested') app.pendingActions = []
  app.status = toStatus
  app.statusHistory.push({ status: toStatus, at })
  if (toStatus === 'disbursed') completeApplication(db, app, owner)
  touch(db, app)
}

function simulationSource(db, source) {
  if (source.type === 'application') {
    const app = findApp(db, source.id)
    const o = app.data.oldLoan ?? {}
    const g = app.data.goal ?? {}
    const p = app.data.property ?? {}
    const f = app.data.finance ?? {}
    const e = app.data.employment ?? {}
    return {
      oldBank: { name: o.bankName, productName: o.productName, estimated: o.source === 'estimate' },
      loan: { outstanding: o.outstanding, rateBps: o.rateBps, rateType: o.rateType, fixedUntil: o.fixedUntil, floatingRateBps: o.floatingRateBps, remainingMonths: o.remainingMonths, currentPayment: o.currentPayment, penaltyBps: o.penaltyBps, dueDay: o.dueDay },
      goal: g,
      propertyValue: p.estimatedValue ?? null,
      disputed: p.disputed === true,
      monthlyIncome: (e.monthlyIncome ?? 0) + (e.jointIncome ? e.partnerIncome ?? 0 : 0),
      otherDebt: (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0),
      excludedProductIds: app.excludedProductIds ?? [],
    }
  }
  const m = mortgageAsOf(findMortgage(db, source.id), db.clock)
  const f = m.finance ?? {}
  return {
    oldBank: { name: m.bankName, productName: m.productName, estimated: m.outstandingEstimated || m.outstandingProjected },
    loan: { outstanding: m.outstandingPrincipal, rateBps: m.currentRateBps, rateType: m.currentRateType, fixedUntil: m.fixedUntil, floatingRateBps: m.estimatedFloatingRateBps, remainingMonths: m.remainingTenorMonths, currentPayment: m.currentPayment, penaltyBps: null, dueDay: m.dueDay },
    propertyValue: m.property?.estimatedValue ?? null,
    disputed: m.property?.disputed === true,
    monthlyIncome: (f.monthlyIncome ?? 0) + (f.jointIncome ? f.partnerIncome ?? 0 : 0),
    otherDebt: (f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0),
    excludedProductIds: [],
  }
}

function runSimulation(db, sim, sort) {
  const src = simulationSource(db, sim.source)
  const l = src.loan
  if (!(l.outstanding > 0) || !(l.remainingMonths > 0) || !(l.rateBps > 0) || !(l.currentPayment > 0)) {
    fail('CALCULATION_INPUT_INCOMPLETE', 'Data KPR lama belum lengkap untuk simulasi.', 400)
  }
  if (!(src.monthlyIncome > 0)) fail('CALCULATION_INPUT_INCOMPLETE', 'Penghasilan bulanan belum diisi.', 400)
  const input = {
    mode: sim.input.mode,
    goal: sim.input.goal,
    tenorMonths: sim.input.tenorMonths,
    requestedTopup: sim.input.mode === 'topup' ? sim.input.requestedTopup ?? 0 : 0,
    purpose: sim.input.purpose ?? null,
    maxPayment: sim.input.maxPayment ?? null,
    propertyValue: src.propertyValue,
    disputed: src.disputed,
    monthlyIncome: src.monthlyIncome,
    otherDebt: src.otherDebt,
  }
  try {
    const baseline = takeoverBaseline({ ...l, asOf: db.clock })
    const comparison = compareTakeoverPrograms({ products: productsOf(db), baseline, input, asOf: db.clock, sort })
    return { id: sim.id, source: sim.source, oldBank: src.oldBank, input, baseline, excludedProductIds: src.excludedProductIds, ...comparison }
  } catch (e) {
    if (e instanceof CalculationError) fail('CALCULATION_FAILED', e.message, 400)
    throw e
  }
}

// The team's move (relaying the bank included); additional_docs_requested waits on the user instead.
const ADMIN_TURN = IN_PROCESS.filter((s) => s !== 'additional_docs_requested')
const AT_BANK = ['bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad']

// Submitted applications (drafts are the user's private work) with their owning account.
const submittedApps = (db) => userAccounts(db).flatMap((a) => a.applications.filter((app) => app.status !== 'draft').map((app) => ({ app, user: a.user })))

function queueRow(db, app, user) {
  const since = app.statusHistory.at(-1)?.at ?? app.updatedAt
  return {
    id: app.id,
    userId: user.id,
    userName: user.name,
    productType: app.productType,
    optimizationMode: app.optimizationMode,
    bankName: app.selection?.bankName ?? null,
    productName: app.selection?.productName ?? null,
    status: app.status,
    submittedAt: app.submittedAt,
    since,
    waitingDays: daysUntil({ fromDate: since.slice(0, 10), targetDate: db.clock }),
    pendingActions: app.pendingActions.length,
  }
}
const longestWaitingFirst = (a, b) => a.since.localeCompare(b.since)

function adminApplications(db, { status, productType, bankName, pendingAction, query = '', from, to } = {}) {
  const q = query.trim().toLowerCase()
  const all = submittedApps(db)
  const items = all
    .filter(({ app }) => (!status || app.status === status) && (!productType || app.productType === productType) && (!bankName || app.selection?.bankName === bankName))
    .filter(({ app }) => pendingAction === undefined || app.pendingActions.length > 0 === pendingAction)
    .filter(({ app }) => (!from || app.submittedAt?.slice(0, 10) >= from) && (!to || app.submittedAt?.slice(0, 10) <= to))
    .filter(({ app, user }) => !q || user.name.toLowerCase().includes(q) || app.id.toLowerCase().includes(q))
    .map(({ app, user }) => queueRow(db, app, user))
    .sort(longestWaitingFirst)
  return { items, banks: [...new Set(all.map(({ app }) => app.selection?.bankName).filter(Boolean))].sort() }
}

function findUserApp(db, id) {
  for (const owner of userAccounts(db)) {
    const app = owner.applications.find((x) => x.id === id)
    if (app) return { owner, app }
  }
  fail('RESOURCE_NOT_FOUND', 'Pengajuan tidak ditemukan.', 404)
}

const maskPersonal = (data) => (data?.personal?.nik ? { ...data, personal: { ...data.personal, nik: maskNik(data.personal.nik) } } : data)

// Internal notes live in db.adminNotes, never on the application, so no B2C response can carry them.
function applicationDetail(db, owner, app) {
  return {
    asOf: db.clock,
    user: { id: owner.user.id, name: owner.user.name, contact: owner.user.contact },
    application: {
      id: app.id,
      productType: app.productType,
      optimizationMode: app.optimizationMode,
      status: app.status,
      version: app.version ?? 1,
      createdAt: app.createdAt,
      submittedAt: app.submittedAt,
      selection: app.selection,
      finalTerms: app.finalTerms ?? null,
      stageNotes: app.stageNotes ?? {},
      rejection: app.rejection,
      pendingActions: app.pendingActions,
      statusHistory: app.statusHistory,
      data: maskPersonal(app.snapshot?.data ?? app.data),
      documents: requiredDocuments(app).map((d) => ({ ...d, file: app.documents[d.type] ?? null })),
    },
    allowedTransitions: allowedTransitions(app),
    rejectionCodes: Object.entries(REJECTION_CODES).map(([code, c]) => ({ code, label: c.label })),
    notes: (db.adminNotes ?? []).filter((n) => n.applicationId === app.id),
  }
}

// ---- admin catalog (admin plan §4.4) ----
// A published product keeps its live terms on the record; edits wait in `pendingRevision` until published as
// version + 1. `version` is what applications pin (selection.productVersion); `rev` counts admin saves and is the
// concurrency check for edits.
const CONTENT_KEYS = ['name', 'productTypes', 'scheme', 'ratePeriods', 'fees', 'eligibility', 'effectiveFrom', 'effectiveUntil', 'lastVerifiedAt']
const contentOf = (p) => p.pendingRevision ?? Object.fromEntries(['bank', ...CONTENT_KEYS].map((k) => [k, p[k]]))

function findProduct(db, id) {
  const p = catalogOf(db).find((x) => x.id === id)
  if (!p) fail('RESOURCE_NOT_FOUND', 'Produk tidak ditemukan.', 404)
  return p
}
function checkRev(p, expectedVersion) {
  checkVersion({ version: p.rev ?? 1 }, expectedVersion)
}

// Form values → catalog shape. Only the keys sent change; bankId becomes the embedded bank.
function productInput(db, values = {}) {
  const { bankId, ...rest } = pickFields(values, ['bankId', ...CONTENT_KEYS])
  const bank = bankId !== undefined && banksOf(db).find((b) => b.id === bankId)
  return { ...rest, ...(typeof rest.name === 'string' && { name: rest.name.trim() }), ...(bankId !== undefined && { bank: bank ? { id: bank.id, name: bank.name, mark: bank.mark } : null }) }
}

// Draft saves need a name and a bank; publishing needs everything matching reads (programs.js).
function productIssues(db, c, full) {
  const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
  const date = (v) => !!parseIsoDate(v)
  const e = {}
  if (String(c.name ?? '').trim().length < 3) e.name = 'Isi nama produk (minimal 3 huruf).'
  if (!c.bank || !banksOf(db).some((b) => b.id === c.bank.id)) e.bankId = 'Pilih bank.'
  if (!full) return e
  const types = c.productTypes ?? []
  if (!types.length || types.some((t) => !['primary', 'takeover', 'topup'].includes(t))) e.productTypes = 'Pilih minimal satu jenis produk.'
  const refinance = types.includes('takeover') || types.includes('topup')
  if (!['conventional', 'sharia'].includes(c.scheme)) e.scheme = 'Pilih skema.'
  const fixed = c.ratePeriods?.find((p) => p.type === 'fixed')
  const floating = c.ratePeriods?.find((p) => p.type === 'floating')
  const el = c.eligibility ?? {}
  const fees = c.fees ?? {}
  if (!int(el.maximumTenorMonths, 12, 360)) e.maximumTenorMonths = 'Tenor maksimal 12–360 bulan.'
  if (!int(fixed?.durationMonths, 1, 359)) e.fixedMonths = 'Isi masa fixed dalam bulan.'
  else if (fixed.durationMonths >= el.maximumTenorMonths) e.fixedMonths = 'Masa fixed harus lebih pendek dari tenor maksimal.'
  if (!int(fixed?.rateBps, 1, 3000)) e.fixedRateBps = 'Isi bunga fixed 0,01–30%.'
  if (!int(floating?.rateBps, 1, 3000)) e.floatingRateBps = 'Isi estimasi bunga floating 0,01–30%.'
  if (!int(fees.provisionBps, 0, 1000)) e.provisionBps = 'Provisi 0–10%.'
  if (!int(fees.admin, 0, Number.MAX_SAFE_INTEGER)) e.admin = 'Isi biaya administrasi (boleh 0).'
  if (refinance) for (const k of ['appraisal', 'notary', 'insurance']) if (!int(fees[k], 0, Number.MAX_SAFE_INTEGER)) e[k] = 'Isi biaya (boleh 0).'
  if (!int(el.maximumDtiBps, 1, 10000)) e.maximumDtiBps = 'DTI maksimal 0,01–100%.'
  if (!int(el.maximumLtvBps, 1, 10000)) e.maximumLtvBps = 'LTV maksimal 0,01–100%.'
  if (types.includes('primary')) {
    if (!int(el.minimumIncome, 0, Number.MAX_SAFE_INTEGER)) e.minimumIncome = 'Isi penghasilan minimum (boleh 0).'
    if (!int(el.minimumAge, 17, 70)) e.minimumAge = 'Usia minimum 17–70 tahun.'
    if (!int(el.maximumAgeAtMaturity, 40, 85)) e.maximumAgeAtMaturity = 'Usia maksimal saat lunas 40–85 tahun.'
    if (!el.occupations?.length) e.occupations = 'Pilih minimal satu jenis pekerjaan.'
    else if (el.occupations.some((o) => typeof o !== 'string' || !o.trim() || o.length > 50)) e.occupations = 'Jenis pekerjaan manual harus diisi, maksimal 50 karakter.'
    if (!el.propertyTypes?.length) e.propertyTypes = 'Pilih minimal satu jenis properti.'
  }
  if (types.includes('topup') && !el.purposes?.length) e.purposes = 'Pilih minimal satu tujuan top-up.'
  if (!date(c.effectiveFrom)) e.effectiveFrom = 'Pilih tanggal mulai berlaku.'
  if (!date(c.effectiveUntil)) e.effectiveUntil = 'Pilih tanggal akhir berlaku.'
  else if (date(c.effectiveFrom) && c.effectiveUntil < c.effectiveFrom) e.effectiveUntil = 'Tanggal akhir harus setelah tanggal mulai.'
  if (!date(c.lastVerifiedAt) || c.lastVerifiedAt > db.clock) e.lastVerifiedAt = 'Isi tanggal data terakhir diverifikasi (tidak di masa depan).'
  return e
}

function productRow(db, p) {
  return {
    id: p.id,
    name: p.name,
    bankName: p.bank?.name ?? null,
    productTypes: p.productTypes ?? [],
    status: p.status,
    version: p.version ?? 0,
    rev: p.rev ?? 1,
    effectiveUntil: p.effectiveUntil ?? null,
    lastVerifiedAt: p.lastVerifiedAt ?? null,
    stale: p.lastVerifiedAt ? isStale(p, db.clock) : false,
    hasPendingRevision: Boolean(p.pendingRevision),
  }
}
function bankIssues(db, b) {
  const e = {}
  if (b.name.length < 2) e.name = 'Isi nama bank.'
  if (!/^[A-Z0-9]{2,5}$/.test(b.mark)) e.mark = 'Kode bank 2–5 huruf/angka.'
  else if (banksOf(db).some((x) => x.id !== b.id && x.mark === b.mark)) e.mark = 'Kode ini sudah dipakai bank lain.'
  if (typeof b.active !== 'boolean') e.active = 'Pilih status bank.'
  return e
}

const productDetail = (db, p) => ({ asOf: db.clock, product: productRow(db, p), content: contentOf(p), issues: productIssues(db, contentOf(p), true), banks: banksOf(db) })
const productAudit = (db, p, action, extra = {}) => audit(db, { action, resource: { type: 'product', id: p.id, label: p.name }, ...extra })

// ---- admin articles (admin plan §4.5) ----
// Seed content stays in articles.js until the first admin write copies it into db.articles (like the catalog).
// No revision layer: a published edit is live at once, so it needs a reason. The slug is locked once published
// because links and Home picks (widgetData.js) find articles by slug.
const ARTICLE_KEYS = ['title', 'slug', 'tag', 'icon', 'summary', 'minutes', 'body']
const ARTICLE_ICONS = ['percent', 'wallet', 'receipt', 'repeat', 'hand-coins'] // HomePage ARTICLE_ICONS
const articlesOf = (db) => db.articles ?? ARTICLES.map((a) => ({ id: `art_${a.slug}`, ...a, status: 'published', rev: 1, updatedAt: '2026-09-01T02:00:00.000Z' }))
const publishedArticles = (db) => articlesOf(db).filter((a) => a.status === 'published').map((a) => pickFields(a, ARTICLE_KEYS))

function findArticle(db, id) {
  const a = articlesOf(db).find((x) => x.id === id)
  if (!a) fail('RESOURCE_NOT_FOUND', 'Artikel tidak ditemukan.', 404)
  return a
}
function articleInput(values) {
  const v = pickFields(values, ARTICLE_KEYS)
  for (const k of ['title', 'slug', 'tag', 'summary']) if (typeof v[k] === 'string') v[k] = v[k].trim()
  if (Array.isArray(v.body)) v.body = v.body.map((p) => String(p).trim()).filter(Boolean)
  return v
}
// Draft saves need a title and a free, URL-safe slug (archived slugs stay taken); publishing needs every field.
function articleIssues(db, a, full) {
  const e = {}
  if (String(a.title ?? '').length < 3) e.title = 'Isi judul (minimal 3 huruf).'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug ?? '')) e.slug = 'Pakai huruf kecil, angka, dan tanda hubung.'
  else if (articlesOf(db).some((x) => x.id !== a.id && x.slug === a.slug)) e.slug = 'Slug ini sudah dipakai artikel lain.'
  if (!full) return e
  if (!a.tag) e.tag = 'Isi tag.'
  if (!ARTICLE_ICONS.includes(a.icon)) e.icon = 'Pilih ikon.'
  if (String(a.summary ?? '').length < 10) e.summary = 'Isi ringkasan (minimal 10 huruf).'
  if (!(Number.isInteger(a.minutes) && a.minutes >= 1 && a.minutes <= 30)) e.minutes = 'Menit baca 1–30.'
  if (!a.body?.length) e.body = 'Isi minimal satu paragraf.'
  return e
}
const articleRow = ({ id, title, slug, tag, minutes, status, rev, updatedAt }) => ({ id, title, slug, tag: tag ?? null, minutes: minutes ?? null, status, rev, updatedAt })
const articleDetail = (db, a) => ({ article: articleRow(a), content: pickFields(a, ARTICLE_KEYS), issues: articleIssues(db, a, true) })
const articleAudit = (db, a, action, extra = {}) => audit(db, { action, resource: { type: 'article', id: a.id, label: a.title }, ...extra })

// Whether a timestamp or date falls on a day in [from, to] (ISO dates, both inclusive).
const onDays = (iso, from, to) => !!iso && iso.slice(0, 10) >= from && iso.slice(0, 10) <= to
// Chart buckets over [from, to]: single days up to a month, then weeks, then 30-day blocks; the last one may be short.
// ponytail: fixed-length blocks, not calendar weeks or months; switch if reports need calendar alignment.
function dateBuckets(from, to) {
  const span = daysUntil({ fromDate: from, targetDate: to }) + 1
  const step = span <= 31 ? 1 : span <= 92 ? 7 : 30
  const buckets = []
  for (let d = from; d <= to; d = addDays(d, step)) {
    const end = addDays(d, step - 1)
    buckets.push({ from: d, to: end < to ? end : to })
  }
  return buckets
}

// Backend-shaped aggregates for the admin overview (admin plan §4.1); the UI only renders them.
function adminOverview(db) {
  const accounts = userAccounts(db)
  const apps = submittedApps(db)
  const count = (statuses) => apps.filter(({ app }) => statuses.includes(app.status)).length
  const reached = (status) => apps.filter(({ app }) => app.statusHistory.some((h) => h.status === status)).length
  const queue = apps
    .filter(({ app }) => ADMIN_TURN.includes(app.status))
    .map(({ app, user }) => queueRow(db, app, user))
    .sort(longestWaitingFirst)
  const products = productsOf(db)
  const live = products.filter((p) => isAvailable(p, db.clock))
  // Two weeks of incoming applications day by day, plus the two weeks before them for comparison.
  const since = addDays(db.clock, -13)
  const submittedIn = (from, to) => apps.filter(({ app }) => onDays(app.submittedAt, from, to)).length
  return {
    asOf: db.clock,
    recentActivity: (db.auditLog ?? []).slice(0, 5),
    users: { total: accounts.length },
    applications: {
      byStatus: apps.reduce((acc, { app }) => ({ ...acc, [app.status]: (acc[app.status] ?? 0) + 1 }), {}),
      needsReview: count(['submitted', 'docs_verification']),
      waitingOnUser: count(['additional_docs_requested']),
      atBank: count(AT_BANK),
      funnel: { submitted: reached('submitted'), approved: reached('approved'), disbursed: reached('disbursed') },
      trend: dateBuckets(since, db.clock).map(({ from, to }) => ({ from, to, submitted: submittedIn(from, to) })),
      previousSubmitted: submittedIn(addDays(since, -14), addDays(since, -1)),
      queue,
    },
    products: {
      active: live.length,
      draft: catalogOf(db).filter((p) => p.status === 'draft').length,
      expired: products.filter((p) => p.effectiveUntil < db.clock).length,
      stale: live.filter((p) => isStale(p, db.clock)).length,
      nearestExpiry: [...live]
        .sort((a, b) => a.effectiveUntil.localeCompare(b.effectiveUntil))
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          bankName: p.bank.name,
          name: p.name,
          productTypes: p.productTypes,
          effectiveUntil: p.effectiveUntil,
          daysLeft: daysUntil({ fromDate: db.clock, targetDate: p.effectiveUntil }),
          lastVerifiedAt: p.lastVerifiedAt,
          stale: isStale(p, db.clock),
        })),
    },
  }
}

// ---- admin reports (admin plan §4.6) ----
// Totals count what happened inside the period; the stage table follows the applications submitted in it, up to
// today. Dates compare by ISO date (UTC in the mock; the backend timezone is open question §12 Q5).
const REPORT_STAGES = ['submitted', 'docs_verification', 'bank_processing', 'appraisal', 'approved', 'akad', 'disbursed']
const enteredAt = (app, status) => app.statusHistory.find((h) => h.status === status)?.at ?? null

function reportScope(db, { from, to, productType, bankName } = {}) {
  const filters = { from: from || addDays(db.clock, -29), to: to || db.clock, productType: productType || null, bankName: bankName || null }
  const e = {}
  if (!parseIsoDate(filters.from)) e.from = 'Pilih tanggal mulai.'
  if (!parseIsoDate(filters.to)) e.to = 'Pilih tanggal akhir.'
  else if (!e.from && filters.from > filters.to) e.to = 'Tanggal akhir tidak boleh sebelum tanggal mulai.'
  failOnFields(e, 'Periksa rentang tanggal.')
  const inPeriod = (iso) => onDays(iso, filters.from, filters.to)
  const matches = (app) => (!filters.productType || app.productType === filters.productType) && (!filters.bankName || app.selection?.bankName === filters.bankName)
  const accounts = userAccounts(db)
  const apps = accounts.flatMap((a) => a.applications).filter(matches)
  const cohort = apps.filter((app) => inPeriod(app.submittedAt)).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  return { filters, inPeriod, matches, accounts, apps, cohort }
}

const reachedIn = (app, status, inRange) => app.statusHistory.some((h) => h.status === status && inRange(h.at))
function periodTotals({ inPeriod, matches, accounts, apps, cohort }) {
  const registered = accounts.filter((a) => inPeriod(a.user.createdAt))
  const reached = (status) => apps.filter((app) => reachedIn(app, status, inPeriod)).length
  return {
    users: { registered: registered.length, withApplication: registered.filter((a) => a.applications.some(matches)).length },
    applications: { created: apps.filter((app) => inPeriod(app.createdAt)).length, submitted: cohort.length, approved: reached('approved'), rejected: reached('rejected'), disbursed: reached('disbursed') },
  }
}

function adminReport(db, params) {
  const scope = reportScope(db, params)
  const { filters, inPeriod, accounts, apps, cohort } = scope
  // The same number of days right before the period, so each total can say how it moved.
  const span = daysUntil({ fromDate: filters.from, targetDate: filters.to }) + 1
  const previous = reportScope(db, { ...filters, from: addDays(filters.from, -span), to: addDays(filters.from, -1) })
  const days = (from, to) => (Date.parse(to) - Date.parse(from)) / 86_400_000
  const stages = REPORT_STAGES.map((status, i) => {
    const entered = cohort.filter((app) => enteredAt(app, status))
    const next = REPORT_STAGES[i + 1]
    const spans = next ? entered.filter((app) => enteredAt(app, next)).map((app) => days(enteredAt(app, status), enteredAt(app, next))) : []
    return { status, count: entered.length, avgDays: spans.length ? Math.round((spans.reduce((s, d) => s + d, 0) / spans.length) * 10) / 10 : null }
  })
  // Selection is the demand signal, so drafts count here (aggregated only).
  const picked = new Map()
  for (const { selection: s, productType } of apps.filter((app) => app.selection && inPeriod(app.createdAt))) {
    const row = picked.get(s.bankProductId) ?? { id: s.bankProductId, bankName: s.bankName, productName: s.productName, productType, count: 0 }
    picked.set(s.bankProductId, { ...row, count: row.count + 1 })
  }
  return {
    asOf: db.clock,
    filters,
    banks: [...new Set(accounts.flatMap((a) => a.applications).map((app) => app.selection?.bankName).filter(Boolean))].sort(),
    ...periodTotals(scope),
    previous: { from: previous.filters.from, to: previous.filters.to, ...periodTotals(previous) },
    trend: dateBuckets(filters.from, filters.to).map(({ from, to }) => {
      const inBucket = (iso) => onDays(iso, from, to)
      return { from, to, submitted: apps.filter((app) => inBucket(app.submittedAt)).length, approved: apps.filter((app) => reachedIn(app, 'approved', inBucket)).length }
    }),
    stages: stages.map((s, i) => ({ ...s, conversionBps: i && stages[i - 1].count ? Math.round((s.count * 10_000) / stages[i - 1].count) : null })),
    products: [...picked.values()].sort((a, b) => b.count - a.count || a.productName.localeCompare(b.productName)),
  }
}

// Whitelisted columns only: no name, contact, NIK, or documents ever leave in an export.
const CSV_COLUMNS = [
  ['id_pengajuan', (app) => app.id],
  ['jenis_produk', (app) => app.productType],
  ['bank', (app) => app.selection?.bankName],
  ['produk', (app) => app.selection?.productName],
  ['status', (app) => app.status],
  ['dibuat', (app) => app.createdAt?.slice(0, 10)],
  ['diajukan', (app) => app.submittedAt?.slice(0, 10)],
  ['disetujui', (app) => enteredAt(app, 'approved')?.slice(0, 10)],
  ['ditolak', (app) => enteredAt(app, 'rejected')?.slice(0, 10)],
  ['cair', (app) => enteredAt(app, 'disbursed')?.slice(0, 10)],
]
// Text a spreadsheet would run as a formula gets a leading ' (OWASP CSV injection), then RFC 4180 quoting.
function csvCell(value) {
  const s = String(value ?? '')
  const inert = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(inert) ? `"${inert.replaceAll('"', '""')}"` : inert
}

// ---- admin configuration (admin plan §4.7) ----
// Settings start at the values the app shipped with; the first admin save copies them into db.config. Reminder
// defaults only shape KPRs set up later: reminders a user already saved are theirs.
const DEFAULT_CONFIG = { version: 1, reminders: DEFAULT_REMINDERS, upload: DEFAULT_UPLOAD }
const configOf = (db) => db.config ?? DEFAULT_CONFIG
const CONFIG_LABEL = { reminders: 'Pengingat default', upload: 'Unggah dokumen' }

function configInput(section, v = {}) {
  const desc = (list) => [...new Set(list ?? [])].sort((a, b) => b - a)
  if (section === 'reminders') return { payment: desc(v.payment), fixedExpiry: desc(v.fixedExpiry), channels: { inApp: !!v.channels?.inApp, email: !!v.channels?.email, whatsapp: !!v.channels?.whatsapp } }
  return { maxFileMb: v.maxFileMb, formats: Object.keys(UPLOAD_FORMATS).filter((f) => v.formats?.includes(f)) }
}
function configIssues(section, v) {
  if (section === 'reminders') {
    const e = validateReminders(v)
    if (v.payment.some((n) => ![7, 3, 1, 0].includes(n))) e.payment = 'Pilih dari H-7, H-3, H-1, atau Hari-H.'
    if (v.fixedExpiry.some((n) => !FIXED_MILESTONES.includes(n))) e.fixedExpiry = 'Pilih dari H-90 sampai H-7.'
    if (v.channels.whatsapp) e.channels = 'WhatsApp belum tersedia.'
    return e
  }
  return {
    ...(!(Number.isInteger(v.maxFileMb) && v.maxFileMb >= 1 && v.maxFileMb <= 20) && { maxFileMb: 'Isi ukuran 1–20 MB.' }),
    ...(!v.formats.length && { formats: 'Pilih minimal satu format.' }),
  }
}

// KPR Health versions are append-only: publishing adds a version, a rollback republishes an old one as a new
// version, and the newest is the one in force. Version 1 is the formula in derive.js.
const SEEDED_HEALTH = { ...HEALTH_V1, reason: 'Formula awal KPR Health', publishedAt: '2026-09-01T02:00:00.000Z', publishedBy: null, rollbackOf: null }
const healthVersionsOf = (db) => db.healthConfigs ?? [SEEDED_HEALTH]
const activeHealth = (db) => healthVersionsOf(db).at(-1)
const healthDetail = (db) => ({ active: activeHealth(db), versions: [...healthVersionsOf(db)].reverse().map(({ params: _p, ...v }) => v) })

function healthIssues(p) {
  const score = (s) => Number.isInteger(s) && s >= 0 && s <= 100
  // Limits rise band by band; the last band is open (`upTo: null`).
  const bands = (list, max) =>
    Array.isArray(list) &&
    list.length >= 2 &&
    list.every((b, i) => score(b?.score) && (i === list.length - 1 ? b.upTo === null : Number.isInteger(b.upTo) && b.upTo > 0 && b.upTo <= max && (i === 0 || b.upTo > list[i - 1].upTo)))
  const weights = ['dti', 'ltv', 'rate', 'progress'].map((k) => p?.weights?.[k])
  const e = {}
  if (!bands(p?.dti, 10_000)) e.dti = 'Batas harus naik dari baris ke baris (maks. 100%), skor 0–100.'
  if (!bands(p?.ltv, 20_000)) e.ltv = 'Batas harus naik dari baris ke baris (maks. 200%), skor 0–100.'
  if (!score(p?.rate?.floating) || !bands(p?.rate?.fixedDays, 3650)) e.rate = 'Batas hari harus naik dari baris ke baris, skor 0–100.'
  if (!score(p?.progress?.base) || !score(p?.progress?.perPaid)) e.progress = 'Skor dasar dan tambahan 0–100.'
  if (!weights.every((w) => Number.isInteger(w) && w >= 0 && w <= 10) || !weights.some((w) => w > 0)) e.weights = 'Bobot 0–10, minimal satu lebih dari 0.'
  if (!(score(p?.labels?.healthy) && score(p?.labels?.attention) && p.labels.attention < p.labels.healthy)) e.labels = 'Ambang Sehat harus lebih tinggi dari ambang Perlu perhatian.'
  return e
}
// Only the known keys are stored (call after healthIssues passes).
const healthInput = ({ dti, ltv, rate, progress, weights, labels }) => {
  const band = (list) => list.map(({ upTo, score }) => ({ upTo, score }))
  return {
    dti: band(dti),
    ltv: band(ltv),
    rate: { floating: rate.floating, fixedDays: band(rate.fixedDays) },
    progress: { base: progress.base, perPaid: progress.perPaid },
    weights: { dti: weights.dti, ltv: weights.ltv, rate: weights.rate, progress: weights.progress },
    labels: { healthy: labels.healthy, attention: labels.attention },
  }
}
function publishHealth(db, { params, reason, rollbackOf, action }) {
  db.healthConfigs ??= structuredClone(healthVersionsOf(db))
  const before = activeHealth(db)
  const v = { version: before.version + 1, params, reason: reason.trim(), publishedAt: nowIso(db), publishedBy: { id: db.user.id, name: db.user.name }, rollbackOf }
  db.healthConfigs.push(v)
  audit(db, { action, resource: { type: 'health_config', id: `v${v.version}`, label: `KPR Health v${v.version}` }, reason, before: { version: before.version }, after: { version: v.version } })
  return healthDetail(db)
}

// Before/after on the seed scenarios a reviewer already knows, plus two synthetic edges (admin plan §4.7).
const HEALTH_FIXTURES = [
  ['mortgage_active_normal', 'KPR fixed, kondisi normal'],
  ['mortgage_active_h90', 'Fixed berakhir < 90 hari'],
  ['mortgage_active_floating', 'Sudah floating'],
  ['mortgage_partial_property', 'Nilai properti belum diisi'],
]
function healthFixtures() {
  const seeded = HEALTH_FIXTURES.map(([key, label]) => ({ key, label, m: createSeed(key).mortgages[0] }))
  const { m } = seeded[0]
  const debts = m.finance.vehicleDebt + m.finance.cardDebt + m.finance.otherDebt
  return [
    ...seeded,
    { key: 'high_dti', label: 'Rasio cicilan 48% (sintetis)', m: { ...m, finance: { ...m.finance, monthlyIncome: Math.round((m.currentPayment + debts) / 0.48) } } },
    { key: 'high_ltv', label: 'LTV 92% (sintetis)', m: { ...m, property: { ...m.property, estimatedValue: Math.round(m.outstandingPrincipal / 0.92) } } },
  ]
}
const scoreOf = ({ score, label, tone, partial }) => ({ score, label, tone, partial })

// The uploaded file becomes the document on record; a re-upload the bank asked for clears that pending action and,
// when none is left, returns the application to verification. `extra` carries the Storage path in Supabase mode.
export function recordDocument(db, app, documentType, file, extra = {}) {
  const replacing = app.documents[documentType]?.status === 'needs_update'
  if (app.status !== 'draft' && !replacing) fail('INVALID_STATE_TRANSITION', 'Dokumen hanya bisa diganti jika diminta tim RuangKPR.', 400)
  app.documents[documentType] = { status: 'uploaded', fileName: file.name, sizeBytes: file.size, contentType: file.type, uploadedAt: nowIso(db), invalidReason: null, ...extra }
  if (replacing) {
    app.pendingActions = app.pendingActions.filter((a) => a.documentType !== documentType)
    pushActivity(db, { type: 'document_replaced', category: 'application', title: `${DOC_LABELS[documentType]} terbaru terkirim`, body: 'Menunggu verifikasi dari tim RuangKPR.', action: { label: 'Lihat status', route: '/my-kpr/application' } })
    if (!app.pendingActions.length && app.status === 'additional_docs_requested') {
      app.status = 'docs_verification'
      app.statusHistory.push({ status: 'docs_verification', at: nowIso(db) })
    }
  }
  touch(db, app)
}

// The browser demo: everything lives in localStorage (mockDb.js).
const localStore = { load: () => loadDb(), save: (db) => saveDb(db) }

// ---------- adapter ----------
// `store` is where an operation reads its data and writes back what it changed: localStore for the demo and tests,
// supabaseStore for the real backend (spec 2026-10-09, Amandemen). A store save that finds a row changed meanwhile
// rejects with `conflict`; the operation then runs again on fresh data.
export function createMockApi({ latencyMs = 300, store = localStore } = {}) {
  const call =
    (name, fn, { auth = true, admin = false } = {}) =>
    async (...args) => {
      const seq = ++callSeq
      if (latencyMs) await sleep(latencyMs)
      maybeFail(name, seq)
      for (let attempt = 1; ; attempt += 1) {
        const db = await store.load({ admin: Boolean(admin) })
        if (auth && db.session.status !== 'authenticated') fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
        // admin: true = super admin only; a module name also lets the roles that own it through (roles.js).
        if (admin && !canOpen(db.user.role, admin === true ? null : admin)) fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.', 403)
        const result = fn(db, ...args)
        try {
          await store.save(db)
        } catch (e) {
          if (e?.conflict && attempt < 3) continue
          throw e
        }
        return clone(result)
      }
    }

  return {
    auth: {
      getSession: call(
        'auth.getSession',
        (db) => ({
          status: db.session.status,
          role: db.session.status === 'authenticated' ? db.user.role : null,
          user: db.user,
          verification: db.session.verification ? { maskedDestination: db.session.verification.maskedDestination, resendAvailableAt: db.session.verification.resendAvailableAt } : null,
        }),
        { auth: false },
      ),
      // Mock "Google": signs straight into the demo Google account (seed GOOGLE_DEMO).
      signInWithGoogle: call(
        'auth.signInWithGoogle',
        (db) => {
          signInAs(db, GOOGLE_DEMO.email, GOOGLE_DEMO.name)
          return { user: db.user }
        },
        { auth: false },
      ),
      // Mock Google is always on (Supabase asks the auth server).
      providers: async () => ({ google: true }),
      signInWithPassword: call(
        'auth.signInWithPassword',
        (db, values = {}) => {
          const email = normalize(values.email)
          failOnFields(validateLogin({ ...values, email }), 'Periksa kembali data kamu.')
          if (!hasAccount(db, email) || passwordOf(db, email) !== values.password) fail('INVALID_CREDENTIALS', 'Email atau password salah.', 400)
          signInAs(db, email)
          return { user: db.user }
        },
        { auth: false },
      ),
      // The account exists once its email is verified, already agreed to the terms on the form.
      signUp: call(
        'auth.signUp',
        (db, values = {}) => {
          const email = normalize(values.email)
          failOnFields(validateRegister({ ...values, email }), 'Periksa kembali data kamu.')
          if (hasAccount(db, email)) fail('EMAIL_TAKEN', 'Email ini sudah terdaftar. Masuk atau pakai Lupa password.', 409)
          const verification = { contact: email, name: values.name.trim(), password: values.password, maskedDestination: maskEmail(email), resendAvailableAt: Date.now() + OTP_COOLDOWN_MS, attemptsRemaining: 5 }
          db.session = { status: 'pending', verification }
          return { maskedDestination: verification.maskedDestination, resendAvailableAt: verification.resendAvailableAt }
        },
        { auth: false },
      ),
      verifySignup: call(
        'auth.verifySignup',
        (db, { token } = {}) => {
          const v = db.session.verification
          if (db.session.status !== 'pending' || !v) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
          if (!/^\d{6}$/.test(String(token))) fail('VALIDATION_FAILED', 'Kode harus 6 angka.', 400)
          if (token === OTP_EXPIRED || v.attemptsRemaining <= 0) fail('OTP_EXPIRED', 'Kode kedaluwarsa. Kirim ulang kode baru.', 401)
          if (token !== OTP_OK) {
            v.attemptsRemaining -= 1
            saveDb(db)
            fail('OTP_INVALID', token === OTP_WRONG ? 'Kode salah. Coba lagi.' : 'Kode salah atau kedaluwarsa. Coba lagi.', 401)
          }
          setPassword(db, v.contact, v.password)
          signInAs(db, v.contact, v.name)
          agree(db, v.name)
          return { user: db.user }
        },
        { auth: false },
      ),
      // Same answer whether or not the email has an account; only an account gets a link (db.resetLink).
      requestPasswordReset: call(
        'auth.requestPasswordReset',
        (db, { email } = {}) => {
          const value = normalize(email)
          failOnFields(validateEmail({ email: value }), 'Masukkan email yang valid.')
          db.resetLink = hasAccount(db, value) ? value : null
          return { maskedDestination: maskEmail(value), resendAvailableAt: Date.now() + OTP_COOLDOWN_MS }
        },
        { auth: false },
      ),
      // Mock only: what opening the emailed link does. The account is signed in, waiting for its new password.
      openResetLink: call(
        'auth.openResetLink',
        (db) => {
          if (!db.resetLink) fail('OTP_INVALID', 'Link reset tidak valid atau kedaluwarsa. Minta link baru.', 401)
          signInAs(db, db.resetLink)
          db.resetLink = null
          db.session = { status: 'recovery', verification: null }
          return { user: db.user }
        },
        { auth: false },
      ),
      updatePassword: call(
        'auth.updatePassword',
        (db, values = {}) => {
          if (db.session.status !== 'recovery') fail('INVALID_STATE_TRANSITION', 'Buka link reset password dari email dulu.', 400)
          failOnFields(validateNewPassword(values), 'Periksa kembali password baru kamu.')
          setPassword(db, db.user.contact, values.password)
          db.session = { status: consented(db) ? 'authenticated' : 'onboarding', verification: null }
          return { user: db.user }
        },
        { auth: false },
      ),
      changePassword: call('auth.changePassword', (db, values = {}) => {
        failOnFields(validateChangePassword(values), 'Periksa kembali password kamu.')
        if (passwordOf(db, db.user.contact) !== values.currentPassword) fail('VALIDATION_FAILED', 'Password lama salah.', 400, { fieldErrors: [{ field: 'currentPassword', message: 'Password lama salah.' }] })
        setPassword(db, db.user.contact, values.password)
        return { changed: true }
      }),
      acceptConsents: call(
        'auth.acceptConsents',
        (db, values = {}) => {
          if (db.session.status !== 'onboarding') fail('INVALID_STATE_TRANSITION', 'Persetujuan sudah tercatat.', 400)
          failOnFields(validateWelcome(values), 'Periksa kembali data kamu.')
          agree(db, values.name.trim())
          return { user: db.user }
        },
        { auth: false },
      ),
      resendOtp: call(
        'auth.resendOtp',
        (db) => {
          const v = db.session.verification
          if (db.session.status !== 'pending' || !v) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
          const wait = Math.ceil((v.resendAvailableAt - Date.now()) / 1000)
          if (wait > 0) fail('RATE_LIMITED', `Tunggu ${wait} detik untuk kirim ulang.`, 429, { retryable: true, details: { retryAfterSeconds: wait } })
          v.resendAvailableAt = Date.now() + OTP_COOLDOWN_MS
          v.attemptsRemaining = 5
          return { resendAvailableAt: v.resendAvailableAt }
        },
        { auth: false },
      ),
      logout: call(
        'auth.logout',
        (db) => {
          db.session = { status: 'guest', verification: null }
          return { loggedOut: true }
        },
        { auth: false },
      ),
      deleteAccount: call('auth.deleteAccount', (db) => {
        if (db.applications.some((a) => IN_PROCESS.includes(a.status))) fail('INVALID_STATE_TRANSITION', 'Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun.', 400)
        // In place: `call` saves this same object afterwards. Clear first so keys outside the seed (kept) go too.
        // Only the signed-in account goes: other accounts in this browser, their passwords and the id sequence stay.
        const { accounts, seq, passwords } = db
        const { [db.user.contact]: _gone, ...kept } = passwords ?? {}
        Object.keys(db).forEach((k) => delete db[k])
        Object.assign(db, createSeed('guest'), { accounts, seq, passwords: kept })
        return { deleted: true }
      }),
    },

    dashboard: {
      getSnapshot: call('dashboard.getSnapshot', (db) => ({
        clock: db.clock,
        user: db.user,
        profile: db.profile,
        finance: db.finance,
        applications: db.applications.map(decorate),
        mortgages: db.mortgages.map((m) => mortgageAsOf(m, db.clock)),
        simulation: db.simulation,
        unreadActivities: db.activities.filter((a) => !a.readAt).length,
        dashboardLayout: savedLayout(db),
        toursSeen: db.toursSeen ?? [],
        // What pages need from admin configuration: the live KPR Health version, reminder defaults, upload limits.
        config: { health: (({ version, params }) => ({ version, params }))(activeHealth(db)), reminders: configOf(db).reminders, upload: configOf(db).upload },
      })),
      // null restores the default board; a missing field means the user never customised it.
      saveLayout: call('dashboard.saveLayout', (db, layout) => {
        if (layout !== null && !Array.isArray(layout)) fail('VALIDATION_FAILED', 'Susunan dashboard tidak valid.', 400)
        if (layout === null) delete db.dashboardLayout
        else db.dashboardLayout = normalizeLayout(layout)
        return savedLayout(db)
      }),
      // Page tours auto-run once; the "Panduan" button replays them without touching this list.
      markTourSeen: call('dashboard.markTourSeen', (db, id) => {
        if (!Object.hasOwn(TOURS, id)) fail('VALIDATION_FAILED', 'Panduan tidak dikenal.', 400)
        db.toursSeen = [...new Set([...(db.toursSeen ?? []), id])]
        return db.toursSeen
      }),
    },

    profile: {
      get: call('profile.get', (db) => ({ ...db.profile, finance: db.finance })),
      update: call('profile.update', (db, values) => {
        const { finance, ...profile } = values
        db.profile = { ...db.profile, ...profile }
        if (finance) applyFinance(db, finance)
        return { ...db.profile, finance: db.finance }
      }),
    },

    applications: {
      get: call('applications.get', (db, id) => decorate(findApp(db, id))),
      create: call('applications.create', (db, { productType, purchaseType, mode, mortgageId }) => {
        const current = activeApplication(db.applications)
        if (current) fail('ACTIVE_DRAFT_EXISTS', 'Kamu masih punya pengajuan aktif. Lanjutkan atau hapus dulu.', 409, { details: { applicationId: current.id } })
        if (productType === 'primary' && activeMortgageOf(db)) {
          fail('ACTIVE_MORTGAGE_EXISTS', 'Versi ini mendukung satu KPR aktif per akun.', 409)
        }
        if (productType === 'takeover' && mortgageId) {
          // Take Over from a monitored KPR with skipped data: prefilled with Peluang's default goal, so it opens the missing
          // forms and then the bank list.
          const m = mortgageAsOf(findMortgage(db, mortgageId), db.clock)
          const app = newApplication(db, { productType, mode, source: 'mortgage', mortgageId: m.id, data: takeoverDataFromMortgage(m, { personal: prefilledPersonal(db), employment: prefilledEmployment(db), goal: defaultTakeoverGoal(m, mode ?? 'takeover') }) })
          app.currentStep = 5
          return app
        }
        // A cancelled application left what was typed behind (see cancel): start from it.
        const kept = structuredClone(db.kept?.[productType] ?? {})
        const data =
          productType === 'primary'
            ? { personal: prefilledPersonal(db), employment: prefilledEmployment(db), property: kept.property ?? { purchaseType }, loan: kept.loan ?? {} }
            : { personal: prefilledPersonal(db), employment: prefilledEmployment(db), oldLoan: kept.oldLoan ?? {}, goal: { mode: mode ?? null }, property: kept.property ?? {}, finance: kept.finance ?? {} }
        return newApplication(db, { productType, mode, data })
      }),
      saveStep: call('applications.saveStep', (db, id, { step, values }) => {
        const app = findApp(db, id)
        if (app.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Pengajuan sudah dikirim dan hanya bisa dilihat.', 400)
        const before = pricingInputs(app)
        const previousPurchase = app.data.property?.purchaseType
        for (const [section, patch] of Object.entries(values)) app.data[section] = { ...(app.data[section] ?? {}), ...patch }
        if (values.goal?.mode) app.optimizationMode = values.goal.mode
        if (app.productType === 'primary' && previousPurchase && app.data.property.purchaseType !== previousPurchase) {
          app.data.property.developerName = null
          app.data.property.sellerName = null
          delete app.documents.property_document
        }
        if (app.selection && before !== pricingInputs(app)) {
          app.selection = null
          if (app.productType === 'primary') app.currentStep = Math.min(app.currentStep, 5)
        }
        syncProfile(db, values)
        app.currentStep = Math.min(app.stepCount, Math.max(app.currentStep, step + 1))
        touch(db, app)
        return decorate(app)
      }),
      removeDocument: call('applications.removeDocument', (db, id, documentType) => {
        const app = findApp(db, id)
        if (app.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Dokumen terkirim tidak bisa dihapus.', 400)
        delete app.documents[documentType]
        touch(db, app)
        return decorate(app)
      }),
      // Upload progress happens before the transaction so parallel uploads never overwrite each other.
      uploadDocument: async (id, { documentType, file }, { onProgress } = {}) => {
        const seq = ++callSeq
        if (latencyMs) await sleep(latencyMs / 2)
        const problem = uploadProblem(file, configOf(await store.load({ admin: false })).upload)
        if (problem) fail(problem.code, problem.message, problem.status)
        for (const pct of [20, 45, 70, 90]) {
          if (latencyMs) await sleep(Math.max(80, latencyMs / 2))
          onProgress?.(pct)
        }
        maybeFail('applications.uploadDocument', seq)
        const db = await store.load({ admin: false })
        if (db.session.status !== 'authenticated') fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
        const app = findApp(db, id)
        if (app.status !== 'draft' && app.documents[documentType]?.status !== 'needs_update') fail('INVALID_STATE_TRANSITION', 'Dokumen hanya bisa diganti jika diminta tim RuangKPR.', 400)
        if (db.flags?.uploadFailOnce && !db.flags.failedUploads.includes(documentType)) {
          db.flags.failedUploads.push(documentType)
          await store.save(db)
          fail('SERVICE_UNAVAILABLE', 'Upload gagal. Periksa koneksi lalu coba lagi.', 503, { retryable: true })
        }
        recordDocument(db, app, documentType, file)
        await store.save(db)
        onProgress?.(100)
        return clone(decorate(app))
      },
      // A file already kept elsewhere (Supabase Storage): record it the same way an upload is recorded.
      attachDocument: call('applications.attachDocument', (db, id, { documentType, file, path }) => {
        const app = findApp(db, id)
        recordDocument(db, app, documentType, file, { path })
        return decorate(app)
      }),
      selectProgram: call('applications.selectProgram', (db, id, { bankProductId, loanAmount, tenorMonths }) => {
        const app = findApp(db, id)
        if (app.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Pengajuan sudah dikirim.', 400)
        const product = productsOf(db).find((p) => p.id === bankProductId)
        if (!product || !isAvailable(product, db.clock)) fail('BANK_PRODUCT_EXPIRED', 'Program ini sudah tidak tersedia. Pilih program lain.', 410)
        const { price } = app.data.property
        const dp = app.data.loan.downPayment ?? 0
        if (!(loanAmount > 0) || loanAmount > price - dp) fail('VALIDATION_FAILED', 'Jumlah pinjaman tidak boleh melebihi Harga − DP.', 400)
        if (loanAmount !== app.data.loan.amount || tenorMonths !== app.data.loan.tenorMonths) {
          app.data.loan = { ...app.data.loan, amount: loanAmount, tenorMonths, amountEdited: loanAmount !== price - dp }
        }
        const sim = simulateLoan({ product, principal: loanAmount, termMonths: tenorMonths })
        app.selection = selectionFrom(product, {
          fixedRateBps: sim.fixedRateBps,
          fixedMonths: sim.fixedMonths,
          floatingRateBps: sim.floatingRateBps,
          loanAmount,
          tenorMonths,
          estimatedPayment: sim.payment,
          paymentAfterFixed: sim.paymentAfterFixed,
          totalPayment: sim.totalPayment,
          lastVerifiedAt: product.lastVerifiedAt,
        })
        app.currentStep = Math.max(app.currentStep, app.productType === 'primary' ? 6 : 5)
        touch(db, app)
        return decorate(app)
      }),
      submit: call('applications.submit', (db, id, { consents }) => {
        const app = decorate(findApp(db, id))
        if (app.status !== 'draft') fail('APPLICATION_ALREADY_SUBMITTED', 'Pengajuan ini sudah dikirim.', 409)
        const missing = app.requiredDocuments.filter((d) => d.required && !['uploaded', 'verified'].includes(app.documents[d.type]?.status))
        if (missing.length) fail('DOCUMENTS_INCOMPLETE', `Lengkapi dokumen wajib: ${missing.map((d) => d.label).join(', ')}.`, 422)
        if (!app.selection) fail('VALIDATION_FAILED', 'Pilih satu program bank dulu.', 400)
        const product = productsOf(db).find((p) => p.id === app.selection.bankProductId)
        if (!product || !isAvailable(product, db.clock) || product.version !== app.selection.productVersion) {
          fail('BANK_PRODUCT_EXPIRED', 'Program yang dipilih sudah berubah. Bandingkan ulang sebelum submit.', 410)
        }
        if (!consents?.dataAccuracy || !consents?.sendToBank) fail('CONSENT_REQUIRED', 'Centang kedua persetujuan untuk submit.', 422)
        const p = app.data.personal ?? {}
        if (!p.fullName || !/^\d{16}$/.test(p.nik ?? '')) fail('VALIDATION_FAILED', 'Data pribadi belum lengkap.', 400)
        if (app.productType === 'takeover' && takeoverGaps(app.data, { today: db.clock, mode: app.optimizationMode }).length) {
          fail('VALIDATION_FAILED', 'Lengkapi data pengajuan dulu.', 400)
        }
        app.status = 'submitted'
        app.submittedAt = nowIso(db)
        app.consents = { ...consents, acceptedAt: app.submittedAt, version: '2026-09-01' }
        app.statusHistory = [{ status: 'submitted', at: app.submittedAt }]
        app.snapshot = { data: structuredClone(app.data), selection: structuredClone(app.selection), productVersion: product.version, calculationVersion: 'calc-1.0.0', capturedAt: app.submittedAt }
        app.lastRejection = null
        touch(db, app)
        pushActivity(db, {
          type: 'application_submitted',
          category: 'application',
          title: `Pengajuan terkirim ke ${app.selection.bankName}`,
          body: `${app.productType === 'primary' ? 'KPR Primary' : app.optimizationMode === 'topup' ? 'Take Over + Top-up' : 'Take Over'} · ${app.selection.productName}`,
          action: { label: 'Lihat status', route: '/my-kpr/application' },
        })
        return app
      }),
      // The application goes; what the user typed and uploaded stays for the next draft (personal and job data already
      // live on the profile), unless they ask to forget it. `unusedFiles`: stored files nothing points to any more.
      cancel: call('applications.cancel', (db, id, { keepData = true } = {}) => {
        const app = findApp(db, id)
        if (!CANCELLABLE.includes(app.status)) fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa dibatalkan.', 400)
        const files = [...docPaths(app.documents), ...docPaths(db.kept?.documents)]
        if (keepData) {
          const d = app.data
          // This application's documents win for every type it asks for, so one the team turned back or the user
          // removed is not brought back; other types (the other product's) stay as they were.
          const documents = { ...db.kept?.documents }
          for (const { type } of requiredDocuments(app)) delete documents[type]
          db.kept = structuredClone({
            ...db.kept,
            [app.productType]: app.productType === 'primary' ? { property: d.property, loan: d.loan } : { oldLoan: d.oldLoan, property: d.property, finance: d.finance },
            documents: freshDocuments({ ...documents, ...app.documents }),
          })
        } else db.kept = null
        db.applications = db.applications.filter((a) => a.id !== id)
        if (db.simulation?.source?.id === id) db.simulation = null
        if (app.status !== 'draft') pushActivity(db, { type: 'application_cancelled', category: 'application', title: 'Pengajuan dibatalkan', body: keepData ? 'Pengajuan sudah ditarik. Data dan dokumen yang kamu isi tetap tersimpan untuk pengajuan berikutnya.' : 'Pengajuan, data, dan dokumen terkait sudah dihapus.' })
        const used = new Set([...docPaths(db.kept?.documents), ...db.applications.flatMap((a) => docPaths(a.documents))])
        return { deleted: true, wasDraft: app.status === 'draft', unusedFiles: [...new Set(files)].filter((p) => !used.has(p)) }
      }),
      retrySameBank: call('applications.retrySameBank', (db, id) => {
        const app = findApp(db, id)
        if (app.status !== 'rejected' || app.superseded) fail('INVALID_STATE_TRANSITION', 'Pengajuan ini tidak bisa diajukan ulang.', 400)
        app.lastRejection = app.rejection
        app.rejection = null
        app.status = 'draft'
        app.currentStep = app.lastRejection?.relevantStep ?? 2
        app.consents = null
        app.snapshot = null
        app.submittedAt = null
        // A new attempt: the team checks every document again and the old stage notes no longer apply.
        app.documents = freshDocuments(app.documents)
        app.stageNotes = {}
        app.statusHistory.push({ status: 'draft', at: nowIso(db) })
        touch(db, app)
        return decorate(app)
      }),
      cloneToBank: call('applications.cloneToBank', (db, id) => {
        const old = findApp(db, id)
        if (old.status !== 'rejected' || old.superseded) fail('INVALID_STATE_TRANSITION', 'Pengajuan ini tidak bisa disalin.', 400)
        old.superseded = true
        const app = newApplication(db, { productType: old.productType, mode: old.optimizationMode, source: old.source, mortgageId: old.mortgageId, data: structuredClone(old.data) })
        app.documents = freshDocuments(old.documents)
        app.excludedProductIds = [...(old.excludedProductIds ?? []), old.selection?.bankProductId].filter(Boolean)
        app.currentStep = 5 // Primary: compare; Take Over: Tujuan, then baseline
        pushActivity(db, { type: 'application_cloned', category: 'application', title: 'Data disalin ke pengajuan baru', body: `Pengajuan ke ${old.selection?.bankName ?? 'bank sebelumnya'} tetap tersimpan sebagai riwayat.` })
        return decorate(app)
      }),
    },

    bankProducts: {
      compare: call('bankProducts.compare', (db, { applicationId, sort = 'total' }) => {
        const app = findApp(db, applicationId)
        const result = comparePrimaryPrograms({ products: productsOf(db), input: primaryInput(app), asOf: db.clock, sort })
        return { ...result, previouslyRejectedProductIds: app.excludedProductIds ?? [] }
      }),
      affordability: call('bankProducts.affordability', (db, { applicationId }) =>
        primaryAffordability({ products: productsOf(db), input: profileInput(findApp(db, applicationId)), asOf: db.clock }),
      ),
    },

    mortgages: {
      createSetup: call('mortgages.createSetup', (db) => {
        if (activeMortgageOf(db)) fail('ACTIVE_MORTGAGE_EXISTS', 'KPR kamu sudah dipantau. Versi ini mendukung satu KPR aktif.', 409)
        const draft = db.mortgages.find((m) => m.status === 'draft')
        if (draft) return draft
        const m = { id: nextId(db, 'mtg'), status: 'draft', setupStep: 1, source: 'monitoring', finance: { ...db.finance }, reminders: structuredClone(configOf(db).reminders), payments: [], rateHistory: [], version: 1, createdAt: nowIso(db) }
        db.mortgages.unshift(m)
        return m
      }),
      saveSetupStep: call('mortgages.saveSetupStep', (db, id, { step, values }) => {
        const m = findMortgage(db, id)
        if (m.status !== 'draft' && m.status !== 'active') fail('INVALID_STATE_TRANSITION', 'Data KPR ini tidak bisa diubah.', 400)
        if (values.reminders && (!values.reminders.payment.length || !(values.reminders.channels.inApp || values.reminders.channels.email))) {
          fail('VALIDATION_FAILED', 'Pilih minimal satu jadwal pembayaran dan satu kanal.', 400)
        }
        const before = { ...m }
        Object.assign(m, values)
        applyMortgageRules(m, before, values, db.clock)
        if (m.status === 'draft') m.setupStep = Math.min(2, Math.max(m.setupStep, step + 1))
        touch(db, m)
        return mortgageAsOf(m, db.clock)
      }),
      activate: call('mortgages.activate', (db, id, { confirmDataCorrect }) => {
        const m = findMortgage(db, id)
        if (m.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Pemantauan sudah aktif.', 400)
        if (!confirmDataCorrect) fail('VALIDATION_FAILED', 'Centang konfirmasi data dulu.', 400)
        // Step 1 data (reminder + amortization) is required; profile and property data can come later.
        const required = ['bankName', 'originalPrincipal', 'currentPayment', 'originalTenorMonths', 'startDate', 'dueDay', 'remainingTenorMonths', 'currentRateBps', 'currentRateType']
        const missing = required.filter((k) => m[k] == null || m[k] === '')
        if (m.scheme !== 'sharia' && !(m.outstandingPrincipal > 0)) missing.push('outstandingPrincipal')
        if (m.currentRateType === 'fixed' && !m.fixedUntil) missing.push('fixedUntil')
        if (!m.reminders?.payment?.length || !(m.reminders.channels.inApp || m.reminders.channels.email)) missing.push('reminders')
        if (missing.length) fail('VALIDATION_FAILED', 'Data KPR belum lengkap.', 400, { details: { missing } })
        m.status = 'active'
        m.setupStep = 2
        m.activatedAt = nowIso(db)
        touch(db, m)
        const due = nextUnpaidDue(m, db.clock) // the first installment, never the akad day
        const channels = ['inApp', 'email'].filter((c) => m.reminders.channels[c]).length
        const fixedLeft = m.currentRateType === 'fixed' && m.fixedUntil > db.clock ? m.reminders.fixedExpiry.filter((h) => daysUntil({ fromDate: db.clock, targetDate: m.fixedUntil }) >= h) : []
        pushActivity(db, { type: 'mortgage_monitoring_activated', category: 'mortgage', title: 'Pemantauan KPR diaktifkan', body: `${m.bankName}${m.productName ? ` · ${m.productName}` : ''}` })
        if (m.reminders.payment.length) {
          const h = Math.max(...m.reminders.payment)
          pushActivity(db, { type: 'payment_reminder_scheduled', category: 'reminder', title: 'Reminder pembayaran dijadwalkan', body: `Kami akan mengingatkan pembayaran H-${h} sebelum jatuh tempo ${dateLong(due)}.`, action: { label: 'Lihat pembayaran', route: '/my-kpr/payment' } })
        }
        const days = m.currentRateType === 'fixed' && m.fixedUntil ? daysUntil({ fromDate: db.clock, targetDate: m.fixedUntil }) : null
        if (days !== null && days > 0 && days <= 90) {
          pushActivity(db, { type: 'fixed_expiry_warning', category: 'warning', title: `Fixed rate berakhir dalam ${days} hari`, body: 'Lihat estimasi dampak ke cicilan kamu.', action: { label: 'Lihat dampak', route: '/my-kpr/rate' } })
        }
        return { mortgage: m, scheduledReminderCount: m.reminders.payment.length * channels + fixedLeft.length * channels, applicationCreated: false }
      }),
      update: call('mortgages.update', (db, id, values) => {
        const m = findMortgage(db, id)
        if (m.status !== 'active') fail('INVALID_STATE_TRANSITION', 'Hanya KPR aktif yang bisa diubah di sini.', 400)
        const before = { ...m }
        if (values.property) m.property = { ...m.property, ...values.property }
        if (values.finance) {
          m.finance = { ...m.finance, ...values.finance }
          db.finance = { ...db.finance, ...values.finance }
        }
        if (values.reminders) m.reminders = values.reminders
        const { property: _p, finance: _f, reminders: _r, ...core } = values
        Object.assign(m, core)
        applyMortgageRules(m, before, core, db.clock)
        touch(db, m)
        if (!values.reminders || Object.keys(values).length > 1) {
          pushActivity(db, { type: 'mortgage_data_updated', category: 'mortgage', title: 'Data KPR diperbarui', body: 'Proyeksi pembayaran dan KPR Health dihitung ulang.' })
        }
        return mortgageAsOf(m, db.clock)
      }),
      // "Tetap di bank sekarang": hides the Home fixed-rate warning until the next milestone (H-60/30/14/7).
      dismissRateWarning: call('mortgages.dismissRateWarning', (db, id) => {
        const m = findMortgage(db, id)
        const { mode, daysUntilFixedEnd } = rateMode(m, db.clock)
        if (m.status !== 'active' || mode !== 'warning') fail('INVALID_STATE_TRANSITION', 'Tidak ada peringatan bunga yang aktif.', 400)
        m.rateWarningDismissedMilestone = nextMilestone(daysUntilFixedEnd)
        touch(db, m)
        return m
      }),
      deleteDraft: call('mortgages.deleteDraft', (db, id) => {
        const m = findMortgage(db, id)
        if (m.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Hanya data pengaturan yang belum aktif yang bisa dihapus.', 400)
        db.mortgages = db.mortgages.filter((x) => x.id !== id)
        return { deleted: true }
      }),
      // `proof` is optional file metadata ({ name, size, type }); file bytes are never stored.
      markPaid: call('mortgages.markPaid', (db, id, { dueDate, amount, paidAt, proof }) => {
        const m = findMortgage(db, id)
        if (!(amount > 0)) fail('VALIDATION_FAILED', 'Nominal harus lebih dari 0.', 400, { fieldErrors: [{ field: 'amount', message: 'Nominal harus lebih dari 0.' }] })
        if (!parseIsoDate(paidAt) || paidAt > db.clock) fail('VALIDATION_FAILED', 'Tanggal bayar tidak valid.', 400, { fieldErrors: [{ field: 'paidAt', message: 'Tanggal bayar tidak boleh di masa depan.' }] })
        const problem = proof && uploadProblem(proof, configOf(db).upload)
        if (problem) fail(problem.code, problem.message, problem.status)
        if (m.payments.some((p) => p.dueDate === dueDate && p.status === 'paid')) fail('DUPLICATE_PAYMENT_RECORD', 'Pembayaran bulan ini sudah ditandai.', 409)
        const payment = { id: nextId(db, 'pay'), dueDate, amount, status: 'paid', paidAt, source: 'manual_user_recorded', bankConfirmed: false, proof: proof ? { fileName: proof.name, sizeBytes: proof.size, contentType: proof.type, ...(proof.path && { path: proof.path }) } : null }
        m.payments.push(payment)
        pushActivity(db, { type: 'payment_marked_paid', category: 'payment', title: 'Pembayaran ditandai dibayar', body: `Jatuh tempo ${dateLong(dueDate)} · dicatat manual, tidak tersinkron dengan bank.`, action: { label: 'Lihat pembayaran', route: '/my-kpr/payment' } })
        touch(db, m)
        return payment
      }),
      removePayment: call('mortgages.removePayment', (db, id, paymentId) => {
        const m = findMortgage(db, id)
        const removed = m.payments.find((p) => p.id === paymentId)
        m.payments = m.payments.filter((p) => p.id !== paymentId)
        if (removed) pushActivity(db, { type: 'payment_unmarked', category: 'payment', title: 'Tanda pembayaran dibatalkan', body: `Jatuh tempo ${dateLong(removed.dueDate)}.`, action: { label: 'Lihat pembayaran', route: '/my-kpr/payment' } })
        touch(db, m)
        return m
      }),
    },

    simulations: {
      run: call('simulations.run', (db, { source, input }) => {
        const sim = { id: nextId(db, 'sim'), source, input, createdAt: nowIso(db) }
        const result = runSimulation(db, sim)
        db.simulation = sim
        return result
      }),
      getCurrent: call('simulations.getCurrent', (db, { sort } = {}) => {
        if (!db.simulation) fail('RESOURCE_NOT_FOUND', 'Belum ada simulasi. Mulai dari Explore atau pengajuan Take Over.', 404)
        return runSimulation(db, db.simulation, sort)
      }),
      // Simulation history is not in MVP scope: say so instead of pretending it was stored.
      save: call('simulations.save', () => ({ saved: false, reason: 'history_not_enabled' })),
      apply: call('simulations.apply', (db, { bankProductId, tenorMonths, plafon }) => {
        const sim = db.simulation
        if (!sim) fail('RESOURCE_NOT_FOUND', 'Simulasi tidak ditemukan.', 404)
        const result = runSimulation(db, sim)
        const product = productsOf(db).find((p) => p.id === bankProductId)
        if (!product || !isAvailable(product, db.clock)) fail('BANK_PRODUCT_EXPIRED', 'Program ini sudah tidak tersedia.', 410)
        const x = evaluateTakeoverProduct({ product, baseline: result.baseline, input: result.input, asOf: db.clock, plafonOverride: plafon ?? null, tenorMonthsOverride: tenorMonths })
        const selection = selectionFrom(product, {
          fixedRateBps: x.fixedRateBps,
          fixedMonths: x.fixedMonths,
          floatingRateBps: x.floatingRateBps,
          loanAmount: x.principal,
          tenorMonths: x.tenorMonths,
          estimatedPayment: x.payment,
          paymentAfterFixed: x.paymentAfterFixed,
          totalPayment: x.totalPayment,
          feesTotal: x.feesTotal,
          netTopup: x.topup?.netTopup ?? null,
          breakEvenMonth: x.breakEven.month,
          lastVerifiedAt: product.lastVerifiedAt,
        })
        let app
        if (sim.source.type === 'application') {
          app = findApp(db, sim.source.id)
          if (app.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Pengajuan sudah dikirim.', 400)
          app.data.goal = { ...app.data.goal, tenorMonths: x.tenorMonths }
        } else {
          const current = activeApplication(db.applications)
          if (current) fail('ACTIVE_DRAFT_EXISTS', 'Kamu masih punya pengajuan aktif. Lanjutkan atau hapus dulu.', 409, { details: { applicationId: current.id } })
          const m = findMortgage(db, sim.source.id)
          app = newApplication(db, {
            productType: 'takeover',
            mode: sim.input.mode,
            source: 'mortgage',
            mortgageId: m.id,
            data: takeoverDataFromMortgage(mortgageAsOf(m, db.clock), { personal: prefilledPersonal(db), employment: prefilledEmployment(db), goal: { ...sim.input, tenorMonths: x.tenorMonths } }),
          })
          db.simulation = { ...sim, source: { type: 'application', id: app.id } }
        }
        app.selection = selection
        app.currentStep = Math.max(app.currentStep, 6)
        touch(db, app)
        return decorate(app)
      }),
    },

    explore: {
      // Signals are computed with the same engine as the simulation; never design placeholder numbers.
      get: call('explore.get', (db) => {
        const active = activeMortgageOf(db)
        const m = active && mortgageAsOf(active, db.clock)
        const education = publishedArticles(db).map(({ body: _b, ...a }) => a)
        if (!m) return { hasActiveMortgage: false, signals: null, education, message: 'Take Over, Refinancing, dan Multiguna aktif setelah KPR disetujui dan akad.' }
        const days = m.currentRateType === 'fixed' && m.fixedUntil && m.fixedUntil >= db.clock ? daysUntil({ fromDate: db.clock, targetDate: m.fixedUntil }) : null
        let opportunity = { available: false }
        try {
          const sim = runSimulation(db, { id: 'explore', source: { type: 'mortgage', id: m.id }, input: defaultTakeoverGoal(m) })
          // Near/after the fixed end the fair reference is the (estimated) floating installment, not today's fixed one.
          const fixedLeft = sim.baseline.fixedMonthsLeft
          const reference = fixedLeft != null ? sim.baseline.payments[fixedLeft] : sim.baseline.currentPayment
          const cheaper = sim.items.filter((x) => reference - x.payment > 0 && x.netSaving > 0 && x.eligibility !== 'not_eligible' && !x.stale)
          const best = [...cheaper].sort((a, b) => a.payment - b.payment)[0]
          const ltvs = productsOf(db).filter((p) => p.productTypes.includes('topup')).map((p) => p.eligibility.maximumLtvBps)
          const maxLtvBps = ltvs.length ? Math.max(...ltvs) : null // empty catalog: no figure, never -Infinity
          const value = m.property?.estimatedValue
          opportunity = {
            available: true,
            cheaperProgramCount: cheaper.length,
            bestMonthlySaving: best ? reference - best.payment : null,
            comparedTo: fixedLeft != null ? 'floating_estimate' : 'current',
            bestBankName: best?.bank.name ?? null,
            bestFixedRateBps: best?.fixedRateBps ?? null,
            bestFixedMonths: best?.fixedMonths ?? null,
            bestBreakEvenMonth: best?.breakEven.month ?? null,
            maxGrossTopup: value > 0 && maxLtvBps ? Math.max(0, Math.floor((value * maxLtvBps) / 10_000) - m.outstandingPrincipal) : null,
            maxLtvBps,
          }
        } catch {
          opportunity = { available: false }
        }
        return {
          hasActiveMortgage: true,
          signals: { floating: days !== null && days <= 90, alreadyFloating: days === null, daysUntilFixedEnd: days, opportunity: opportunity.cheaperProgramCount > 0 },
          opportunity,
          education,
        }
      }),
      article: call('explore.article', (db, slug) => {
        const a = publishedArticles(db).find((x) => x.slug === slug)
        if (!a) fail('RESOURCE_NOT_FOUND', 'Artikel tidak ditemukan.', 404)
        return a
      }),
    },

    activities: {
      list: call('activities.list', (db) => [...db.activities].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))),
      markRead: call('activities.markRead', (db, id) => {
        const a = db.activities.find((x) => x.id === id)
        if (a && !a.readAt) a.readAt = nowIso(db)
        return a
      }),
      markAllRead: call('activities.markAllRead', (db) => {
        db.activities.forEach((a) => {
          a.readAt ??= nowIso(db)
        })
        return { ok: true }
      }),
    },

    // super_admin only (admin dashboard plan): app registrations and sample users alike.
    admin: {
      overview: {
        get: call('admin.overview.get', adminOverview, { admin: true }),
      },
      reports: {
        get: call('admin.reports.get', adminReport, { admin: true }),
        // The backend streams this; the mock returns the text and the page saves it as a file.
        exportCsv: call(
          'admin.reports.exportCsv',
          (db, params) => {
            const { filters, cohort } = reportScope(db, params)
            const rows = [CSV_COLUMNS.map(([name]) => name), ...cohort.map((app) => CSV_COLUMNS.map(([, get]) => get(app)))]
            audit(db, { action: 'report.export', resource: { type: 'report', id: 'applications', label: 'Pengajuan per periode' }, after: { ...filters, rows: cohort.length } })
            return { filename: `laporan-pengajuan-${filters.from}-${filters.to}.csv`, csv: `${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`, rows: cohort.length }
          },
          { admin: true },
        ),
      },
      config: {
        get: call('admin.config.get', (db) => ({ config: configOf(db), health: { version: activeHealth(db).version, publishedAt: activeHealth(db).publishedAt } }), { admin: true }),
        update: call(
          'admin.config.update',
          (db, section, { values, reason, expectedVersion }) => {
            if (!CONFIG_LABEL[section]) fail('RESOURCE_NOT_FOUND', 'Bagian konfigurasi tidak dikenal.', 404)
            requireReason(reason)
            db.config ??= structuredClone(DEFAULT_CONFIG)
            checkVersion(db.config, expectedVersion)
            const next = configInput(section, values)
            failOnFields(configIssues(section, next), 'Periksa kembali pengaturan ini.')
            const diff = changes(db.config[section], next, Object.keys(next))
            if (!diff) fail('VALIDATION_FAILED', 'Tidak ada perubahan untuk disimpan.', 400)
            db.config[section] = next
            bumpVersion(db.config)
            audit(db, { action: 'config.update', resource: { type: 'config', id: section, label: CONFIG_LABEL[section] }, reason, ...diff })
            return { config: db.config, health: { version: activeHealth(db).version, publishedAt: activeHealth(db).publishedAt } }
          },
          { admin: true },
        ),
      },
      health: {
        get: call('admin.health.get', healthDetail, { admin: true }),
        // The draft lives in the editor until it is published; nothing here is stored.
        preview: call(
          'admin.health.preview',
          (db, { params }) => {
            failOnFields(healthIssues(params), 'Periksa kembali formula.')
            const active = activeHealth(db)
            const draft = { version: active.version + 1, params: healthInput(params) }
            return {
              activeVersion: active.version,
              items: healthFixtures().map(({ key, label, m }) => ({ key, label, before: scoreOf(deriveMortgage(m, db.clock, active).health), after: scoreOf(deriveMortgage(m, db.clock, draft).health) })),
            }
          },
          { admin: true },
        ),
        publish: call(
          'admin.health.publish',
          (db, { params, reason, expectedVersion }) => {
            requireReason(reason)
            checkVersion(activeHealth(db), expectedVersion)
            failOnFields(healthIssues(params), 'Periksa kembali formula.')
            return publishHealth(db, { params: healthInput(params), reason, rollbackOf: null, action: 'health.publish' })
          },
          { admin: true },
        ),
        rollback: call(
          'admin.health.rollback',
          (db, { toVersion, reason, expectedVersion }) => {
            requireReason(reason)
            checkVersion(activeHealth(db), expectedVersion)
            const target = healthVersionsOf(db).find((v) => v.version === toVersion)
            if (!target) fail('RESOURCE_NOT_FOUND', 'Versi formula tidak ditemukan.', 404)
            if (target === activeHealth(db)) fail('INVALID_STATE_TRANSITION', 'Versi ini sedang berlaku.', 409)
            return publishHealth(db, { params: structuredClone(target.params), reason, rollbackOf: target.version, action: 'health.rollback' })
          },
          { admin: true },
        ),
      },
      // Read-only: nothing in the API edits or deletes an audit event (admin plan §4.8). The backend pages with a cursor.
      audit: {
        list: call(
          'admin.audit.list',
          (db, { resourceType, actorId, from, to, query = '' } = {}) => {
            const q = query.trim().toLowerCase()
            const log = db.auditLog ?? []
            const items = log.filter(
              (e) =>
                (!resourceType || e.resource.type === resourceType) &&
                (!actorId || e.actor.id === actorId) &&
                (!from || e.occurredAt.slice(0, 10) >= from) &&
                (!to || e.occurredAt.slice(0, 10) <= to) &&
                (!q || [e.reason, e.resource.label, e.actor.name].some((s) => s?.toLowerCase().includes(q))),
            )
            // Everyone who appears in the whole log, for the "Oleh admin" filter (it stays whole while filtering).
            const actors = [...new Map(log.map((e) => [e.actor.id, { id: e.actor.id, name: e.actor.name }])).values()].sort((a, b) => a.name.localeCompare(b.name))
            return { items, actors }
          },
          { admin: true },
        ),
      },
      products: {
        list: call(
          'admin.products.list',
          (db, { status, bankId, query = '' } = {}) => {
            const q = query.trim().toLowerCase()
            return catalogOf(db)
              .filter((p) => (!status || p.status === status) && (!bankId || p.bank?.id === bankId) && (!q || `${p.name} ${p.bank?.name ?? ''}`.toLowerCase().includes(q)))
              .map((p) => productRow(db, p))
          },
          { admin: true },
        ),
        get: call('admin.products.get', (db, id) => productDetail(db, findProduct(db, id)), { admin: true }),
        create: call(
          'admin.products.create',
          (db, { values }) => {
            editableCatalog(db)
            const content = productInput(db, values)
            failOnFields(productIssues(db, content, false), 'Lengkapi nama dan bank produk.')
            const p = { id: nextId(db, 'bpr'), ...content, status: 'draft', version: 0, rev: 1, updatedAt: nowIso(db) }
            db.products.push(p)
            productAudit(db, p, 'product.create')
            return productDetail(db, p)
          },
          { admin: true },
        ),
        // Drafts and revisions are not live, so saving them needs no reason; publish/archive do.
        update: call(
          'admin.products.update',
          (db, id, { values, expectedVersion }) => {
            editableCatalog(db)
            const p = findProduct(db, id)
            if (p.status === 'archived') fail('INVALID_STATE_TRANSITION', 'Produk yang diarsipkan tidak bisa diubah.', 409)
            checkRev(p, expectedVersion)
            const before = contentOf(p)
            const content = { ...before, ...productInput(db, values) }
            failOnFields(productIssues(db, content, false), 'Lengkapi nama dan bank produk.')
            const diff = changes(before, content, ['bank', ...CONTENT_KEYS])
            if (p.status === 'published') p.pendingRevision = content
            else Object.assign(p, content)
            p.rev = (p.rev ?? 1) + 1
            p.updatedAt = nowIso(db)
            productAudit(db, p, 'product.update', diff ?? {})
            return productDetail(db, p)
          },
          { admin: true },
        ),
        publish: call(
          'admin.products.publish',
          (db, id, { reason, expectedVersion }) => {
            editableCatalog(db)
            const p = findProduct(db, id)
            requireReason(reason)
            checkRev(p, expectedVersion)
            if (p.status === 'archived' || (p.status === 'published' && !p.pendingRevision)) fail('INVALID_STATE_TRANSITION', 'Tidak ada draft atau revisi untuk diterbitkan.', 409)
            const content = contentOf(p)
            failOnFields(productIssues(db, content, true), 'Lengkapi data produk sebelum diterbitkan.')
            const before = { status: p.status, version: p.version ?? 0 }
            Object.assign(p, content, { status: 'published', version: (p.version ?? 0) + 1, rev: (p.rev ?? 1) + 1, updatedAt: nowIso(db) })
            delete p.pendingRevision
            productAudit(db, p, 'product.publish', { reason, before, after: { status: 'published', version: p.version } })
            return productDetail(db, p)
          },
          { admin: true },
        ),
        // Archive, never delete: applications keep their snapshot, matching stops offering it.
        archive: call(
          'admin.products.archive',
          (db, id, { reason, expectedVersion }) => {
            editableCatalog(db)
            const p = findProduct(db, id)
            requireReason(reason)
            checkRev(p, expectedVersion)
            if (p.status === 'archived') fail('INVALID_STATE_TRANSITION', 'Produk ini sudah diarsipkan.', 409)
            const before = { status: p.status }
            Object.assign(p, { status: 'archived', rev: (p.rev ?? 1) + 1, updatedAt: nowIso(db) })
            delete p.pendingRevision
            productAudit(db, p, 'product.archive', { reason, before, after: { status: 'archived' } })
            return productDetail(db, p)
          },
          { admin: true },
        ),
        // What a borrower would pay under these terms, from the same engine as matching. Unsaved `values` allowed.
        preview: call(
          'admin.products.preview',
          (db, id, { principal, termMonths, values } = {}) => {
            const content = { ...contentOf(findProduct(db, id)), ...productInput(db, values) }
            const issues = productIssues(db, content, true)
            const e = Object.fromEntries(['fixedMonths', 'fixedRateBps', 'floatingRateBps'].filter((k) => issues[k]).map((k) => [k, issues[k]]))
            if (!(Number.isInteger(principal) && principal > 0)) e.principal = 'Isi plafon simulasi.'
            if (!(Number.isInteger(termMonths) && termMonths >= 12 && termMonths <= 360)) e.termMonths = 'Tenor simulasi 12–360 bulan.'
            failOnFields(e, 'Lengkapi bunga dan simulasi dulu.')
            const sim = simulateLoan({ product: content, principal, termMonths })
            return { payment: sim.payment, paymentAfterFixed: sim.paymentAfterFixed, totalPayment: sim.totalPayment, totalInterest: sim.totalInterest, fixedMonths: sim.fixedMonths }
          },
          { admin: true },
        ),
      },
      banks: {
        list: call(
          'admin.banks.list',
          (db) =>
            banksOf(db).map((b) => ({
              ...b,
              products: catalogOf(db).filter((p) => p.bank.id === b.id && p.status !== 'archived').length,
              published: catalogOf(db).filter((p) => p.bank.id === b.id && p.status === 'published').length,
            })),
          { admin: true },
        ),
        create: call(
          'admin.banks.create',
          (db, { values, reason }) => {
            editableCatalog(db)
            requireReason(reason)
            const bank = { id: nextId(db, 'bnk'), name: String(values?.name ?? '').trim(), mark: String(values?.mark ?? '').trim().toUpperCase(), active: true, version: 1 }
            failOnFields(bankIssues(db, bank), 'Periksa data bank.')
            db.banks.push(bank)
            audit(db, { action: 'bank.create', resource: { type: 'bank', id: bank.id, label: bank.name }, reason, after: { name: bank.name, mark: bank.mark } })
            return bank
          },
          { admin: true },
        ),
        update: call(
          'admin.banks.update',
          (db, id, { values, reason, expectedVersion }) => {
            editableCatalog(db)
            const bank = db.banks.find((b) => b.id === id)
            if (!bank) fail('RESOURCE_NOT_FOUND', 'Bank tidak ditemukan.', 404)
            requireReason(reason)
            checkVersion(bank, expectedVersion)
            const next = { ...bank, ...pickFields(values, ['name', 'mark', 'active']) }
            next.name = String(next.name).trim()
            next.mark = String(next.mark).trim().toUpperCase()
            failOnFields(bankIssues(db, next), 'Periksa data bank.')
            const diff = changes(bank, next, ['name', 'mark', 'active'])
            if (!diff) fail('VALIDATION_FAILED', 'Tidak ada perubahan untuk disimpan.', 400)
            Object.assign(bank, next)
            bumpVersion(bank)
            // Products embed their bank (catalog shape), so a rename travels with them, revisions included.
            const embedded = { id, name: bank.name, mark: bank.mark }
            for (const p of db.products.filter((x) => x.bank.id === id)) {
              p.bank = embedded
              if (p.pendingRevision) p.pendingRevision.bank = embedded
            }
            audit(db, { action: 'bank.update', resource: { type: 'bank', id, label: bank.name }, reason, ...diff })
            return bank
          },
          { admin: true },
        ),
      },
      articles: {
        list: call(
          'admin.articles.list',
          (db, { query = '', status } = {}) => {
            const q = query.trim().toLowerCase()
            return articlesOf(db)
              .filter((a) => (!status || a.status === status) && (!q || `${a.title} ${a.tag ?? ''}`.toLowerCase().includes(q)))
              .map(articleRow)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          },
          { admin: 'articles' },
        ),
        get: call('admin.articles.get', (db, id) => articleDetail(db, findArticle(db, id)), { admin: 'articles' }),
        create: call(
          'admin.articles.create',
          (db, { values }) => {
            db.articles ??= articlesOf(db)
            const a = { id: nextId(db, 'art'), ...articleInput(values), status: 'draft', rev: 1, updatedAt: nowIso(db) }
            failOnFields(articleIssues(db, a, false), 'Lengkapi judul dan slug artikel.')
            db.articles.push(a)
            articleAudit(db, a, 'article.create')
            return articleDetail(db, a)
          },
          { admin: 'articles' },
        ),
        update: call(
          'admin.articles.update',
          (db, id, { values, reason, expectedVersion }) => {
            db.articles ??= articlesOf(db)
            const a = findArticle(db, id)
            if (a.status === 'archived') fail('INVALID_STATE_TRANSITION', 'Artikel yang diarsipkan tidak bisa diubah.', 409)
            const live = a.status === 'published'
            if (live) requireReason(reason)
            checkRev(a, expectedVersion)
            const next = { ...a, ...articleInput(values) }
            const e = articleIssues(db, next, live)
            if (live && next.slug !== a.slug) e.slug = 'Slug tidak bisa diubah setelah artikel terbit.'
            failOnFields(e, live ? 'Artikel yang tampil harus tetap lengkap.' : 'Lengkapi judul dan slug artikel.')
            const diff = changes(a, next, ARTICLE_KEYS)
            Object.assign(a, next, { rev: a.rev + 1, updatedAt: nowIso(db) })
            articleAudit(db, a, 'article.update', { ...(live && { reason }), ...diff })
            return articleDetail(db, a)
          },
          { admin: 'articles' },
        ),
        publish: call(
          'admin.articles.publish',
          (db, id, { reason, expectedVersion }) => {
            db.articles ??= articlesOf(db)
            const a = findArticle(db, id)
            requireReason(reason)
            checkRev(a, expectedVersion)
            if (a.status !== 'draft') fail('INVALID_STATE_TRANSITION', 'Hanya draft yang bisa diterbitkan.', 409)
            failOnFields(articleIssues(db, a, true), 'Lengkapi artikel sebelum diterbitkan.')
            Object.assign(a, { status: 'published', rev: a.rev + 1, updatedAt: nowIso(db) })
            articleAudit(db, a, 'article.publish', { reason, before: { status: 'draft' }, after: { status: 'published' } })
            return articleDetail(db, a)
          },
          { admin: 'articles' },
        ),
        archive: call(
          'admin.articles.archive',
          (db, id, { reason, expectedVersion }) => {
            db.articles ??= articlesOf(db)
            const a = findArticle(db, id)
            requireReason(reason)
            checkRev(a, expectedVersion)
            if (a.status === 'archived') fail('INVALID_STATE_TRANSITION', 'Artikel ini sudah diarsipkan.', 409)
            const before = { status: a.status }
            Object.assign(a, { status: 'archived', rev: a.rev + 1, updatedAt: nowIso(db) })
            articleAudit(db, a, 'article.archive', { reason, before, after: { status: 'archived' } })
            return articleDetail(db, a)
          },
          { admin: 'articles' },
        ),
      },
      applications: {
        list: call('admin.applications.list', adminApplications, { admin: true }),
        get: call(
          'admin.applications.get',
          (db, id) => {
            const { owner, app } = findUserApp(db, id)
            return applicationDetail(db, owner, app)
          },
          { admin: true },
        ),
        transition: call(
          'admin.applications.transition',
          (db, id, { toStatus, reason, expectedVersion, metadata }) => {
            const { owner, app } = findUserApp(db, id)
            requireReason(reason)
            checkVersion(app, expectedVersion)
            const from = app.status
            transitionApplication(db, owner, app, { toStatus, metadata })
            audit(db, { action: 'application.transition', resource: { type: 'application', id, label: owner.user.name }, reason, before: { status: from }, after: { status: toStatus } })
            return applicationDetail(db, owner, app)
          },
          { admin: true },
        ),
        reviewDocument: call(
          'admin.applications.reviewDocument',
          (db, id, { documentType, result, reasonCode, note, expectedVersion }) => {
            const { owner, app } = findUserApp(db, id)
            checkVersion(app, expectedVersion)
            const verdict = (d) => (d?.review ? rejectMessage(d.review) : d?.status === 'verified' ? 'Sesuai' : 'Terunggah')
            const before = verdict(app.documents[documentType])
            applyReview(app, { documentType, result, reasonCode, note }, nowIso(db))
            const document = DOC_LABELS[documentType]
            audit(db, { action: 'application.document_review', resource: { type: 'application', id, label: owner.user.name }, before: { document, result: before }, after: { document, result: verdict(app.documents[documentType]) } })
            touch(db, app)
            return applicationDetail(db, owner, app)
          },
          { admin: true },
        ),
        saveStageNote: call(
          'admin.applications.saveStageNote',
          (db, id, { message, schedule, expectedVersion }) => {
            const { owner, app } = findUserApp(db, id)
            checkVersion(app, expectedVersion)
            if (!STAGE_NOTE_STATUSES.includes(app.status)) fail('INVALID_STATE_TRANSITION', 'Info untuk user hanya bisa diisi saat pengajuan sedang diproses.', 409)
            const before = app.stageNotes?.[app.status] ?? null
            const note = { ...stageNoteOf(app.status, { message, schedule }), updatedAt: nowIso(db) }
            app.stageNotes = { ...app.stageNotes, [app.status]: note }
            const stage = STATUS_LABEL[app.status]
            // The text stays out of the Activity, so an older notification never shows a note that was edited since.
            pushActivity(db, { type: 'application_stage_note', category: 'application', title: before ? `Info ${stage} diperbarui` : `Info baru dari tim · ${stage}`, body: app.status === 'appraisal' ? 'Jadwal appraisal sudah dikonfirmasi.' : 'Buka detail pengajuan untuk membaca pesannya.', action: { label: 'Lihat status', route: '/my-kpr/application' } }, owner)
            audit(db, { action: 'application.stage_note', resource: { type: 'application', id, label: owner.user.name }, before: before && { message: before.message, schedule: before.schedule }, after: { status: app.status, message: note.message, schedule: note.schedule } })
            touch(db, app)
            return applicationDetail(db, owner, app)
          },
          { admin: true },
        ),
        // The demo keeps file metadata only; the Supabase adapter answers with a short-lived signed URL.
        documentUrl: call('admin.applications.documentUrl', () => fail('RESOURCE_NOT_FOUND', 'Pratinjau dokumen hanya tersedia di server asli.', 404), { admin: true }),
        addNote: call(
          'admin.applications.addNote',
          (db, id, { text }) => {
            const { owner, app } = findUserApp(db, id)
            const note = String(text ?? '').trim()
            if (note.length < 3) fail('VALIDATION_FAILED', 'Tulis catatan (minimal 3 karakter).', 400, { fieldErrors: [{ field: 'text', message: 'Tulis catatan (minimal 3 karakter).' }] })
            ;(db.adminNotes ??= []).unshift({ id: nextId(db, 'note'), applicationId: id, text: note, author: { id: db.user.id, name: db.user.name }, createdAt: nowIso(db) })
            audit(db, { action: 'application.note', resource: { type: 'application', id, label: owner.user.name }, after: { note } })
            return applicationDetail(db, owner, app)
          },
          { admin: true },
        ),
      },
      users: {
        list: call(
          'admin.users.list',
          (db, { query = '', inProcess, hasActiveMortgage } = {}) => {
            const q = query.trim().toLowerCase()
            return userAccounts(db)
              .filter((a) => !q || [a.user.name, a.user.contact, a.profile?.email, a.profile?.phone].some((s) => s?.toLowerCase().includes(q)))
              .map(userRow)
              .filter((r) => inProcess === undefined || IN_PROCESS.includes(r.activeApplicationStatus) === inProcess)
              .filter((r) => hasActiveMortgage === undefined || r.hasActiveMortgage === hasActiveMortgage)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          },
          { admin: true },
        ),
        get: call('admin.users.get', (db, id) => userDetail(db, findAccount(db, id)), { admin: true }),
        // The login contact is the OTP identity and never changes here; the NIK is only replaced, never read back.
        updateProfile: call(
          'admin.users.updateProfile',
          (db, id, { values, reason, expectedVersion }) => {
            const a = findAccount(db, id)
            requireReason(reason)
            checkVersion(a.user, expectedVersion)
            const next = { ...a.profile, ...pickFields(values, PROFILE_FIELDS) }
            failOnFields(filledOnly({ ...validatePersonal(next, { today: db.clock }), ...validateEmploymentBasic(next) }, next, ['fullName']), 'Periksa kembali data profil.')
            const diff = changes(a.profile, next, PROFILE_FIELDS)
            if (!diff) fail('VALIDATION_FAILED', 'Tidak ada perubahan untuk disimpan.', 400)
            a.profile = next
            bumpVersion(a.user)
            audit(db, { action: 'user.profile.update', resource: { type: 'user', id, label: a.user.name }, reason, ...diff })
            return userDetail(db, a)
          },
          { admin: true },
        ),
        updateFinance: call(
          'admin.users.updateFinance',
          (db, id, { values, reason, expectedVersion }) => {
            const a = findAccount(db, id)
            requireReason(reason)
            checkVersion(a.user, expectedVersion)
            const finance = pickFields(values, FINANCE_FIELDS)
            const errors = {}
            for (const k of FINANCE_FIELDS.filter((x) => x !== 'jointIncome')) {
              if (finance[k] != null && !(Number.isInteger(finance[k]) && finance[k] >= 0)) errors[k] = 'Isi angka Rupiah 0 atau lebih.'
            }
            if ('monthlyIncome' in finance && !(finance.monthlyIncome > 0)) errors.monthlyIncome = 'Penghasilan bulanan harus lebih dari 0.'
            failOnFields(errors, 'Periksa kembali data keuangan.')
            const diff = changes(a.finance, { ...a.finance, ...finance }, FINANCE_FIELDS)
            if (!diff) fail('VALIDATION_FAILED', 'Tidak ada perubahan untuk disimpan.', 400)
            applyFinance(a, finance)
            bumpVersion(a.user)
            audit(db, { action: 'user.finance.update', resource: { type: 'user', id, label: a.user.name }, reason, ...diff })
            // DTI always moves with income/debts; KPR Health only where a mortgage carries the copy.
            const health = a.mortgages.some((m) => m.status === 'draft' || m.status === 'active')
            return { ...userDetail(db, a), recalculated: ['dti', ...(health ? ['health'] : [])] }
          },
          { admin: true },
        ),
      },
    },
  }
}

// ---------- development controls (never imported by app runtime outside DEV) ----------
export const mockControls = {
  scenarios: SCENARIOS,
  currentScenario: () => loadDb().scenario,
  reset: (scenario) => resetDb(scenario),
  // E2E journeys run with tours already seen so the overlay never blocks them.
  seeAllTours() {
    const db = loadDb()
    db.toursSeen = Object.keys(TOURS)
    saveDb(db)
  },
  failNext: (name, error = { code: 'SERVICE_UNAVAILABLE', message: 'Koneksi bermasalah. Periksa koneksi lalu coba lagi.', status: 503, retryable: true }) => failures.set(name, error),
  // Tracker demo buttons: the admin's transition helper applied to the signed-in user's application.
  advanceApplication(id) {
    const db = loadDb()
    const app = findApp(db, id)
    if (app.status === 'additional_docs_requested') {
      app.status = 'docs_verification'
      app.pendingActions = []
    }
    // The team takes the documents as they are.
    if (app.status === 'docs_verification') {
      for (const [t, { review: _draft, ...doc }] of Object.entries(app.documents)) app.documents[t] = { ...doc, status: 'verified', invalidReason: null }
    }
    const next = allowedTransitions(app).find((s) => s !== 'rejected' && s !== 'additional_docs_requested')
    if (!next) return
    const s = app.selection ?? {}
    const finalTerms = { loanAmount: s.loanAmount, tenorMonths: s.tenorMonths, fixedRateBps: s.fixedRateBps, fixedMonths: s.fixedMonths, floatingRateBps: s.floatingRateBps, akadDate: db.clock }
    transitionApplication(db, db, app, { toStatus: next, metadata: next === 'akad' ? { finalTerms } : {} })
    saveDb(db)
  },
  rejectApplication(id) {
    const db = loadDb()
    const app = findApp(db, id)
    if (!allowedTransitions(app).includes('rejected')) return
    transitionApplication(db, db, app, { toStatus: 'rejected', metadata: { code: 'DTI_ABOVE_BANK_POLICY', displayReason: `Rasio cicilan melebihi kebijakan ${app.selection?.bankName ?? 'bank'}.` } })
    saveDb(db)
  },
  requestDocument(id, documentType = 'bank_statement') {
    const db = loadDb()
    const app = findApp(db, id)
    if (!allowedTransitions(app).includes('additional_docs_requested')) return
    const type = app.documents[documentType] ? documentType : Object.keys(app.documents)[0]
    app.documents[type] = { ...app.documents[type], status: 'uploaded', review: { reasonCode: 'expired', note: 'Unggah versi terbaru.', at: nowIso(db) } }
    transitionApplication(db, db, app, { toStatus: 'additional_docs_requested' })
    saveDb(db)
  },
}
