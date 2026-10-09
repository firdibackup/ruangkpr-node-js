import { describe, expect, it } from 'vitest'
import { calculateMaxPrincipal } from '@/calculations/finance'
import { selectHomeState } from '@/domains/home/selectHomeState'
import { takeoverGaps } from '@/domains/optimize/validation'
import { deriveMortgage } from '@/domains/mortgages/derive'
import { createMockApi, mockControls } from './mockApi'
import { DEFAULT_REMINDERS, SCENARIOS, createSeed } from './seed'
import { loadDb, saveDb } from './mockDb'

const api = createMockApi({ latencyMs: 0 })
const file = (name, size = 200_000, type = 'image/jpeg') => ({ name, size, type })
const expectCode = async (promise, code) => {
  await expect(promise).rejects.toMatchObject({ name: 'ApiError', code })
}
const signIn = async (name, email) => {
  await api.auth.logout()
  await api.auth.sendEmailOtp({ email })
  await api.auth.verifyEmailOtp({ token: '148260' })
  if ((await api.auth.getSession()).status === 'onboarding') await api.auth.acceptConsents({ name, acceptTerms: true, acceptPrivacy: true })
}

describe('auth', () => {
  it('email OTP fixtures (000000 invalid, 999999 expired, 148260 ok), then consent; nothing before consent', async () => {
    mockControls.reset('guest')
    await expectCode(api.auth.sendEmailOtp({ email: 'x' }), 'VALIDATION_FAILED')
    const r = await api.auth.sendEmailOtp({ email: ' Nadia@Example.com ' })
    expect(r.maskedDestination).toBe('na***@example.com')
    await expectCode(api.auth.verifyEmailOtp({ token: '000000' }), 'OTP_INVALID')
    await expectCode(api.auth.verifyEmailOtp({ token: '999999' }), 'OTP_EXPIRED')
    await api.auth.verifyEmailOtp({ token: '148260' })
    expect(await api.auth.getSession()).toMatchObject({ status: 'onboarding', role: null })
    await expectCode(api.dashboard.getSnapshot(), 'AUTH_REQUIRED')
    await expectCode(api.auth.acceptConsents({ name: 'Na', acceptTerms: true, acceptPrivacy: false }), 'VALIDATION_FAILED')
    await api.auth.acceptConsents({ name: 'Nadia Putri', acceptTerms: true, acceptPrivacy: true })
    const snap = await api.dashboard.getSnapshot()
    expect(snap.user).toMatchObject({ name: 'Nadia Putri', contact: 'nadia@example.com', contactType: 'email' })
    expect(snap.profile.consents.map((c) => [c.type, c.version])).toEqual([['terms', '2026-09-01'], ['privacy', '2026-09-01']])
    expect(snap.applications).toHaveLength(0) // signing in never creates an application
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

  it('deleteAccount wipes the signed-in account; registering again starts empty', async () => {
    mockControls.reset('mortgage_active_normal')
    await api.auth.deleteAccount()
    expect((await api.auth.getSession()).status).toBe('guest')
    await expectCode(api.dashboard.getSnapshot(), 'AUTH_REQUIRED')
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    const snap = await api.dashboard.getSnapshot()
    expect(snap.profile.nik).toBeUndefined()
    expect(snap.mortgages).toHaveLength(0)
    expect(snap.applications).toHaveLength(0)
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
    await signIn('Admin RuangKPR', 'admin@ruangkpr.id')
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
    await signIn('Admin RuangKPR', 'admin@ruangkpr.id')
    const users = await api.admin.users.list()
    expect(users.map((u) => u.name)).toEqual(expect.arrayContaining(['Firdi Audi', 'Nadia Putri', 'Budi Santoso']))
    expect(users.map((u) => u.name)).not.toContain('Admin RuangKPR')
    expect(users.find((u) => u.name === 'Budi Santoso')).toMatchObject({ activeApplicationStatus: 'additional_docs_requested', hasActiveMortgage: false })
    expect(users.find((u) => u.name === 'Nadia Putri')).toMatchObject({ contact: 'nadia@example.com', activeApplicationStatus: null, hasActiveMortgage: false })
  })

  it('deleteAccount removes only the signed-in account; other accounts stay and new ids stay unique', async () => {
    mockControls.reset('fresh')
    await signIn('Nadia Putri', 'nadia@example.com')
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    await api.auth.deleteAccount()
    await signIn('Rudi Hartono', 'rudi@example.com')
    await signIn('Admin RuangKPR', 'admin@ruangkpr.id')
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
      byStatus: { submitted: 1, additional_docs_requested: 1, bank_processing: 2, appraisal: 1, approved: 1, rejected: 1, disbursed: 1 },
      funnel: { submitted: 8, approved: 2, disbursed: 1 },
    })
    // Budi waits on the user (additional docs), so he is not in the admin's queue.
    expect(o.applications.queue.map((q) => [q.userName, q.status, q.waitingDays])).toEqual([
      ['Agus Pratama', 'approved', 14],
      ['Dewi Lestari', 'appraisal', 10],
      ['Firdi Audi', 'bank_processing', 3],
      ['Sari Wulandari', 'bank_processing', 1],
      ['Rina Hartati', 'submitted', 1],
    ])
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
    expect(statuses).toEqual(expect.arrayContaining(['submitted', 'additional_docs_requested', 'bank_processing', 'appraisal', 'approved', 'rejected']))
  })
})

describe('admin applications', () => {
  const move = (id, toStatus, expectedVersion, metadata = {}) => api.admin.applications.transition(id, { toStatus, reason: 'Dicek tim operasional', expectedVersion, metadata })

  it('follows the status matrix: legal moves only, for primary and take over', async () => {
    mockControls.reset('admin_ops')
    await expectCode(move('app_sample_01', 'bank_processing', 3), 'INVALID_STATE_TRANSITION')
    let d = await move('app_sample_01', 'docs_verification', 3)
    expect(d.allowedTransitions).toEqual(['additional_docs_requested', 'bank_processing'])
    await expectCode(move('app_sample_01', 'rejected', d.application.version, { code: 'DTI_ABOVE_BANK_POLICY', displayReason: 'Rasio cicilan terlalu tinggi.' }), 'INVALID_STATE_TRANSITION')
    expect((await api.admin.applications.get('app_sample_04')).allowedTransitions).toEqual(['akad'])
    d = await move('app_sample_05', 'appraisal', 6)
    d = await move('app_sample_05', 'approved', d.application.version)
    expect(d.allowedTransitions).toEqual(['old_mortgage_settlement'])
    expect((await api.admin.applications.get('app_sample_02')).allowedTransitions).toEqual([]) // waits on the user
  })

  it('a revision request flags the documents and reaches the user; re-uploading returns it to verification', async () => {
    mockControls.reset('admin_ops')
    let d = await move('app_sample_01', 'docs_verification', 3)
    await expectCode(move('app_sample_01', 'additional_docs_requested', d.application.version, { documentTypes: [], message: 'Foto KTP buram.' }), 'VALIDATION_FAILED')
    d = await move('app_sample_01', 'additional_docs_requested', d.application.version, { documentTypes: ['ktp'], message: 'Foto KTP buram, unggah ulang.' })
    expect(d.application.status).toBe('additional_docs_requested')
    expect(d.application.documents.find((x) => x.type === 'ktp').file).toMatchObject({ status: 'needs_update', invalidReason: 'Foto KTP buram, unggah ulang.' })
    await signIn('Rina Hartati', 'rina.hartati@example.com')
    const [app] = (await api.dashboard.getSnapshot()).applications
    expect(app.pendingActions).toEqual([expect.objectContaining({ documentType: 'ktp', message: 'Foto KTP buram, unggah ulang.' })])
    expect((await api.activities.list())[0]).toMatchObject({ type: 'additional_document_requested' })
    expect((await api.applications.uploadDocument(app.id, { documentType: 'ktp', file: file('ktp-baru.jpg') })).status).toBe('docs_verification')
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
    await move('app_sample_01', 'docs_verification', 3)
    await expectCode(move('app_sample_01', 'bank_processing', 3), 'CONFLICT_VERSION')
    const d = await api.admin.applications.addNote('app_sample_01', { text: 'Catatan rahasia tim: cek ulang slip gaji.' })
    expect(d.notes[0]).toMatchObject({ text: 'Catatan rahasia tim: cek ulang slip gaji.', author: { name: 'Admin RuangKPR' } })
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
    expect((await api.admin.applications.list()).items).toHaveLength(8)
  })
})

describe('admin catalog', () => {
  const asAdmin = () => signIn('Admin RuangKPR', 'admin@ruangkpr.id')
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
})

describe('admin articles', () => {
  const asAdmin = () => signIn('Admin RuangKPR', 'admin@ruangkpr.id')
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
    expect(submitted.status).toBe('submitted')
    expect(submitted.snapshot.selection.bankProductId).toBe(chosen.productId)
    await expectCode(api.applications.submit(app.id, { consents: { dataAccuracy: true, sendToBank: true } }), 'APPLICATION_ALREADY_SUBMITTED')
    await expectCode(api.applications.saveStep(app.id, { step: 2, values: { loan: { amount: 1 } } }), 'INVALID_STATE_TRANSITION')
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
    expect(clone).toMatchObject({ status: 'draft', currentStep: 6 })
    expect(clone.excludedProductIds).toContain(rejected.selection.bankProductId)

    mockControls.reset('application_rejected_dti')
    const retried = await api.applications.retrySameBank(rejected.id)
    expect(retried).toMatchObject({ id: rejected.id, status: 'draft', currentStep: 2 })
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

describe('monitoring', () => {
  const step1 = { bankName: 'Bank ABC', scheme: 'conventional', originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22 }
  const fixedRate = { currentRateType: 'fixed', fixedUntil: '2026-12-22', currentRateBps: 550, remainingTenorMonths: 183, estimatedFloatingRateBps: 900, outstandingPrincipal: null, outstandingEstimated: null }

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
    expect((await api.applications.submit(app.id, { consents })).status).toBe('submitted')

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
    await api.applications.cancel(app.id)

    const next = await api.applications.create({ productType: 'takeover', mode: 'takeover' })
    expect(next.id).not.toBe(app.id)
    expect(next.data).toMatchObject({ oldLoan, property, finance, employment: { monthlyIncome: 15_000_000 } }) // gaji via the profile
    expect(next).toMatchObject({ currentStep: 1, documents: {} })
  })

  it('a draft created from a monitored KPR is prefilled and opens on Tujuan with only the missing forms left', async () => {
    mockControls.reset('mortgage_active_floating')
    const { mortgages: [m], clock } = await api.dashboard.getSnapshot()
    const app = await api.applications.create({ productType: 'takeover', mode: 'takeover', mortgageId: m.id })
    expect(app).toMatchObject({ source: 'mortgage', mortgageId: m.id, currentStep: 5, selection: null, data: { oldLoan: { bankName: m.bankName, outstanding: m.outstandingPrincipal } } })
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
    // e.g. submitted → verification: Firdi 1.75 days, Sari 0.75, five others 1 → 7.5 / 7 ≈ 1.1
    expect(r.stages.map((s) => [s.status, s.count, s.conversionBps, s.avgDays])).toEqual([
      ['submitted', 8, null, 1.1],
      ['docs_verification', 7, 8750, 1.5],
      ['bank_processing', 6, 8571, 1],
      ['appraisal', 3, 5000, 1],
      ['approved', 2, 6667, 1],
      ['akad', 1, 5000, 1],
      ['disbursed', 1, 10000, null],
    ])
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
  const asAdmin = () => signIn('Admin RuangKPR', 'admin@ruangkpr.id')
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
    await signIn('Admin RuangKPR', 'admin@ruangkpr.id')
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
    await signIn('Admin RuangKPR', 'admin@ruangkpr.id')
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
    // Sinta still holds the version she opened before Admin RuangKPR saved: her save must not overwrite it.
    await expectCode(api.admin.config.update('upload', { values: { maxFileMb: 3, formats: ['jpg'] }, reason: 'Hemat penyimpanan', expectedVersion: config.version }), 'CONFLICT_VERSION')
    await api.admin.config.update('upload', { values: { maxFileMb: 3, formats: ['jpg'] }, reason: 'Hemat penyimpanan', expectedVersion: config.version + 1 })
    const log = await api.admin.audit.list()
    expect(log.items.map((e) => [e.actor.name, e.reason])).toEqual([['Sinta Maharani', 'Hemat penyimpanan'], ['Admin RuangKPR', 'Batas bank mitra']])
    expect(log.actors).toEqual([{ id: 'usr_admin_01', name: 'Admin RuangKPR' }, { id: 'usr_admin_02', name: 'Sinta Maharani' }])
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
