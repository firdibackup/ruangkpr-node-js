import { describe, expect, it } from 'vitest'
import { addDays } from '@/calculations/dates'
import { calculateMaxPrincipal } from '@/calculations/finance'
import { selectHomeState } from '@/domains/home/selectHomeState'
import { defaultTakeoverGoal, takeoverGaps } from '@/domains/optimize/validation'
import { deriveMortgage } from '@/domains/mortgages/derive'
import { remainingFromStart } from '@/domains/mortgages/validation'
import { createMockApi, mockControls } from './mockApi'
import { DEFAULT_REMINDERS, DEMO_PASSWORD, SCENARIOS, createSeed } from './seed'
import { loadDb, saveDb } from './mockDb'
import { DEFAULT_SUPPORT, bookingLink, calendarEmbedLink, whatsappLink } from './support'

const api = createMockApi({ latencyMs: 0 })
const file = (name, size = 200_000, type = 'image/jpeg') => ({ name, size, type })
const expectCode = async (promise, code) => {
  await expect(promise).rejects.toMatchObject({ name: 'ApiError', code })
}
// The demo keeps its own clock; Supabase mode reads the real date.
const setClock = (date) => {
  const db = loadDb()
  db.clock = date
  saveDb(db)
}
const register = (name, email, password = DEMO_PASSWORD) => api.auth.signUp({ name, email, password, confirm: password, acceptTerms: true, acceptPrivacy: true })
// An account this browser knows signs in with the demo password; any other email registers first.
const signIn = async (name, email) => {
  await api.auth.logout()
  try {
    await api.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
  } catch (e) {
    if (e.code !== 'INVALID_CREDENTIALS') throw e
    await register(name, email)
    await api.auth.verifySignup({ token: '148260' })
  }
  if ((await api.auth.getSession()).status === 'onboarding') await api.auth.acceptConsents({ name, acceptTerms: true, acceptPrivacy: true })
}

describe('auth', () => {
  it('registration: code fixtures (000000 invalid, 999999 expired, 148260 ok); the account exists, agreed, once verified', async () => {
    mockControls.reset('guest')
    await expectCode(register('Nadia Putri', 'x'), 'VALIDATION_FAILED')
    await expectCode(api.auth.signUp({ name: 'Nadia Putri', email: 'nadia@example.com', password: 'rumah2026', confirm: 'rumah2026', acceptTerms: true, acceptPrivacy: false }), 'VALIDATION_FAILED')
    await expectCode(register('Admin', 'admin@ruangkpr.id'), 'EMAIL_TAKEN')
    const r = await register('Nadia Putri', ' Nadia@Example.com ', 'rumah2026')
    expect(r.maskedDestination).toBe('na***@example.com')
    expect(await api.auth.getSession()).toMatchObject({ status: 'pending', verification: { maskedDestination: 'na***@example.com' } })
    await expectCode(api.dashboard.getSnapshot(), 'AUTH_REQUIRED')
    await expectCode(api.auth.signInWithPassword({ email: 'nadia@example.com', password: 'rumah2026' }), 'INVALID_CREDENTIALS') // not an account yet
    await register('Nadia Putri', 'nadia@example.com', 'rumah2026')
    await expectCode(api.auth.verifySignup({ token: '000000' }), 'OTP_INVALID')
    await expectCode(api.auth.verifySignup({ token: '999999' }), 'OTP_EXPIRED')
    await api.auth.verifySignup({ token: '148260' })
    expect(await api.auth.getSession()).toMatchObject({ status: 'authenticated', role: 'user' })
    const snap = await api.dashboard.getSnapshot()
    expect(snap.user).toMatchObject({ name: 'Nadia Putri', contact: 'nadia@example.com', contactType: 'email' })
    expect(snap.profile.consents.map((c) => [c.type, c.version])).toEqual([['terms', '2026-09-01'], ['privacy', '2026-09-01']])
    expect(snap.applications).toHaveLength(0) // signing in never creates an application
    await api.auth.logout()
    await expectCode(api.auth.signInWithPassword({ email: 'nadia@example.com', password: DEMO_PASSWORD }), 'INVALID_CREDENTIALS')
    await api.auth.signInWithPassword({ email: 'NADIA@example.com', password: 'rumah2026' })
    expect((await api.auth.getSession()).status).toBe('authenticated')
  })

  it('login: the same answer for a wrong password and an unknown email; seeded and staff accounts use the demo password', async () => {
    mockControls.reset('guest')
    await expectCode(api.auth.signInWithPassword({ email: 'admin@ruangkpr.id', password: '' }), 'VALIDATION_FAILED')
    const wrong = api.auth.signInWithPassword({ email: 'admin@ruangkpr.id', password: 'salah123' })
    await expect(wrong).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' })
    await expect(api.auth.signInWithPassword({ email: 'siapa@example.com', password: DEMO_PASSWORD })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' })
    await api.auth.signInWithPassword({ email: 'penulis@ruangkpr.id', password: DEMO_PASSWORD })
    expect(await api.auth.getSession()).toMatchObject({ status: 'authenticated', role: 'content_writer' })
  })

  it('forgot password: one answer for any email; the link signs in to set a new password; the old one stops working', async () => {
    mockControls.reset('guest')
    await api.auth.requestPasswordReset({ email: 'siapa@example.com' })
    expect((await api.auth.getSession()).status).toBe('guest')
    await expectCode(api.auth.openResetLink(), 'OTP_INVALID') // no account, no link
    const r = await api.auth.requestPasswordReset({ email: 'Sinta@RuangKPR.id' })
    expect(r.maskedDestination).toBe('si***@ruangkpr.id')
    await expectCode(api.auth.updatePassword({ password: 'rumah2026', confirm: 'rumah2026' }), 'INVALID_STATE_TRANSITION') // link not opened yet
    await api.auth.openResetLink()
    expect(await api.auth.getSession()).toMatchObject({ status: 'recovery', role: null, user: { contact: 'sinta@ruangkpr.id' } })
    await expectCode(api.auth.openResetLink(), 'OTP_INVALID') // a link works once
    await expectCode(api.auth.updatePassword({ password: 'pendek', confirm: 'pendek' }), 'VALIDATION_FAILED')
    await api.auth.updatePassword({ password: 'rumah2026', confirm: 'rumah2026' })
    expect(await api.auth.getSession()).toMatchObject({ status: 'authenticated', role: 'super_admin' })
    await api.auth.logout()
    await expectCode(api.auth.signInWithPassword({ email: 'sinta@ruangkpr.id', password: DEMO_PASSWORD }), 'INVALID_CREDENTIALS')
    await api.auth.signInWithPassword({ email: 'sinta@ruangkpr.id', password: 'rumah2026' })
  })

  it('change password needs the current one; signing in again uses the new one', async () => {
    mockControls.reset('fresh')
    await expectCode(api.auth.changePassword({ currentPassword: 'salah123', password: 'rumah2026', confirm: 'rumah2026' }), 'VALIDATION_FAILED')
    await api.auth.changePassword({ currentPassword: DEMO_PASSWORD, password: 'rumah2026', confirm: 'rumah2026' })
    await api.auth.logout()
    await expectCode(api.auth.signInWithPassword({ email: 'firdi.audi@email.com', password: DEMO_PASSWORD }), 'INVALID_CREDENTIALS')
    await api.auth.signInWithPassword({ email: 'firdi.audi@email.com', password: 'rumah2026' })
    await api.auth.logout()
    await expectCode(api.auth.changePassword({ currentPassword: 'rumah2026', password: 'rumah2027', confirm: 'rumah2027' }), 'AUTH_REQUIRED')
  })

  it('Google opens the demo Google account; signing in again skips consent', async () => {
    mockControls.reset('guest')
    await api.auth.signInWithGoogle()
    expect(await api.auth.getSession()).toMatchObject({ status: 'onboarding', user: { contact: 'firdi.audi@email.com', name: 'Firdi Audi' } })
    await api.auth.acceptConsents({ name: 'Firdi Audi', acceptTerms: true, acceptPrivacy: true })
    await api.auth.logout()
    await api.auth.signInWithGoogle()
    expect(await api.auth.getSession()).toMatchObject({ status: 'authenticated', role: 'user' })
  })

  it('deleteAccount archives the signed-in account; registering again starts empty', async () => {
    mockControls.reset('mortgage_active_normal')
    const old = await api.dashboard.getSnapshot()
    await api.auth.deleteAccount()
    const archive = loadDb().accountArchives[0]
    expect(archive.originalUserId).toBe(old.user.id)
    expect(archive.snapshot.mortgages).toHaveLength(1)
    expect(archive.snapshot.profile.nik).toBe(old.profile.nik)
    expect((await api.auth.getSession()).status).toBe('guest')
    await expectCode(api.dashboard.getSnapshot(), 'AUTH_REQUIRED')
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    const snap = await api.dashboard.getSnapshot()
    expect(snap.profile.nik).toBeUndefined()
    expect(snap.mortgages).toHaveLength(0)
    expect(snap.applications).toHaveLength(0)
    expect(snap.user.id).not.toBe(old.user.id)
    await expectCode(api.admin.archives.list(), 'FORBIDDEN')
    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    expect(await api.admin.archives.list()).toEqual([expect.objectContaining({ id: archive.id, mortgageCount: 1 })])
    expect((await api.admin.archives.get(archive.id)).snapshot.mortgages).toHaveLength(1)
    await expectCode(api.admin.archives.remove(archive.id, { reason: '' }), 'VALIDATION_FAILED')
    await api.admin.archives.remove(archive.id, { reason: 'Permintaan penghapusan arsip' })
    expect(await api.admin.archives.list()).toEqual([])
    expect(loadDb().auditLog.some((e) => e.action === 'account_archive.delete')).toBe(true)
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    expect((await api.dashboard.getSnapshot()).user.id).toBe(snap.user.id)
  })

  it('deleteAccount is blocked while an application is at the bank', async () => {
    mockControls.reset('application_in_process')
    await expectCode(api.auth.deleteAccount(), 'INVALID_STATE_TRANSITION')
    expect((await api.dashboard.getSnapshot()).user).toBeTruthy()
  })
})

describe('accounts and admin access', () => {
  it('a new contact gets its own empty account; the earlier account comes back intact on its next login', async () => {
    mockControls.reset('mortgage_active_normal')
    await signIn('Nadia Putri', 'nadia@example.com')
    expect((await api.dashboard.getSnapshot()).mortgages).toHaveLength(0)
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    const snap = await api.dashboard.getSnapshot()
    expect(snap.user.id).toBe('usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE')
    expect(snap.mortgages).toHaveLength(1)
  })

  it('the admin signs in through the same OTP flow and gets super_admin; a logged-out session has no role', async () => {
    mockControls.reset('fresh')
    expect((await api.auth.getSession()).role).toBe('user')
    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    expect(await api.auth.getSession()).toMatchObject({ status: 'authenticated', role: 'super_admin' })
    await api.auth.logout()
    expect((await api.auth.getSession()).role).toBeNull()
  })

  it('admin operations need a session and the super_admin role', async () => {
    mockControls.reset('fresh')
    await expectCode(api.admin.users.list(), 'FORBIDDEN')
    await api.auth.logout()
    await expectCode(api.admin.users.list(), 'AUTH_REQUIRED')
  })

  it('the admin user list holds app registrations and sample users from localStorage, never the admin', async () => {
    mockControls.reset('fresh')
    await signIn('Nadia Putri', 'nadia@example.com')
    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    const users = await api.admin.users.list()
    expect(users.map((u) => u.name)).toEqual(expect.arrayContaining(['Firdi Audi', 'Nadia Putri', 'Budi Santoso']))
    expect(users.map((u) => u.name)).not.toContain('Admin Maxi')
    expect(users.find((u) => u.name === 'Budi Santoso')).toMatchObject({ activeApplicationStatus: 'additional_docs_requested', hasActiveMortgage: false })
    expect(users.find((u) => u.name === 'Nadia Putri')).toMatchObject({ contact: 'nadia@example.com', activeApplicationStatus: null, hasActiveMortgage: false })
  })

  it('deleteAccount removes only the signed-in account; other accounts stay and new ids stay unique', async () => {
    mockControls.reset('fresh')
    await signIn('Nadia Putri', 'nadia@example.com')
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    await api.auth.deleteAccount()
    await signIn('Rudi Hartono', 'rudi@example.com')
    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    const users = await api.admin.users.list()
    expect(users.map((u) => u.name)).toEqual(expect.arrayContaining(['Nadia Putri', 'Rudi Hartono']))
    expect(users.map((u) => u.name)).not.toContain('Firdi Audi')
    expect(new Set(users.map((u) => u.id)).size).toBe(users.length)
  })

  it('the overview counts every user account: queue longest-waiting first, pipeline, funnel, product validity', async () => {
    mockControls.reset('admin_ops')
    const o = await api.admin.overview.get()
    expect(o.users).toEqual({ total: 9 })
    expect(o.applications).toMatchObject({
      needsReview: 1,
      waitingOnUser: 1,
      atBank: 4,
      byStatus: { docs_verification: 1, additional_docs_requested: 1, bank_processing: 2, appraisal: 1, approved: 1, rejected: 1, disbursed: 1 },
      funnel: { submitted: 8, approved: 2, disbursed: 1 },
    })
    // Budi waits on the user (additional docs), so he is not in the admin's queue.
    expect(o.applications.queue.map((q) => [q.userName, q.status, q.waitingDays])).toEqual([
      ['Agus Pratama', 'approved', 14],
      ['Dewi Lestari', 'appraisal', 10],
      ['Firdi Audi', 'bank_processing', 3],
      ['Sari Wulandari', 'bank_processing', 1],
      ['Rina Hartati', 'docs_verification', 1],
    ])
    // Two weeks day by day up to the clock (28 Sep): seven submitted in them, one (Agus, 10 Sep) the two weeks before.
    const { trend } = o.applications
    expect([trend.length, trend[0].from, trend.at(-1).to]).toEqual([14, '2026-09-15', '2026-09-28'])
    expect(trend.reduce((n, d) => n + d.submitted, 0)).toBe(7)
    expect(o.applications.previousSubmitted).toBe(1)
    expect(o.products).toMatchObject({ active: 6, expired: 0, stale: 1 })
    expect(o.products.nearestExpiry[0]).toMatchObject({ effectiveUntil: '2026-12-31', daysLeft: 94 })
    expect(o.products.nearestExpiry.find((p) => p.bankName === 'Bank GHI')).toMatchObject({ stale: true })
    mockControls.reset('fresh')
    await expectCode(api.admin.overview.get(), 'FORBIDDEN')
  })

  it('user search and filters run over every stored account, newest first', async () => {
    mockControls.reset('admin_ops')
    expect((await api.admin.users.list({ query: 'BUDI' })).map((u) => u.name)).toEqual(['Budi Santoso'])
    expect((await api.admin.users.list({ query: 'hendra.gunawan@' })).map((u) => u.name)).toEqual(['Hendra Gunawan'])
    expect((await api.admin.users.list({ hasActiveMortgage: true })).map((u) => u.name).sort()).toEqual(['Sari Wulandari', 'Yoga Saputra'])
    expect((await api.admin.users.list({ inProcess: false })).map((u) => u.name).sort()).toEqual(['Hendra Gunawan', 'Maya Putri', 'Yoga Saputra'])
    expect((await api.admin.users.list()).map((u) => u.name).slice(0, 2)).toEqual(['Maya Putri', 'Rina Hartati'])
  })

  it('user detail masks the NIK and never returns the raw number', async () => {
    mockControls.reset('admin_ops')
    const d = await api.admin.users.get('usr_sample_02')
    expect(d.user).toMatchObject({ name: 'Budi Santoso', contact: 'budi.santoso@example.com', version: 1 })
    expect(d.profile.nikMasked).toBe('3276********0002')
    expect(JSON.stringify(d)).not.toContain('3276010000000002')
    expect(d.applications).toEqual([expect.objectContaining({ id: 'app_sample_02', status: 'additional_docs_requested' })])
    await expectCode(api.admin.users.get('usr_tidak_ada'), 'RESOURCE_NOT_FOUND')
  })

  it('user detail carries each whole KPR and the published Health formula for the admin KPR page', async () => {
    mockControls.reset('admin_ops')
    const d = await api.admin.users.get('usr_sample_05')
    expect(d.mortgages).toEqual([expect.objectContaining({ id: 'mtg_sample_05', remainingTenorMonths: expect.any(Number), payments: [], reminders: expect.any(Object) })])
    expect(d.mortgages[0].rateHistory).toHaveLength(2)
    expect(d.mortgages[0].property.address).toBe('Jl. Contoh No. 5, Kota Bekasi')
    expect(d.health).toEqual({ version: expect.any(Number), params: expect.objectContaining({ dti: expect.any(Array) }) })
  })

  it("user detail history puts the user's own edits next to the admin's, newest first", async () => {
    mockControls.reset('admin_ops')
    const own = (await api.admin.users.get('usr_sample_05')).audit
    expect(own.map((e) => e.action)).toEqual(['mortgage.update', 'profile', 'finance', 'profile', 'mortgage.update', 'profile'])
    expect(own.every((e) => e.actor.id === 'usr_sample_05' && e.actor.name === 'Sari Wulandari' && e.actor.role === 'user')).toBe(true)
    expect(own[0]).toMatchObject({ resource: { type: 'mortgage', id: 'mtg_sample_05' }, after: { 'property.estimatedValue': 850_000_000 } })
    const d = await api.admin.users.updateFinance('usr_sample_05', { values: { monthlyIncome: 20_000_000 }, reason: 'Slip gaji terbaru', expectedVersion: 1 })
    expect(d.audit).toHaveLength(7) // the whole history: the panels cut it, the history page does not
    expect(d.audit.map((e) => e.action).slice(0, 2)).toEqual(['user.finance.update', 'mortgage.update'])
    expect(d.audit[0].actor.role).toBeUndefined()
  })

  it('profile edits need a reason and the current version; each one is audited with the NIK masked', async () => {
    mockControls.reset('admin_ops')
    const edit = (values, extra = {}) => api.admin.users.updateProfile('usr_sample_02', { values, reason: 'Koreksi sesuai KTP', expectedVersion: 1, ...extra })
    await expectCode(edit({ address: 'Jl. Baru No. 1, Kota Bekasi' }, { reason: ' ' }), 'VALIDATION_FAILED')
    await expectCode(edit({ email: 'bukan-email' }), 'VALIDATION_FAILED')
    const d = await edit({ address: 'Jl. Baru No. 1, Kota Bekasi', nik: '3276019999990002' })
    expect(d.user.version).toBe(2)
    expect(d.profile).toMatchObject({ address: 'Jl. Baru No. 1, Kota Bekasi', nikMasked: '3276********0002' })
    await expectCode(edit({ address: 'Jl. Lain No. 2, Kota Bekasi' }), 'CONFLICT_VERSION') // still sends version 1
    const [event] = d.audit
    expect(event).toMatchObject({ action: 'user.profile.update', resource: { type: 'user', id: 'usr_sample_02' }, reason: 'Koreksi sesuai KTP', actor: { id: 'usr_admin_01' } })
    expect(event.after).toMatchObject({ address: 'Jl. Baru No. 1, Kota Bekasi', nik: '3276********0002' })
    expect(JSON.stringify(event)).not.toMatch(/3276019999990002|3276010000000002/)
    expect((await api.admin.overview.get()).recentActivity[0]).toMatchObject({ action: 'user.profile.update' })
  })

  it('finance edits reach the user\'s KPR copy (KPR Health reads it) and say what was recalculated', async () => {
    mockControls.reset('admin_ops')
    const d = await api.admin.users.updateFinance('usr_sample_05', { values: { monthlyIncome: 20_000_000 }, reason: 'Slip gaji terbaru', expectedVersion: 1 })
    expect(d.recalculated).toEqual(['dti', 'health'])
    expect(d.finance.monthlyIncome).toBe(20_000_000)
    const budi = await api.admin.users.updateFinance('usr_sample_02', { values: { cardDebt: 750_000 }, reason: 'Tagihan kartu terbaru', expectedVersion: 1 })
    expect(budi.recalculated).toEqual(['dti']) // no KPR to recalculate
    await expectCode(api.admin.users.updateFinance('usr_sample_02', { values: { cardDebt: -1 }, reason: 'Salah ketik', expectedVersion: 2 }), 'VALIDATION_FAILED')
    await signIn('Sari Wulandari', 'sari.wulandari@example.com')
    expect((await api.dashboard.getSnapshot()).mortgages[0].finance.monthlyIncome).toBe(20_000_000)
  })

  it('admin_ops starts signed in as super admin with sample applications waiting in the queue', async () => {
    mockControls.reset('admin_ops')
    expect((await api.auth.getSession()).role).toBe('super_admin')
    const statuses = (await api.admin.users.list()).map((u) => u.activeApplicationStatus)
    expect(statuses).toEqual(expect.arrayContaining(['docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal', 'approved', 'rejected']))
  })
})

describe('admin applications', () => {
  const move = (id, toStatus, expectedVersion, metadata = {}) => api.admin.applications.transition(id, { toStatus, reason: 'Dicek tim operasional', expectedVersion, metadata })
  const review = (id, documentType, expectedVersion, verdict = { result: 'ok' }) => api.admin.applications.reviewDocument(id, { documentType, expectedVersion, ...verdict })
  const fileOf = (d, type) => d.application.documents.find((x) => x.type === type).file

  it('follows the status matrix: legal moves only, for primary and take over', async () => {
    mockControls.reset('admin_ops')
    // A submit lands in docs_verification: there is no separate "start verifying" move any more.
    let d = await api.admin.applications.get('app_sample_01')
    expect(d.allowedTransitions).toEqual(['additional_docs_requested', 'bank_processing'])
    await expectCode(move('app_sample_01', 'docs_verification', 3), 'INVALID_STATE_TRANSITION')
    await expectCode(move('app_sample_01', 'bank_processing', 3), 'INVALID_STATE_TRANSITION') // documents not checked yet
    await expectCode(move('app_sample_01', 'rejected', d.application.version, { code: 'DTI_ABOVE_BANK_POLICY', displayReason: 'Rasio cicilan terlalu tinggi.' }), 'INVALID_STATE_TRANSITION')
    expect((await api.admin.applications.get('app_sample_04')).allowedTransitions).toEqual(['akad'])
    d = await move('app_sample_05', 'appraisal', 6)
    d = await move('app_sample_05', 'approved', d.application.version)
    expect(d.allowedTransitions).toEqual(['old_mortgage_settlement'])
    expect((await api.admin.applications.get('app_sample_02')).allowedTransitions).toEqual([]) // waits on the user
  })

  it('documents are reviewed one by one while verifying; a rejection stays a draft the user cannot see', async () => {
    mockControls.reset('admin_ops')
    await expectCode(review('app_sample_06', 'ktp', 3), 'INVALID_STATE_TRANSITION') // rejected: past verification
    let d = await review('app_sample_01', 'ktp', 3) // straight from the submit, no move first
    expect(fileOf(d, 'ktp').status).toBe('verified')
    await expectCode(review('app_sample_01', 'npwp', d.application.version, { result: 'rejected', reasonCode: 'other', note: ' ' }), 'VALIDATION_FAILED')
    await expectCode(review('app_sample_01', 'npwp', d.application.version, { result: 'rejected', reasonCode: 'tidak_ada' }), 'VALIDATION_FAILED')
    await expectCode(review('app_sample_01', 'additional', d.application.version), 'INVALID_STATE_TRANSITION') // no file
    d = await review('app_sample_01', 'npwp', d.application.version, { result: 'rejected', reasonCode: 'blurry', note: ' angka NPWP tidak terbaca ' })
    expect(fileOf(d, 'npwp')).toMatchObject({ status: 'uploaded', review: { reasonCode: 'blurry', note: 'angka NPWP tidak terbaca' } })
    d = await review('app_sample_01', 'ktp', d.application.version, { result: 'rejected', reasonCode: 'expired' })
    expect(fileOf(d, 'ktp')).toMatchObject({ status: 'uploaded', review: { reasonCode: 'expired', note: '' } })
    d = await review('app_sample_01', 'ktp', d.application.version)
    expect(fileOf(d, 'ktp').status).toBe('verified')
    expect(fileOf(d, 'ktp').review).toBeUndefined()
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'application.document_review', before: { document: 'KTP', result: 'Kedaluwarsa' }, after: { document: 'KTP', result: 'Sesuai' } })
    await signIn('Rina Hartati', 'rina.hartati@example.com')
    expect((await api.dashboard.getSnapshot()).applications[0].pendingActions).toEqual([])
    expect((await api.activities.list()).some((a) => a.type === 'additional_document_requested')).toBe(false)
  })

  it('stale review conflicts', async () => {
    mockControls.reset('admin_ops')
    await review('app_sample_01', 'ktp', 3)
    await expectCode(review('app_sample_01', 'npwp', 3), 'CONFLICT_VERSION')
  })

  it('sending turns every drafted rejection into one request the user sees per document; the bank waits for all verified', async () => {
    mockControls.reset('admin_ops')
    let d = await api.admin.applications.get('app_sample_01')
    await expectCode(move('app_sample_01', 'additional_docs_requested', d.application.version), 'VALIDATION_FAILED') // nothing rejected yet
    for (const t of ['ktp', 'property_document']) d = await review('app_sample_01', t, d.application.version)
    await expectCode(move('app_sample_01', 'bank_processing', d.application.version), 'INVALID_STATE_TRANSITION')
    d = await review('app_sample_01', 'npwp', d.application.version, { result: 'rejected', reasonCode: 'blurry', note: 'angka NPWP tidak terbaca' })
    d = await review('app_sample_01', 'income_proof', d.application.version, { result: 'rejected', reasonCode: 'expired' })
    d = await move('app_sample_01', 'additional_docs_requested', d.application.version)
    expect(fileOf(d, 'npwp')).toMatchObject({ status: 'needs_update', invalidReason: 'Buram / tidak terbaca: angka NPWP tidak terbaca' })
    expect(fileOf(d, 'npwp').review).toBeUndefined()
    expect(d.application.pendingActions.map((p) => [p.documentType, p.message])).toEqual([
      ['npwp', 'Buram / tidak terbaca: angka NPWP tidak terbaca'],
      ['income_proof', 'Kedaluwarsa'],
    ])

    await signIn('Rina Hartati', 'rina.hartati@example.com')
    expect((await api.activities.list()).filter((a) => a.type === 'additional_document_requested')).toEqual([
      expect.objectContaining({ title: 'Dokumen perlu diunggah ulang', body: 'NPWP, Slip Gaji / Bukti Penghasilan perlu diperbarui.' }),
    ])
    const [app] = (await api.dashboard.getSnapshot()).applications
    expect((await api.applications.uploadDocument(app.id, { documentType: 'npwp', file: file('npwp-baru.pdf', 200_000, 'application/pdf') })).status).toBe('additional_docs_requested')
    const back = await api.applications.uploadDocument(app.id, { documentType: 'income_proof', file: file('slip-baru.pdf', 200_000, 'application/pdf') })
    expect(back.status).toBe('docs_verification')
    expect(back.documents.npwp).toMatchObject({ status: 'uploaded', invalidReason: null })
    expect((await api.activities.list())[0]).toMatchObject({ type: 'document_replaced', body: 'Menunggu verifikasi dari tim Maxi.' })

    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    d = await api.admin.applications.get('app_sample_01')
    for (const t of ['npwp', 'income_proof']) d = await review('app_sample_01', t, d.application.version)
    d = await move('app_sample_01', 'bank_processing', d.application.version)
    expect(d.application.status).toBe('bank_processing')
  })

  it('an unsent rejection on an optional document also holds the application back from the bank', async () => {
    mockControls.reset('admin_ops')
    const db = loadDb()
    db.accounts.flatMap((a) => a.applications).find((x) => x.id === 'app_sample_01').documents.additional = { status: 'uploaded', fileName: 'kk.pdf', sizeBytes: 1000, contentType: 'application/pdf', uploadedAt: '2026-09-18', invalidReason: null }
    saveDb(db)
    let d = await api.admin.applications.get('app_sample_01')
    for (const t of ['ktp', 'npwp', 'income_proof', 'property_document']) d = await review('app_sample_01', t, d.application.version)
    d = await review('app_sample_01', 'additional', d.application.version, { result: 'rejected', reasonCode: 'cropped' })
    await expectCode(move('app_sample_01', 'bank_processing', d.application.version), 'INVALID_STATE_TRANSITION')
    d = await review('app_sample_01', 'additional', d.application.version)
    expect((await move('app_sample_01', 'bank_processing', d.application.version)).application.status).toBe('bank_processing')
  })

  it('a rejection needs a known reason code and a user-facing explanation, which the user then sees', async () => {
    mockControls.reset('admin_ops')
    await expectCode(move('app_sample_03', 'rejected', 3, { code: 'TIDAK_ADA', displayReason: 'Ditolak bank.' }), 'VALIDATION_FAILED')
    const d = await move('app_sample_03', 'rejected', 3, { code: 'DTI_ABOVE_BANK_POLICY', displayReason: 'Rasio cicilan melebihi batas bank.' })
    expect(d.application.rejection).toMatchObject({ code: 'DTI_ABOVE_BANK_POLICY', relevantStep: 2 })
    await signIn('Dewi Lestari', 'dewi.lestari@example.com')
    expect((await api.dashboard.getSnapshot()).applications[0].rejection.displayReason).toBe('Rasio cicilan melebihi batas bank.')
  })

  it('akad records the final terms; disbursement activates the KPR from them, not from the simulation', async () => {
    mockControls.reset('admin_ops')
    const finalTerms = { loanAmount: 480_000_000, tenorMonths: 240, fixedRateBps: 525, fixedMonths: 60, floatingRateBps: 1050, akadDate: '2026-10-05' }
    await expectCode(move('app_sample_04', 'akad', 3), 'VALIDATION_FAILED')
    let d = await move('app_sample_04', 'akad', 3, { finalTerms })
    d = await move('app_sample_04', 'disbursed', d.application.version)
    expect(d.application.status).toBe('disbursed')
    await signIn('Agus Pratama', 'agus.pratama@example.com')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    expect(m).toMatchObject({ status: 'active', originalPrincipal: 480_000_000, startDate: '2026-10-05', currentRateBps: 525, fixedUntil: '2031-10-05' })
  })

  it('stale versions conflict, notes stay internal, and the detail masks the NIK', async () => {
    mockControls.reset('admin_ops')
    await review('app_sample_01', 'ktp', 3)
    await expectCode(move('app_sample_01', 'bank_processing', 3), 'CONFLICT_VERSION')
    const d = await api.admin.applications.addNote('app_sample_01', { text: 'Catatan rahasia tim: cek ulang slip gaji.' })
    expect(d.notes[0]).toMatchObject({ text: 'Catatan rahasia tim: cek ulang slip gaji.', author: { name: 'Admin Maxi' } })
    expect(d.application.data.personal.nik).toBe('3276********0001')
    expect(JSON.stringify(d)).not.toContain('3276010000000001')
    await signIn('Rina Hartati', 'rina.hartati@example.com')
    expect(JSON.stringify(await api.dashboard.getSnapshot())).not.toContain('Catatan rahasia tim')
  })

  it('the queue filters by status, pending action, bank, and search; drafts are never listed', async () => {
    mockControls.reset('admin_ops')
    const ids = async (f) => (await api.admin.applications.list(f)).items.map((x) => x.id).sort()
    expect(await ids({ status: 'bank_processing' })).toEqual(['app_01J8Z19RZ4VE4Q2AB7M5N8XKCF', 'app_sample_05'])
    expect(await ids({ pendingAction: true })).toEqual(['app_sample_02'])
    expect(await ids({ bankName: 'Bank DEF' })).toEqual(['app_sample_03'])
    expect(await ids({ query: 'rina' })).toEqual(['app_sample_01'])
    expect(await ids({ query: 'Firdi.Audi@email.com' })).toEqual(['app_01J8Z19RZ4VE4Q2AB7M5N8XKCF']) // the email CS gets on WhatsApp / cal.com
    expect((await api.admin.applications.list()).items).toHaveLength(8)
  })

  it('the team keeps one editable note per stage for the user; appraisal needs the agreed schedule', async () => {
    mockControls.reset('admin_ops')
    const id = 'app_01J8Z19RZ4VE4Q2AB7M5N8XKCF' // Firdi Audi, bank_processing
    const save = (expectedVersion, note) => api.admin.applications.saveStageNote(id, { expectedVersion, ...note })
    await expectCode(api.admin.applications.saveStageNote('app_sample_06', { message: 'Pesan untuk pengajuan ditolak.', expectedVersion: 3 }), 'INVALID_STATE_TRANSITION')
    let d = await api.admin.applications.get(id)
    await expectCode(save(d.application.version, { message: 'ok' }), 'VALIDATION_FAILED')
    d = await save(d.application.version, { message: 'Bank minta 5 hari kerja untuk analisis.' })
    expect(d.application.stageNotes.bank_processing).toMatchObject({ message: 'Bank minta 5 hari kerja untuk analisis.', schedule: null })
    d = await move(id, 'appraisal', d.application.version)
    expect(d.application.stageNotes.appraisal).toBeUndefined()
    await expectCode(save(d.application.version, { message: '', schedule: { date: '2026-10-18', time: '25:00', location: 'Jl. Melati 12' } }), 'VALIDATION_FAILED')
    d = await save(d.application.version, { message: 'Siapkan IMB/PBG asli.', schedule: { date: '2026-10-18', time: '10:00', location: 'Jl. Melati 12, Bekasi' } })
    d = await save(d.application.version, { message: 'Siapkan IMB/PBG asli.', schedule: { date: '2026-10-19', time: '09:30', location: 'Jl. Melati 12, Bekasi' } })
    await expectCode(save(1, { message: 'Versi lama.' }), 'CONFLICT_VERSION')
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'application.stage_note', after: { status: 'appraisal', schedule: { date: '2026-10-19', time: '09:30' } } })

    await signIn('Firdi Audi', 'firdi.audi@email.com')
    const app = (await api.dashboard.getSnapshot()).applications.find((x) => x.id === id)
    expect(app.stageNotes.appraisal).toMatchObject({ message: 'Siapkan IMB/PBG asli.', schedule: { date: '2026-10-19', time: '09:30', location: 'Jl. Melati 12, Bekasi' } })
    const activity = await api.activities.list()
    expect(activity.filter((a) => a.type === 'application_stage_note').map((a) => a.title)).toEqual(['Info Appraisal diperbarui', 'Info baru dari tim · Appraisal', 'Info baru dari tim · Proses Bank'])
    expect(JSON.stringify(activity)).not.toContain('Siapkan IMB')
  })
})

describe('admin cover letter', () => {
  const FIRDI = 'app_01J8Z19RZ4VE4Q2AB7M5N8XKCF' // KPR Primary at the bank: Bank ABC, Rp400 jt
  const office = { officeName: 'RE/MAX Eagle Citraland', logoLabel: 'Eagle', maName: 'Like', maId: 'R230021', boName: 'Budiono Yuwono', feeAccount: 'Rek. Bank BCA 511.010.6060 a/n PT. BUANA JAYA MAPAN' }
  const saveOffice = async (values = office, reason = 'Data kantor RE/MAX') => api.admin.config.update('coverLetter', { values, reason, expectedVersion: (await api.admin.config.get()).config.version })

  it('prefills from the application and the office defaults, only once the application is at the bank', async () => {
    mockControls.reset('admin_ops')
    await expectCode(api.admin.applications.coverLetter('app_sample_01'), 'INVALID_STATE_TRANSITION') // docs_verification
    await expectCode(api.admin.applications.coverLetter('app_sample_06'), 'INVALID_STATE_TRANSITION') // rejected
    await expectCode(api.admin.applications.coverLetter('app_nope'), 'RESOURCE_NOT_FOUND')
    await saveOffice()
    const d = await api.admin.applications.coverLetter(FIRDI)
    expect(d).toMatchObject({ variant: 'primary', saved: false, application: { id: FIRDI, userName: 'Firdi Audi' }, rows: { second: { title: 'Dokumen Penjual' } } })
    expect(d.letter).toEqual({
      ...office,
      customerName: 'Firdi Audi',
      propertyAddress: 'Rumah Griya Asri Blok C2 No. 8, Bekasi',
      bankName: 'Bank ABC',
      loanAmount: 400_000_000,
      submittedDate: '2026-09-25',
      salesOfficer: '',
      applicantColumn: 'employee',
      checked: ['app_ktp_kk', 'app_npwp', 'app_income', 'app_property'],
    })
  })

  it('take over uses the old-loan table; take over + top-up splits the amount', async () => {
    mockControls.reset('admin_ops')
    let d = await api.admin.applications.coverLetter('app_sample_05') // Sari, Take Over at the bank
    expect(d.variant).toBe('takeover')
    expect(d.rows.second.title).toBe('Dokumen KPR Lama')
    expect(d.letter.checked).toEqual(['app_ktp_kk', 'app_npwp', 'app_savings', 'app_income', 'app_property', 'house_certificate', 'house_permit', 'house_pbb', 'old_agreement', 'old_outstanding', 'old_payment'])
    expect(d.letter).not.toHaveProperty('topupAmount')

    const db = loadDb()
    const app = db.accounts.flatMap((a) => a.applications).find((a) => a.id === 'app_sample_05')
    const outstanding = app.snapshot.data.oldLoan.outstanding
    app.optimizationMode = 'topup'
    app.selection.loanAmount = outstanding + 150_000_000
    saveDb(db)
    d = await api.admin.applications.coverLetter('app_sample_05')
    expect(d.variant).toBe('topup')
    expect(d.rows.second.rows.at(-1)).toMatchObject({ key: 'topup_plan', label: 'Rencana Penggunaan Dana' })
    expect(d.letter).toMatchObject({ loanAmount: outstanding + 150_000_000, takeoverAmount: outstanding, topupAmount: 150_000_000 })
  })

  it('validation: required fields, amount, date, and column', async () => {
    mockControls.reset('admin_ops')
    const d = await api.admin.applications.coverLetter(FIRDI) // no office defaults yet: those fields are empty
    const e = await api.admin.applications.saveCoverLetter(FIRDI, { values: { ...d.letter, loanAmount: null, submittedDate: '2026-02-30', applicantColumn: 'boss' } }).catch((x) => x)
    expect(e.code).toBe('VALIDATION_FAILED')
    expect(e.fieldErrors.map((f) => f.field).sort()).toEqual(['applicantColumn', 'boName', 'feeAccount', 'loanAmount', 'maId', 'maName', 'officeName', 'submittedDate'])
    expect(e.fieldErrors.find((f) => f.field === 'loanAmount').message).toBe('Isi nominal KPR yang diajukan.')
    const long = await api.admin.applications.saveCoverLetter(FIRDI, { values: { ...d.letter, ...office, salesOfficer: 'x'.repeat(161) } }).catch((x) => x)
    expect(long.fieldErrors).toEqual([{ field: 'salesOfficer', message: 'Maksimal 160 karakter.' }])
  })

  it('saves the edited letter, keeps it when the defaults change, and audits only real changes', async () => {
    mockControls.reset('admin_ops')
    const d0 = await api.admin.applications.coverLetter(FIRDI)
    const values = { ...d0.letter, ...office, salesOfficer: '  Hilda ', checked: [...d0.letter.checked, 'app_license', 'not_a_row', 'app_license'] }
    let d = await api.admin.applications.saveCoverLetter(FIRDI, { values })
    expect(d.saved).toBe(true)
    expect(d.letter).toMatchObject({ salesOfficer: 'Hilda', checked: ['app_ktp_kk', 'app_npwp', 'app_income', 'app_license', 'app_property'], updatedBy: { name: 'Admin Maxi' } })
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'application.cover_letter', resource: { type: 'application', id: FIRDI, label: 'Firdi Audi' }, after: { salesOfficer: 'Hilda' } })

    await saveOffice({ ...office, maName: 'Budi' }, 'MA baru di kantor')
    d = await api.admin.applications.coverLetter(FIRDI)
    expect(d.letter.maName).toBe('Like')

    // unchanged save: what Cetak sends for a saved letter
    const before = (await api.admin.audit.list()).items.length
    await api.admin.applications.saveCoverLetter(FIRDI, { values: d.letter })
    expect((await api.admin.audit.list()).items).toHaveLength(before)
  })

  it('a new submission of the same application starts a new letter dated by its latest move to the bank', async () => {
    mockControls.reset('admin_ops')
    const d0 = await api.admin.applications.coverLetter(FIRDI)
    await api.admin.applications.saveCoverLetter(FIRDI, { values: { ...d0.letter, ...office, salesOfficer: 'Hilda' } })
    // What retrySameBank + a new submit leave behind: same id, a new submittedAt, a later trip to the bank.
    const db = loadDb()
    const app = db.accounts.flatMap((a) => a.applications).find((a) => a.id === FIRDI)
    app.submittedAt = '2026-10-08T02:00:00.000Z'
    app.statusHistory.push({ status: 'rejected', at: '2026-10-01T02:00:00.000Z' }, { status: 'draft', at: '2026-10-07T02:00:00.000Z' }, { status: 'submitted', at: '2026-10-08T02:00:00.000Z' }, { status: 'docs_verification', at: '2026-10-08T02:00:00.000Z' }, { status: 'bank_processing', at: '2026-10-10T02:00:00.000Z' })
    saveDb(db)
    let d = await api.admin.applications.coverLetter(FIRDI)
    expect(d.saved).toBe(false)
    expect(d.letter).toMatchObject({ submittedDate: '2026-10-10', salesOfficer: '' })
    // saving the fresh prefill unchanged still stores it for this submission
    d = await api.admin.applications.saveCoverLetter(FIRDI, { values: { ...d.letter, ...office } })
    expect(d).toMatchObject({ saved: true, letter: { submittedDate: '2026-10-10' } })
  })

  it('only super admins open it, and the applicant never receives it', async () => {
    mockControls.reset('admin_ops')
    const d = await api.admin.applications.coverLetter(FIRDI)
    await api.admin.applications.saveCoverLetter(FIRDI, { values: { ...d.letter, ...office, salesOfficer: 'Sales Rahasia' } })
    await signIn('Penulis Konten', 'penulis@ruangkpr.id')
    await expectCode(api.admin.applications.coverLetter(FIRDI), 'FORBIDDEN')
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    await expectCode(api.admin.applications.saveCoverLetter(FIRDI, { values: d.letter }), 'FORBIDDEN')
    expect(JSON.stringify(await api.dashboard.getSnapshot())).not.toContain('Sales Rahasia')
  })

  it('office defaults: empty at first (also for an older saved configuration), trimmed, capped, audited', async () => {
    mockControls.reset('admin_ops')
    const db = loadDb()
    db.config = { version: 2, reminders: DEFAULT_REMINDERS, upload: { maxFileMb: 5, formats: ['jpg', 'png', 'pdf'] } }
    saveDb(db)
    const { config } = await api.admin.config.get()
    expect(config.coverLetter).toEqual({ officeName: '', logoLabel: '', maName: '', maId: '', boName: '', feeAccount: '' })
    await expectCode(api.admin.config.update('coverLetter', { values: { ...office, feeAccount: 'x'.repeat(161) }, reason: 'Data kantor', expectedVersion: 2 }), 'VALIDATION_FAILED')
    const d = await api.admin.config.update('coverLetter', { values: { ...office, maName: '  Like  ' }, reason: 'Data kantor', expectedVersion: 2 })
    expect(d.config.coverLetter).toEqual(office)
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'config.update', resource: { type: 'config', id: 'coverLetter', label: 'Surat pengantar' } })
  })
})

describe('admin catalog', () => {
  const asAdmin = () => signIn('Admin Maxi', 'admin@ruangkpr.id')
  const asFirdi = () => signIn('Firdi Audi', 'firdi.audi@email.com')
  const compareFor = async () => api.bankProducts.compare({ applicationId: (await api.dashboard.getSnapshot()).applications[0].id })
  const compareIds = async () => (await compareFor()).items.map((x) => x.productId)
  const FULL = {
    bankId: 'bnk_abc',
    name: 'KPR Promo Uji 3 Tahun',
    productTypes: ['primary'],
    scheme: 'conventional',
    ratePeriods: [
      { type: 'fixed', durationMonths: 36, rateBps: 475 },
      { type: 'floating', durationMonths: null, rateBps: 1025, estimated: true },
    ],
    fees: { provisionBps: 100, admin: 1_000_000 },
    eligibility: { minimumIncome: 5_000_000, maximumDtiBps: 4000, maximumLtvBps: 9000, minimumAge: 21, maximumAgeAtMaturity: 60, maximumTenorMonths: 300, occupations: ['private_employee'], propertyTypes: ['landed_house'] },
    effectiveFrom: '2026-09-01',
    effectiveUntil: '2026-12-31',
    lastVerifiedAt: '2026-09-28',
  }

  it('a draft stays out of matching until a complete product is published; archiving takes it out again', async () => {
    mockControls.reset('upload_failure') // Firdi has a primary draft ready to compare
    await asAdmin()
    let p = await api.admin.products.create({ values: { bankId: 'bnk_abc', name: 'KPR Promo Uji 3 Tahun' } })
    expect(p.product).toMatchObject({ status: 'draft' })
    await expect(api.admin.products.publish(p.product.id, { reason: 'Promo kuartal 4', expectedVersion: p.product.rev })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: expect.arrayContaining([expect.objectContaining({ field: 'fixedRateBps' })]),
    })
    p = await api.admin.products.update(p.product.id, { values: FULL, expectedVersion: p.product.rev })
    await asFirdi()
    expect(await compareIds()).not.toContain(p.product.id)
    await asAdmin()
    p = await api.admin.products.publish(p.product.id, { reason: 'Promo kuartal 4', expectedVersion: p.product.rev })
    expect(p.product).toMatchObject({ status: 'published', version: 1 })
    await asFirdi()
    expect(await compareIds()).toContain(p.product.id)
    await asAdmin()
    await api.admin.products.archive(p.product.id, { reason: 'Promo selesai', expectedVersion: p.product.rev })
    await asFirdi()
    expect(await compareIds()).not.toContain(p.product.id)
  })

  it('a job typed by the admin cannot be blank', async () => {
    await asAdmin()
    const p = await api.admin.products.create({ values: { ...FULL, eligibility: { ...FULL.eligibility, occupations: ['private_employee', '  '] } } })
    await expect(api.admin.products.publish(p.product.id, { reason: 'Promo kuartal 4', expectedVersion: p.product.rev })).rejects.toMatchObject({
      fieldErrors: [expect.objectContaining({ field: 'occupations' })],
    })
  })

  it('a Take Over + Top-up product needs at least one top-up purpose', async () => {
    await asAdmin()
    const values = { ...FULL, productTypes: ['takeover', 'topup'], fees: { ...FULL.fees, appraisal: 0, notary: 0, insurance: 0 }, eligibility: { maximumDtiBps: 4000, maximumLtvBps: 8000, maximumTenorMonths: 240, purposes: [] } }
    const p = await api.admin.products.create({ values })
    await expect(api.admin.products.publish(p.product.id, { reason: 'Promo kuartal 4', expectedVersion: p.product.rev })).rejects.toMatchObject({
      fieldErrors: [expect.objectContaining({ field: 'purposes' })],
    })
  })

  it('editing a published product is a revision: matching keeps the live terms until it is published as a new version', async () => {
    mockControls.reset('upload_failure')
    await asAdmin()
    const id = 'bpr_abc_primary_fix5_v4'
    let p = await api.admin.products.get(id)
    expect(p.product).toMatchObject({ status: 'published', version: 4 })
    const revised = { ...p.content, bankId: p.content.bank.id, ratePeriods: [{ type: 'fixed', durationMonths: 60, rateBps: 525 }, { type: 'floating', durationMonths: null, rateBps: 1050, estimated: true }] }
    p = await api.admin.products.update(id, { values: revised, expectedVersion: p.product.rev })
    expect(p.product.hasPendingRevision).toBe(true)
    await expectCode(api.admin.products.update(id, { values: revised, expectedVersion: p.product.rev - 1 }), 'CONFLICT_VERSION')
    const liveRate = async () => (await compareFor()).items.find((x) => x.productId === id).fixedRateBps
    await asFirdi()
    expect(await liveRate()).toBe(550)
    await asAdmin()
    p = await api.admin.products.publish(id, { reason: 'Penyesuaian suku bunga', expectedVersion: p.product.rev })
    expect(p.product).toMatchObject({ version: 5, hasPendingRevision: false })
    await asFirdi()
    expect(await liveRate()).toBe(525)
  })

  it('switching a bank off takes its products out of matching; the preview uses the simulation engine', async () => {
    mockControls.reset('upload_failure')
    await asAdmin()
    expect((await api.admin.products.preview('bpr_abc_primary_fix5_v4', { principal: 400_000_000, termMonths: 240 })).payment).toBe(2_751_549)
    const abc = (await api.admin.banks.list()).find((b) => b.id === 'bnk_abc')
    await expectCode(api.admin.banks.update('bnk_abc', { values: { active: false }, reason: 'x', expectedVersion: abc.version }), 'VALIDATION_FAILED')
    await api.admin.banks.update('bnk_abc', { values: { active: false }, reason: 'Kerja sama dihentikan', expectedVersion: abc.version })
    await asFirdi()
    expect(await compareIds()).not.toContain('bpr_abc_primary_fix5_v4')
  })

  const png = (name = 'logo.png', bytes = 64) => new File([new Uint8Array(bytes)], name, { type: 'image/png' })

  it('a bank logo is set, replaced and removed; every bank-showing read picks it up by bank id', async () => {
    mockControls.reset('upload_failure')
    await asAdmin()
    let abc = (await api.admin.banks.list()).find((b) => b.id === 'bnk_abc')
    await expectCode(api.admin.banks.update('bnk_abc', { values: { logo: new File(['%PDF'], 'logo.pdf', { type: 'application/pdf' }) }, reason: 'Logo baru', expectedVersion: abc.version }), 'FILE_TYPE_UNSUPPORTED')
    await expectCode(api.admin.banks.update('bnk_abc', { values: { logo: png('besar.png', 1024 * 1024 + 1) }, reason: 'Logo baru', expectedVersion: abc.version }), 'FILE_TOO_LARGE')
    abc = await api.admin.banks.update('bnk_abc', { values: { logo: png() }, reason: 'Logo baru', expectedVersion: abc.version })
    expect(abc.logoUrl).toMatch(/^data:image\/png;base64,/)
    const first = abc.logo.path
    abc = await api.admin.banks.update('bnk_abc', { values: { logo: png() }, reason: 'Logo diperbarui', expectedVersion: abc.version })
    expect(abc.logo.path).not.toBe(first) // same file name, new path: a replacement is always a change
    const audit = (await api.admin.audit.list({ resourceType: 'bank' })).items[0]
    expect(audit).toMatchObject({ action: 'bank.update', before: { logo: first }, after: { logo: abc.logo.path } })
    expect(JSON.stringify(audit)).not.toContain('base64')
    abc = await api.admin.banks.update('bnk_abc', { values: { name: 'Bank ABC', mark: 'ABC', active: true, logo: undefined }, reason: 'Hanya cek', expectedVersion: abc.version }).catch((e) => e)
    expect(abc.code).toBe('VALIDATION_FAILED') // undefined keeps the logo: nothing changed
    abc = (await api.admin.banks.list()).find((b) => b.id === 'bnk_abc')
    await asFirdi()
    const compare = await compareFor()
    expect(compare.items.find((x) => x.bank.id === 'bnk_abc').bank.logoUrl).toBe(abc.logoUrl)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.banks.find((b) => b.id === 'bnk_abc')).toEqual({ id: 'bnk_abc', name: 'Bank ABC', mark: 'ABC', logoUrl: abc.logoUrl })
    await asAdmin()
    abc = await api.admin.banks.update('bnk_abc', { values: { logo: null }, reason: 'Logo dicabut', expectedVersion: abc.version })
    expect(abc.logoUrl).toBeNull()
  })

  it('bank names stay unique; an inactive bank still lists for the KPR dropdown', async () => {
    mockControls.reset('upload_failure')
    await asAdmin()
    await expectCode(api.admin.banks.create({ values: { name: 'bank abc', mark: 'ABX' }, reason: 'Bank baru' }), 'VALIDATION_FAILED')
    const ghi = (await api.admin.banks.list()).find((b) => b.id === 'bnk_ghi')
    await api.admin.banks.update('bnk_ghi', { values: { active: false }, reason: 'Kerja sama dihentikan', expectedVersion: ghi.version })
    await asFirdi()
    expect((await api.dashboard.getSnapshot()).banks.map((b) => b.id)).toContain('bnk_ghi')
  })

  it('the product list filters by bank and searches product and bank names', async () => {
    mockControls.reset('upload_failure')
    await asAdmin()
    const names = async (q) => (await api.admin.products.list(q)).map((p) => `${p.bankName} · ${p.name}`)
    expect(await names({ bankId: 'bnk_xyz' })).toEqual(['Bank XYZ · KPR Fixed 3 Tahun', 'Bank XYZ · Take Over Fixed 5 Tahun'])
    expect(await names({ query: '  bank def ' })).toEqual(['Bank DEF · KPR Fixed 10 Tahun', 'Bank DEF · Take Over Fixed 3 Tahun'])
    expect(await names({ query: 'take over', bankId: 'bnk_ghi' })).toEqual(['Bank GHI · Take Over Fixed 10 Tahun'])
    expect(await names({ query: 'tidak ada' })).toEqual([])
  })
})

describe('admin articles', () => {
  const asAdmin = () => signIn('Admin Maxi', 'admin@ruangkpr.id')
  const asFirdi = () => signIn('Firdi Audi', 'firdi.audi@email.com')
  const exploreSlugs = async () => (await api.explore.get()).education.map((x) => x.slug)
  const DRAFT = {
    title: 'Cara membaca SLIK OJK',
    slug: 'cara-membaca-slik',
    tag: 'Persiapan',
    icon: 'receipt',
    summary: 'Riwayat kredit yang dicek bank sebelum menyetujui KPR.',
    minutes: 3,
    body: ['SLIK mencatat riwayat cicilan kamu di semua lembaga keuangan.', 'Lunasi tunggakan kecil sebelum mengajukan KPR.'],
  }

  it('a draft reaches Explore only once published; archiving hides it again; slugs stay unique and URL-safe', async () => {
    mockControls.reset('fresh')
    await asAdmin()
    await expectCode(api.admin.articles.create({ values: { ...DRAFT, slug: 'fixed-vs-floating' } }), 'VALIDATION_FAILED') // taken by a seeded article
    await expectCode(api.admin.articles.create({ values: { ...DRAFT, slug: 'Bukan Slug' } }), 'VALIDATION_FAILED')
    let a = await api.admin.articles.create({ values: DRAFT })
    expect(a.article.status).toBe('draft')
    await asFirdi()
    expect(await exploreSlugs()).not.toContain('cara-membaca-slik')
    await expectCode(api.explore.article('cara-membaca-slik'), 'RESOURCE_NOT_FOUND')
    await asAdmin()
    a = await api.admin.articles.publish(a.article.id, { reason: 'Konten edukasi baru', expectedVersion: a.article.rev })
    await asFirdi()
    expect(await api.explore.article('cara-membaca-slik')).toMatchObject({ title: 'Cara membaca SLIK OJK', body: DRAFT.body })
    await asAdmin()
    await api.admin.articles.archive(a.article.id, { reason: 'Diganti artikel baru', expectedVersion: a.article.rev })
    await asFirdi()
    expect(await exploreSlugs()).not.toContain('cara-membaca-slik')
  })

  it('editing a published article goes live, so it needs a reason; publishing checks every field', async () => {
    mockControls.reset('fresh')
    await asAdmin()
    const id = 'art_fixed-vs-floating'
    let a = await api.admin.articles.get(id)
    expect(a.article).toMatchObject({ status: 'published', slug: 'fixed-vs-floating' })
    await expectCode(api.admin.articles.update(id, { values: { title: 'Fixed vs Floating: panduan' }, expectedVersion: a.article.rev }), 'VALIDATION_FAILED')
    a = await api.admin.articles.update(id, { values: { title: 'Fixed vs Floating: panduan' }, reason: 'Judul lebih jelas', expectedVersion: a.article.rev })
    await expectCode(api.admin.articles.update(id, { values: { title: 'Judul lain lagi' }, reason: 'Coba lagi', expectedVersion: a.article.rev - 1 }), 'CONFLICT_VERSION')
    // Links and Home picks find articles by slug, so it is locked once live.
    await expect(api.admin.articles.update(id, { values: { slug: 'fixed-floating' }, reason: 'Slug lebih pendek', expectedVersion: a.article.rev })).rejects.toMatchObject({
      fieldErrors: [expect.objectContaining({ field: 'slug' })],
    })
    await asFirdi()
    expect((await api.explore.article('fixed-vs-floating')).title).toBe('Fixed vs Floating: panduan')
    await asAdmin()
    const d = await api.admin.articles.create({ values: { title: 'Draft masih kosong', slug: 'draft-kosong' } })
    await expect(api.admin.articles.publish(d.article.id, { reason: 'Coba terbit', expectedVersion: d.article.rev })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: expect.arrayContaining([expect.objectContaining({ field: 'body' })]),
    })
  })
})

describe('primary application', () => {
  it('one active application; submit requires docs, program, and consent', async () => {
    mockControls.reset('fresh')
    const app = await api.applications.create({ productType: 'primary', purchaseType: 'new_from_developer' })
    await expectCode(api.applications.create({ productType: 'primary', purchaseType: 'used_from_owner' }), 'ACTIVE_DRAFT_EXISTS')
    await api.applications.saveStep(app.id, {
      step: 2,
      values: {
        personal: { fullName: 'Firdi Audi', nik: '3174012345678901', birthDate: '1996-04-12' },
        employment: { occupation: 'private_employee', monthlyIncome: 15_000_000, vehicleDebt: 1_000_000, cardDebt: 500_000, otherDebt: 0 },
        property: { propertyType: 'landed_house', price: 500_000_000, developerName: 'PT Griya' },
        loan: { downPayment: 100_000_000, amount: 400_000_000, tenorMonths: 240 },
      },
    })
    expect(await api.bankProducts.affordability({ applicationId: app.id })).toMatchObject({ openCount: 3, capacity: { remainingCapacity: 3_750_000 } })
    await expectCode(api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: true } }), 'DOCUMENTS_INCOMPLETE')
    for (const t of ['ktp', 'npwp', 'income_proof', 'property_document']) await api.applications.uploadDocument(app.id, { documentType: t, file: file(`${t}.jpg`) })
    // Upload rules are on, with the limits from admin configuration (default: JPG/PNG/PDF, 5MB).
    await expectCode(api.applications.uploadDocument(app.id, { documentType: 'additional', file: file('a.heic') }), 'FILE_TYPE_UNSUPPORTED')
    await expectCode(api.applications.uploadDocument(app.id, { documentType: 'additional', file: file('a.pdf', 6 * 1024 * 1024) }), 'FILE_TOO_LARGE')
    const compare = await api.bankProducts.compare({ applicationId: app.id })
    expect(JSON.stringify(compare)).not.toMatch(/secondary/i)
    const chosen = compare.items[0]
    await api.applications.selectProgram(app.id, { bankProductId: chosen.productId, loanAmount: 400_000_000, tenorMonths: 240 })
    await expectCode(api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: false } }), 'CONSENT_REQUIRED')
    const submitted = await api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: true } })
    // Straight into the team's document check; the history still records the submit itself.
    expect(submitted.status).toBe('docs_verification')
    expect(submitted.statusHistory.map((h) => h.status)).toEqual(['submitted', 'docs_verification'])
    expect(submitted.statusHistory[1].at).toBe(submitted.submittedAt)
    expect(submitted.snapshot.selection.bankProductId).toBe(chosen.productId)
    await expectCode(api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: true } }), 'APPLICATION_ALREADY_SUBMITTED')
    await expectCode(api.applications.saveStep(app.id, { step: 2, values: { loan: { amount: 1 } } }), 'INVALID_STATE_TRANSITION')
  })

  it('step order: Pinjaman (4) → Bandingkan Program (5) → Upload Dokumen (6) → Review (7)', async () => {
    mockControls.reset('no_bank_matches') // Primary draft at step 5, a low income so no program fits yet
    const [draft] = (await api.dashboard.getSnapshot()).applications
    let app = await api.applications.saveStep(draft.id, { step: 2, values: { employment: { monthlyIncome: 15_000_000 } } })
    expect(app.currentStep).toBe(5)
    const [chosen] = (await api.bankProducts.compare({ applicationId: app.id })).items
    app = await api.applications.selectProgram(app.id, { bankProductId: chosen.productId, loanAmount: 400_000_000, tenorMonths: 240 })
    expect(app.currentStep).toBe(6)
    app = await api.applications.saveStep(app.id, { step: 6, values: {} })
    expect(app.currentStep).toBe(7)
    // A new loan amount drops the program: back to Bandingkan Program.
    app = await api.applications.saveStep(app.id, { step: 4, values: { loan: { amount: 350_000_000 } } })
    expect(app).toMatchObject({ selection: null, currentStep: 5 })
  })

  it('upload failure scenario fails once, retry succeeds without touching other data', async () => {
    mockControls.reset('upload_failure')
    const { applications } = await api.dashboard.getSnapshot()
    const id = applications[0].id
    await expectCode(api.applications.uploadDocument(id, { documentType: 'ktp', file: file('ktp.jpg') }), 'SERVICE_UNAVAILABLE')
    const ok = await api.applications.uploadDocument(id, { documentType: 'ktp', file: file('ktp.jpg') })
    expect(ok.documents.ktp.status).toBe('uploaded')
    expect(ok.data.loan.amount).toBe(400_000_000)
  })

  it('rejected: clone keeps history row, retry returns the same row to draft', async () => {
    mockControls.reset('application_rejected_dti')
    const [rejected] = (await api.dashboard.getSnapshot()).applications
    const clone = await api.applications.cloneToBank(rejected.id)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.applications).toHaveLength(2)
    expect(snap.applications.find((a) => a.id === rejected.id)).toMatchObject({ status: 'rejected', superseded: true })
    expect(clone).toMatchObject({ status: 'draft', currentStep: 5 }) // reopens at Bandingkan Program Bank
    expect(clone.excludedProductIds).toContain(rejected.selection.bankProductId)

    mockControls.reset('application_rejected_dti')
    const retried = await api.applications.retrySameBank(rejected.id)
    expect(retried).toMatchObject({ id: rejected.id, status: 'draft', currentStep: 2 })
  })

  it('a retry at the same bank starts clean: every document is checked again and the old stage notes are gone', async () => {
    mockControls.reset('application_rejected_dti') // rejected after appraisal, all documents verified
    const db = loadDb()
    const old = db.applications[0]
    old.stageNotes = { appraisal: { message: 'Siapkan IMB/PBG asli.', schedule: { date: '2026-09-26', time: '10:00', location: 'Jl. Melati 12, Bekasi' }, updatedAt: '2026-09-25T03:00:00.000Z' } }
    old.documents.npwp = { ...old.documents.npwp, review: { reasonCode: 'blurry', note: '', at: '2026-09-23T03:00:00.000Z' }, invalidReason: 'Buram / tidak terbaca' }
    saveDb(db)
    const fresh = (app) => Object.values(app.documents).every((d) => d.status === 'uploaded' && !('review' in d) && !d.invalidReason)
    const retried = await api.applications.retrySameBank(old.id)
    expect(retried.stageNotes).toEqual({})
    expect(fresh(retried)).toBe(true)
    await api.applications.submit(old.id, { consents: { dataAccuracy: true, sendToBank: true } })
    const [app] = (await api.dashboard.getSnapshot()).applications
    expect(app).toMatchObject({ status: 'docs_verification', stageNotes: {} })
    expect(fresh(app)).toBe(true)
  })

  it('status can advance to disbursed and creates an active mortgage from final terms', async () => {
    mockControls.reset('application_in_process')
    const [app] = (await api.dashboard.getSnapshot()).applications
    for (let i = 0; i < 6; i++) mockControls.advanceApplication(app.id)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.applications[0].status).toBe('disbursed')
    const m = snap.mortgages.find((x) => x.status === 'active')
    expect(m.originalPrincipal).toBe(app.selection.loanAmount)
    expect(m.currentPayment).toBe(app.selection.estimatedPayment)
  })
})

describe('one finance for the profile and KPR Health', () => {
  it('income and other installments typed in an application reach KPR Health at once', async () => {
    mockControls.reset('mortgage_active_normal')
    const app = await api.applications.create({ productType: 'takeover', mode: 'takeover' })
    // Take Over's Pekerjaan form: income in `employment`, the other installments in `finance`.
    await api.applications.saveStep(app.id, { step: 1, values: { employment: { monthlyIncome: 25_000_000 }, finance: { vehicleDebt: 0, cardDebt: 0, otherDebt: 0 } } })
    const { finance, mortgages: [m], clock } = await api.dashboard.getSnapshot()
    const typed = { monthlyIncome: 25_000_000, vehicleDebt: 0, cardDebt: 0, otherDebt: 0 }
    expect(finance).toMatchObject(typed)
    expect(m.finance).toMatchObject(typed)
    expect(deriveMortgage(m, clock).dti.dtiRatio).toBe(m.currentPayment / 25_000_000)
  })

  it('a KPR opened at disbursement takes the profile’s current finance, not the application’s older copy', async () => {
    mockControls.reset('application_in_process')
    const [app] = (await api.dashboard.getSnapshot()).applications
    await api.profile.update({ finance: { monthlyIncome: 30_000_000 } })
    for (let i = 0; i < 6; i++) mockControls.advanceApplication(app.id)
    const { mortgages } = await api.dashboard.getSnapshot()
    expect(mortgages.find((m) => m.status === 'active').finance).toMatchObject({ monthlyIncome: 30_000_000 })
  })
})

describe('monitoring', () => {
  const step1 = { bankName: 'Bank ABC', scheme: 'conventional', originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22 }
  const fixedRate = { currentRateType: 'fixed', fixedUntil: '2026-12-22', currentRateBps: 550, remainingTenorMonths: 183, estimatedFloatingRateBps: 900, outstandingPrincipal: null, outstandingEstimated: null }

  it('My KPR reads sisa pokok as of today: a passed due date moves it, a payment mark never does', async () => {
    mockControls.reset('mortgage_active_normal')
    const snap = await api.dashboard.getSnapshot()
    const [m] = snap.mortgages
    const seen = deriveMortgage(m, snap.clock) // the projection My KPR shows today
    await api.mortgages.markPaid(m.id, { dueDate: seen.nextDue, amount: m.currentPayment, paidAt: snap.clock })
    expect((await api.dashboard.getSnapshot()).mortgages[0]).toMatchObject({ outstandingPrincipal: m.outstandingPrincipal, remainingTenorMonths: m.remainingTenorMonths })
    setClock(addDays(seen.nextDue, 1))
    const later = await api.dashboard.getSnapshot()
    expect(later.mortgages[0]).toMatchObject({ outstandingPrincipal: seen.schedule.rows[0].closingBalance, remainingTenorMonths: m.remainingTenorMonths - 1, outstandingProjected: true })
    expect(deriveMortgage(later.mortgages[0], later.clock).estimatedEndDate).toBe(seen.estimatedEndDate)
  })

  // The seeded KPR a day after its next installment, with the balance My KPR projected for that day.
  async function afterNextInstallment() {
    mockControls.reset('mortgage_active_normal')
    const { mortgages: [m], clock } = await api.dashboard.getSnapshot()
    const seen = deriveMortgage(m, clock)
    setClock(addDays(seen.nextDue, 1))
    return { id: m.id, balance: seen.schedule.rows[0].closingBalance, tenor: m.remainingTenorMonths - 1 }
  }

  it('a property save, Explore, Take Over with its simulation, and the admin all read that same balance', async () => {
    const { id, balance, tenor } = await afterNextInstallment()
    expect((await api.mortgages.update(id, { property: { estimatedValue: 900_000_000 } })).outstandingPrincipal).toBe(balance)
    expect((await api.dashboard.getSnapshot()).mortgages[0].outstandingPrincipal).toBe(balance) // the save did not reset it
    const { opportunity } = await api.explore.get()
    expect(opportunity.maxGrossTopup).toBe(Math.floor((900_000_000 * opportunity.maxLtvBps) / 10_000) - balance)
    const sim = await api.simulations.run({ source: { type: 'mortgage', id }, input: { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180 } })
    expect(sim.baseline).toMatchObject({ outstanding: balance, remainingMonths: tenor })
    const fromSim = await api.simulations.apply({ bankProductId: sim.items[0].productId, tenorMonths: 180 })
    expect(fromSim.data.oldLoan).toMatchObject({ outstanding: balance, remainingMonths: tenor, source: 'estimate' })
    await api.applications.cancel(fromSim.id)
    const app = await api.applications.create({ productType: 'takeover', mode: 'takeover', mortgageId: id })
    expect(app.data.oldLoan).toMatchObject({ outstanding: balance, remainingMonths: tenor, source: 'estimate' })
    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    const user = (await api.admin.users.list()).find((u) => u.name === 'Firdi Audi')
    expect((await api.admin.users.get(user.id)).mortgages[0].outstandingPrincipal).toBe(balance)
  })

  it('a saved KPR links its bank by id, so a renamed bank keeps its code and logo on the KPR and its Take Over', async () => {
    mockControls.reset('mortgage_active_normal')
    const { mortgages: [{ id }] } = await api.dashboard.getSnapshot()
    expect((await api.mortgages.saveSetupStep(id, { step: 1, values: { bankName: 'Bank Sinar' } })).bankId).toBeNull()
    expect((await api.mortgages.saveSetupStep(id, { step: 1, values: { bankName: 'Bank XYZ' } })).bankId).toBe('bnk_xyz')
    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    const xyz = (await api.admin.banks.list()).find((b) => b.id === 'bnk_xyz')
    await api.admin.banks.update('bnk_xyz', { values: { name: 'Bank XYZ Syariah', mark: 'XYZS' }, reason: 'Ganti nama', expectedVersion: xyz.version })
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    expect((await api.dashboard.getSnapshot()).mortgages.find((m) => m.id === id).bank).toMatchObject({ id: 'bnk_xyz', mark: 'XYZS', logoUrl: null })
    const sim = await api.simulations.run({ source: { type: 'mortgage', id }, input: { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180 } })
    expect(sim.oldBank).toMatchObject({ name: 'Bank XYZ', mark: 'XYZS', logoUrl: null })
    const draft = await api.applications.create({ productType: 'takeover', mode: 'takeover', mortgageId: id })
    expect(draft.data.oldLoan).toMatchObject({ bankName: 'Bank XYZ', bankId: 'bnk_xyz' })
    const saved = await api.applications.saveStep(draft.id, { step: 2, values: { oldLoan: { bankName: 'Bank ABC' } } })
    expect(saved.data.oldLoan.bankId).toBe('bnk_abc')
  })

  it('Edit Data KPR saves the figures on screen as today’s, so passed installments are not counted twice', async () => {
    const { id, balance, tenor } = await afterNextInstallment()
    const saved = await api.mortgages.saveSetupStep(id, { step: 1, values: { outstandingPrincipal: balance, remainingTenorMonths: tenor, outstandingEstimated: false } })
    expect(saved).toMatchObject({ outstandingPrincipal: balance, remainingTenorMonths: tenor })
    expect((await api.dashboard.getSnapshot()).mortgages[0]).toMatchObject({ outstandingPrincipal: balance, remainingTenorMonths: tenor })
  })

  it('an estimated sisa pokok saved again later is estimated for that day, once', async () => {
    mockControls.reset('fresh')
    const { id } = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(id, { step: 1, values: { ...step1, ...fixedRate } }) // 183 months left on 28 Sep
    await api.mortgages.saveSetupStep(id, { step: 2, values: { reminders: structuredClone(DEFAULT_REMINDERS) } })
    await api.mortgages.activate(id, { confirmDataCorrect: true })
    setClock('2026-10-23')
    // "Tidak tahu sisa pokok": the form counts 182 months left after 22 Oct and the API estimates the balance.
    const saved = await api.mortgages.saveSetupStep(id, { step: 1, values: { ...step1, ...fixedRate, remainingTenorMonths: 182 } })
    expect(saved).toMatchObject({ remainingTenorMonths: 182, outstandingPrincipal: calculateMaxPrincipal({ payment: 4_127_324, annualRateBps: 550, termMonths: 182 }) })
  })

  it('Edit Data KPR sending the moved balance back unchanged keeps it an estimate; a typed bank figure replaces it', async () => {
    const { id, balance, tenor } = await afterNextInstallment()
    const shown = { outstandingPrincipal: balance, remainingTenorMonths: tenor, outstandingEstimated: false }
    await api.mortgages.saveSetupStep(id, { step: 1, values: { ...shown, estimatedFloatingRateBps: 1000 } }) // only the floating estimate changed
    expect((await api.dashboard.getSnapshot()).mortgages[0]).toMatchObject({ outstandingPrincipal: balance, remainingTenorMonths: tenor, outstandingProjected: true })
    await api.mortgages.saveSetupStep(id, { step: 1, values: { ...shown, outstandingPrincipal: balance - 1_000_000 } }) // typed from the bank
    const typed = (await api.dashboard.getSnapshot()).mortgages[0]
    expect(typed.outstandingPrincipal).toBe(balance - 1_000_000)
    expect(typed.outstandingProjected).toBeUndefined()
  })

  it('an estimated sisa pokok saved on its due date is not counted twice the next day', async () => {
    async function savedOn(clock) {
      mockControls.reset('fresh')
      setClock(clock)
      const { id } = await api.mortgages.createSetup()
      // "Tidak tahu sisa pokok": the form counts the months left on the day it is saved.
      const remainingTenorMonths = remainingFromStart({ originalTenorMonths: '240', startDate: step1.startDate, dueDay: '22' }, clock)
      await api.mortgages.saveSetupStep(id, { step: 1, values: { ...step1, ...fixedRate, remainingTenorMonths } })
      setClock('2026-10-23')
      return (await api.dashboard.getSnapshot()).mortgages[0]
    }
    const dayBefore = await savedOn('2026-10-21')
    expect(await savedOn('2026-10-22')).toMatchObject({ outstandingPrincipal: dayBefore.outstandingPrincipal, remainingTenorMonths: dayBefore.remainingTenorMonths })
  })

  it('a new due day moves the marked payments to that day of the same month', async () => {
    mockControls.reset('mortgage_active_normal') // due on the 22nd, 22 Sep marked
    const { mortgages: [m] } = await api.dashboard.getSnapshot()
    await api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28' })
    await api.mortgages.saveSetupStep(m.id, { step: 1, values: { dueDay: 13 } })
    const snap = await api.dashboard.getSnapshot()
    expect(snap.mortgages[0].payments.map((p) => p.dueDate).sort()).toEqual(['2026-09-13', '2026-10-13'])
    expect(deriveMortgage(snap.mortgages[0], snap.clock).nextDue).toBe('2026-11-13') // October is not asked again
  })

  it('the activity feed records a cancelled mark, with dates people read', async () => {
    mockControls.reset('mortgage_active_normal')
    const { mortgages: [m] } = await api.dashboard.getSnapshot()
    const p = await api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28' })
    await api.mortgages.removePayment(m.id, p.id)
    const feed = await api.activities.list()
    expect(feed.find((a) => a.type === 'payment_marked_paid').body).toContain('22 Oktober 2026')
    expect(feed.find((a) => a.type === 'payment_unmarked')).toMatchObject({ title: 'Tanda pembayaran dibatalkan', body: expect.stringContaining('22 Oktober 2026') })
  })

  it('activation schedules the first reminder for the first installment, never the akad day', async () => {
    mockControls.reset('fresh') // 28 Sep 2026
    const { id } = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(id, { step: 1, values: { ...step1, ...fixedRate, startDate: '2026-09-28', dueDay: 28, remainingTenorMonths: 240 } })
    await api.mortgages.saveSetupStep(id, { step: 2, values: { reminders: structuredClone(DEFAULT_REMINDERS) } })
    await api.mortgages.activate(id, { confirmDataCorrect: true })
    const reminder = (await api.activities.list()).find((a) => a.type === 'payment_reminder_scheduled')
    expect(reminder.body).toContain('28 Oktober 2026')
  })

  it('with no program in the catalog Explore offers no refinancing figure, not Rp0 at LTV -Infinity', async () => {
    mockControls.reset('mortgage_active_normal')
    const db = loadDb()
    Object.assign(db, { products: [], banks: [] }) // what Supabase loads from empty catalog tables
    saveDb(db)
    expect((await api.explore.get()).opportunity).toMatchObject({ maxGrossTopup: null, maxLtvBps: null })
  })

  it('step 1 KPR data is all activation needs; sisa pokok is estimated when not known', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    const saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { ...step1, ...fixedRate } })
    expect(saved.outstandingPrincipal).toBe(calculateMaxPrincipal({ payment: 4_127_324, annualRateBps: 550, termMonths: 183 }))
    expect(saved.outstandingEstimated).toBe(true)
    expect(saved.setupStep).toBe(2) // straight to Reminder
    await api.mortgages.saveSetupStep(m.id, { step: 2, values: { reminders: structuredClone(DEFAULT_REMINDERS) } })
    const r = await api.mortgages.activate(m.id, { confirmDataCorrect: true })
    expect(r.applicationCreated).toBe(false)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.applications).toHaveLength(0)
    expect(selectHomeState(snap, snap.clock).state).toBe('mortgage_active_warning')
  })

  it('reminder-only data no longer activates: amortization data is required', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(m.id, { step: 1, values: { bankName: 'Bank ABC', currentPayment: 4_127_324, dueDay: 22, currentRateType: 'floating' } })
    await expect(api.mortgages.activate(m.id, { confirmDataCorrect: true })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { missing: expect.arrayContaining(['originalPrincipal', 'currentRateBps', 'outstandingPrincipal']) } })
  })

  it('official sisa pinjaman wins until cleared; floating clears the fixed-only fields', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(m.id, { step: 1, values: { ...step1, ...fixedRate, outstandingPrincipal: 500_000_000, outstandingEstimated: false } })
    let saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { currentRateBps: 600 } })
    expect(saved).toMatchObject({ outstandingPrincipal: 500_000_000, outstandingEstimated: false })
    saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { outstandingPrincipal: null, outstandingEstimated: null } })
    expect(saved.outstandingPrincipal).toBe(calculateMaxPrincipal({ payment: 4_127_324, annualRateBps: 600, termMonths: 183 }))
    expect(saved.outstandingEstimated).toBe(true)
    saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { currentRateType: 'floating' } })
    expect(saved).toMatchObject({ fixedUntil: null, estimatedFloatingRateBps: null })
  })

  it('Data properti filled after activation is saved on the KPR', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { property: { type: 'landed_house', address: 'Griya Asri Blok C2' } } })
    expect(saved.property).toMatchObject({ type: 'landed_house', address: 'Griya Asri Blok C2' })
    expect(saved.status).toBe('active')
  })

  it('"Tetap di bank" hides the fixed-rate warning for the current milestone only', async () => {
    mockControls.reset('mortgage_active_h90')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    expect((await api.mortgages.dismissRateWarning(m.id)).rateWarningDismissedMilestone).toBe(90)
    mockControls.reset('mortgage_active_normal')
    const [normal] = (await api.dashboard.getSnapshot()).mortgages
    await expectCode(api.mortgages.dismissRateWarning(normal.id), 'INVALID_STATE_TRANSITION')
  })

  it('saving unrelated fields keeps an existing sisa pinjaman stable', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { bankName: m.bankName, currentPayment: m.currentPayment, dueDay: m.dueDay } })
    expect(saved.outstandingPrincipal).toBe(m.outstandingPrincipal)
  })

  it('profile finance edits reach the active mortgage (KPR Health reads that copy)', async () => {
    mockControls.reset('mortgage_active_normal')
    await api.profile.update({ finance: { monthlyIncome: 20_000_000, vehicleDebt: 1_000_000 } })
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    expect(m.finance).toMatchObject({ monthlyIncome: 20_000_000, vehicleDebt: 1_000_000 })
  })

  it('manual payment is user-recorded and never bank-confirmed; duplicates rejected', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const p = await api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28' })
    expect(p).toMatchObject({ source: 'manual_user_recorded', bankConfirmed: false })
    await expectCode(api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28' }), 'DUPLICATE_PAYMENT_RECORD')
  })

  it('payment proof keeps metadata only and rejects unsupported files', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    await expectCode(api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28', proof: { name: 'bukti.docx', size: 1000, type: 'application/msword' } }), 'FILE_TYPE_UNSUPPORTED')
    await expectCode(api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28', proof: { name: 'bukti.pdf', size: 6 * 1024 * 1024, type: 'application/pdf' } }), 'FILE_TOO_LARGE')
    const p = await api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28', proof: { name: 'bukti.pdf', size: 120_000, type: 'application/pdf' } })
    expect(p.proof).toEqual({ fileName: 'bukti.pdf', sizeBytes: 120_000, contentType: 'application/pdf' })
  })
})

describe('dashboard layout', () => {
  it('is null until customised (the board picks the default for the data); saves a validated layout; null restores it', async () => {
    mockControls.reset('mortgage_active_normal')
    expect((await api.dashboard.getSnapshot()).dashboardLayout).toBeNull()
    await expectCode(api.dashboard.saveLayout('rusak'), 'VALIDATION_FAILED')
    const saved = await api.dashboard.saveLayout([{ i: 'outstanding', x: 0, y: 3, w: 99, h: 4 }, { i: 'chart', x: 0, y: 0, w: 4, h: 4 }])
    expect(saved).toEqual([{ i: 'outstanding', x: 0, y: 0, w: 12, h: 4 }])
    expect((await api.dashboard.getSnapshot()).dashboardLayout).toEqual(saved)
    expect(await api.dashboard.saveLayout(null)).toBeNull()
  })
})

describe('page tours', () => {
  it('none seen after a reset; marks known tours once; rejects unknown ids', async () => {
    mockControls.reset('fresh')
    expect((await api.dashboard.getSnapshot()).toursSeen).toEqual([])
    await api.dashboard.markTourSeen('home-fresh')
    await api.dashboard.markTourSeen('home-fresh')
    await expectCode(api.dashboard.markTourSeen('toString'), 'VALIDATION_FAILED')
    expect((await api.dashboard.getSnapshot()).toursSeen).toEqual(['home-fresh'])
  })
})

describe('take over simulation', () => {
  it('save creates no application; apply creates exactly one draft at documents step', async () => {
    mockControls.reset('mortgage_active_floating')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const sim = await api.simulations.run({ source: { type: 'mortgage', id: m.id }, input: { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180 } })
    expect(sim.items.length).toBeGreaterThan(0)
    expect(await api.simulations.save(sim.id)).toEqual({ saved: false, reason: 'history_not_enabled' })
    expect((await api.dashboard.getSnapshot()).applications).toHaveLength(0)
    const app = await api.simulations.apply({ bankProductId: sim.items[0].productId, tenorMonths: 180 })
    expect(app).toMatchObject({ productType: 'takeover', status: 'draft', currentStep: 6, mortgageId: m.id })
    expect((await api.dashboard.getSnapshot()).applications).toHaveLength(1)
  })

  it('a draft from a monitored KPR submits only once its forms pass; non-pricing data keeps the program', async () => {
    const applyFirst = async () => {
      mockControls.reset('mortgage_active_floating')
      const [m] = (await api.dashboard.getSnapshot()).mortgages
      const sim = await api.simulations.run({ source: { type: 'mortgage', id: m.id }, input: { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180 } })
      return api.simulations.apply({ bankProductId: sim.items[0].productId, tenorMonths: 180 })
    }
    let app = await applyFirst()
    for (const d of app.requiredDocuments.filter((x) => x.required)) await api.applications.uploadDocument(app.id, { documentType: d.type, file: file(`${d.type}.jpg`) })
    const consents = { dataAccuracy: true, sendToBank: true }
    app = await api.applications.saveStep(app.id, { step: 1, values: { employment: { companyName: '' } } })
    await expectCode(api.applications.submit(app.id, { consents }), 'VALIDATION_FAILED') // Pekerjaan no longer passes its form
    app = await api.applications.saveStep(app.id, { step: 1, values: { employment: { companyName: 'PT Lain', jobTitle: 'Manager' } } })
    expect(app.selection).not.toBeNull()
    expect((await api.applications.submit(app.id, { consents })).status).toBe('docs_verification')

    app = await applyFirst()
    app = await api.applications.saveStep(app.id, { step: 1, values: { employment: { monthlyIncome: app.data.employment.monthlyIncome + 1_000_000 } } })
    expect(app.selection).toBeNull() // income prices the program
  })

  it('a cancelled Take Over keeps what was typed, so the next draft starts filled in', async () => {
    mockControls.reset('fresh')
    let app = await api.applications.create({ productType: 'takeover', mode: 'takeover' })
    const oldLoan = { bankName: 'Bank ABC', originalPrincipal: 500_000_000, currentPayment: 5_000_000, rateBps: 1050, rateType: 'floating', outstanding: 421_500_000, remainingMonths: 181, source: 'official' }
    const property = { propertyType: 'landed_house', city: 'Kota Bekasi', estimatedValue: 850_000_000 }
    const finance = { vehicleDebt: 1_000_000, cardDebt: 0, otherDebt: 0 }
    app = await api.applications.saveStep(app.id, { step: 1, values: { employment: { monthlyIncome: 15_000_000 } } })
    app = await api.applications.saveStep(app.id, { step: 2, values: { oldLoan, property, finance } })
    await api.applications.uploadDocument(app.id, { documentType: 'certificate', file: file('shm.pdf', 200_000, 'application/pdf') })
    await api.applications.cancel(app.id)

    const next = await api.applications.create({ productType: 'takeover', mode: 'takeover' })
    expect(next.id).not.toBe(app.id)
    expect(next.data).toMatchObject({ oldLoan, property, finance, employment: { monthlyIncome: 15_000_000 } }) // gaji via the profile
    expect(next).toMatchObject({ currentStep: 1, documents: { certificate: { status: 'uploaded', fileName: 'shm.pdf' } } })
  })

  it('a cancelled Primary keeps its property, loan and documents; another product takes only the documents it asks for', async () => {
    mockControls.reset('fresh')
    let app = await api.applications.create({ productType: 'primary' })
    const property = { purchaseType: 'new_from_developer', developerName: 'PT Griya', price: 900_000_000 }
    app = await api.applications.saveStep(app.id, { step: 3, values: { property, loan: { downPayment: 180_000_000 } } })
    for (const t of ['ktp', 'property_document']) await api.applications.uploadDocument(app.id, { documentType: t, file: file(`${t}.pdf`, 200_000, 'application/pdf') })
    await api.applications.cancel(app.id)

    const takeover = await api.applications.create({ productType: 'takeover', mode: 'takeover' })
    expect(Object.keys(takeover.documents)).toEqual(['ktp']) // a Take Over asks for no Primary property document
    await api.applications.cancel(takeover.id)

    const next = await api.applications.create({ productType: 'primary' })
    expect(next.data).toMatchObject({ property, loan: { downPayment: 180_000_000 } })
    expect(next.documents).toMatchObject({ ktp: { status: 'uploaded' }, property_document: { status: 'uploaded', fileName: 'property_document.pdf' } })
  })

  it('cancel can forget what was kept, and names the stored files nothing points to any more', async () => {
    mockControls.reset('fresh')
    const app = await api.applications.create({ productType: 'primary' })
    await api.applications.attachDocument(app.id, { documentType: 'ktp', file: { name: 'ktp.pdf', size: 1, type: 'application/pdf' }, path: `u1/${app.id}/ktp/a.pdf` })
    expect((await api.applications.cancel(app.id)).unusedFiles).toEqual([]) // kept for the next draft

    const next = await api.applications.create({ productType: 'primary' })
    expect(next.documents.ktp.path).toBe(`u1/${app.id}/ktp/a.pdf`)
    expect((await api.applications.cancel(next.id, { keepData: false })).unusedFiles).toEqual([`u1/${app.id}/ktp/a.pdf`])
    expect(await api.applications.create({ productType: 'primary' })).toMatchObject({ documents: {}, data: { loan: {} } })
  })

  it('bank picked first: old-loan details asked afterwards keep it, a new outstanding drops it', async () => {
    mockControls.reset('mortgage_active_floating')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const sim = await api.simulations.run({ source: { type: 'mortgage', id: m.id }, input: { mode: 'takeover', goal: 'lower_payment', tenorMonths: 180 } })
    let app = await api.simulations.apply({ bankProductId: sim.items[0].productId, tenorMonths: 180 })
    app = await api.applications.saveStep(app.id, { step: 2, values: { oldLoan: { productName: 'KPR Lama', startDate: '2020-01-15', penaltyBps: null } } })
    expect(app.selection).not.toBeNull()
    app = await api.applications.saveStep(app.id, { step: 2, values: { oldLoan: { outstanding: m.outstandingPrincipal - 10_000_000 } } })
    expect(app.selection).toBeNull()
  })

  it('a draft created from a monitored KPR is prefilled, with Peluang default goal, so only the missing forms are left', async () => {
    mockControls.reset('mortgage_active_floating')
    const { mortgages: [m], clock } = await api.dashboard.getSnapshot()
    const app = await api.applications.create({ productType: 'takeover', mode: 'takeover', mortgageId: m.id })
    expect(app).toMatchObject({ source: 'mortgage', mortgageId: m.id, currentStep: 5, selection: null, data: { oldLoan: { bankName: m.bankName, outstanding: m.outstandingPrincipal } } })
    expect(app.data.goal).toEqual(defaultTakeoverGoal(m)) // the bank list opens on it, no Tujuan step
    expect(takeoverGaps(app.data, { today: clock, mode: 'takeover' })).toEqual([]) // nothing left to ask
  })
})

describe('fixtures', () => {
  it('home priority is consistent for every named scenario and no fixture mentions secondary', () => {
    const expected = {
      fresh: 'fresh',
      application_primary_draft_step_3: 'application_draft',
      application_in_process: 'application_in_process',
      application_additional_docs: 'application_in_process',
      application_rejected_dti: 'application_rejected',
      mortgage_setup_step_3: 'mortgage_setup_draft',
      mortgage_active_normal: 'mortgage_active_normal',
      mortgage_active_h90: 'mortgage_active_warning',
      mortgage_active_floating: 'mortgage_active_floating',
      mortgage_partial_property: 'mortgage_active_partial',
      takeover_in_process: 'application_in_process',
    }
    for (const { id } of SCENARIOS) {
      const db = createSeed(id)
      expect(JSON.stringify(db)).not.toMatch(/secondary/i)
      if (expected[id]) expect(selectHomeState(db, db.clock).state, id).toBe(expected[id])
    }
  })

  it('sample users open the Home their data implies once they sign in', () => {
    const db = createSeed('admin_ops')
    const home = Object.fromEntries(db.accounts.map((a) => [a.user.name, selectHomeState({ ...db, ...a }, db.clock).state]))
    expect(home).toMatchObject({
      'Budi Santoso': 'application_in_process',
      'Sari Wulandari': 'application_in_process',
      'Hendra Gunawan': 'application_rejected',
      'Yoga Saputra': 'mortgage_active_normal',
      'Maya Putri': 'fresh',
    })
  })
})

describe('admin reports', () => {
  // admin_ops on 28 Sep 2026: 9 users joined in September (Maya never applied); 8 applications, all submitted in
  // September. Totals count events in the period; stages follow the applications submitted in it, up to today.
  it('defaults to the last 30 days: period totals, stage conversion and days per stage, most selected products', async () => {
    mockControls.reset('admin_ops')
    const r = await api.admin.reports.get()
    expect(r.filters).toMatchObject({ from: '2026-08-30', to: '2026-09-28' })
    expect(r.users).toEqual({ registered: 9, withApplication: 8 })
    expect(r.applications).toEqual({ created: 8, submitted: 8, approved: 2, rejected: 1, disbursed: 1 })
    // A submit enters verification at once, so it holds all 8. Verification → bank: Firdi ≈4.7 days, Sari ≈2.7,
    // four others 2 (Rina and Budi have not reached the bank) → 15.4 / 6 ≈ 2.6
    expect(r.stages.map((s) => [s.status, s.count, s.conversionBps, s.avgDays])).toEqual([
      ['docs_verification', 8, null, 2.6],
      ['bank_processing', 6, 7500, 1],
      ['appraisal', 3, 5000, 1],
      ['approved', 2, 6667, 1],
      ['akad', 1, 5000, 1],
      ['disbursed', 1, 10000, null],
    ])
    // The 30 days before hold nothing yet; the trend splits the period into days that add up to the totals.
    expect(r.previous).toMatchObject({ from: '2026-07-31', to: '2026-08-29', users: { registered: 0 }, applications: { submitted: 0, approved: 0 } })
    expect(r.trend).toHaveLength(30)
    expect(r.trend.filter((d) => d.approved).map((d) => d.from)).toEqual(['2026-09-14', '2026-09-20'])
    expect(r.trend.reduce((n, d) => n + d.submitted, 0)).toBe(8)
    // Past a month the buckets grow to weeks, then 30-day blocks, the last one cut at the period's end.
    expect((await api.admin.reports.get({ from: '2026-08-01', to: '2026-09-28' })).trend.map((b) => b.from).slice(-2)).toEqual(['2026-09-19', '2026-09-26'])
    const long = await api.admin.reports.get({ from: '2026-06-10', to: '2026-09-28' })
    expect(long.trend.map((b) => [b.from, b.to])).toEqual([['2026-06-10', '2026-07-09'], ['2026-07-10', '2026-08-08'], ['2026-08-09', '2026-09-07'], ['2026-09-08', '2026-09-28']])
    expect(r.products.map((p) => [p.id, p.count])).toEqual([
      ['bpr_abc_primary_fix5_v4', 4],
      ['bpr_xyz_primary_fix3_v3', 2],
      ['bpr_def_primary_fix10_v2', 1],
      ['bpr_xyz_takeover_fix5_v3', 1],
    ])
  })

  it('product filters narrow the application numbers only; an empty period reads as zeros, never NaN', async () => {
    mockControls.reset('admin_ops')
    const takeover = await api.admin.reports.get({ productType: 'takeover' })
    expect(takeover.applications).toMatchObject({ created: 1, submitted: 1 })
    expect(takeover.users.registered).toBe(9)
    expect((await api.admin.reports.get({ bankName: 'Bank XYZ' })).applications.submitted).toBe(3) // Rina, Hendra, Sari
    const empty = await api.admin.reports.get({ from: '2025-01-01', to: '2025-01-31' })
    expect(empty.applications).toEqual({ created: 0, submitted: 0, approved: 0, rejected: 0, disbursed: 0 })
    expect(empty.stages.every((s) => s.count === 0 && s.conversionBps === null && s.avgDays === null)).toBe(true)
    expect(empty.products).toEqual([])
    await expectCode(api.admin.reports.get({ from: '2026-09-28', to: '2026-09-01' }), 'VALIDATION_FAILED')
  })

  it('the CSV export has no personal data, keeps formula-like text inert, and is audited', async () => {
    mockControls.reset('admin_ops')
    const db = loadDb() // a product name typed by an admin travels into each application's selection
    db.accounts.find((a) => a.user.id === 'usr_sample_01').applications[0].selection.productName = '=HYPERLINK("http://x","klik")'
    saveDb(db)
    const { filename, csv } = await api.admin.reports.exportCsv({})
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('id_pengajuan,jenis_produk,bank,produk,status,dibuat,diajukan,disetujui,ditolak,cair')
    expect(lines).toHaveLength(9)
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""klik"")"`)
    for (const personal of ['Rina', '081200000101', '3276010000000001', 'dewi.lestari@example.com']) expect(csv).not.toContain(personal)
    expect(filename).toBe('laporan-pengajuan-2026-08-30-2026-09-28.csv')
    expect((await api.admin.overview.get()).recentActivity[0]).toMatchObject({ action: 'report.export', after: expect.objectContaining({ rows: 8 }) })
  })

  it('only the super admin can read or export reports', async () => {
    mockControls.reset('fresh')
    await expectCode(api.admin.reports.get(), 'FORBIDDEN')
    await expectCode(api.admin.reports.exportCsv({}), 'FORBIDDEN')
  })
})

describe('admin configuration', () => {
  const asAdmin = () => signIn('Admin Maxi', 'admin@ruangkpr.id')
  const asFirdi = () => signIn('Firdi Audi', 'firdi.audi@email.com')

  it('starts from the values the app used to hard-code; only the super admin reads or changes it', async () => {
    mockControls.reset('fresh')
    await expectCode(api.admin.config.get(), 'FORBIDDEN')
    await expectCode(api.admin.config.update('upload', { values: { maxFileMb: 2 }, reason: 'Coba ubah', expectedVersion: 1 }), 'FORBIDDEN')
    await expectCode(api.admin.health.get(), 'FORBIDDEN')
    await asAdmin()
    expect(await api.admin.config.get()).toMatchObject({
      config: { version: 1, reminders: DEFAULT_REMINDERS, upload: { maxFileMb: 5, formats: ['jpg', 'png', 'pdf'] } },
      health: { version: 1 },
    })
  })

  it('reminder defaults shape the next KPR set up; reminders a user already saved stay as they are', async () => {
    mockControls.reset('mortgage_active_normal')
    const saved = (await api.dashboard.getSnapshot()).mortgages[0].reminders
    await asAdmin()
    const { config } = await api.admin.config.get()
    const values = { ...config.reminders, payment: [3], fixedExpiry: [30, 7] }
    await expectCode(api.admin.config.update('reminders', { values: { ...values, payment: [] }, reason: 'Kurangi notifikasi', expectedVersion: config.version }), 'VALIDATION_FAILED')
    await expectCode(api.admin.config.update('reminders', { values, reason: 'x', expectedVersion: config.version }), 'VALIDATION_FAILED')
    await api.admin.config.update('reminders', { values, reason: 'Kurangi notifikasi', expectedVersion: config.version })
    await expectCode(api.admin.config.update('reminders', { values, reason: 'Simpan lagi', expectedVersion: config.version }), 'CONFLICT_VERSION')
    await asFirdi()
    expect((await api.dashboard.getSnapshot()).mortgages[0].reminders).toEqual(saved)
    await signIn('Maya Putri', 'maya.putri@example.com')
    expect((await api.mortgages.createSetup()).reminders).toMatchObject({ payment: [3], fixedExpiry: [30, 7] })
    expect((await api.dashboard.getSnapshot()).config.reminders.payment).toEqual([3])
  })

  it('upload limits decide what the API accepts, in the words the page shows', async () => {
    mockControls.reset('application_additional_docs')
    await asAdmin()
    const { config } = await api.admin.config.get()
    await expectCode(api.admin.config.update('upload', { values: { maxFileMb: 2, formats: [] }, reason: 'Batas bank mitra', expectedVersion: config.version }), 'VALIDATION_FAILED')
    await expectCode(api.admin.config.update('upload', { values: { maxFileMb: 50, formats: ['jpg'] }, reason: 'Batas bank mitra', expectedVersion: config.version }), 'VALIDATION_FAILED')
    await api.admin.config.update('upload', { values: { maxFileMb: 2, formats: ['jpg', 'png'] }, reason: 'Batas bank mitra', expectedVersion: config.version })
    await asFirdi()
    const { applications, config: live } = await api.dashboard.getSnapshot()
    expect(live.upload).toEqual({ maxFileMb: 2, formats: ['jpg', 'png'] })
    const upload = (f) => api.applications.uploadDocument(applications[0].id, { documentType: 'income_proof', file: f })
    await expect(upload(file('slip.jpg', 3 * 1024 * 1024))).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', message: 'Ukuran file lebih dari 2MB. Kompres dulu, lalu coba lagi.' })
    await expect(upload(file('slip.pdf', 100_000, 'application/pdf'))).rejects.toMatchObject({ code: 'FILE_TYPE_UNSUPPORTED', message: 'Format tidak didukung. Gunakan JPG atau PNG.' })
    expect((await upload(file('slip.png', 1024 * 1024, 'image/png'))).status).toBe('docs_verification')
  })

  it('CS contact: one WhatsApp number and booking page for every user, normalised, https only, audited; the calendar stays with admins', async () => {
    mockControls.reset('admin_ops')
    const { config } = await api.admin.config.get()
    expect(config.support).toEqual(DEFAULT_SUPPORT)
    const save = (values) => api.admin.config.update('support', { values, reason: 'Nomor CS baru', expectedVersion: config.version })
    await expectCode(save({ whatsapp: '0812', bookingUrl: DEFAULT_SUPPORT.bookingUrl }), 'VALIDATION_FAILED')
    await expectCode(save({ whatsapp: '0812-3456-7890', bookingUrl: 'javascript:alert(1)' }), 'VALIDATION_FAILED')
    await expectCode(save({ whatsapp: '', bookingUrl: '', calendarId: 'kalender tim' }), 'VALIDATION_FAILED')
    const d = await save({ whatsapp: '+62 812-3456-7890', bookingUrl: ' https://cal.com/tim/konsultasi ', calendarId: ' tim.cs@gmail.com ' })
    expect(d.config.support).toEqual({ whatsapp: '6281234567890', bookingUrl: 'https://cal.com/tim/konsultasi', calendarId: 'tim.cs@gmail.com' })
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'config.update', resource: { id: 'support', label: 'Layanan CS' } })
    await asFirdi()
    expect((await api.dashboard.getSnapshot()).config.support).toEqual({ whatsapp: '6281234567890', bookingUrl: 'https://cal.com/tim/konsultasi' })
  })

  it('CS links carry who is asking and open nothing but wa.me or an https page', () => {
    expect(whatsappLink('6281234567890', 'Halo, saya Firdi. ID: app_1')).toBe('https://wa.me/6281234567890?text=Halo%2C%20saya%20Firdi.%20ID%3A%20app_1')
    expect(whatsappLink('', 'x')).toBeNull()
    expect(whatsappLink('12', 'x')).toBeNull()
    expect(bookingLink('https://cal.com/tim/konsultasi', { name: 'Firdi Audi', email: 'firdi@x.com', notes: 'ID pengajuan: app_1' })).toBe(
      'https://cal.com/tim/konsultasi?name=Firdi+Audi&email=firdi%40x.com&notes=ID+pengajuan%3A+app_1',
    )
    expect(bookingLink('https://cal.com/tim/konsultasi', {})).toBe('https://cal.com/tim/konsultasi')
    expect(bookingLink('javascript:alert(1)', {})).toBeNull()
    expect(bookingLink('', {})).toBeNull()
    const embed = new URL(calendarEmbedLink('tim.cs@gmail.com'))
    expect(embed.origin + embed.pathname).toBe('https://calendar.google.com/calendar/embed')
    expect(embed.searchParams.get('src')).toBe('tim.cs@gmail.com')
    expect(embed.searchParams.get('ctz')).toBe('Asia/Jakarta')
    expect(calendarEmbedLink('x')).toBeNull()
    expect(calendarEmbedLink('')).toBeNull()
  })

  it('a KPR Health formula is previewed on fixtures, published as the version users get, and rolled back as a new version', async () => {
    mockControls.reset('admin_ops')
    const v1 = (await api.admin.health.get()).active
    expect(v1).toMatchObject({ version: 1 })
    const params = { ...v1.params, weights: { ...v1.params.weights, dti: 3 } }
    const preview = await api.admin.health.preview({ params })
    expect(preview.items.map((x) => x.key)).toEqual(['mortgage_active_normal', 'mortgage_active_h90', 'mortgage_active_floating', 'mortgage_partial_property', 'high_dti', 'high_ltv'])
    const highDti = preview.items.find((x) => x.key === 'high_dti')
    expect(highDti.after.score).toBeLessThan(highDti.before.score)
    await expect(api.admin.health.preview({ params: { ...params, dti: [...params.dti].reverse() } })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fieldErrors: [expect.objectContaining({ field: 'dti' })] })
    await expectCode(api.admin.health.publish({ params: { ...params, labels: { healthy: 50, attention: 60 } }, reason: 'Bobot DTI', expectedVersion: 1 }), 'VALIDATION_FAILED')
    await api.admin.health.publish({ params, reason: 'Beban cicilan paling menentukan', expectedVersion: 1 })
    await expectCode(api.admin.health.publish({ params, reason: 'Terbitkan lagi', expectedVersion: 1 }), 'CONFLICT_VERSION')

    await signIn('Yoga Saputra', 'yoga.saputra@example.com')
    const snap = await api.dashboard.getSnapshot()
    expect(snap.config.health.version).toBe(2)
    expect(deriveMortgage(snap.mortgages[0], snap.clock, snap.config.health).health.version).toBe(2)

    await asAdmin()
    const h = await api.admin.health.rollback({ toVersion: 1, reason: 'Kembali ke formula awal', expectedVersion: 2 })
    expect(h.active).toMatchObject({ version: 3, rollbackOf: 1, params: v1.params })
    expect(h.versions.map((v) => v.version)).toEqual([3, 2, 1])
    expect((await api.admin.overview.get()).recentActivity.slice(0, 2).map((e) => e.action)).toEqual(['health.rollback', 'health.publish'])
  })
})

describe('content writer', () => {
  const asWriter = () => signIn('Penulis Konten', 'penulis@ruangkpr.id')

  it('signs in through the same OTP flow and manages articles under their own name', async () => {
    mockControls.reset('fresh')
    await asWriter()
    expect(await api.auth.getSession()).toMatchObject({ role: 'content_writer' })
    let a = await api.admin.articles.create({ values: { title: 'Cara membaca SLIK OJK', slug: 'cara-membaca-slik' } })
    const values = { tag: 'Persiapan', icon: 'receipt', summary: 'Riwayat kredit yang dicek bank.', minutes: 3, body: ['SLIK mencatat riwayat cicilan kamu.'] }
    a = await api.admin.articles.update(a.article.id, { values, expectedVersion: a.article.rev })
    await api.admin.articles.publish(a.article.id, { reason: 'Konten edukasi baru', expectedVersion: a.article.rev })
    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    expect((await api.admin.overview.get()).recentActivity[0]).toMatchObject({ action: 'article.publish', actor: { name: 'Penulis Konten' } })
  })

  it('every admin operation outside articles is refused, and a writer never counts as a user', async () => {
    mockControls.reset('content_writer')
    const outside = Object.entries(api.admin)
      .filter(([group]) => group !== 'articles')
      .flatMap(([group, ops]) => Object.entries(ops).map(([op, fn]) => [`admin.${group}.${op}`, fn]))
    expect(outside.length).toBeGreaterThan(20)
    for (const [name, fn] of outside) await expect(fn('usr_sample_01', {}), name).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await api.admin.articles.list()).toHaveLength(5)
    await signIn('Admin Maxi', 'admin@ruangkpr.id')
    expect((await api.admin.users.list()).map((u) => u.contact)).not.toContain('penulis@ruangkpr.id')
  })
})

describe('admin audit log', () => {
  it('lists admin changes newest first, filters by data and date, and never carries a raw NIK', async () => {
    mockControls.reset('admin_ops')
    await api.admin.users.updateProfile('usr_sample_01', { values: { nik: '3174012345678901' }, reason: 'Koreksi sesuai KTP', expectedVersion: 1 })
    const { config } = await api.admin.config.get()
    await api.admin.config.update('upload', { values: { maxFileMb: 4, formats: ['jpg', 'png', 'pdf'] }, reason: 'Batas bank mitra', expectedVersion: config.version })
    const all = (await api.admin.audit.list()).items
    expect(all.map((e) => e.action)).toEqual(['config.update', 'user.profile.update'])
    expect(all[0]).toMatchObject({ resource: { type: 'config', id: 'upload' }, before: { maxFileMb: 5 }, after: { maxFileMb: 4 }, requestId: expect.any(String) })
    expect((await api.admin.audit.list({ resourceType: 'user' })).items.map((e) => e.resource.id)).toEqual(['usr_sample_01'])
    expect((await api.admin.audit.list({ query: 'bank mitra' })).items).toHaveLength(1)
    expect((await api.admin.audit.list({ from: '2026-10-01' })).items).toEqual([])
    expect(JSON.stringify(all)).not.toContain('3174012345678901')
  })

  it('with two super admins, each change is recorded under who made it and the log filters by admin', async () => {
    mockControls.reset('admin_ops')
    const { config } = await api.admin.config.get()
    await api.admin.config.update('upload', { values: { maxFileMb: 4, formats: ['jpg', 'png', 'pdf'] }, reason: 'Batas bank mitra', expectedVersion: config.version })
    await signIn('Sinta Maharani', 'sinta@ruangkpr.id')
    expect(await api.auth.getSession()).toMatchObject({ role: 'super_admin' })
    // Sinta still holds the version she opened before Admin Maxi saved: her save must not overwrite it.
    await expectCode(api.admin.config.update('upload', { values: { maxFileMb: 3, formats: ['jpg'] }, reason: 'Hemat penyimpanan', expectedVersion: config.version }), 'CONFLICT_VERSION')
    await api.admin.config.update('upload', { values: { maxFileMb: 3, formats: ['jpg'] }, reason: 'Hemat penyimpanan', expectedVersion: config.version + 1 })
    const log = await api.admin.audit.list()
    expect(log.items.map((e) => [e.actor.name, e.reason])).toEqual([['Sinta Maharani', 'Hemat penyimpanan'], ['Admin Maxi', 'Batas bank mitra']])
    expect(log.actors).toEqual([{ id: 'usr_admin_01', name: 'Admin Maxi' }, { id: 'usr_admin_02', name: 'Sinta Maharani' }])
    const bySinta = await api.admin.audit.list({ actorId: 'usr_admin_02' })
    expect(bySinta.items.map((e) => e.after)).toEqual([{ maxFileMb: 3, formats: ['jpg'] }])
    expect(bySinta.actors).toHaveLength(2) // the filter list stays whole while one admin is picked
  })
})

describe('admin hardening', () => {
  const operations = Object.entries(api.admin).flatMap(([group, ops]) => Object.entries(ops).map(([op, fn]) => [`admin.${group}.${op}`, fn]))

  it('every admin operation refuses a guest (401) and a signed-in user (403) before touching any data', async () => {
    expect(operations.length).toBeGreaterThanOrEqual(34)
    for (const [scenario, code] of [['guest', 'AUTH_REQUIRED'], ['fresh', 'FORBIDDEN']]) {
      mockControls.reset(scenario)
      const before = JSON.stringify(loadDb())
      for (const [name, fn] of operations) await expect(fn('usr_sample_01', {}), name).rejects.toMatchObject({ code })
      expect(JSON.stringify(loadDb())).toBe(before)
    }
  })

  it('versioned writes without their own conflict test still refuse a stale version', async () => {
    mockControls.reset('admin_ops')
    const bank = (await api.admin.banks.list())[0]
    await expectCode(api.admin.banks.update(bank.id, { values: { name: 'Bank Nama Baru' }, reason: 'Ganti nama', expectedVersion: bank.version + 1 }), 'CONFLICT_VERSION')
    const product = (await api.admin.products.list())[0]
    await expectCode(api.admin.products.archive(product.id, { reason: 'Promo selesai', expectedVersion: product.rev + 1 }), 'CONFLICT_VERSION')
    const article = (await api.admin.articles.list())[0]
    await expectCode(api.admin.articles.archive(article.id, { reason: 'Konten lama', expectedVersion: article.rev + 1 }), 'CONFLICT_VERSION')
    await expectCode(api.admin.health.rollback({ toVersion: 1, reason: 'Kembali ke awal', expectedVersion: 2 }), 'CONFLICT_VERSION')
  })

  it('the CSV keeps every formula prefix inert and quotes commas, quotes, and line breaks', async () => {
    mockControls.reset('admin_ops')
    const db = loadDb()
    const names = { usr_sample_01: '@SUM(A1:A2)', usr_sample_02: '-2+3', usr_sample_03: '+cmd', usr_sample_04: 'Fixed, "Promo"\nBaris 2' }
    for (const [id, name] of Object.entries(names)) db.accounts.find((a) => a.user.id === id).applications[0].selection.productName = name
    saveDb(db)
    const { csv } = await api.admin.reports.exportCsv({})
    for (const cell of [`,'@SUM(A1:A2),`, `,'-2+3,`, `,'+cmd,`, `,"Fixed, ""Promo""\nBaris 2",`]) expect(csv).toContain(cell)
  })

  it('upload settings and file names outside the rules are refused', async () => {
    mockControls.reset('admin_ops')
    const { config } = await api.admin.config.get()
    for (const values of [{ maxFileMb: 1.5, formats: ['jpg'] }, { maxFileMb: '5', formats: ['jpg'] }, { maxFileMb: 0, formats: ['jpg'] }, { maxFileMb: 5, formats: ['exe'] }]) {
      await expectCode(api.admin.config.update('upload', { values, reason: 'Uji batas', expectedVersion: config.version }), 'VALIDATION_FAILED')
    }
    mockControls.reset('application_additional_docs')
    const id = (await api.dashboard.getSnapshot()).applications[0].id
    const upload = (name) => api.applications.uploadDocument(id, { documentType: 'income_proof', file: file(name) })
    await expectCode(upload('slip.jpg.exe'), 'FILE_TYPE_UNSUPPORTED')
    await expectCode(upload('slip'), 'FILE_TYPE_UNSUPPORTED')
    expect((await upload('SLIP.JPG')).status).toBe('docs_verification')
  })
})
describe('files stored outside the app (Supabase Storage)', () => {
  it('attachDocument records a file that is already stored, with its path', async () => {
    mockControls.reset('upload_failure')
    const [app] = (await api.dashboard.getSnapshot()).applications
    const next = await api.applications.attachDocument(app.id, { documentType: 'npwp', file: { name: 'npwp.pdf', size: 1000, type: 'application/pdf' }, path: 'u1/app/npwp/x.pdf' })
    expect(next.documents.npwp).toMatchObject({ status: 'uploaded', fileName: 'npwp.pdf', path: 'u1/app/npwp/x.pdf' })
  })

  it('markPaid keeps the proof path; the mock has no files for an admin preview', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const p = await api.mortgages.markPaid(m.id, { dueDate: '2026-10-22', amount: m.currentPayment, paidAt: '2026-09-28', proof: { name: 'bukti.pdf', size: 1000, type: 'application/pdf', path: 'u1/mtg/x.pdf' } })
    expect(p.proof).toEqual({ fileName: 'bukti.pdf', sizeBytes: 1000, contentType: 'application/pdf', path: 'u1/mtg/x.pdf' })
    mockControls.reset('admin_ops')
    await expectCode(api.admin.applications.documentUrl('app_sample_02', 'ktp'), 'RESOURCE_NOT_FOUND')
  })
})
