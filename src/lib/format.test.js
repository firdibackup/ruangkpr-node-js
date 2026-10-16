import { describe, expect, it } from 'vitest'
import { terbilang } from './format'

describe('terbilang', () => {
  it('spells whole Rupiah the way a bank letter writes it', () => {
    expect(terbilang(0)).toBe('Nol Rupiah')
    expect(terbilang(11)).toBe('Sebelas Rupiah')
    expect(terbilang(15)).toBe('Lima Belas Rupiah')
    expect(terbilang(21)).toBe('Dua Puluh Satu Rupiah')
    expect(terbilang(100)).toBe('Seratus Rupiah')
    expect(terbilang(110)).toBe('Seratus Sepuluh Rupiah')
    expect(terbilang(1_000)).toBe('Seribu Rupiah')
    expect(terbilang(11_000)).toBe('Sebelas Ribu Rupiah')
    expect(terbilang(100_000)).toBe('Seratus Ribu Rupiah')
    expect(terbilang(1_500_000)).toBe('Satu Juta Lima Ratus Ribu Rupiah')
    expect(terbilang(1_001_000)).toBe('Satu Juta Seribu Rupiah')
    expect(terbilang(400_000_000)).toBe('Empat Ratus Juta Rupiah')
    expect(terbilang(2_750_000_000)).toBe('Dua Miliar Tujuh Ratus Lima Puluh Juta Rupiah')
    expect(terbilang(1_000_000_000_000)).toBe('Satu Triliun Rupiah')
  })

  it('returns nothing for an empty or invalid amount', () => {
    expect(terbilang(null)).toBe('')
    expect(terbilang(-5)).toBe('')
    expect(terbilang(1.5)).toBe('')
  })
})
