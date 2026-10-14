import { describe, expect, it } from 'vitest'
import { validateChangePassword, validateLogin, validateNewPassword, validateRegister } from './validation'

describe('password rules (same as the auth server: 8+ characters, letters and digits)', () => {
  it('a new password needs length, a letter, a digit, and a matching repeat', () => {
    expect(validateNewPassword({ password: 'abc12', confirm: 'abc12' })).toEqual({ password: 'Password minimal 8 karakter.' })
    expect(validateNewPassword({ password: 'abcdefgh', confirm: 'abcdefgh' })).toEqual({ password: 'Password harus berisi huruf dan angka.' })
    expect(validateNewPassword({ password: '12345678', confirm: '12345678' })).toEqual({ password: 'Password harus berisi huruf dan angka.' })
    expect(validateNewPassword({ password: `a1${'x'.repeat(71)}`, confirm: `a1${'x'.repeat(71)}` })).toEqual({ password: 'Password maksimal 72 karakter.' })
    expect(validateNewPassword({ password: 'rumah2026', confirm: '' })).toEqual({ confirm: 'Ulangi password.' })
    expect(validateNewPassword({ password: 'rumah2026', confirm: 'rumah2025' })).toEqual({ confirm: 'Password tidak sama.' })
    expect(validateNewPassword({ password: 'rumah 2026', confirm: 'rumah 2026' })).toEqual({})
  })

  it('login only needs an email and some password; registration also needs name and both consents', () => {
    expect(validateLogin({ email: 'nadia@example.com', password: 'x' })).toEqual({})
    expect(Object.keys(validateLogin({ email: 'nadia', password: '' }))).toEqual(['email', 'password'])
    const ok = { name: 'Nadia Putri', email: 'nadia@example.com', password: 'rumah2026', confirm: 'rumah2026', acceptTerms: true, acceptPrivacy: true }
    expect(validateRegister(ok)).toEqual({})
    expect(Object.keys(validateRegister({ ...ok, name: 'Na', acceptPrivacy: false })).sort()).toEqual(['acceptPrivacy', 'name'])
  })

  it('a changed password needs the current one and must differ from it', () => {
    expect(validateChangePassword({ currentPassword: '', password: 'rumah2026', confirm: 'rumah2026' })).toEqual({ currentPassword: 'Masukkan password lama.' })
    expect(validateChangePassword({ currentPassword: 'rumah2026', password: 'rumah2026', confirm: 'rumah2026' })).toEqual({ password: 'Password baru harus berbeda dari password lama.' })
    expect(validateChangePassword({ currentPassword: 'rumah2025', password: 'rumah2026', confirm: 'rumah2026' })).toEqual({})
  })
})
