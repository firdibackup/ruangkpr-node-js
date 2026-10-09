// Same error shape for mock and future HTTP adapters (doc 04 §2).
export class ApiError extends Error {
  constructor(error, meta = {}) {
    super(error.message)
    this.name = 'ApiError'
    this.code = error.code
    this.status = meta.status ?? 500
    this.details = error.details ?? null
    this.fieldErrors = error.fieldErrors ?? []
    this.retryable = Boolean(error.retryable)
  }
}

export const isNetworkish = (error) => error?.retryable === true

export function errorMessage(error, fallback = 'Data gagal dimuat.') {
  if (error?.name === 'ApiError') return error.message
  return fallback
}
