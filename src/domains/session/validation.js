export const isPhone = (v) => /^(\+62|62|0)8\d{7,12}$/.test(String(v ?? '').replace(/[\s-]/g, ''))
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim())

// Version of the S&K + Kebijakan Privasi text the user agrees to; raising it asks everyone again (spec §3.1).
export const CONSENT_VERSION = '2026-09-01'
export const CONSENT_TYPES = ['terms', 'privacy']

export const validateEmail = (v) => (isEmail(v.email) ? {} : { email: 'Masukkan email yang valid.' })

export function validateWelcome(v) {
  const e = {}
  if (String(v.name ?? '').trim().length < 3) e.name = 'Nama minimal 3 huruf.'
  if (!v.acceptTerms) e.acceptTerms = 'Centang persetujuan Syarat & Ketentuan untuk lanjut.'
  if (!v.acceptPrivacy) e.acceptPrivacy = 'Centang persetujuan Kebijakan Privasi untuk lanjut.'
  return e
}
