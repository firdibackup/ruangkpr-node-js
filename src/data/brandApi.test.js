import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/brand/theme'
import { createMockApi, mockControls } from './mockApi'
import { DEMO_PASSWORD } from './seed'
import { loadDb } from './mockDb'

// Brand CMS (spec 2026-10-20): draft → publish → reset, through the same logic the Supabase adapter runs.
const api = createMockApi({ latencyMs: 0 })
const expectCode = (promise, code) => expect(promise).rejects.toMatchObject({ name: 'ApiError', code })
const signIn = async (email, name = 'Admin Maxi') => {
  await api.auth.logout()
  await api.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
  if ((await api.auth.getSession()).status === 'onboarding') await api.auth.acceptConsents({ name, acceptTerms: true, acceptPrivacy: true })
}
const asAdmin = async () => {
  mockControls.reset('admin_ops')
  await signIn('admin@ruangkpr.id')
}
const blue = {
  ...DEFAULT_SETTINGS,
  overrides: {},
  colors: { primary: '#0066ff', secondary: '#14b8a6', accent: '#facc15', neutral: '#334155', success: '#16a34a', warning: '#d97706', danger: '#dc2626', info: '#2563eb' },
  fonts: { body: 'Inter', heading: 'Sora' },
  cardRadius: 16,
}
const png = (name) => new File([new Uint8Array(64)], name, { type: 'image/png' })

describe('brand', () => {
  it('starts with no brand: everyone gets the files’ look', async () => {
    await asAdmin()
    expect(await api.admin.brand.get()).toEqual({ draft: null, published: null })
    expect(await api.brand.published()).toBeNull()
  })

  it('keeps a draft away from visitors until it is published, with a reason in the audit log', async () => {
    await asAdmin()
    const { draft } = await api.admin.brand.saveDraft({ settings: blue, expectedVersion: 0 })
    expect(draft).toMatchObject({ colors: blue.colors, fonts: blue.fonts, cardRadius: 16, version: 1, updatedBy: 'Admin Maxi' })
    expect(await api.brand.published()).toBeNull()

    await expectCode(api.admin.brand.publish({ reason: '', expectedVersion: 1 }), 'VALIDATION_FAILED')
    await expectCode(api.admin.brand.publish({ reason: 'Rebrand biru', expectedVersion: 0 }), 'CONFLICT_VERSION')
    const { published } = await api.admin.brand.publish({ reason: 'Rebrand biru', expectedVersion: 1 })
    expect(published).toMatchObject({ colors: blue.colors, version: 1, publishedBy: 'Admin Maxi' })
    expect(loadDb().auditLog[0]).toMatchObject({
      action: 'brand.publish',
      reason: 'Rebrand biru',
      before: null,
      after: { colors: '#0066ff · #14b8a6 · #facc15 · #334155 · #16a34a · #d97706 · #dc2626 · #2563eb', fonts: 'Inter / Sora', cardRadius: '16px' },
    })

    // Visitors, signed in or not, read the published brand.
    await api.auth.logout()
    expect((await api.brand.published()).colors).toEqual(blue.colors)
  })

  it('checks every field and refuses a brand that would not read', async () => {
    await asAdmin()
    await expect(
      api.admin.brand.saveDraft({ settings: { ...blue, colors: { ...blue.colors, primary: 'biru', neutral: 'abu' }, fonts: { body: 'Comic Sans', heading: 'Inter' }, cardRadius: 99 }, expectedVersion: 0 }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: expect.arrayContaining([
        expect.objectContaining({ field: 'colors.primary' }),
        expect.objectContaining({ field: 'colors.neutral' }),
        expect.objectContaining({ field: 'fonts.body' }),
        expect.objectContaining({ field: 'cardRadius' }),
      ]),
    })
    // A pasted shade that makes links unreadable saves as a draft but never goes live.
    await api.admin.brand.saveDraft({ settings: { ...blue, overrides: { 'secondary-700': '#a3efdd' } }, expectedVersion: 0 })
    await expect(api.admin.brand.publish({ reason: 'Coba shade', expectedVersion: 1 })).rejects.toThrow(/Kontras belum cukup: .*Link/)
  })

  it('stores the logo, favicon, and white logo with the draft (data URLs in the demo)', async () => {
    await asAdmin()
    const { draft } = await api.admin.brand.saveDraft({ settings: { ...blue, logo: png('logo.png'), favicon: png('favicon.png'), logoWhite: png('logo-white.png') }, expectedVersion: 0 })
    expect(draft.logo).toMatchObject({ path: expect.stringMatching(/\.png$/), url: expect.stringMatching(/^data:image\/png/) })
    expect(draft.favicon.url).toMatch(/^data:image\/png/)
    expect(draft.logoWhite).toMatchObject({ path: expect.stringMatching(/\.png$/), url: expect.stringMatching(/^data:image\/png/) })
    await expectCode(api.admin.brand.saveDraft({ settings: { ...blue, logo: new File(['x'], 'logo.gif', { type: 'image/gif' }) }, expectedVersion: 1 }), 'FILE_TYPE_UNSUPPORTED')
  })

  it('goes back to the default for everyone', async () => {
    await asAdmin()
    await api.admin.brand.saveDraft({ settings: blue, expectedVersion: 0 })
    await api.admin.brand.publish({ reason: 'Rebrand biru', expectedVersion: 1 })
    expect(await api.admin.brand.reset({ reason: 'Kembali ke teal' })).toEqual({ draft: null, published: null })
    expect(await api.brand.published()).toBeNull()
    expect(loadDb().auditLog[0]).toMatchObject({ action: 'brand.reset', after: null })
    await expectCode(api.admin.brand.reset({ reason: 'Sudah default' }), 'VALIDATION_FAILED')
  })

  it('is for the super admin only', async () => {
    mockControls.reset('admin_ops')
    await signIn('penulis@ruangkpr.id')
    await expectCode(api.admin.brand.get(), 'FORBIDDEN')
    await expectCode(api.admin.brand.saveDraft({ settings: blue, expectedVersion: 0 }), 'FORBIDDEN')
  })
})
