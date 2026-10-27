import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApplicationApi } from './applicationApi'

vi.mock('./supabase', () => ({ createSupabaseApi: () => ({ source: 'supabase' }) }))

describe('production boundary', () => {
  beforeEach(() => vi.resetModules())

  it('ignores old demo flags and a mock data-source setting without reading browser demo storage', async () => {
    sessionStorage.setItem('ruangkpr:demo', '1')
    localStorage.setItem('ruangkpr:prototype:v1', '{"session":{"status":"authenticated"}}')
    vi.stubEnv('VITE_DATA_SOURCE', 'mock')
    const read = vi.spyOn(Storage.prototype, 'getItem')
    try {
      const runtime = await import('./api.production')
      expect(runtime.api.source).toBe('supabase')
      expect(runtime.demoEnabled).toBe(false)
      expect(runtime.isDemo).toBe(false)
      expect(runtime.isMock).toBe(false)
      expect(runtime.showDemoControls).toBe(false)
      expect(runtime.startDemo('fresh', '/')).toBe(false)
      expect(runtime.exitDemo()).toBe(false)
      expect(read).not.toHaveBeenCalled()
    } finally {
      read.mockRestore()
      vi.unstubAllEnvs()
      sessionStorage.clear()
      localStorage.clear()
    }
  })

  it('never invents catalog or article records for an empty backend, including the first admin write', async () => {
    const db = { session: { status: 'authenticated' }, user: { id: 'admin', role: 'super_admin', name: 'Admin' }, clock: '2026-10-27', seq: 0, accounts: [] }
    const api = createApplicationApi({ store: { load: async () => db, save: async () => {} } })
    expect(api.auth).toBeUndefined()
    expect(api.applications.uploadDocument).toBeUndefined()
    expect(await api.admin.banks.list()).toEqual([])
    expect(await api.admin.articles.list({})).toEqual([])
    const bank = await api.admin.banks.create({ values: { name: 'Bank Nyata', mark: 'BN' }, reason: 'Tambah bank resmi' })
    expect(bank.name).toBe('Bank Nyata')
    expect(db.banks).toHaveLength(1)
    expect(db.products).toEqual([])
  })
})
