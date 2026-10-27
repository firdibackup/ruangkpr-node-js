import { describe, expect, it } from 'vitest'
import { createApplicationApi } from './applicationApi'
import { createSeed } from './seed'

// Stands in for supabaseStore: hands the shared operations a fresh copy per call and records writes.
function memoryStore(seed) {
  let data = structuredClone(seed)
  let n = 0
  const calls = { load: [], saved: [] }
  return {
    calls,
    load(scope) {
      calls.load.push(scope)
      const db = structuredClone(data)
      db.newId = (prefix) => `${prefix}_mem${++n}`
      db.now = () => '2026-10-09T03:00:00.000Z'
      return Promise.resolve(db)
    },
    save(db) {
      const { newId: _id, now: _now, ...plain } = db
      data = structuredClone(plain)
      calls.saved.push(data)
      return Promise.resolve()
    },
  }
}

describe('createApplicationApi over an injected store', () => {
  it('loads through the store, saves what the operation changed, and takes ids and time from the store', async () => {
    const store = memoryStore(createSeed('fresh'))
    const api = createApplicationApi({ store })
    const m = await api.mortgages.createSetup()
    expect(m).toMatchObject({ id: 'mtg_mem1', status: 'draft', createdAt: '2026-10-09T03:00:00.000Z' })
    expect(store.calls.load).toEqual([{ admin: false }])
    expect(store.calls.saved.at(-1).mortgages.map((x) => x.id)).toEqual(['mtg_mem1'])
  })

  it('asks the store for the admin scope on admin operations', async () => {
    const store = memoryStore(createSeed('admin_ops'))
    const api = createApplicationApi({ store })
    await api.admin.users.list()
    expect(store.calls.load).toEqual([{ admin: true }])
  })

  it('runs the operation again when the store reports that a row changed meanwhile', async () => {
    const store = memoryStore(createSeed('fresh'))
    const save = store.save
    let conflicts = 1
    store.save = (db) => (conflicts-- > 0 ? Promise.reject(Object.assign(new Error('changed'), { conflict: true })) : save(db))
    const api = createApplicationApi({ store })
    await api.dashboard.markTourSeen('my-kpr')
    expect(store.calls.load).toHaveLength(2)
    expect(store.calls.saved.at(-1).toursSeen).toContain('my-kpr')
  })
})
