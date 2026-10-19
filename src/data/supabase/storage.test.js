import { describe, expect, it } from 'vitest'
import { filePath, ownsFolder, storageError } from './storage'

describe('storage helpers', () => {
  it('builds {user}/{record}/{type}/{uuid}.{ext} paths with a lower-case extension', () => {
    expect(filePath(['u1', 'app_1', 'ktp'], { name: 'KTP Saya.JPG' })).toMatch(/^u1\/app_1\/ktp\/[0-9a-f-]{36}\.jpg$/)
    expect(filePath(['u1', 'mtg_1'], { name: 'bukti' })).toMatch(/^u1\/mtg_1\/[0-9a-f-]{36}\.bin$/)
    expect(filePath([], { name: 'Logo.PNG' })).toMatch(/^[0-9a-f-]{36}\.png$/) // bank logos sit at the bucket root
  })

  it('only removes files that sit in the record own folder (a copied application shares the old files)', () => {
    expect(ownsFolder('u1/app_new/ktp/a.pdf', 'app_new')).toBe(true)
    expect(ownsFolder('u1/app_old/ktp/a.pdf', 'app_new')).toBe(false)
    expect(ownsFolder(undefined, 'app_new')).toBe(false)
  })

  it('maps Storage HTTP failures to the upload errors the UI already shows', () => {
    expect(storageError(413, '')).toMatchObject({ code: 'FILE_TOO_LARGE', status: 413 })
    expect(storageError(415, '')).toMatchObject({ code: 'FILE_TYPE_UNSUPPORTED', status: 415 })
    expect(storageError(400, '{"message":"new row violates row-level security policy"}')).toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    expect(storageError(500, '')).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true })
  })
})
