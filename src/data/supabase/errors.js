// Supabase/Postgres errors → the ApiError shape the UI already handles (spec 2026-10-09 §1).
import { isAuthError } from '@supabase/supabase-js'
import { ApiError } from '../apiError'

const make = (code, message, status, extra = {}) => new ApiError({ code, message, ...extra }, { status })
const offline = () => make('SERVICE_UNAVAILABLE', 'Koneksi bermasalah. Periksa koneksi lalu coba lagi.', 503, { retryable: true })
const SESSION_ENDED = ['AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401]
const GOOGLE_OFF = ['SERVICE_UNAVAILABLE', 'Masuk dengan Google belum tersedia.', 503]
const EMAIL_TAKEN = ['EMAIL_TAKEN', 'Email ini sudah terdaftar. Masuk atau pakai Lupa password.', 409]

const AUTH = {
  invalid_credentials: ['INVALID_CREDENTIALS', 'Email atau password salah.', 400],
  weak_password: ['VALIDATION_FAILED', 'Password minimal 8 karakter dan berisi huruf serta angka.', 422],
  same_password: ['VALIDATION_FAILED', 'Password baru harus berbeda dari password lama.', 422],
  user_already_exists: EMAIL_TAKEN,
  email_exists: EMAIL_TAKEN,
  otp_expired: ['OTP_INVALID', 'Kode salah atau kedaluwarsa. Coba lagi atau kirim ulang kode.', 401],
  over_email_send_rate_limit: ['RATE_LIMITED', 'Terlalu sering meminta kode. Tunggu sebentar lalu coba lagi.', 429],
  over_request_rate_limit: ['RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.', 429],
  email_address_invalid: ['VALIDATION_FAILED', 'Masukkan email yang valid.', 400],
  validation_failed: ['VALIDATION_FAILED', 'Periksa kembali data kamu.', 400],
  otp_disabled: ['SERVICE_UNAVAILABLE', 'Masuk dengan email sedang tidak tersedia.', 503],
  signup_disabled: ['SERVICE_UNAVAILABLE', 'Pendaftaran akun baru sedang ditutup.', 503],
  provider_disabled: GOOGLE_OFF,
  oauth_provider_not_supported: GOOGLE_OFF,
  session_expired: SESSION_ENDED,
  session_not_found: SESSION_ENDED,
  refresh_token_not_found: SESSION_ENDED,
  refresh_token_already_used: SESSION_ENDED,
}

// HTTP status per domain code raised by private.fail (same numbers the mock uses).
const STATUS = { AUTH_REQUIRED: 401, FORBIDDEN: 403, RESOURCE_NOT_FOUND: 404, CONFLICT_VERSION: 409, ACTIVE_DRAFT_EXISTS: 409, ACTIVE_MORTGAGE_EXISTS: 409, BANK_PRODUCT_EXPIRED: 410, DOCUMENTS_INCOMPLETE: 422, CONSENT_REQUIRED: 422 }

// Unique indexes that stand for a domain rule (same codes and messages as mockApi.js).
const UNIQUE = {
  applications_one_active: ['ACTIVE_DRAFT_EXISTS', 'Kamu masih punya pengajuan aktif. Lanjutkan atau hapus dulu.', 409],
  mortgages_one_active: ['ACTIVE_MORTGAGE_EXISTS', 'Versi ini mendukung satu KPR aktif per akun.', 409],
}

function fromAuth(error) {
  const known = AUTH[error.code]
  if (known) return make(known[0], known[1], known[2], { retryable: known[0] === 'RATE_LIMITED' })
  if (!error.status || error.status >= 500) return offline()
  return make('UNKNOWN', 'Permintaan gagal. Coba lagi.', error.status)
}

function fromPostgres(error, status) {
  if (error.code === 'P0001') {
    let detail = {}
    try {
      detail = JSON.parse(error.details || '{}')
    } catch {
      // a raise without our JSON detail: keep the message, call it a validation failure
    }
    const code = detail.code ?? 'VALIDATION_FAILED'
    return make(code, error.message, STATUS[code] ?? 400, { fieldErrors: detail.fieldErrors ?? [], details: detail.details ?? null })
  }
  if (error.code === '23505') {
    const known = UNIQUE[/"([^"]+)"/.exec(error.message ?? '')?.[1]]
    if (known) return make(...known)
  }
  if (error.code === '42501') return make('FORBIDDEN', 'Halaman ini di luar akses akun kamu.', 403)
  if (error.code === 'PGRST301' || error.code === 'PGRST303') return make(...SESSION_ENDED)
  if (error.code === 'PGRST116') return make('RESOURCE_NOT_FOUND', 'Data tidak ditemukan.', 404)
  if (!status || status >= 500 || /fetch|network/i.test(error.message ?? '')) return offline()
  return make('UNKNOWN', 'Permintaan gagal. Coba lagi.', status)
}

export function toApiError(error, status) {
  if (!error || error.name === 'ApiError') return error
  if (isAuthError(error)) return fromAuth(error)
  if (error instanceof TypeError) return offline()
  return fromPostgres(error, status)
}

// Awaits a supabase-js query: its data, or the mapped ApiError.
export async function must(request) {
  const { data, error, status } = await request
  if (error) throw toApiError(error, status)
  return data
}
