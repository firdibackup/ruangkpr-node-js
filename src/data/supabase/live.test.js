// Live check against the real Supabase (VPS): the full journey through the real adapter, RLS, triggers and Storage.
// Opt-in only: `LIVE=1 npx vitest run src/data/supabase/live.test.js`. Reads the secret key from .env.local to create
// two throwaway users (a user and a super admin) and removes everything it created at the end.
import fs from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  (fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)
const LIVE = process.env.LIVE === '1' && env.SUPABASE_SECRET_KEY

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
const shift = (days) => new Date(Date.parse(today) + days * 86_400_000).toISOString().slice(0, 10)
const pdf = (name) => new File(['%PDF-1.4 live check'], name, { type: 'application/pdf' })
const PASSWORD = `Live-${crypto.randomUUID()}`
const tag = Date.now()
const people = { user: `live-user-${tag}@example.com`, staff: `live-staff-${tag}@example.com` }

describe.skipIf(!LIVE)('live: real Supabase end to end', () => {
  let service
  let api
  let client
  const ids = {}

  // Every step signs in again: src/test/setup.js clears localStorage (where supabase-js keeps the session) after each test.
  const signInAs = async (email) => {
    await client().auth.signOut({ scope: 'local' })
    const { error } = await client().auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
  }

  beforeAll(async () => {
    process.env.VITE_SUPABASE_URL ??= env.VITE_SUPABASE_URL
    import.meta.env.VITE_SUPABASE_URL ??= env.VITE_SUPABASE_URL
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= env.VITE_SUPABASE_PUBLISHABLE_KEY
    service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    for (const [who, email] of Object.entries(people)) {
      const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
      if (error) throw error
      ids[who] = data.user.id
    }
    const { error } = await service.from('user_roles').insert({ user_id: ids.staff, role: 'super_admin' })
    if (error) throw error
    ;({ supabase: client } = await import('./client'))
    const { createSupabaseApi } = await import('./index')
    api = createSupabaseApi()
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of Object.values(ids)) {
      for (const bucket of ['application-documents', 'payment-proofs']) {
        const walk = async (prefix) => {
          const { data } = await service.storage.from(bucket).list(prefix, { limit: 1000 })
          const files = []
          for (const e of data ?? []) files.push(...(e.id ? [`${prefix}/${e.name}`] : await walk(`${prefix}/${e.name}`)))
          return files
        }
        const files = await walk(id)
        if (files.length) await service.storage.from(bucket).remove(files)
      }
      await service.auth.admin.deleteUser(id).catch(() => {})
    }
    if (ids.product) await service.from('bank_products').delete().eq('id', ids.product)
    if (ids.bank) await service.from('banks').delete().eq('id', ids.bank)
    if (ids.staff) await service.from('audit_log').delete().eq('actor_id', ids.staff)
  }, 60_000)

  it('a new user agrees to the terms before any data', async () => {
    await signInAs(people.user)
    expect(await api.auth.getSession()).toMatchObject({ status: 'onboarding', role: null })
    await expect(api.dashboard.getSnapshot()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
    await api.auth.acceptConsents({ name: 'Live User', acceptTerms: true, acceptPrivacy: true })
    const s = await api.auth.getSession()
    expect(s).toMatchObject({ status: 'authenticated', role: 'user', user: { name: 'Live User', contact: people.user } })
    await expect(api.admin.users.list()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  }, 60_000)

  it('the user fills a KPR Primary draft and uploads the documents to Storage', async () => {
    await signInAs(people.user)
    const app = await api.applications.create({ productType: 'primary', purchaseType: 'new_from_developer' })
    ids.app = app.id
    await api.applications.saveStep(app.id, {
      step: 1,
      values: { personal: { fullName: 'Live User', nik: '3174012345678901', birthPlace: 'Bekasi', birthDate: '1990-01-01', gender: 'male', maritalStatus: 'single', address: 'Jl. Uji No. 1', phone: '081234567890', email: people.user } },
    })
    await api.applications.saveStep(app.id, {
      step: 2,
      values: { employment: { occupation: 'private_employee', companyName: 'PT Uji', jobTitle: 'Staf', workYears: 5, workMonths: 0, monthlyIncome: 20_000_000, jointIncome: false, partnerIncome: null, vehicleDebt: 0, cardDebt: 0, otherDebt: 0 } },
    })
    await api.applications.saveStep(app.id, {
      step: 3,
      values: { property: { purchaseType: 'new_from_developer', developerName: 'PT Graha Uji', propertyType: 'landed_house', address: 'Perumahan Uji', city: 'Kota Bekasi', price: 600_000_000 } },
    })
    await api.applications.saveStep(app.id, { step: 4, values: { loan: { downPayment: 120_000_000, amount: 480_000_000, tenorMonths: 240 } } })
    let progress = 0
    for (const type of ['ktp', 'npwp', 'income_proof', 'property_document']) {
      await api.applications.uploadDocument(app.id, { documentType: type, file: pdf(`${type}.pdf`) }, { onProgress: (p) => (progress = p) })
    }
    expect(progress).toBe(100)
    // Uploading again replaces the file: the earlier one leaves Storage (no stale KTP copies).
    await api.applications.uploadDocument(app.id, { documentType: 'ktp', file: pdf('ktp-baru.pdf') })
    const { data: ktpFiles } = await service.storage.from('application-documents').list(`${ids.user}/${app.id}/ktp`)
    expect(ktpFiles).toHaveLength(1)
    const saved = await api.applications.get(app.id)
    expect(saved.documents.ktp).toMatchObject({ status: 'uploaded', fileName: 'ktp-baru.pdf' })
    expect(saved.documents.ktp.path.startsWith(`${ids.user}/${app.id}/ktp/`)).toBe(true)
    expect((await api.profile.get()).finance.monthlyIncome).toBe(20_000_000)
  }, 120_000)

  it('the admin adds a real bank and publishes a product', async () => {
    await signInAs(people.staff)
    expect(await api.auth.getSession()).toMatchObject({ status: 'onboarding' })
    await api.auth.acceptConsents({ name: 'Live Staff', acceptTerms: true, acceptPrivacy: true })
    await api.admin.banks.create({ values: { name: 'Bank Uji Live', mark: `L${String(tag).slice(-3)}` }, reason: 'Uji integrasi' })
    ids.bank = (await api.admin.banks.list()).find((b) => b.name === 'Bank Uji Live').id
    const created = await api.admin.products.create({
      values: {
        name: 'KPR Uji Live',
        bankId: ids.bank,
        productTypes: ['primary'],
        scheme: 'conventional',
        ratePeriods: [{ type: 'fixed', durationMonths: 60, rateBps: 550 }, { type: 'floating', durationMonths: null, rateBps: 1050, estimated: true }],
        fees: { provisionBps: 75, admin: 1_000_000 },
        eligibility: { minimumIncome: 5_000_000, maximumDtiBps: 4000, maximumLtvBps: 9000, minimumAge: 21, maximumAgeAtMaturity: 60, maximumTenorMonths: 360, occupations: ['private_employee'], propertyTypes: ['landed_house'] },
        effectiveFrom: shift(-30),
        effectiveUntil: shift(365),
        lastVerifiedAt: today,
      },
    })
    ids.product = created.product.id
    const published = await api.admin.products.publish(ids.product, { reason: 'Uji integrasi', expectedVersion: created.product.rev })
    expect(published.product).toMatchObject({ status: 'published', version: 1 })
  }, 60_000)

  it('the user picks the program and submits; the database checks it against the catalog', async () => {
    await signInAs(people.user)
    const compare = await api.bankProducts.compare({ applicationId: ids.app })
    expect(JSON.stringify(compare)).toContain(ids.product)
    await api.applications.selectProgram(ids.app, { bankProductId: ids.product, loanAmount: 480_000_000, tenorMonths: 240 })
    const submitted = await api.applications.submit(ids.app, { consents: { dataAccuracy: true, sendToBank: true } })
    expect(submitted.status).toBe('submitted')
    await expect(api.applications.uploadDocument(ids.app, { documentType: 'additional', file: pdf('lain.pdf') })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
  }, 60_000)

  it('the admin opens a document and walks the application to disbursement', async () => {
    await signInAs(people.staff)
    const queue = await api.admin.applications.list()
    expect(queue.items.map((x) => x.id)).toContain(ids.app)
    const url = await api.admin.applications.documentUrl(ids.app, 'ktp')
    expect((await fetch(url)).status).toBe(200)
    let detail = await api.admin.applications.get(ids.app)
    await expect(api.admin.applications.transition(ids.app, { toStatus: 'approved', reason: 'Lompat status', expectedVersion: detail.application.version })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    const finalTerms = { loanAmount: 480_000_000, tenorMonths: 240, fixedRateBps: 550, fixedMonths: 60, floatingRateBps: 1050, akadDate: today }
    for (const toStatus of ['docs_verification', 'bank_processing', 'appraisal', 'approved', 'akad', 'disbursed']) {
      detail = await api.admin.applications.transition(ids.app, { toStatus, reason: 'Uji integrasi', expectedVersion: detail.application.version, metadata: toStatus === 'akad' ? { finalTerms } : {} })
      expect(detail.application.status).toBe(toStatus)
    }
    const audit = await api.admin.audit.list()
    expect(audit.items.filter((e) => e.action === 'application.transition')).toHaveLength(6)
  }, 120_000)

  it('the user now monitors an active KPR, records a payment with proof, and deletes the account', async () => {
    await signInAs(people.user)
    const snap = await api.dashboard.getSnapshot()
    const m = snap.mortgages.find((x) => x.status === 'active')
    expect(m).toMatchObject({ source: 'application', originalPrincipal: 480_000_000 })
    const activities = await api.activities.list()
    expect(activities.map((a) => a.type)).toContain('application_completed')
    const paid = await api.mortgages.markPaid(m.id, { dueDate: shift(30), amount: m.currentPayment, paidAt: today, proof: pdf('bukti.pdf') })
    expect(paid.proof.path.startsWith(`${ids.user}/${m.id}/`)).toBe(true)
    expect(await api.auth.deleteAccount()).toEqual({ deleted: true })
    const { data } = await service.auth.admin.getUserById(ids.user)
    expect(data?.user ?? null).toBeNull()
    const { data: left } = await service.storage.from('application-documents').list(ids.user)
    expect(left ?? []).toHaveLength(0)
  }, 120_000)
})
