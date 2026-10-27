// Browser-only authentication simulator, included only in staging/development/test.
import { CONSENT_TYPES, CONSENT_VERSION, validateChangePassword, validateEmail, validateLogin, validateNewPassword, validateRegister, validateWelcome } from '@/domains/session/validation'
import { IN_PROCESS } from '@/domains/home/selectHomeState'
import { maskEmail } from '@/lib/format'
import { ApiError } from './apiError'
import { archiveFiles } from './accountArchives'
import { ACCOUNT_KEYS, DEMO_PASSWORD, GOOGLE_DEMO, newAccount, pickAccount, staffAccount } from './seed'

const fail = (code, message, status = 400, extra = {}) => { throw new ApiError({ code, message, ...extra }, { status }) }
const failOnFields = (errors, message) => {
  const fieldErrors = Object.entries(errors).map(([field, message]) => ({ field, message }))
  if (fieldErrors.length) fail('VALIDATION_FAILED', message, 400, { fieldErrors })
}
const nowIso = (db) => db.now?.() ?? `${db.clock}T${new Date().toISOString().slice(11)}`
const nextId = (db) => db.newId?.('usr') ?? `usr_${String((db.seq += 1)).padStart(6, '0')}`
const consented = (db) => CONSENT_TYPES.every((t) => db.profile?.consents?.some((c) => c.type === t && c.version === CONSENT_VERSION))
function signInAs(db, contact, name = '') {
  if (db.user?.contact !== contact) {
    if (db.user) db.accounts.push(pickAccount(db))
    const i = db.accounts.findIndex((a) => a.user.contact === contact)
    const next = i < 0 ? (staffAccount(contact) ?? newAccount()) : db.accounts.splice(i, 1)[0]
    ACCOUNT_KEYS.forEach((k) => delete db[k])
    Object.assign(db, next)
  }
  db.user = { role: 'user', createdAt: nowIso(db), name, ...db.user, id: db.user?.id ?? nextId(db), contact, contactType: 'email' }
  db.profile = { ...db.profile, fullName: db.profile?.fullName || db.user.name, email: db.profile?.email || contact }
  db.session = { status: consented(db) ? 'authenticated' : 'onboarding', verification: null }
}
function agree(db, name) {
  const at = nowIso(db)
  db.user = { ...db.user, name }
  db.profile = { ...db.profile, fullName: name, consents: CONSENT_TYPES.map((type) => ({ type, version: CONSENT_VERSION, acceptedAt: at })) }
  db.session = { status: 'authenticated', verification: null }
}
const normalize = (email) => String(email ?? '').trim().toLowerCase()
const hasAccount = (db, email) => db.user?.contact === email || db.accounts.some((a) => a.user?.contact === email) || Boolean(staffAccount(email))
const passwordOf = (db, email) => db.passwords?.[email] ?? DEMO_PASSWORD
const setPassword = (db, email, password) => { db.passwords = { ...db.passwords, [email]: password } }
const OTP_COOLDOWN_MS = 60_000

export function createMockAuth(call, store) {
  return {
    getSession: call('auth.getSession', (db) => ({
      status: db.session.status, role: db.session.status === 'authenticated' ? db.user.role : null, user: db.user,
      verification: db.session.verification ? { maskedDestination: db.session.verification.maskedDestination, resendAvailableAt: db.session.verification.resendAvailableAt } : null,
    }), { auth: false }),
    signInWithGoogle: call('auth.signInWithGoogle', (db) => {
      signInAs(db, GOOGLE_DEMO.email, GOOGLE_DEMO.name)
      return { user: db.user }
    }, { auth: false }),
    providers: async () => ({ google: true }),
    signInWithPassword: call('auth.signInWithPassword', (db, values = {}) => {
      const email = normalize(values.email)
      failOnFields(validateLogin({ ...values, email }), 'Periksa kembali data kamu.')
      if (!hasAccount(db, email) || passwordOf(db, email) !== values.password) fail('INVALID_CREDENTIALS', 'Email atau password salah.')
      signInAs(db, email)
      return { user: db.user }
    }, { auth: false }),
    signUp: call('auth.signUp', (db, values = {}) => {
      const email = normalize(values.email)
      failOnFields(validateRegister({ ...values, email }), 'Periksa kembali data kamu.')
      if (hasAccount(db, email)) fail('EMAIL_TAKEN', 'Email ini sudah terdaftar. Masuk atau pakai Lupa password.', 409)
      const verification = { contact: email, name: values.name.trim(), password: values.password, maskedDestination: maskEmail(email), resendAvailableAt: Date.now() + OTP_COOLDOWN_MS, attemptsRemaining: 5 }
      db.session = { status: 'pending', verification }
      return { maskedDestination: verification.maskedDestination, resendAvailableAt: verification.resendAvailableAt }
    }, { auth: false }),
    verifySignup: call('auth.verifySignup', (db, { token } = {}) => {
      const v = db.session.verification
      if (db.session.status !== 'pending' || !v) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.')
      if (!/^\d{6}$/.test(String(token))) fail('VALIDATION_FAILED', 'Kode harus 6 angka.')
      if (token === '999999' || v.attemptsRemaining <= 0) fail('OTP_EXPIRED', 'Kode kedaluwarsa. Kirim ulang kode baru.', 401)
      if (token !== '148260') {
        v.attemptsRemaining -= 1
        store.save(db)
        fail('OTP_INVALID', token === '000000' ? 'Kode salah. Coba lagi.' : 'Kode salah atau kedaluwarsa. Coba lagi.', 401)
      }
      setPassword(db, v.contact, v.password)
      signInAs(db, v.contact, v.name)
      agree(db, v.name)
      return { user: db.user }
    }, { auth: false }),
    requestPasswordReset: call('auth.requestPasswordReset', (db, { email } = {}) => {
      const value = normalize(email)
      failOnFields(validateEmail({ email: value }), 'Masukkan email yang valid.')
      db.resetLink = hasAccount(db, value) ? value : null
      return { maskedDestination: maskEmail(value), resendAvailableAt: Date.now() + OTP_COOLDOWN_MS }
    }, { auth: false }),
    openResetLink: call('auth.openResetLink', (db) => {
      if (!db.resetLink) fail('OTP_INVALID', 'Link reset tidak valid atau kedaluwarsa. Minta link baru.', 401)
      signInAs(db, db.resetLink)
      db.resetLink = null
      db.session = { status: 'recovery', verification: null }
      return { user: db.user }
    }, { auth: false }),
    updatePassword: call('auth.updatePassword', (db, values = {}) => {
      if (db.session.status !== 'recovery') fail('INVALID_STATE_TRANSITION', 'Buka link reset password dari email dulu.')
      failOnFields(validateNewPassword(values), 'Periksa kembali password baru kamu.')
      setPassword(db, db.user.contact, values.password)
      db.session = { status: consented(db) ? 'authenticated' : 'onboarding', verification: null }
      return { user: db.user }
    }, { auth: false }),
    changePassword: call('auth.changePassword', (db, values = {}) => {
      failOnFields(validateChangePassword(values), 'Periksa kembali password kamu.')
      if (passwordOf(db, db.user.contact) !== values.currentPassword) fail('VALIDATION_FAILED', 'Password lama salah.', 400, { fieldErrors: [{ field: 'currentPassword', message: 'Password lama salah.' }] })
      setPassword(db, db.user.contact, values.password)
      return { changed: true }
    }),
    acceptConsents: call('auth.acceptConsents', (db, values = {}) => {
      if (db.session.status !== 'onboarding') fail('INVALID_STATE_TRANSITION', 'Persetujuan sudah tercatat.')
      failOnFields(validateWelcome(values), 'Periksa kembali data kamu.')
      agree(db, values.name.trim())
      return { user: db.user }
    }, { auth: false }),
    resendOtp: call('auth.resendOtp', (db) => {
      const v = db.session.verification
      if (db.session.status !== 'pending' || !v) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.')
      const wait = Math.ceil((v.resendAvailableAt - Date.now()) / 1000)
      if (wait > 0) fail('RATE_LIMITED', `Tunggu ${wait} detik untuk kirim ulang.`, 429, { retryable: true, details: { retryAfterSeconds: wait } })
      v.resendAvailableAt = Date.now() + OTP_COOLDOWN_MS
      v.attemptsRemaining = 5
      return { resendAvailableAt: v.resendAvailableAt }
    }, { auth: false }),
    logout: call('auth.logout', (db) => {
      db.session = { status: 'guest', verification: null }
      return { loggedOut: true }
    }, { auth: false }),
    deleteAccount: call('auth.deleteAccount', (db) => {
      if (db.user.role !== 'user') fail('FORBIDDEN', 'Akun staf tidak bisa dihapus melalui profil pengguna.', 403)
      if (db.applications.some((a) => IN_PROCESS.includes(a.status))) fail('INVALID_STATE_TRANSITION', 'Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun.')
      const snapshot = structuredClone(pickAccount(db))
      const appIds = new Set(db.applications.map((a) => a.id))
      snapshot.adminNotes = (db.adminNotes ?? []).filter((n) => appIds.has(n.applicationId))
      snapshot.coverLetters = (db.coverLetters ?? []).filter((l) => appIds.has(l.id))
      snapshot.userChanges = (db.userChanges ?? []).filter((c) => c.userId === db.user.id)
      const archive = { id: crypto.randomUUID(), originalUserId: db.user.id, name: db.user.name, contact: db.user.contact,
        closedAt: nowIso(db), status: 'archived', schemaVersion: 1, snapshot, files: archiveFiles(snapshot) }
      const { passwords } = db
      const accountArchives = [archive, ...(db.accountArchives ?? [])]
      const { [db.user.contact]: _gone, ...kept } = passwords ?? {}
      db.adminNotes = (db.adminNotes ?? []).filter((n) => !appIds.has(n.applicationId))
      db.coverLetters = (db.coverLetters ?? []).filter((l) => !appIds.has(l.id))
      db.userChanges = (db.userChanges ?? []).filter((c) => c.userId !== db.user.id)
      ACCOUNT_KEYS.forEach((k) => delete db[k])
      Object.assign(db, newAccount(), { user: null, session: { status: 'guest', verification: null }, passwords: kept, accountArchives })
      return { deleted: true }
    }),
  }
}
