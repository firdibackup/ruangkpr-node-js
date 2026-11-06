import { expect, it } from 'vitest'
import { requireDocumentConsent } from './documentConsent'

it('requires explicit current consent, not a truthy value or an older policy', () => {
  for (const consent of [undefined, {}, { accepted: 'true', version: '2026-11-06' }, { accepted: true, version: '2026-09-01' }]) {
    expect(() => requireDocumentConsent(consent)).toThrow('Setujui penggunaan dokumen')
  }
  expect(() => requireDocumentConsent({ accepted: true, version: '2026-11-06' })).not.toThrow()
})
