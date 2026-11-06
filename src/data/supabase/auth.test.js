import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError } from '@supabase/supabase-js'

// A stand-in for the supabase-js client: just the calls authApi makes, backed by plain arrays. The one account with a
// password is rumah2026; unverified@example.com never verified its email; taken@example.com already has an account.
const state = { session: null, tables: {}, calls: [], files: {}, updateError: null }
const result = (data) => ({ data, error: null, status: 200 })
const authError = (message, status, code) => ({ data: {}, error: new AuthApiError(message, status, code) })
const signedIn = { user: { id: 'u1', email: 'nadia@example.com', created_at: '2026-10-09T00:00:00Z' } }
const query = (table) => {
  const rows = () => state.tables[table] ?? []
  const q = { select: () => q, eq: () => q, in: () => q, limit: () => q, maybeSingle: () => Promise.resolve(result(rows()[0] ?? null)), then: (ok, ko) => Promise.resolve(result(rows())).then(ok, ko) }
  return q
}
const called = (name) => state.calls.filter((c) => c[0] === name)
const fake = {
  auth: {
    getSession: async () => ({ data: { session: state.session }, error: null }),
    signUp: async (args) => (state.calls.push(['signUp', args]), result({ user: { identities: args.email === 'taken@example.com' ? [] : [{ provider: 'email' }] }, session: null })),
    signInWithPassword: async (args) => {
      state.calls.push(['signIn', args])
      if (args.password !== 'rumah2026') return authError('Invalid login credentials', 400, 'invalid_credentials')
      if (args.email === 'unverified@example.com') return authError('Email not confirmed', 400, 'email_not_confirmed')
      state.session = signedIn
      return result({ session: signedIn })
    },
    verifyOtp: async (args) => {
      state.calls.push(['verify', args])
      if (args.token !== '148260') return authError('Token has expired or is invalid', 403, 'otp_expired')
      state.session = signedIn
      return result({ session: signedIn })
    },
    updateUser: async (args) => {
      state.calls.push(['updateUser', args])
      const error = state.updateError
      state.updateError = null
      return { data: {}, error }
    },
    resetPasswordForEmail: async (email, options) => (state.calls.push(['reset', email, options]), result({})),
    resend: async (args) => (state.calls.push(['resend', args]), result({})),
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
vi.mock('./client', () => ({ supabase: () => fake, recovery: { active: false } }))
const { authApi } = await import('./auth')
const { recovery } = await import('./client')

const registration = { name: ' Nadia Putri ', email: ' Nadia@Example.com ', password: 'rumah2026', confirm: 'rumah2026', acceptTerms: true, acceptPrivacy: true }

beforeEach(async () => {
  Object.assign(state, { session: null, tables: { profiles: [{ full_name: 'Nadia Putri', email: 'nadia@example.com' }] }, calls: [], files: {}, updateError: null })
  await authApi.logout()
})

describe('supabase authApi', () => {
  it('getSession is guest without a session or a code to wait for', async () => {
    expect(await authApi.getSession()).toEqual({ status: 'guest', role: null, user: null, verification: null })
  })

  it('signUp validates, normalises, keeps the name, and waits for the code', async () => {
    await expect(authApi.signUp({ ...registration, confirm: 'rumah2025' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(state.calls).toEqual([])
    const r = await authApi.signUp(registration)
    expect(r.maskedDestination).toBe('na***@example.com')
    expect(called('signUp')[0][1]).toEqual({ email: 'nadia@example.com', password: 'rumah2026', options: { data: { full_name: 'Nadia Putri' } } })
    expect(await authApi.getSession()).toMatchObject({ status: 'pending', verification: { maskedDestination: 'na***@example.com' } })
  })

  it('signUp with an email that already has an account says so (GoTrue answers without identities)', async () => {
    await expect(authApi.signUp({ ...registration, email: 'taken@example.com' })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
    expect((await authApi.getSession()).status).toBe('guest')
  })

  it('verifySignup: a wrong code keeps waiting; the right one saves the typed password, then the consent', async () => {
    await authApi.signUp(registration)
    await expect(authApi.verifySignup({ token: '000000' })).rejects.toMatchObject({ code: 'OTP_INVALID' })
    expect((await authApi.getSession()).status).toBe('pending')
    await authApi.verifySignup({ token: '148260' })
    expect(called('verify')[1][1]).toEqual({ email: 'nadia@example.com', token: '148260', type: 'email' })
    expect(called('updateUser')).toEqual([['updateUser', { password: 'rumah2026' }]])
    expect(called('rpc')[0]).toEqual(['rpc', 'accept_consents', { p_name: 'Nadia Putri', p_terms: true, p_privacy: true, p_version: '2026-09-01' }])
    expect((await authApi.getSession()).status).toBe('onboarding') // the fake keeps no consent rows
  })

  it('a password already on the account is fine; a failed save is retried without the code again', async () => {
    await authApi.signUp(registration)
    state.updateError = new AuthApiError('upstream down', 500, 'unexpected_failure')
    await expect(authApi.verifySignup({ token: '148260' })).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
    expect((await authApi.getSession()).status).toBe('pending')
    state.updateError = new AuthApiError('New password should be different from the old password.', 422, 'same_password')
    await authApi.verifySignup({ token: '148260' })
    expect(called('verify')).toHaveLength(1)
    expect(called('rpc')).toHaveLength(1)
  })

  it('signInWithPassword: wrong password, never-verified email (a new code, then /verify), and success', async () => {
    await expect(authApi.signInWithPassword({ email: 'nadia@example.com', password: 'salah123' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' })
    await expect(authApi.signInWithPassword({ email: 'unverified@example.com', password: 'rumah2026' })).rejects.toMatchObject({ code: 'EMAIL_NOT_CONFIRMED' })
    expect(called('resend')).toEqual([['resend', { type: 'signup', email: 'unverified@example.com' }]])
    expect((await authApi.getSession()).status).toBe('pending')
    await authApi.signInWithPassword({ email: ' Nadia@Example.com ', password: 'rumah2026' })
    expect(await authApi.getSession()).toMatchObject({ status: 'onboarding', user: { contact: 'nadia@example.com' } })
  })

  it('reset: one answer for any email, with a link back to /reset-password', async () => {
    const r = await authApi.requestPasswordReset({ email: 'Siapa@Example.com' })
    expect(r.maskedDestination).toBe('si***@example.com')
    expect(called('reset')).toEqual([['reset', 'siapa@example.com', { redirectTo: `${window.location.origin}/reset-password` }]])
    expect((await authApi.getSession()).status).toBe('guest')
  })

  it('the session a reset link opened is "recovery" until its new password is saved', async () => {
    await expect(authApi.updatePassword({ password: 'rumah2027', confirm: 'rumah2027' })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    state.session = signedIn
    recovery.active = true // what supabase-js reports for the link (client.js)
    expect(await authApi.getSession()).toMatchObject({ status: 'recovery', role: null, user: { contact: 'nadia@example.com' } })
    await expect(authApi.updatePassword({ password: 'pendek', confirm: 'pendek' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    state.updateError = new AuthApiError('upstream down', 500, 'unexpected_failure')
    await expect(authApi.updatePassword({ password: 'rumah2027', confirm: 'rumah2027' })).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
    expect((await authApi.getSession()).status).toBe('recovery')
    await authApi.updatePassword({ password: 'rumah2027', confirm: 'rumah2027' })
    expect(called('updateUser').at(-1)).toEqual(['updateUser', { password: 'rumah2027' }])
    expect((await authApi.getSession()).status).toBe('onboarding')
  })

  it('resendOtp waits out the cooldown, then sends the signup code again', async () => {
    vi.useFakeTimers()
    try {
      await authApi.signUp(registration)
      await expect(authApi.resendOtp()).rejects.toMatchObject({ code: 'RATE_LIMITED' })
      vi.advanceTimersByTime(60_000)
      await authApi.resendOtp()
      expect(called('resend')).toEqual([['resend', { type: 'signup', email: 'nadia@example.com' }]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('changePassword proves the current password with a fresh sign-in, then saves the new one', async () => {
    state.session = signedIn
    await expect(authApi.changePassword({ currentPassword: 'salah123', password: 'rumah2027', confirm: 'rumah2027' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'Password lama salah.' })
    expect(called('updateUser')).toHaveLength(0)
    await authApi.changePassword({ currentPassword: 'rumah2026', password: 'rumah2027', confirm: 'rumah2027' })
    expect(called('signIn').at(-1)[1]).toEqual({ email: 'nadia@example.com', password: 'rumah2026' })
    expect(called('updateUser')).toEqual([['updateUser', { password: 'rumah2027' }]])
  })

  it('providers asks the auth server once whether Google is on', async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => ({ external: { email: true, google: false } }) }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      expect(await authApi.providers()).toEqual({ google: false })
      await authApi.providers()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
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

  it('deleteAccount delegates atomic archiving and deletion without removing files', async () => {
    state.session = signedIn
    state.files['application-documents'] = [{ prefix: 'u1', name: 'app_1' }, { prefix: 'u1/app_1', name: 'ktp' }, { prefix: 'u1/app_1/ktp', name: 'a.pdf', id: 'f1' }]
    expect(await authApi.deleteAccount()).toEqual({ deleted: true })
    expect(state.calls).toEqual([['rpc', 'delete_my_account', undefined]])
  })

  it('an old session without a profile is treated as signed out', async () => {
    state.session = signedIn
    state.tables.profiles = []
    expect(await authApi.getSession()).toMatchObject({ status: 'guest', user: null })
  })
})
