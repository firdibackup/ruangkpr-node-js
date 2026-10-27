// Staging/demo adapter: local persistence, fake auth, file metadata and scenario controls.
import { createApplicationApi, allowedTransitions, decorate, findApp, recordDocument, transitionApplication } from './applicationApi'
import { createOperation } from './operation'
import { createMockAuth } from './mockAuth'
import { ApiError } from './apiError'
import { loadDb, resetDb, saveDb } from './mockDb'
import { SCENARIOS } from './seed'
import { ARTICLES } from './articles'
import { BANK_PRODUCTS } from './catalog'
import { DEFAULT_UPLOAD, LOGO_UPLOAD, uploadProblem } from './documentRules'
import { TOURS } from './tours'

export { recordDocument } from './applicationApi'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (code, message, status = 400, extra = {}) => { throw new ApiError({ code, message, ...extra }, { status }) }
const failures = new Map()
let callSeq = 0
function maybeFail(name, seq) {
  const f = failures.get(name)
  if (!f) return
  if (f.firedUpTo !== undefined && seq > f.firedUpTo) { failures.delete(name); return }
  f.firedUpTo ??= callSeq
  fail(f.code, f.message, f.status, { retryable: f.retryable })
}

// Populate legacy demo stores only. Real stores never fall back to fixture content.
export const localStore = {
  load() {
    const db = loadDb()
    db.products ??= structuredClone(BANK_PRODUCTS)
    if (db.flags?.staleProducts) db.products = db.products.map((p) => ({ ...p, ...(db.flags.staleProducts[p.id] && { lastVerifiedAt: db.flags.staleProducts[p.id] }) }))
    db.articles ??= ARTICLES.map((a) => ({ id: `art_${a.slug}`, ...a, status: 'published', rev: 1, updatedAt: '2026-09-01T02:00:00.000Z' }))
    return db
  },
  save: saveDb,
}

async function demoFile(file) {
  const problem = uploadProblem(file, LOGO_UPLOAD)
  if (problem) fail(problem.code, problem.message, problem.status)
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return { path: `${crypto.randomUUID()}.${/\.([a-z0-9]+)$/i.exec(file.name)[1].toLowerCase()}`, url }
}
const withLogo = (write) => async (...args) => {
  const input = args.at(-1)
  const file = input?.values?.logo
  if (!(file instanceof Blob)) return write(...args)
  return write(...args.slice(0, -1), { ...input, values: { ...input.values, logo: await demoFile(file) } })
}

export function createMockApi({ latencyMs = 300, store = localStore } = {}) {
  const call = createOperation(store, async (name) => {
    const seq = ++callSeq
    if (latencyMs) await sleep(latencyMs)
    maybeFail(name, seq)
  })
  const base = createApplicationApi({ store, call })
  return {
    ...base,
    auth: createMockAuth(call, store),
    applications: {
      ...base.applications,
      async uploadDocument(id, { documentType, file }, { onProgress } = {}) {
        const seq = ++callSeq
        if (latencyMs) await sleep(latencyMs / 2)
        const problem = uploadProblem(file, (await store.load({ admin: false })).config?.upload ?? DEFAULT_UPLOAD)
        if (problem) fail(problem.code, problem.message, problem.status)
        for (const pct of [20, 45, 70, 90]) {
          if (latencyMs) await sleep(Math.max(80, latencyMs / 2))
          onProgress?.(pct)
        }
        maybeFail('applications.uploadDocument', seq)
        const db = await store.load({ admin: false })
        if (db.session.status !== 'authenticated') fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
        const app = findApp(db, id)
        if (db.flags?.uploadFailOnce && !db.flags.failedUploads.includes(documentType)) {
          db.flags.failedUploads.push(documentType)
          await store.save(db)
          fail('SERVICE_UNAVAILABLE', 'Upload gagal. Periksa koneksi lalu coba lagi.', 503, { retryable: true })
        }
        recordDocument(db, app, documentType, file)
        await store.save(db)
        onProgress?.(100)
        return structuredClone(decorate(app))
      },
    },
    admin: {
      ...base.admin,
      banks: { ...base.admin.banks, create: withLogo(base.admin.banks.create), update: withLogo(base.admin.banks.update) },
      brand: {
        ...base.admin.brand,
        async saveDraft(input = {}) {
          const settings = { ...input.settings }
          for (const key of ['logo', 'favicon']) if (settings[key] instanceof Blob) settings[key] = await demoFile(settings[key])
          return base.admin.brand.saveDraft({ ...input, settings })
        },
      },
    },
  }
}

export const mockControls = {
  scenarios: SCENARIOS,
  currentScenario: () => loadDb().scenario,
  reset: resetDb,
  seeAllTours() {
    const db = loadDb()
    db.toursSeen = Object.keys(TOURS)
    saveDb(db)
  },
  failNext: (name, error = { code: 'SERVICE_UNAVAILABLE', message: 'Koneksi bermasalah. Periksa koneksi lalu coba lagi.', status: 503, retryable: true }) => failures.set(name, error),
  advanceApplication(id) {
    const db = localStore.load()
    const app = findApp(db, id)
    if (app.status === 'additional_docs_requested') { app.status = 'docs_verification'; app.pendingActions = [] }
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
    const db = localStore.load()
    const app = findApp(db, id)
    if (!allowedTransitions(app).includes('rejected')) return
    transitionApplication(db, db, app, { toStatus: 'rejected', metadata: { code: 'DTI_ABOVE_BANK_POLICY', displayReason: `Rasio cicilan melebihi kebijakan ${app.selection?.bankName ?? 'bank'}.` } })
    saveDb(db)
  },
  requestDocument(id, documentType = 'bank_statement') {
    const db = localStore.load()
    const app = findApp(db, id)
    if (!allowedTransitions(app).includes('additional_docs_requested')) return
    const type = app.documents[documentType] ? documentType : Object.keys(app.documents)[0]
    app.documents[type] = { ...app.documents[type], status: 'uploaded', review: { reasonCode: 'expired', note: 'Unggah versi terbaru.', at: `${db.clock}T${new Date().toISOString().slice(11)}` } }
    transitionApplication(db, db, app, { toStatus: 'additional_docs_requested' })
    saveDb(db)
  },
}
