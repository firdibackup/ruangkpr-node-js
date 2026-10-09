// Auth through Supabase: Google OAuth + email OTP, then the consent step (spec 2026-10-09 §3).
import { IN_PROCESS } from '@/domains/home/selectHomeState'
import { CONSENT_TYPES, CONSENT_VERSION, validateEmail, validateWelcome } from '@/domains/session/validation'
import { maskEmail } from '@/lib/format'
import { ApiError } from '../apiError'
import { supabase } from './client'
import { must, toApiError } from './errors'
import { DOCS_BUCKET, PROOFS_BUCKET, listOwnFiles, removeFiles } from './storage'

const COOLDOWN_MS = 60_000
const GUEST = { status: 'guest', role: null, user: null, verification: null }
// ponytail: the email waiting for its code lives in this tab only; a refresh on /verify starts over at /register.
let pending = null

const fail = (code, message, status, extra = {}) => {
  throw new ApiError({ code, message, ...extra }, { status })
}
const failOnFields = (errors, message) => {
  const fieldErrors = Object.entries(errors).map(([field, msg]) => ({ field, message: msg }))
  if (fieldErrors.length) fail('VALIDATION_FAILED', message, 400, { fieldErrors })
}

async function sendCode(email) {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw toApiError(error)
  pending = { email, maskedDestination: maskEmail(email), resendAvailableAt: Date.now() + COOLDOWN_MS }
  return { maskedDestination: pending.maskedDestination, resendAvailableAt: pending.resendAvailableAt }
}

export const authApi = {
  async getSession() {
    const { data, error } = await supabase().auth.getSession()
    if (error) throw toApiError(error)
    const s = data.session
    if (!s) return pending ? { ...GUEST, status: 'pending', verification: { maskedDestination: pending.maskedDestination, resendAvailableAt: pending.resendAvailableAt } } : GUEST
    const id = s.user.id
    const [profile, role, consents] = await Promise.all([
      must(supabase().from('profiles').select('full_name, email, created_at').eq('id', id).maybeSingle()),
      must(supabase().from('user_roles').select('role').eq('user_id', id).maybeSingle()),
      must(supabase().from('consents').select('type').eq('user_id', id).eq('version', CONSENT_VERSION)),
    ])
    const user = { id, name: profile?.full_name ?? '', contact: s.user.email, contactType: 'email', role: role?.role ?? 'user', createdAt: profile?.created_at ?? s.user.created_at }
    const consented = CONSENT_TYPES.every((t) => consents.some((c) => c.type === t))
    return { status: consented ? 'authenticated' : 'onboarding', role: consented ? user.role : null, user, verification: null }
  },

  async signInWithGoogle() {
    const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/register` } })
    if (error) throw toApiError(error)
    return new Promise(() => {}) // the browser is on its way to Google
  },

  async sendEmailOtp({ email } = {}) {
    const value = String(email ?? '').trim().toLowerCase()
    failOnFields(validateEmail({ email: value }), 'Masukkan email yang valid.')
    return sendCode(value)
  },

  async verifyEmailOtp({ token } = {}) {
    if (!pending) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
    if (!/^\d{6}$/.test(String(token))) fail('VALIDATION_FAILED', 'Kode harus 6 angka.', 400)
    const { error } = await supabase().auth.verifyOtp({ email: pending.email, token: String(token), type: 'email' })
    if (error) throw toApiError(error)
    pending = null
    return { user: (await authApi.getSession()).user }
  },

  async resendOtp() {
    if (!pending) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
    const wait = Math.ceil((pending.resendAvailableAt - Date.now()) / 1000)
    if (wait > 0) fail('RATE_LIMITED', `Tunggu ${wait} detik untuk kirim ulang.`, 429, { retryable: true, details: { retryAfterSeconds: wait } })
    const { resendAvailableAt } = await sendCode(pending.email)
    return { resendAvailableAt }
  },

  async acceptConsents({ name, acceptTerms, acceptPrivacy } = {}) {
    failOnFields(validateWelcome({ name, acceptTerms, acceptPrivacy }), 'Periksa kembali data kamu.')
    await must(supabase().rpc('accept_consents', { p_name: name.trim(), p_terms: true, p_privacy: true, p_version: CONSENT_VERSION }))
    return { user: (await authApi.getSession()).user }
  },

  async logout() {
    pending = null
    const { error } = await supabase().auth.signOut({ scope: 'local' })
    if (error) throw toApiError(error)
    return { loggedOut: true }
  },

  // Files first (only the owner can remove them), then the account row cascade in delete_my_account. The database
  // refuses too while an application is at the bank; checking here first keeps the files in that case.
  async deleteAccount() {
    const { data, error } = await supabase().auth.getSession()
    if (error) throw toApiError(error)
    if (!data.session) fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401)
    const busy = await must(supabase().from('applications').select('id').in('status', IN_PROCESS).limit(1))
    if (busy.length) fail('INVALID_STATE_TRANSITION', 'Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun.', 400)
    const uid = data.session.user.id
    await removeFiles(DOCS_BUCKET, await listOwnFiles(DOCS_BUCKET, uid))
    await removeFiles(PROOFS_BUCKET, await listOwnFiles(PROOFS_BUCKET, uid))
    await must(supabase().rpc('delete_my_account'))
    pending = null
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
