import { describe, expect, it } from 'vitest'
import { validateEmployment, validatePersonal, validatePrimaryLoan, validatePrimaryProperty } from './validation'

const property = { purchaseType: 'new_from_developer', developerName: 'PT Griya', propertyType: 'landed_house', propertyAddress: 'Griya Asri Blok C2 No. 8', city: 'Kota Bekasi', price: '500000000', downPayment: '100000000', amount: '400000000', tenorMonths: '240', savings: '' }

describe('primary validation', () => {
  it('new house requires developer; used house does not (seller optional)', () => {
    expect(validatePrimaryProperty({ ...property, developerName: '' }).developerName).toBeTruthy()
    expect(validatePrimaryProperty({ ...property, purchaseType: 'used_from_owner', developerName: '' })).toEqual({})
  })
  it('loan cannot exceed price − DP and DP must be below price', () => {
    expect(validatePrimaryLoan({ ...property, amount: '400000001' }).amount).toBe('Jumlah pinjaman tidak boleh melebihi Harga − DP.')
    expect(validatePrimaryLoan({ ...property, downPayment: '500000000' }).downPayment).toBeTruthy()
    expect(validatePrimaryLoan(property)).toEqual({})
    expect(validatePrimaryProperty({ ...property, amount: '', downPayment: '' })).toEqual({}) // loan is its own step
  })
  it('NIK must be exactly 16 digits and birth date not in the future', () => {
    const base = { fullName: 'Firdi Audi', nik: '3174012345678901', birthPlace: 'Bekasi', birthDate: '1996-04-12', gender: 'male', maritalStatus: 'single', address: 'Jl. Melati No. 12, Bekasi', phone: '081234567890', email: 'a@b.co' }
    expect(validatePersonal(base, { today: '2026-09-28' })).toEqual({})
    expect(validatePersonal({ ...base, nik: '31740123' }, { today: '2026-09-28' }).nik).toBe('NIK harus terdiri dari 16 angka.')
    expect(validatePersonal({ ...base, birthDate: '2027-01-01' }, { today: '2026-09-28' }).birthDate).toBeTruthy()
  })
  it('debts are required (0 allowed) and joint income needs partner income', () => {
    const base = { occupation: 'private_employee', companyName: 'PT A', jobTitle: 'Designer', workYears: '4', workMonths: '6', monthlyIncome: '15000000', jointIncome: false, partnerIncome: '', vehicleDebt: '0', cardDebt: '0', otherDebt: '0' }
    expect(validateEmployment(base)).toEqual({})
    expect(validateEmployment({ ...base, cardDebt: '' }).cardDebt).toBe('Isi 0 kalau tidak ada.')
    expect(validateEmployment({ ...base, jointIncome: true }).partnerIncome).toBeTruthy()
    expect(validateEmployment({ ...base, occupation: 'Guru Honorer' }).occupation).toBeUndefined()
    expect(validateEmployment({ ...base, occupation: '  ' }).occupation).toBe('Pilih atau tulis jenis pekerjaan.')
  })
})
