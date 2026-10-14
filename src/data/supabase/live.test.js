// Live check against the real Supabase (VPS): the full journey through the real adapter, RLS, triggers and Storage.
// Opt-in only: `LIVE=1 npx vitest run src/data/supabase/live.test.js`. Reads the secret key from .env.local to create
// throwaway users (applicant, KPR monitor, super admin, content writer) and removes everything it created at the end,
// restoring app_config and health_configs to what they were.
import fs from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { HEALTH_V1 } from '@/domains/mortgages/derive'
import { defaultTakeoverGoal } from '@/domains/optimize/validation'

const env = Object.fromEntries(
  (fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)
const LIVE = process.env.LIVE === '1' && env.SUPABASE_SECRET_KEY
// KEEP=1 KEEP_FILE=<path>: leave the data in place (no account deletion, no cleanup) for a browser check of the pages;
// the file holds what a later cleanup needs.
const KEEP = process.env.KEEP === '1' && process.env.KEEP_FILE

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
const shift = (days) => new Date(Date.parse(today) + days * 86_400_000).toISOString().slice(0, 10)
const pdf = (name) => new File(['%PDF-1.4 live check'], name, { type: 'application/pdf' })
const PASSWORD = `Live-${crypto.randomUUID()}`
const tag = Date.now()
const people = { user: `live-user-${tag}@example.com`, staff: `live-staff-${tag}@example.com`, monitor: `live-monitor-${tag}@example.com`, writer: `live-writer-${tag}@example.com` }
// A due day that falls exactly 7, 3 or 1 days from today without month-end clamping (for the reminder job check).
const reminderOffset = [7, 3, 1].find((o) => Number(shift(o).slice(8)) <= 28)

describe.skipIf(!LIVE)('live: real Supabase end to end', () => {
  let service
  let api
  let client
  const uid = {} // throwaway users
  const ids = {} // records they create
  const before = {} // production config to restore
  const sql = async (query) => {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/pg/query`, { method: 'POST', headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  }

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
      uid[who] = data.user.id
    }
    const { error } = await service.from('user_roles').insert([{ user_id: uid.staff, role: 'super_admin' }, { user_id: uid.writer, role: 'content_writer' }])
    if (error) throw error
    before.config = (await service.from('app_config').select('doc').maybeSingle()).data?.doc ?? null
    before.healthMax = (await service.from('health_configs').select('version').order('version', { ascending: false }).limit(1)).data?.[0]?.version ?? 0
    ;({ supabase: client } = await import('./client'))
    const { createSupabaseApi } = await import('./index')
    api = createSupabaseApi()
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    if (KEEP) {
      fs.writeFileSync(process.env.KEEP_FILE, JSON.stringify({ password: PASSWORD, people, uid, ids, before }))
      return
    }
    for (const id of Object.values(uid)) {
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
    for (const id of [ids.product, ids.product2].filter(Boolean)) await service.from('bank_products').delete().eq('id', id)
    if (ids.bank) await service.from('banks').delete().eq('id', ids.bank)
    if (ids.article) await service.from('articles').delete().eq('id', ids.article)
    await service.from('audit_log').delete().in('actor_id', [uid.staff, uid.writer].filter(Boolean))
    await service.from('health_configs').delete().gt('version', before.healthMax ?? 0)
    if (before.config) await service.from('app_config').update({ doc: before.config }).eq('id', 1)
    else await service.from('app_config').delete().eq('id', 1)
  }, 60_000)

  // GoTrue really sends its two emails (to Resend's test inbox); the admin API hands the test a fresh code instead.
  it('email + password: register by code, reset by link, one answer for a wrong password, change password', async () => {
    const email = `delivered+ruangkpr-${tag}@resend.dev`
    const registration = { name: 'Live Signup', email, password: PASSWORD, confirm: PASSWORD, acceptTerms: true, acceptPrivacy: true }
    await client().auth.signOut({ scope: 'local' })
    await api.auth.signUp(registration)
    expect((await api.auth.getSession()).status).toBe('pending')
    const signup = await service.auth.admin.generateLink({ type: 'signup', email, password: PASSWORD })
    if (signup.error) throw signup.error
    uid.signup = signup.data.user.id
    await expect(api.auth.verifySignup({ token: '000000' })).rejects.toMatchObject({ code: 'OTP_INVALID' })
    await api.auth.verifySignup({ token: signup.data.properties.email_otp })
    expect(await api.auth.getSession()).toMatchObject({ status: 'authenticated', role: 'user', user: { name: 'Live Signup', contact: email } })

    await api.auth.logout()
    await expect(api.auth.signInWithPassword({ email, password: 'Salah-12345' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(api.auth.signUp(registration)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })

    // Reset: the email carries a link; opening it signs in with PASSWORD_RECOVERY, which verifying the token does too.
    const renewed = `${PASSWORD}-baru`
    await api.auth.requestPasswordReset({ email })
    expect((await api.auth.getSession()).status).toBe('guest')
    const recovery = await service.auth.admin.generateLink({ type: 'recovery', email })
    if (recovery.error) throw recovery.error
    const opened = await client().auth.verifyOtp({ email, token: recovery.data.properties.email_otp, type: 'recovery' })
    if (opened.error) throw opened.error
    expect((await api.auth.getSession()).status).toBe('recovery')
    await api.auth.updatePassword({ password: renewed, confirm: renewed })
    expect((await api.auth.getSession()).status).toBe('authenticated')
    await api.auth.logout()
    await expect(api.auth.signInWithPassword({ email, password: PASSWORD })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await api.auth.signInWithPassword({ email, password: renewed })

    await expect(api.auth.changePassword({ currentPassword: PASSWORD, password: 'Rumah-2026', confirm: 'Rumah-2026' })).rejects.toMatchObject({ message: 'Password lama salah.' })
    await api.auth.changePassword({ currentPassword: renewed, password: PASSWORD, confirm: PASSWORD })
    await api.auth.logout()
    await api.auth.signInWithPassword({ email, password: PASSWORD })
    await api.auth.logout()
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
    const { data: ktpFiles } = await service.storage.from('application-documents').list(`${uid.user}/${app.id}/ktp`)
    expect(ktpFiles).toHaveLength(1)
    const saved = await api.applications.get(app.id)
    expect(saved.documents.ktp).toMatchObject({ status: 'uploaded', fileName: 'ktp-baru.pdf' })
    expect(saved.documents.ktp.path.startsWith(`${uid.user}/${app.id}/ktp/`)).toBe(true)
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
    const file = await fetch(url)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-disposition')).toMatch(/^attachment/)
    let detail = await api.admin.applications.get(ids.app)
    await expect(api.admin.applications.transition(ids.app, { toStatus: 'approved', reason: 'Lompat status', expectedVersion: detail.application.version })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    const finalTerms = { loanAmount: 480_000_000, tenorMonths: 240, fixedRateBps: 550, fixedMonths: 60, floatingRateBps: 1050, akadDate: today }
    const step = async (toStatus, metadata = {}) => {
      detail = await api.admin.applications.transition(ids.app, { toStatus, reason: 'Uji integrasi', expectedVersion: detail.application.version, metadata })
      expect(detail.application.status).toBe(toStatus)
    }
    const review = async (documentType, verdict = { result: 'ok' }) => {
      detail = await api.admin.applications.reviewDocument(ids.app, { documentType, expectedVersion: detail.application.version, ...verdict })
    }
    await step('docs_verification')
    for (const t of ['ktp', 'income_proof', 'property_document']) await review(t)
    await review('npwp', { result: 'rejected', reasonCode: 'blurry', note: 'angka tidak terbaca' })
    await step('additional_docs_requested')

    // The user's re-upload passes the database's re-upload rule.
    await signInAs(people.user)
    expect((await api.applications.uploadDocument(ids.app, { documentType: 'npwp', file: pdf('npwp-baru.pdf') })).status).toBe('docs_verification')

    await signInAs(people.staff)
    detail = await api.admin.applications.get(ids.app)
    await review('npwp')
    await step('bank_processing')
    await step('appraisal')
    detail = await api.admin.applications.saveStageNote(ids.app, { message: 'Siapkan IMB asli.', schedule: { date: shift(5), time: '10:00', location: 'Lokasi uji' }, expectedVersion: detail.application.version })
    expect(detail.application.stageNotes.appraisal.schedule.location).toBe('Lokasi uji')
    await step('approved')
    await step('akad', { finalTerms })
    await step('disbursed')
    const audit = await api.admin.audit.list()
    expect(audit.items.filter((e) => e.action === 'application.transition' && e.resource.id === ids.app)).toHaveLength(7)
  }, 120_000)

  it('the user now monitors an active KPR, records a payment with proof, and deletes the account', async () => {
    await signInAs(people.user)
    const snap = await api.dashboard.getSnapshot()
    const m = snap.mortgages.find((x) => x.status === 'active')
    expect(m).toMatchObject({ source: 'application', originalPrincipal: 480_000_000 })
    const activities = await api.activities.list()
    expect(activities.map((a) => a.type)).toContain('application_completed')
    const paid = await api.mortgages.markPaid(m.id, { dueDate: shift(30), amount: m.currentPayment, paidAt: today, proof: pdf('bukti.pdf') })
    expect(paid.proof.path.startsWith(`${uid.user}/${m.id}/`)).toBe(true)
    if (KEEP) return
    expect(await api.auth.deleteAccount()).toEqual({ deleted: true })
    const { data } = await service.auth.admin.getUserById(uid.user)
    expect(data?.user ?? null).toBeNull()
    const { data: left } = await service.storage.from('application-documents').list(uid.user)
    expect(left ?? []).toHaveLength(0)
  }, 120_000)

  it('the admin publishes a Take Over product', async () => {
    await signInAs(people.staff)
    const created = await api.admin.products.create({
      values: {
        name: 'Take Over Uji Live',
        bankId: ids.bank,
        productTypes: ['takeover'],
        scheme: 'conventional',
        ratePeriods: [{ type: 'fixed', durationMonths: 36, rateBps: 450 }, { type: 'floating', durationMonths: null, rateBps: 900, estimated: true }],
        fees: { provisionBps: 50, admin: 500_000, appraisal: 1_000_000, notary: 2_000_000, insurance: 1_500_000 },
        eligibility: { maximumDtiBps: 4500, maximumLtvBps: 9000, maximumTenorMonths: 300 },
        effectiveFrom: shift(-30),
        effectiveUntil: shift(365),
        lastVerifiedAt: today,
      },
    })
    ids.product2 = created.product.id
    expect((await api.admin.products.publish(ids.product2, { reason: 'Uji integrasi', expectedVersion: created.product.rev })).product.status).toBe('published')
  }, 60_000)

  it('a KPR owner sets up monitoring: data, property and income, reminders, activation', async () => {
    await signInAs(people.monitor)
    await api.auth.acceptConsents({ name: 'Live Monitor', acceptTerms: true, acceptPrivacy: true })
    const draft = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(draft.id, {
      step: 1,
      values: {
        bankName: 'Bank Lama Uji', productName: 'KPR Fixed', scheme: 'conventional', originalPrincipal: 500_000_000, currentPayment: 4_500_000,
        originalTenorMonths: 240, startDate: shift(-3 * 365), dueDay: Number(shift(reminderOffset).slice(8)), currentRateType: 'fixed', currentRateBps: 750,
        fixedUntil: shift(60), estimatedFloatingRateBps: 1100, outstandingPrincipal: null, remainingTenorMonths: 204, outstandingEstimated: null,
      },
    })
    await api.mortgages.saveSetupStep(draft.id, {
      step: 2,
      values: {
        property: { type: 'landed_house', address: 'Jl. Uji', city: 'Kota Bekasi', estimatedValue: 900_000_000, valueAsOf: today, disputed: false, valueLater: false },
        finance: { monthlyIncome: 25_000_000, jointIncome: false, partnerIncome: null, vehicleDebt: 0, cardDebt: 0, otherDebt: 0, routineExpenses: null, emergencyFund: null },
      },
    })
    await api.mortgages.saveSetupStep(draft.id, { step: 3, values: { reminders: { payment: [7, 3, 1], fixedExpiry: [90, 60, 30, 14, 7], channels: { inApp: true, email: false, whatsapp: false } } } })
    const { mortgage } = await api.mortgages.activate(draft.id, { confirmDataCorrect: true })
    ids.monitorMortgage = mortgage.id
    expect(mortgage).toMatchObject({ status: 'active', outstandingEstimated: true })
    expect(mortgage.outstandingPrincipal).toBeGreaterThan(300_000_000)
    const types = (await api.activities.list()).map((a) => a.type)
    expect(types).toEqual(expect.arrayContaining(['mortgage_monitoring_activated', 'fixed_expiry_warning']))
  }, 60_000)

  it('Explore, the Take Over simulation and applying from it work on real data', async () => {
    await signInAs(people.monitor)
    const snap = await api.dashboard.getSnapshot()
    const m = snap.mortgages.find((x) => x.status === 'active')
    const explore = await api.explore.get()
    expect(explore).toMatchObject({ hasActiveMortgage: true, signals: { floating: true }, opportunity: { available: true } })
    expect(explore.education.length).toBeGreaterThan(0)
    const sim = await api.simulations.run({ source: { type: 'mortgage', id: m.id }, input: defaultTakeoverGoal(m) })
    const item = sim.items.find((x) => x.productId === ids.product2)
    expect(item).toBeTruthy()
    expect(item.payment).toBeGreaterThan(0)
    expect(sim.baseline.currentPayment).toBe(4_500_000)
    expect((await api.simulations.getCurrent({})).items.map((x) => x.productId)).toContain(ids.product2)
    const app = await api.simulations.apply({ bankProductId: ids.product2, tenorMonths: item.tenorMonths, plafon: null })
    expect(app).toMatchObject({ productType: 'takeover', status: 'draft', selection: { bankProductId: ids.product2 } })
    const p = await api.mortgages.markPaid(m.id, { dueDate: shift(reminderOffset), amount: m.currentPayment, paidAt: today })
    expect(p).toMatchObject({ status: 'paid', source: 'manual_user_recorded', bankConfirmed: false })
    await api.mortgages.removePayment(m.id, p.id)
    await api.activities.markAllRead()
    expect((await api.dashboard.getSnapshot()).unreadActivities).toBe(0)
    await api.dashboard.markTourSeen('my-kpr')
    expect((await api.dashboard.getSnapshot()).toursSeen).toContain('my-kpr')
  }, 120_000)

  it('the daily reminder job writes the owner reminders (only when no real KPR would be touched)', async () => {
    const [{ others }] = await sql("select count(*)::int as others from public.mortgages m join auth.users u on u.id = m.user_id where m.status = 'active' and u.email not like 'live-%@example.com'")
    if (others > 0) return // ponytail: never run the job by hand once real users have active KPRs
    await sql('select private.enqueue_reminders()')
    await signInAs(people.monitor)
    const list = await api.activities.list()
    expect(list.map((a) => a.title)).toContain(`Cicilan jatuh tempo ${reminderOffset} hari lagi`)
    expect(list.filter((a) => a.type === 'fixed_expiry_warning')).toHaveLength(2) // one at activation, one from the job
  }, 60_000)

  it('the admin manages users, configuration, KPR Health and reports, and every change is audited', async () => {
    await signInAs(people.staff)
    const users = await api.admin.users.list()
    expect(users.map((u) => u.contact)).toContain(people.monitor)
    let detail = await api.admin.users.get(uid.monitor)
    // The owner's own edits, recorded by the database triggers (migration user_changes), next to the admin's.
    const own = detail.audit.filter((e) => e.actor.role === 'user')
    expect(own.map((e) => e.action)).toEqual(expect.arrayContaining(['mortgage.activate', 'payment.mark', 'payment.unmark']))
    expect(own.find((e) => e.action === 'payment.mark')).toMatchObject({ resource: { type: 'mortgage', id: ids.monitorMortgage }, after: { dueDate: shift(reminderOffset), amount: 4_500_000 } })
    detail = await api.admin.users.updateProfile(uid.monitor, { values: { birthPlace: 'Bekasi' }, reason: 'Uji integrasi live', expectedVersion: detail.user.version })
    const fin = await api.admin.users.updateFinance(uid.monitor, { values: { monthlyIncome: 26_000_000 }, reason: 'Uji integrasi live', expectedVersion: detail.user.version })
    expect(fin.recalculated).toEqual(['dti', 'health'])
    const { config } = await api.admin.config.get()
    // A real change (the app refuses a save that changes nothing); afterAll restores the stored configuration.
    const reminders = { payment: [7, 3], fixedExpiry: [90, 60, 30, 14, 7], channels: { inApp: true, email: true, whatsapp: false } }
    await api.admin.config.update('reminders', { values: reminders, reason: 'Uji integrasi live', expectedVersion: config.version })
    const health = await api.admin.health.get()
    const params = structuredClone(HEALTH_V1.params)
    params.labels = { ...params.labels, healthy: params.labels.healthy + 1 }
    expect((await api.admin.health.preview({ params })).items.length).toBeGreaterThan(0)
    const published = await api.admin.health.publish({ params, reason: 'Uji integrasi live', expectedVersion: health.active.version })
    const rolled = await api.admin.health.rollback({ toVersion: health.active.version, reason: 'Uji integrasi live', expectedVersion: published.active.version })
    expect(rolled.active).toMatchObject({ version: published.active.version + 1, rollbackOf: health.active.version })
    const overview = await api.admin.overview.get()
    expect(overview.products.active).toBeGreaterThanOrEqual(2)
    const report = await api.admin.reports.get({})
    expect(report.users.registered).toBeGreaterThanOrEqual(1)
    const csv = await api.admin.reports.exportCsv({})
    expect(csv.csv.startsWith('id_pengajuan')).toBe(true)
    expect(csv.csv).not.toContain(people.monitor)
    const actions = (await api.admin.audit.list()).items.map((e) => e.action)
    expect(actions).toEqual(expect.arrayContaining(['user.profile.update', 'user.finance.update', 'config.update', 'health.publish', 'health.rollback', 'report.export', 'product.publish', 'bank.create']))
  }, 120_000)

  it('a content writer runs the article lifecycle and nothing else', async () => {
    await signInAs(people.writer)
    await api.auth.acceptConsents({ name: 'Live Writer', acceptTerms: true, acceptPrivacy: true })
    expect((await api.auth.getSession()).role).toBe('content_writer')
    const slug = `uji-live-${tag}`
    const draft = await api.admin.articles.create({ values: { title: 'Artikel Uji Live', slug, tag: 'Uji', icon: 'percent', summary: 'Ringkasan artikel uji live.', minutes: 2, body: ['Paragraf uji.'] } })
    ids.article = draft.article.id
    const live = await api.admin.articles.publish(ids.article, { reason: 'Uji integrasi live', expectedVersion: draft.article.rev })
    expect(live.article.status).toBe('published')
    await expect(api.admin.users.list()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(api.admin.applications.list()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await signInAs(people.monitor)
    expect((await api.explore.article(slug)).title).toBe('Artikel Uji Live')
    await signInAs(people.writer)
    await api.admin.articles.archive(ids.article, { reason: 'Uji integrasi live', expectedVersion: live.article.rev })
    await signInAs(people.monitor)
    await expect(api.explore.article(slug)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  }, 120_000)

  it.skipIf(KEEP)('the KPR owner deletes the account with a Take Over draft; everything of theirs goes', async () => {
    await signInAs(people.monitor)
    expect(await api.auth.deleteAccount()).toEqual({ deleted: true })
    const [{ left }] = await sql(`select (select count(*) from public.mortgages where user_id = '${uid.monitor}') + (select count(*) from public.applications where user_id = '${uid.monitor}') + (select count(*) from public.activities where user_id = '${uid.monitor}') + (select count(*) from public.reminder_deliveries where user_id = '${uid.monitor}') as left`)
    expect(Number(left)).toBe(0)
  }, 60_000)
})
