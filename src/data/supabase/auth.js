// Auth through Supabase: email + password or Google. A 6-digit email code verifies a new account; a forgotten password
// is reset through an email link that opens /reset-password. Consent before any data (spec 2026-10-09 §3, Amandemen 3).
import { IN_PROCESS } from '@/domains/home/selectHomeState'
import { CONSENT_TYPES, CONSENT_VERSION, validateChangePassword, validateEmail, validateLogin, validateNewPassword, validateRegister, validateWelcome } from '@/domains/session/validation'
import { maskEmail } from '@/lib/format'
import { ApiError } from '../apiError'
import { recovery, supabase } from './client'
import { must, toApiError } from './errors'

const COOLDOWN_MS = 60_000
const GUEST = { status: 'guest', role: null, user: null, verification: null }
// ponytail: the email waiting for its code (and the password it gets once verified) lives in this tab only; a refresh
// on /verify starts over at /login.
let pending = null
let providers = null

const fail = (code, message, status, extra = {}) => {
  throw new ApiError({ code, message, ...extra }, { status })
}
const failOnFields = (errors, message) => {
  const fieldErrors = Object.entries(errors).map(([field, msg]) => ({ field, message: msg }))
  if (fieldErrors.length) fail('VALIDATION_FAILED', message, 400, { fieldErrors })
}
const normalize = (email) => String(email ?? '').trim().toLowerCase()

function awaitCode(email, extra = {}) {
  pending = { email, ...extra, maskedDestination: maskEmail(email), resendAvailableAt: Date.now() + COOLDOWN_MS }
  return { maskedDestination: pending.maskedDestination, resendAvailableAt: pending.resendAvailableAt }
}

async function savePassword(password) {
  const { error } = await supabase().auth.updateUser({ password })
  // Keeping the password the account already has is fine (a reset to the same one, or a repeated verification).
  if (error && error.code !== 'same_password') throw toApiError(error)
}

export const authApi = {
  async getSession() {
    // A flow waiting for its code wins over the session it may already hold (code checked, password not saved yet).
    if (pending) return { ...GUEST, status: 'pending', verification: { maskedDestination: pending.maskedDestination, resendAvailableAt: pending.resendAvailableAt } }
    const { data, error } = await supabase().auth.getSession()
    if (error) throw toApiError(error)
    const s = data.session
    if (!s) return GUEST
    const id = s.user.id
    const [profile, role, consents] = await Promise.all([
      must(supabase().from('profiles').select('full_name, email, created_at').eq('id', id).maybeSingle()),
      must(supabase().from('user_roles').select('role').eq('user_id', id).maybeSingle()),
      must(supabase().from('consents').select('type').eq('user_id', id).eq('version', CONSENT_VERSION)),
    ])
    if (!profile) {
      await supabase().auth.signOut({ scope: 'local' })
      return GUEST
    }
    const user = { id, name: profile.full_name ?? '', contact: s.user.email, contactType: 'email', role: role?.role ?? 'user', createdAt: profile.created_at ?? s.user.created_at }
    const consented = CONSENT_TYPES.every((t) => consents.some((c) => c.type === t))
    if (recovery.active) return { status: 'recovery', role: null, user, verification: null }
    return { status: consented ? 'authenticated' : 'onboarding', role: consented ? user.role : null, user, verification: null }
  },

  // The Google button shows only once the auth server has the provider on (supabase/README.md, Fase 0 §3).
  async providers() {
    providers ??= fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then((r) => r.json())
      .then((s) => ({ google: Boolean(s.external?.google) }))
      .catch(() => {
        providers = null
        return { google: false }
      })
    return providers
  },

  async signInWithGoogle() {
    const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/login` } })
    if (error) throw toApiError(error)
    return new Promise(() => {}) // the browser is on its way to Google
  },

  async signInWithPassword({ email, password } = {}) {
    const value = normalize(email)
    failOnFields(validateLogin({ email: value, password }), 'Periksa kembali data kamu.')
    const { error } = await supabase().auth.signInWithPassword({ email: value, password })
    if (error?.code === 'email_not_confirmed') {
      // Registered but never verified: a new code goes out (unless one just did) and /verify finishes the account.
      const { error: resendError } = await supabase().auth.resend({ type: 'signup', email: value })
      if (resendError && resendError.code !== 'over_email_send_rate_limit') throw toApiError(resendError)
      awaitCode(value, { password })
      fail('EMAIL_NOT_CONFIRMED', 'Email kamu belum diverifikasi. Masukkan kode yang kami kirim ke email itu.', 403)
    }
    if (error) throw toApiError(error)
    pending = null
    recovery.active = false
    return { user: (await authApi.getSession()).user }
  },

  async signUp(values = {}) {
    const email = normalize(values.email)
    const name = String(values.name ?? '').trim()
    failOnFields(validateRegister({ ...values, email }), 'Periksa kembali data kamu.')
    const { data, error } = await supabase().auth.signUp({ email, password: values.password, options: { data: { full_name: name } } })
    if (error) throw toApiError(error)
    // An email that already has an account comes back without identities, and no email goes out.
    if (!data.user?.identities?.length) fail('EMAIL_TAKEN', 'Email ini sudah terdaftar. Masuk atau pakai Lupa password.', 409)
    return awaitCode(email, { password: values.password, name })
  },

  async verifySignup({ token } = {}) {
    if (!pending) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
    if (!/^\d{6}$/.test(String(token ?? ''))) fail('VALIDATION_FAILED', 'Kode harus 6 angka.', 400)
    // The code is checked once: a retry after a failed save goes straight to the save.
    if (!pending.verified) {
      const { error } = await supabase().auth.verifyOtp({ email: pending.email, token: String(token), type: 'email' })
      if (error) throw toApiError(error)
      pending.verified = true
    }
    // GoTrue keeps the first password of an email that was never verified: the owner of the inbox sets theirs now.
    await savePassword(pending.password)
    // Consent given on the registration form; an account finished from /login agrees at /welcome instead.
    if (pending.name) await must(supabase().rpc('accept_consents', { p_name: pending.name, p_terms: true, p_privacy: true, p_version: CONSENT_VERSION }))
    pending = null
    return { user: (await authApi.getSession()).user }
  },

  // Emails a link back to this app's /reset-password (the auth server must allow the address: supabase/README.md
  // step 2). Answers the same whether or not the email has an account.
  // ponytail: PKCE keeps the link's key in this browser, so it must be opened here; a template with {{ .TokenHash }}
  // and verifyOtp({ token_hash }) would work from any device.
  async requestPasswordReset({ email } = {}) {
    const value = normalize(email)
    failOnFields(validateEmail({ email: value }), 'Masukkan email yang valid.')
    const { error } = await supabase().auth.resetPasswordForEmail(value, { redirectTo: `${window.location.origin}/reset-password` })
    if (error) throw toApiError(error)
    return { maskedDestination: maskEmail(value), resendAvailableAt: Date.now() + COOLDOWN_MS }
  },

  // The session the reset link opened sets its new password, then becomes an ordinary one.
  async updatePassword({ password, confirm } = {}) {
    if (!recovery.active) fail('INVALID_STATE_TRANSITION', 'Buka link reset password dari email dulu.', 400)
    failOnFields(validateNewPassword({ password, confirm }), 'Periksa kembali password baru kamu.')
    await savePassword(password)
    recovery.active = false
    return { user: (await authApi.getSession()).user }
  },

  async resendOtp() {
    if (!pending) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
    const wait = Math.ceil((pending.resendAvailableAt - Date.now()) / 1000)
    if (wait > 0) fail('RATE_LIMITED', `Tunggu ${wait} detik untuk kirim ulang.`, 429, { retryable: true, details: { retryAfterSeconds: wait } })
    const { error } = await supabase().auth.resend({ type: 'signup', email: pending.email })
    if (error) throw toApiError(error)
    pending.resendAvailableAt = Date.now() + COOLDOWN_MS
    return { resendAvailableAt: pending.resendAvailableAt }
  },

  async changePassword(values = {}) {
    failOnFields(validateChangePassword(values), 'Periksa kembali password kamu.')
    const { data, error } = await supabase().auth.getSession()
    if (error) throw toApiError(error)
    if (!data.session) fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
    // Signing in again proves the current password and gives the recent session a password change needs.
    const { error: wrong } = await supabase().auth.signInWithPassword({ email: data.session.user.email, password: values.currentPassword })
    if (wrong?.code === 'invalid_credentials') fail('VALIDATION_FAILED', 'Password lama salah.', 400, { fieldErrors: [{ field: 'currentPassword', message: 'Password lama salah.' }] })
    if (wrong) throw toApiError(wrong)
    await savePassword(values.password)
    return { changed: true }
  },

  async acceptConsents({ name, acceptTerms, acceptPrivacy } = {}) {
    failOnFields(validateWelcome({ name, acceptTerms, acceptPrivacy }), 'Periksa kembali data kamu.')
    await must(supabase().rpc('accept_consents', { p_name: name.trim(), p_terms: true, p_privacy: true, p_version: CONSENT_VERSION }))
    return { user: (await authApi.getSession()).user }
  },

  async logout() {
    pending = null
    recovery.active = false
    const { error } = await supabase().auth.signOut({ scope: 'local' })
    if (error) throw toApiError(error)
    return { loggedOut: true }
  },

  // The database archives data/files and removes the login in one transaction.
  async deleteAccount() {
    const { data, error } = await supabase().auth.getSession()
    if (error) throw toApiError(error)
    if (!data.session) fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
    const busy = await must(supabase().from('applications').select('id').in('status', IN_PROCESS).limit(1))
    if (busy.length) fail('INVALID_STATE_TRANSITION', 'Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun.', 400)
    await must(supabase().rpc('delete_my_account'))
    pending = null
    recovery.active = false
    await supabase().auth.signOut({ scope: 'local' })
    return { deleted: true }
  },

  // Another tab signing out (or an expired refresh token) must reach the UI. Never call supabase inside the
  // listener itself: supabase-js holds a lock there.
  onChange(callback) {
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setTimeout(callback, 0)
    })
    return () => data.subscription.unsubscribe()
  },
}
