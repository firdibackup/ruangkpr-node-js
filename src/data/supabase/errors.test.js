import { describe, expect, it } from 'vitest'
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { must, toApiError } from './errors'

describe('toApiError', () => {
  it('turns a domain exception from SQL into the same ApiError the mock throws', () => {
    const e = toApiError({ code: 'P0001', message: 'Periksa kembali data kamu.', details: JSON.stringify({ code: 'VALIDATION_FAILED', fieldErrors: [{ field: 'name', message: 'Nama minimal 3 huruf.' }] }) }, 400)
    expect(e).toMatchObject({ name: 'ApiError', code: 'VALIDATION_FAILED', status: 400, message: 'Periksa kembali data kamu.', fieldErrors: [{ field: 'name', message: 'Nama minimal 3 huruf.' }] })
  })

  it('maps permission and session failures', () => {
    expect(toApiError({ code: '42501', message: 'permission denied for table profiles' }, 403)).toMatchObject({ code: 'FORBIDDEN', status: 403 })
    expect(toApiError({ code: 'PGRST303', message: 'JWT expired' }, 401)).toMatchObject({ code: 'AUTH_REQUIRED', status: 401 })
    expect(toApiError({ code: 'P0001', message: 'Sesi berakhir. Silakan masuk lagi.', details: '{"code":"AUTH_REQUIRED"}' })).toMatchObject({ code: 'AUTH_REQUIRED', status: 401 })
  })

  it('maps auth errors to Indonesian messages', () => {
    expect(toApiError(new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'))).toMatchObject({ code: 'OTP_INVALID', message: 'Kode salah atau kedaluwarsa. Coba lagi atau kirim ulang kode.' })
    expect(toApiError(new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'))).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
  })

  it('maps the one-active unique indexes to the same codes the mock uses', () => {
    expect(toApiError({ code: '23505', message: 'duplicate key value violates unique constraint "applications_one_active"' }, 409)).toMatchObject({ code: 'ACTIVE_DRAFT_EXISTS', status: 409 })
    expect(toApiError({ code: '23505', message: 'duplicate key value violates unique constraint "mortgages_one_active"' }, 409)).toMatchObject({ code: 'ACTIVE_MORTGAGE_EXISTS', status: 409 })
  })

  it('treats network failures as retryable', () => {
    expect(toApiError(new AuthRetryableFetchError('Failed to fetch', 0))).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true })
    expect(toApiError({ code: '', message: 'TypeError: Failed to fetch' }, 0)).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true })
  })

  it('must returns data or throws the mapped error', async () => {
    await expect(must(Promise.resolve({ data: [1], error: null, status: 200 }))).resolves.toEqual([1])
    await expect(must(Promise.resolve({ data: null, error: { code: '42501', message: 'denied' }, status: 403 }))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
