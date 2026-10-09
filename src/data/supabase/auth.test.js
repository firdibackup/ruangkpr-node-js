import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError } from '@supabase/supabase-js'

// A stand-in for the supabase-js client: just the calls authApi makes, backed by plain arrays.
const state = { session: null, tables: {}, calls: [], files: {} }
const result = (data) => ({ data, error: null, status: 200 })
const query = (table) => {
  const rows = () => state.tables[table] ?? []
  const q = { select: () => q, eq: () => q, in: () => q, limit: () => q, maybeSingle: () => Promise.resolve(result(rows()[0] ?? null)), then: (ok, ko) => Promise.resolve(result(rows())).then(ok, ko) }
  return q
}
const fake = {
  auth: {
    getSession: async () => ({ data: { session: state.session }, error: null }),
    signInWithOtp: async (args) => (state.calls.push(['otp', args]), { error: null }),
    verifyOtp: async (args) => (state.calls.push(['verify', args]), args.token === '148260' ? { error: null } : { error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired') }),
    signOut: async () => ({ error: null }),
  },
  from: query,
  storage: {
    from: (bucket) => ({
      list: async (prefix) => ({ data: (state.files[bucket] ?? []).filter((f) => f.prefix === prefix).map(({ name, id }) => ({ name, id })), error: null }),
      remove: async (paths) => (state.calls.push(['remove', bucket, paths]), { data: [], error: null }),
    }),
  },
  rpc: async (name, args) => (state.calls.push(['rpc', name, args]), { data: null, error: null, status: 204 }),
}
vi.mock('./client', () => ({ supabase: () => fake }))
const { authApi } = await import('./auth')

const signedIn = { user: { id: 'u1', email: 'nadia@example.com', created_at: '2026-10-09T00:00:00Z' } }

beforeEach(async () => {
  Object.assign(state, { session: null, tables: {}, calls: [], files: {} })
  await authApi.logout()
})

describe('supabase authApi', () => {
  it('getSession is guest without a session or a pending email', async () => {
    expect(await authApi.getSession()).toEqual({ status: 'guest', role: null, user: null, verification: null })
  })

  it('sendEmailOtp validates, normalises, and leaves the session pending', async () => {
    await expect(authApi.sendEmailOtp({ email: 'x' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    const r = await authApi.sendEmailOtp({ email: ' Nadia@Example.com ' })
    expect(r.maskedDestination).toBe('na***@example.com')
    expect(state.calls[0]).toEqual(['otp', { email: 'nadia@example.com', options: { shouldCreateUser: true } }])
    expect(await authApi.getSession()).toMatchObject({ status: 'pending', verification: { maskedDestination: 'na***@example.com' } })
  })

  it('verifyEmailOtp maps a wrong code and keeps the email pending', async () => {
    await authApi.sendEmailOtp({ email: 'nadia@example.com' })
    await expect(authApi.verifyEmailOtp({ token: '000000' })).rejects.toMatchObject({ code: 'OTP_INVALID' })
    expect((await authApi.getSession()).status).toBe('pending')
  })

  it('a signed-in user without consent is onboarding; with consent authenticated with their role', async () => {
    state.session = signedIn
    state.tables.profiles = [{ full_name: 'Nadia Putri', email: 'nadia@example.com', created_at: '2026-10-09T00:00:00Z' }]
    expect(await authApi.getSession()).toMatchObject({ status: 'onboarding', role: null, user: { id: 'u1', name: 'Nadia Putri', contact: 'nadia@example.com', contactType: 'email' } })
    state.tables.consents = [{ type: 'terms' }, { type: 'privacy' }]
    expect(await authApi.getSession()).toMatchObject({ status: 'authenticated', role: 'user' })
    state.tables.user_roles = [{ role: 'super_admin' }]
    expect(await authApi.getSession()).toMatchObject({ status: 'authenticated', role: 'super_admin' })
  })

  it('acceptConsents validates before calling the RPC with the active version', async () => {
    await expect(authApi.acceptConsents({ name: 'Na', acceptTerms: true, acceptPrivacy: true })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(state.calls).toHaveLength(0)
    await authApi.acceptConsents({ name: ' Nadia Putri ', acceptTerms: true, acceptPrivacy: true })
    expect(state.calls[0]).toEqual(['rpc', 'accept_consents', { p_name: 'Nadia Putri', p_terms: true, p_privacy: true, p_version: '2026-09-01' }])
  })

  it('deleteAccount refuses while an application is at the bank, before touching any file', async () => {
    state.session = signedIn
    state.tables.applications = [{ id: 'app_1' }]
    await expect(authApi.deleteAccount()).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    expect(state.calls).toEqual([])
  })

  it('deleteAccount removes the user files, then the account', async () => {
    state.session = signedIn
    state.files['application-documents'] = [{ prefix: 'u1', name: 'app_1' }, { prefix: 'u1/app_1', name: 'ktp' }, { prefix: 'u1/app_1/ktp', name: 'a.pdf', id: 'f1' }]
    expect(await authApi.deleteAccount()).toEqual({ deleted: true })
    expect(state.calls).toEqual([['remove', 'application-documents', ['u1/app_1/ktp/a.pdf']], ['rpc', 'delete_my_account', undefined]])
  })
})
