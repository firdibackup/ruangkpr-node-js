import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockControls } from '../mockApi'

vi.mock('./client', () => ({ supabase: () => ({ storage: { from: (bucket) => ({ getPublicUrl: (path) => ({ data: { publicUrl: `https://sb.test/${bucket}/${path}` } }) }) } }) }))
vi.mock('./store', async () => {
  const { localStore } = await import('../mockApi')
  return { createSupabaseStore: () => localStore }
}) // An explicit test store stands in for the database.
vi.mock('./storage', async (original) => ({ ...(await original()), uploadFile: vi.fn(async () => {}), removeFiles: vi.fn(async () => {}) }))

const { createSupabaseApi } = await import('./index')
const { uploadFile, removeFiles } = await import('./storage')
const png = () => new File([new Uint8Array(8)], 'Logo.PNG', { type: 'image/png' })

describe('bank logos in Storage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uploads first, saves the public URL, then removes the file the bank no longer uses', async () => {
    mockControls.reset('admin_ops')
    const api = createSupabaseApi()
    let bank = (await api.admin.banks.list())[0]
    bank = await api.admin.banks.update(bank.id, { values: { logo: png() }, reason: 'Logo baru', expectedVersion: bank.version })
    const [bucket, path] = uploadFile.mock.calls[0]
    expect(bucket).toBe('bank-logos')
    expect(path).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(bank.logo).toEqual({ path, url: `https://sb.test/bank-logos/${path}` })
    expect(removeFiles.mock.calls.flatMap(([, paths]) => paths).filter(Boolean)).toEqual([]) // nothing to replace yet
    bank = await api.admin.banks.update(bank.id, { values: { logo: null }, reason: 'Logo dicabut', expectedVersion: bank.version })
    expect(removeFiles).toHaveBeenLastCalledWith('bank-logos', [path])
    expect(bank.logo).toBeNull()
  })

  it('a save that fails after the upload takes the new file back out', async () => {
    mockControls.reset('admin_ops')
    const api = createSupabaseApi()
    const bank = (await api.admin.banks.list())[0]
    await expect(api.admin.banks.update(bank.id, { values: { logo: png() }, reason: 'Logo baru', expectedVersion: bank.version + 1 })).rejects.toMatchObject({ code: 'CONFLICT_VERSION' })
    expect(removeFiles).toHaveBeenLastCalledWith('bank-logos', [uploadFile.mock.calls[0][1]])
  })

  it('a wrong file never reaches Storage', async () => {
    mockControls.reset('admin_ops')
    const api = createSupabaseApi()
    const bank = (await api.admin.banks.list())[0]
    const pdf = new File(['%PDF'], 'logo.pdf', { type: 'application/pdf' })
    await expect(api.admin.banks.update(bank.id, { values: { logo: pdf }, reason: 'Logo baru', expectedVersion: bank.version })).rejects.toMatchObject({ code: 'FILE_TYPE_UNSUPPORTED' })
    expect(uploadFile).not.toHaveBeenCalled()
  })
})
