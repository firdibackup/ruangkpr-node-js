import { describe, expect, it } from 'vitest'
import { draftProgress, primaryProgress, takeoverProgress, takeoverScreenOf } from './meta'

describe('primaryProgress', () => {
  it('maps the 7 screens onto 3 phases with a front-loaded percent that starts at 0', () => {
    const p = [1, 2, 3, 4, 5, 6, 7].map(primaryProgress)
    expect(p.map((x) => x.phase)).toEqual([1, 1, 2, 2, 3, 3, 3])
    expect(p.map((x) => x.percent)).toEqual([0, 30, 55, 70, 80, 88, 95])
    expect(p.map((x) => Math.round(x.position * 1000) / 1000)).toEqual([1, 1.5, 2, 2.5, 3, 3.333, 3.667])
    expect(p[2].label).toBe('Rumah & Pinjaman')
  })
})

describe('takeoverProgress', () => {
  it('maps the 9 Take Over screens onto 3 phases opening on the same 55% / 80% as Primary', () => {
    const p = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(takeoverProgress)
    expect(p.map((x) => x.phase)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3])
    expect(p.map((x) => x.percent)).toEqual([0, 30, 45, 55, 65, 73, 80, 88, 95])
    expect(p.map((x) => Math.round(x.position * 1000) / 1000)).toEqual([1, 1.333, 1.667, 2, 2.333, 2.667, 3, 3.333, 3.667])
    expect(p.map((x) => x.label)).toEqual(['Kamu & KPR Lama', 'Kamu & KPR Lama', 'Kamu & KPR Lama', 'Kondisi & Tujuan', 'Kondisi & Tujuan', 'Kondisi & Tujuan', 'Pilih Bank & Kirim', 'Pilih Bank & Kirim', 'Pilih Bank & Kirim'])
  })
})

describe('takeoverScreenOf', () => {
  it('maps currentStep to the furthest saved screen; step 6 depends on the program pick', () => {
    const at = (currentStep, selection = null) => takeoverScreenOf({ id: 'app_1', currentStep, selection })
    expect([1, 2, 3, 4, 5].map((s) => at(s))).toEqual([2, 3, 4, 5, 6])
    expect(takeoverScreenOf({ currentStep: 1, selection: null })).toBe(1) // unsaved: Data pribadi not saved yet
    expect(at(6)).toBe(7)
    expect(at(6, { bankProductId: 'bpr_x' })).toBe(8)
    expect(at(7, { bankProductId: 'bpr_x' })).toBe(9)
  })
})

describe('draftProgress', () => {
  it('reads Primary and Take Over drafts in their own phase tables', () => {
    expect(draftProgress({ productType: 'primary', currentStep: 3 })).toMatchObject({ phase: 2, label: 'Rumah & Pinjaman', percent: 55 })
    expect(draftProgress({ productType: 'primary', currentStep: 9 })).toMatchObject({ phase: 3, percent: 95 })
    expect(draftProgress({ id: 'app_1', productType: 'takeover', currentStep: 1, selection: null })).toMatchObject({ phase: 1, percent: 30 })
    expect(draftProgress({ productType: 'takeover', currentStep: 3, selection: null })).toMatchObject({ phase: 2, label: 'Kondisi & Tujuan', percent: 55 })
    expect(draftProgress({ productType: 'takeover', currentStep: 6, selection: null })).toMatchObject({ phase: 3, percent: 80 })
  })
})
