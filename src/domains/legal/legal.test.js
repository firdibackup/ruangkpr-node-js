import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { legalDocuments, LEGAL_VERSION, DOCUMENT_CONSENT } from './content'

describe('public legal documents', () => {
  it('matches the database consent version and exact notice', () => {
    const sql = readFileSync('supabase/migrations/20261106080358_legal_document_consent.sql', 'utf8')
    expect(sql).toContain(`check (version = '${LEGAL_VERSION}')`)
    expect(sql).toContain(`check (notice = '${DOCUMENT_CONSENT}')`)
    expect(sql).toContain(`c.version = '${LEGAL_VERSION}'`)
    expect(sql).toContain(`'{consents,version}' is distinct from '${LEGAL_VERSION}'`)
  })
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
