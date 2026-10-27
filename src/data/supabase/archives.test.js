import { beforeEach, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() }))
vi.mock('./client', () => ({ supabase: () => ({ rpc: fake.rpc, storage: { from: () => fake } }) }))
import { createArchiveApi } from './archives'
const api = createArchiveApi()
const file = { bucket: 'application-documents', path: 'old-user/app/ktp/a.pdf' }

beforeEach(() => {
  vi.resetAllMocks()
  fake.rpc.mockImplementation(async (name) => ({ data: name === 'begin_delete_account_archive' ? [file] : null, error: null }))
  fake.remove.mockResolvedValue({ data: [], error: null })
})

it('deletes files before finalizing the archive, and propagates Storage failures', async () => {
  fake.remove.mockResolvedValueOnce({ error: { code: '42501', message: 'denied' }, status: 403 })
  await expect(api.remove('archive-id', { reason: 'Requested deletion' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect(fake.rpc).not.toHaveBeenCalledWith('finish_delete_account_archive', expect.anything())
  expect(await api.remove('archive-id', { reason: 'Requested deletion' })).toEqual({ deleted: true })
  expect(fake.remove).toHaveBeenCalledWith([file.path])
  expect(fake.rpc).toHaveBeenLastCalledWith('finish_delete_account_archive', { p_id: 'archive-id' })
})

it('downloads only a file belonging to the requested archive', async () => {
  fake.rpc.mockResolvedValue({ data: { files: [file] }, error: null })
  await expect(api.documentUrl('archive-id', file.bucket, 'another-user/secret.pdf')).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  expect(fake.createSignedUrl).not.toHaveBeenCalled()
  fake.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.com/file' }, error: null })
  expect(await api.documentUrl('archive-id', file.bucket, file.path)).toBe('https://example.com/file')
})
