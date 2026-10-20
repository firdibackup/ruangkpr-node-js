import { describe, expect, it } from 'vitest'
import { planWrites, profileRow } from './store'

const base = () => ({
  user: { id: 'u1' },
  profile: { fullName: 'User A', nik: '3174012345678901', phone: '0812', email: 'a@x.co', birthPlace: 'Bekasi', consents: [{ type: 'terms' }] },
  finance: { monthlyIncome: 10 },
  applications: [{ id: 'app_1', status: 'draft', data: {}, documents: {} }],
  mortgages: [],
  activities: [{ id: 'act_1', title: 'x', readAt: null }],
  simulation: null,
  toursSeen: [],
  accounts: [],
  products: [],
  banks: [],
  articles: [],
  auditLog: [],
  adminNotes: [],
})
const versions = { applications: { app_1: 3, app_old: 5 }, mortgages: { mtg_1: 2 }, profiles: { u1: 7, u2: 4 } }

describe('planWrites', () => {
  it('a read writes nothing, even after decorate() added requiredDocuments', () => {
    const before = base()
    const after = structuredClone(before)
    after.applications[0].requiredDocuments = [{ type: 'ktp' }]
    expect(planWrites(before, after, versions)).toEqual([])
  })

  it('cover letters insert once, then update their doc', () => {
    const before = base()
    const after = structuredClone(before)
    after.coverLetters = [{ id: 'app_1', salesOfficer: 'Hilda' }]
    expect(planWrites(before, after, versions)).toEqual([{ op: 'insert', table: 'cover_letters', values: { id: 'app_1', doc: after.coverLetters[0] } }])
    const later = structuredClone(after)
    later.coverLetters[0].salesOfficer = 'Rudi'
    expect(planWrites(after, later, versions)).toEqual([{ op: 'update', table: 'cover_letters', id: 'app_1', values: { doc: later.coverLetters[0] } }])
  })

  it('new, changed and removed applications become insert, versioned update and delete', () => {
    const before = base()
    const after = structuredClone(before)
    after.applications[0].data = { loan: { amount: 1 } }
    after.applications.unshift({ id: 'app_2', status: 'draft' })
    const removed = structuredClone(after)
    removed.applications = removed.applications.filter((a) => a.id !== 'app_1')
    expect(planWrites(before, after, versions)).toEqual([
      { op: 'update', table: 'applications', id: 'app_1', version: 3, values: { doc: after.applications[1] } },
      { op: 'insert', table: 'applications', values: { id: 'app_2', user_id: 'u1', doc: after.applications[0] } },
    ])
    expect(planWrites(before, removed, versions)).toEqual([
      { op: 'delete', table: 'applications', id: 'app_1' },
      { op: 'insert', table: 'applications', values: { id: 'app_2', user_id: 'u1', doc: removed.applications[0] } },
    ])
  })

  it('profile and finance changes update only the changed profile columns, with the row version', () => {
    const before = base()
    const after = structuredClone(before)
    after.profile.birthPlace = 'Depok'
    after.finance = { monthlyIncome: 20 }
    after.toursSeen = ['my-kpr']
    expect(planWrites(before, after, versions)).toEqual([
      { op: 'update', table: 'profiles', id: 'u1', version: 7, values: { personal: { birthPlace: 'Depok' }, finance: { monthlyIncome: 20 }, tours_seen: ['my-kpr'] } },
    ])
  })

  it('maps the profile object to columns: login email and consents are never written, an empty NIK is null', () => {
    expect(profileRow({ profile: { fullName: 'A', nik: '', phone: '', email: 'a@x.co', consents: [], gender: 'male' }, finance: {} })).toMatchObject({
      full_name: 'A',
      nik: null,
      phone: null,
      personal: { gender: 'male' },
      finance: {},
    })
  })

  it('activities: a read one is updated, a new one is inserted for its owner', () => {
    const before = base()
    const after = structuredClone(before)
    after.activities[0].readAt = '2026-10-09T03:00:00.000Z'
    after.activities.unshift({ id: 'act_2', title: 'y', readAt: null })
    expect(planWrites(before, after, versions)).toEqual([
      { op: 'update', table: 'activities', id: 'act_1', values: { doc: after.activities[1] } },
      { op: 'insert', table: 'activities', values: { id: 'act_2', user_id: 'u1', doc: after.activities[0] } },
    ])
  })

  it('admin moves on another account: its application, a new active KPR and an activity for that user', () => {
    const before = { ...base(), user: { id: 's1' }, applications: [], activities: [] }
    before.accounts = [{ user: { id: 'u2' }, profile: { fullName: 'B' }, finance: {}, applications: [{ id: 'app_old', status: 'akad' }], mortgages: [], activities: [] }]
    const after = structuredClone(before)
    const acct = after.accounts[0]
    acct.applications[0].status = 'disbursed'
    acct.mortgages.unshift({ id: 'mtg_new', status: 'active' })
    acct.activities.unshift({ id: 'act_b', title: 'KPR aktif' })
    after.auditLog.unshift({ id: 'aud_1', action: 'application.transition' })
    after.adminNotes.unshift({ id: 'note_1', applicationId: 'app_old', text: 'ok' })
    expect(planWrites(before, after, versions)).toEqual([
      { op: 'update', table: 'applications', id: 'app_old', version: 5, values: { doc: acct.applications[0] } },
      { op: 'insert', table: 'mortgages', values: { id: 'mtg_new', user_id: 'u2', doc: acct.mortgages[0] } },
      { op: 'insert', table: 'activities', values: { id: 'act_b', user_id: 'u2', doc: acct.activities[0] } },
      { op: 'insert', table: 'audit_log', values: { id: 'aud_1', doc: after.auditLog[0] } },
      { op: 'insert', table: 'admin_notes', values: { id: 'note_1', application_id: 'app_old', doc: after.adminNotes[0] } },
    ])
  })

  it('catalog, articles, configuration and KPR Health versions', () => {
    const before = base()
    const after = structuredClone(before)
    after.banks.push({ id: 'bnk_1', name: 'Bank' })
    after.products.push({ id: 'bpr_1', status: 'draft' })
    after.articles.push({ id: 'art_1', slug: 'x' })
    after.config = { version: 2 }
    after.healthConfigs = [{ version: 1 }, { version: 2 }]
    expect(planWrites(before, after, versions)).toEqual([
      { op: 'insert', table: 'banks', values: { id: 'bnk_1', doc: after.banks[0] } },
      { op: 'insert', table: 'bank_products', values: { id: 'bpr_1', doc: after.products[0] } },
      { op: 'insert', table: 'articles', values: { id: 'art_1', doc: after.articles[0] } },
      { op: 'insert', table: 'app_config', values: { id: 1, doc: { version: 2 } } },
      { op: 'insert', table: 'health_configs', values: { doc: { version: 1 } } },
      { op: 'insert', table: 'health_configs', values: { doc: { version: 2 } } },
    ])
    const edited = structuredClone(after)
    edited.config.version = 3
    expect(planWrites(after, edited, versions)).toEqual([{ op: 'update', table: 'app_config', id: 1, values: { doc: { version: 3 } } }])
  })

  it('brand rows: a draft, its publish, and the way back to the default', () => {
    const before = base()
    const drafted = { ...structuredClone(before), brand: { draft: { version: 1 }, published: null } }
    expect(planWrites(before, drafted, versions)).toEqual([{ op: 'insert', table: 'brand_settings', values: { id: 'draft', doc: { version: 1 } } }])
    const published = { ...structuredClone(drafted), brand: { draft: { version: 1 }, published: { version: 1, publishedBy: 'A' } } }
    expect(planWrites(drafted, published, versions)).toEqual([{ op: 'insert', table: 'brand_settings', values: { id: 'published', doc: { version: 1, publishedBy: 'A' } } }])
    const edited = { ...structuredClone(published), brand: { ...published.brand, draft: { version: 2 } } }
    expect(planWrites(published, edited, versions)).toEqual([{ op: 'update', table: 'brand_settings', id: 'draft', values: { doc: { version: 2 } } }])
    const reset = { ...structuredClone(edited), brand: { draft: null, published: null } }
    expect(planWrites(edited, reset, versions)).toEqual([
      { op: 'delete', table: 'brand_settings', id: 'draft' },
      { op: 'delete', table: 'brand_settings', id: 'published' },
    ])
  })
})
