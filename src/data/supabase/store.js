// supabaseStore: the account the shared app logic works on, loaded from Supabase and written back row by row
// (spec 2026-10-09, Amandemen). Loads build the same `db` shape the localStorage demo uses; saves send only what
// changed, in one transaction (public.apply_writes) with RLS and the status triggers in force.
import { CONSENT_TYPES, CONSENT_VERSION } from '@/domains/session/validation'
import { supabase } from './client'
import { must, toApiError } from './errors'

// ---------- profile object ↔ profiles columns ----------

// Login email and consents are read-only here (auth + accept_consents own them); everything else not promoted to a
// column lives in `personal`.
const PROFILE_OWN = ['fullName', 'nik', 'phone', 'email', 'consents']

export function profileRow({ profile = {}, finance = {}, dashboardLayout, toursSeen, kept, simulation, own = false }) {
  const personal = Object.fromEntries(Object.entries(profile).filter(([k]) => !PROFILE_OWN.includes(k)))
  const row = { full_name: profile.fullName ?? '', phone: profile.phone || null, nik: profile.nik || null, personal, finance: finance ?? {} }
  return own ? { ...row, dashboard_layout: Array.isArray(dashboardLayout) ? dashboardLayout : null, tours_seen: toursSeen ?? [], kept: kept ?? null, simulation: simulation ?? null } : row
}

const profileOf = (row, consents = []) => ({ ...(row.personal ?? {}), fullName: row.full_name, nik: row.nik ?? undefined, phone: row.phone ?? undefined, email: row.email, consents })

// ---------- planWrites ----------

// Deep equality that ignores key order (spreads in the app logic may reorder keys).
function same(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).filter((k) => a[k] !== undefined)
  const kb = Object.keys(b).filter((k) => b[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => same(a[k], b[k]))
}

// Fields the app adds on the fly (decorate) are never stored.
const stored = (app) => {
  const { requiredDocuments: _derived, ...rest } = app
  return rest
}

// Every account in this db: the signed-in one (top level) and, for admins, the users in db.accounts.
const accountsOf = (db) => [{ ...db, own: true }, ...(db.accounts ?? [])]

function rowsBy(db, key, shape = (x) => x) {
  const rows = new Map()
  for (const a of accountsOf(db)) for (const x of a[key] ?? []) rows.set(x.id, { doc: shape(x), userId: a.user?.id })
  return rows
}

// Deletes, then updates, then inserts: a copied application only appears after the old one is marked superseded,
// and a new active KPR after the replaced one.
function diffRows(table, before, after, version) {
  const deletes = []
  const updates = []
  const inserts = []
  for (const id of before.keys()) if (!after.has(id)) deletes.push({ op: 'delete', table, id })
  for (const [id, { doc, userId }] of after) {
    const old = before.get(id)
    if (!old) inserts.push({ op: 'insert', table, values: { id, ...(userId !== undefined && { user_id: userId }), doc } })
    else if (!same(old.doc, doc)) updates.push({ op: 'update', table, id, ...(version && { version: version[id] }), values: { doc } })
  }
  return [...deletes, ...updates, ...inserts]
}

function diffList(table, before = [], after = [], key = 'id', values = (x) => ({ id: x.id, doc: x })) {
  const old = new Map(before.map((x) => [x[key], x]))
  const ops = []
  for (const x of after) {
    if (!old.has(x[key])) ops.push({ op: 'insert', table, values: values(x) })
    else if (!same(old.get(x[key]), x)) ops.push({ op: 'update', table, id: x[key], values: { doc: x } })
  }
  return ops
}

export function planWrites(before, after, versions) {
  const ops = []
  const beforeAccounts = new Map(accountsOf(before).map((a) => [a.user?.id, a]))
  for (const a of accountsOf(after)) {
    const b = beforeAccounts.get(a.user?.id)
    if (!b || !a.user?.id) continue
    const was = profileRow(b)
    const now = profileRow(a)
    const changed = Object.fromEntries(Object.entries(now).filter(([k, v]) => !same(was[k], v)))
    if (Object.keys(changed).length) ops.push({ op: 'update', table: 'profiles', id: a.user.id, version: versions.profiles?.[a.user.id], values: changed })
  }
  ops.push(...diffRows('applications', rowsBy(before, 'applications', stored), rowsBy(after, 'applications', stored), versions.applications ?? {}))
  ops.push(...diffRows('mortgages', rowsBy(before, 'mortgages'), rowsBy(after, 'mortgages'), versions.mortgages ?? {}))
  ops.push(...diffRows('activities', rowsBy(before, 'activities'), rowsBy(after, 'activities')))
  ops.push(...diffList('banks', before.banks, after.banks))
  ops.push(...diffList('bank_products', before.products, after.products))
  ops.push(...diffList('articles', before.articles, after.articles))
  if (after.config && !before.config) ops.push({ op: 'insert', table: 'app_config', values: { id: 1, doc: after.config } })
  else if (after.config && !same(before.config, after.config)) ops.push({ op: 'update', table: 'app_config', id: 1, values: { doc: after.config } })
  ops.push(...diffList('health_configs', before.healthConfigs, after.healthConfigs, 'version', (x) => ({ doc: x })).filter((o) => o.op === 'insert'))
  ops.push(...diffList('audit_log', before.auditLog, after.auditLog).filter((o) => o.op === 'insert'))
  ops.push(...diffList('admin_notes', before.adminNotes, after.adminNotes, 'id', (x) => ({ id: x.id, application_id: x.applicationId, doc: x })).filter((o) => o.op === 'insert'))
  ops.push(...diffList('cover_letters', before.coverLetters, after.coverLetters))
  // Brand rows (spec 2026-10-20 brand CMS): null means the row is gone (back to the files' look).
  for (const id of ['draft', 'published']) {
    const was = before.brand?.[id] ?? null
    const now = after.brand?.[id] ?? null
    if (was && !now) ops.push({ op: 'delete', table: 'brand_settings', id })
    else if (now && !was) ops.push({ op: 'insert', table: 'brand_settings', values: { id, doc: now } })
    else if (now && !same(was, now)) ops.push({ op: 'update', table: 'brand_settings', id, values: { doc: now } })
  }
  return ops
}

// ---------- the store ----------

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
const newId = (prefix) => `${prefix}_${crypto.randomUUID()}`
const docs = (rows) => rows.map((r) => r.doc)

export function createSupabaseStore(client = supabase) {
  const loaded = new WeakMap() // db → { before, versions }

  async function load({ admin = false } = {}) {
    const sb = client()
    const { data, error } = await sb.auth.getSession()
    if (error) throw toApiError(error)
    const session = data.session
    if (!session) return { session: { status: 'guest' }, user: null, accounts: [] }
    const uid = session.user.id
    const [profile, role, consents, apps, mortgages, activities, banks, products, articles, config, health] = await Promise.all([
      must(sb.from('profiles').select('*').eq('id', uid).maybeSingle()),
      must(sb.from('user_roles').select('role').eq('user_id', uid).maybeSingle()),
      must(sb.from('consents').select('type, version, accepted_at').eq('user_id', uid)),
      must(sb.from('applications').select('id, doc, version').eq('user_id', uid).order('created_at', { ascending: false })),
      must(sb.from('mortgages').select('id, doc, version').eq('user_id', uid).order('created_at', { ascending: false })),
      must(sb.from('activities').select('id, doc').eq('user_id', uid).order('occurred_at', { ascending: false })),
      must(sb.from('banks').select('id, doc')),
      must(sb.from('bank_products').select('id, doc')),
      must(sb.from('articles').select('id, doc')),
      must(sb.from('app_config').select('doc').maybeSingle()),
      must(sb.from('health_configs').select('doc').order('version')),
    ])
    const consented = CONSENT_TYPES.every((t) => consents.some((c) => c.type === t && c.version === CONSENT_VERSION))
    const versions = { applications: {}, mortgages: {}, profiles: { [uid]: profile?.version } }
    for (const r of apps) versions.applications[r.id] = r.version
    for (const r of mortgages) versions.mortgages[r.id] = r.version

    const db = {
      clock: today(),
      session: { status: consented ? 'authenticated' : 'onboarding' },
      user: { id: uid, name: profile?.full_name ?? '', contact: session.user.email, contactType: 'email', role: role?.role ?? 'user', createdAt: profile?.created_at ?? session.user.created_at, version: profile?.version ?? 1 },
      profile: profile ? profileOf(profile, consents.map((c) => ({ type: c.type, version: c.version, acceptedAt: c.accepted_at }))) : {},
      finance: profile?.finance ?? {},
      applications: docs(apps),
      mortgages: docs(mortgages),
      activities: docs(activities),
      simulation: profile?.simulation ?? null,
      ...(Array.isArray(profile?.dashboard_layout) && { dashboardLayout: profile.dashboard_layout }),
      toursSeen: profile?.tours_seen ?? [],
      ...(profile?.kept && { kept: profile.kept }),
      banks: docs(banks),
      products: docs(products),
      articles: docs(articles),
      ...(config && { config: config.doc }),
      ...(health.length && { healthConfigs: docs(health) }),
      flags: {},
      accounts: [],
    }

    // Admin pages see every user account (RLS decides what a role may read).
    if (admin && role) {
      const [profiles, roles, allApps, allMortgages, notes, audit, changes, letters, brand] = await Promise.all([
        must(sb.from('profiles').select('*').neq('id', uid)),
        must(sb.from('user_roles').select('user_id, role')),
        must(sb.from('applications').select('id, user_id, doc, version').neq('user_id', uid).order('created_at', { ascending: false })),
        must(sb.from('mortgages').select('id, user_id, doc, version').neq('user_id', uid).order('created_at', { ascending: false })),
        must(sb.from('admin_notes').select('doc').order('created_at', { ascending: false })),
        must(sb.from('audit_log').select('doc').order('occurred_at', { ascending: false })),
        // ponytail: every admin call reads the whole history; filter by user in the query once it grows large.
        must(sb.from('user_changes').select('id, user_id, doc, occurred_at').order('occurred_at', { ascending: false })),
        must(sb.from('cover_letters').select('doc')),
        must(sb.from('brand_settings').select('id, doc')),
      ])
      const roleOf = new Map(roles.map((r) => [r.user_id, r.role]))
      for (const r of allApps) versions.applications[r.id] = r.version
      for (const r of allMortgages) versions.mortgages[r.id] = r.version
      db.accounts = profiles.map((p) => {
        versions.profiles[p.id] = p.version
        return {
          user: { id: p.id, name: p.full_name, contact: p.email, contactType: 'email', role: roleOf.get(p.id) ?? 'user', createdAt: p.created_at, version: p.version },
          profile: profileOf(p),
          finance: p.finance ?? {},
          applications: docs(allApps.filter((r) => r.user_id === p.id)),
          mortgages: docs(allMortgages.filter((r) => r.user_id === p.id)),
          activities: [], // admins only add activities for a user; existing ones stay unread here
          simulation: null,
        }
      })
      db.adminNotes = docs(notes)
      db.coverLetters = docs(letters)
      db.brand = Object.fromEntries(['draft', 'published'].map((id) => [id, brand.find((r) => r.id === id)?.doc ?? null]))
      db.auditLog = docs(audit)
      // Written by database triggers only (migration user_changes); planWrites never sends it back.
      db.userChanges = changes.map((r) => ({ ...r.doc, id: r.id, userId: r.user_id, occurredAt: r.occurred_at }))
    }

    loaded.set(db, { before: structuredClone(db), versions })
    db.newId = newId
    db.now = () => new Date().toISOString()
    return db
  }

  async function save(db) {
    const state = loaded.get(db)
    if (!state) return
    const ops = planWrites(state.before, db, state.versions)
    if (!ops.length) return
    const { error, status } = await client().rpc('apply_writes', { p_ops: ops })
    if (error) {
      const e = toApiError(error, status)
      if (e.code === 'CONFLICT_VERSION') e.conflict = true // createMockApi runs the operation again on fresh data
      throw e
    }
  }

  return { load, save }
}
