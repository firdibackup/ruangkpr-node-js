import { describe, expect, it } from 'vitest'
import { legalDocuments, LEGAL_VERSION } from './content'

describe('public legal documents', () => {
  it('keeps four complete documents with honest post-completion retention', () => {
    expect(Object.keys(legalDocuments)).toEqual(['legalitas', 'kebijakan-privasi', 'syarat-dan-ketentuan', 'kebijakan-keamanan-informasi'])
    for (const doc of Object.values(legalDocuments)) {
      expect(doc.sections.length).toBeGreaterThan(1)
      expect(doc.summary).toBeTruthy()
    }
    expect(JSON.stringify(legalDocuments['kebijakan-privasi'])).toContain('arsip')
    expect(LEGAL_VERSION).toBe('2026-11-06')
  })
})
