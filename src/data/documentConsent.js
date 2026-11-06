import { LEGAL_VERSION } from '@/domains/legal/content'
import { ApiError } from './apiError'

export function requireDocumentConsent(consent) {
  if (consent?.accepted !== true || consent?.version !== LEGAL_VERSION) {
    throw new ApiError({ code: 'CONSENT_REQUIRED', message: 'Setujui penggunaan dokumen sebelum mengunggah.' }, { status: 422 })
  }
}
