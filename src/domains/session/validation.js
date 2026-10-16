export const isPhone = (v) => /^(\+62|62|0)8\d{7,12}$/.test(String(v ?? '').replace(/[\s-]/g, ''))
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim())

// Version of the S&K + Kebijakan Privasi text the user agrees to; raising it asks everyone again (spec §3.1).
export const CONSENT_VERSION = '2026-09-01'
export const CONSENT_TYPES = ['terms', 'privacy']

// Same rule as the auth server (GOTRUE_PASSWORD_MIN_LENGTH, GOTRUE_PASSWORD_REQUIRED_CHARACTERS); 72 is bcrypt's limit.
export const PASSWORD_HINT = 'Minimal 8 karakter, berisi huruf dan angka.'
function passwordProblem(value) {
  const p = String(value ?? '')
  if (p.length < 8) return 'Password minimal 8 karakter.'
  if (p.length > 72) return 'Password maksimal 72 karakter.'
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return 'Password harus berisi huruf dan angka.'
  return ''
}

export const validateEmail = (v) => (isEmail(v.email) ? {} : { email: 'Masukkan email yang valid.' })

export function validateLogin(v) {
  const e = validateEmail(v)
  if (!v.password) e.password = 'Masukkan password.'
  return e
}

// A new password and its repeat: registration, reset, and change.
export function validateNewPassword(v) {
  const e = {}
  const problem = passwordProblem(v.password)
  if (problem) e.password = problem
  if (!v.confirm) e.confirm = 'Ulangi password.'
  else if (v.confirm !== v.password) e.confirm = 'Password tidak sama.'
  return e
}

export function validateWelcome(v) {
  const e = {}
  if (String(v.name ?? '').trim().length < 3) e.name = 'Nama minimal 3 huruf.'
  // One checkbox covers both agreements, so both share its message.
  const consent = 'Centang persetujuan Syarat & Ketentuan dan Kebijakan Privasi untuk lanjut.'
  if (!v.acceptTerms) e.acceptTerms = consent
  if (!v.acceptPrivacy) e.acceptPrivacy = consent
  return e
}

// Registration asks name and consent up front, so a verified email lands straight on Home.
export const validateRegister = (v) => ({ ...validateWelcome(v), ...validateEmail(v), ...validateNewPassword(v) })

export function validateChangePassword(v) {
  const e = validateNewPassword(v)
  if (!v.currentPassword) e.currentPassword = 'Masukkan password lama.'
  else if (!e.password && v.password === v.currentPassword) e.password = 'Password baru harus berbeda dari password lama.'
  return e
}
