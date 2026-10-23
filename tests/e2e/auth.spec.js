import { expect, test } from '@playwright/test'
import { DEMO_PASSWORD, register, useScenario } from './helpers'

const HOME = /^http:\/\/localhost:\d+\/$/

test('register → email code → Home with the consent on record; the new password signs in next time', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  await register(page, { name: 'Nadia Putri', email: 'Nadia@Example.com', password: 'rumah2026' })
  await expect(page).toHaveURL(/\/verify$/)
  await expect(page.getByText('na***@example.com')).toBeVisible()
  await page.getByLabel('Digit 1 dari 6').fill('148260')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page).toHaveURL(HOME)

  await page.goto('/profile')
  await expect(page.getByText(/Syarat & Ketentuan v2026-09-01/)).toBeVisible()
  await page.getByRole('button', { name: 'Keluar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keluar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email').fill('nadia@example.com')
  await page.getByLabel('Password', { exact: true }).fill('rumah2026')
  await page.getByRole('button', { name: 'Tampilkan password' }).click() // the toggle shows what was typed
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page).toHaveURL(HOME)
})

test('the desktop profile chip opens a menu: Lihat Profil goes to Profile, Keluar signs out after confirming', async ({ page }) => {
  await useScenario(page, 'fresh', '/activity')
  await page.getByRole('button', { name: 'Firdi' }).click()
  await page.getByRole('menuitem', { name: 'Lihat Profil' }).click()
  await expect(page).toHaveURL(/\/profile$/)

  await page.getByRole('button', { name: 'Firdi' }).click()
  await page.getByRole('menuitem', { name: 'Keluar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keluar' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('register refuses an email that already has an account; the code page goes back to change the email', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  await register(page, { name: 'Admin Lagi', email: 'admin@ruangkpr.id' })
  await expect(page.getByRole('alert')).toContainText('Email ini sudah terdaftar')

  await register(page, { name: 'Nadia Putri', email: 'nadia@example.com' })
  await page.getByLabel('Digit 1 dari 6').fill('000000')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Kode salah')
  await page.getByRole('link', { name: 'Ubah email' }).click()
  await expect(page).toHaveURL(/\/register$/)
})

test('login: one message for a wrong password; Lupa password → email link → new password → Home', async ({ page }) => {
  await useScenario(page, 'guest', '/login')
  await page.getByLabel('Email').fill('sari.wulandari@example.com')
  await page.getByLabel('Password', { exact: true }).fill('salah123')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Email atau password salah.')

  await page.getByRole('link', { name: 'Lupa password?' }).click()
  await page.getByLabel('Email').fill('sari.wulandari@example.com')
  await page.getByRole('button', { name: 'Kirim link reset' }).click()
  await expect(page.getByRole('heading', { name: 'Cek email kamu' })).toBeVisible()
  await expect(page.getByText('sa***@example.com')).toBeVisible()
  await expect(page.getByLabel('Digit 1 dari 6')).toHaveCount(0) // a link, no code
  await page.getByRole('button', { name: 'Buka link reset (mode demo)' }).click()
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel('Password baru', { exact: true }).fill('rumah2026')
  await page.getByLabel('Ulangi password baru', { exact: true }).fill('rumah2025')
  await page.getByRole('button', { name: 'Simpan password baru' }).click({ force: true }) // looks disabled, still explains why
  await expect(page.getByText('Password tidak sama.')).toBeVisible()
  await page.getByLabel('Ulangi password baru', { exact: true }).fill('rumah2026')
  await page.getByRole('button', { name: 'Simpan password baru' }).click()
  await expect(page).toHaveURL(HOME)
})

test('a reset link that no longer works says so and offers a new one', async ({ page }) => {
  await useScenario(page, 'guest', '/reset-password?error=access_denied&error_code=otp_expired')
  await expect(page.getByRole('heading', { name: 'Link tidak bisa dipakai' })).toBeVisible()
  await page.getByRole('button', { name: 'Minta link baru' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
})

test('change password in Profile needs the current one', async ({ page }) => {
  await useScenario(page, 'fresh', '/profile')
  await page.getByRole('button', { name: 'Ubah Password' }).click()
  await expect(page).toHaveURL(/\/profile\/password$/)
  await page.getByLabel('Password lama', { exact: true }).fill('salah123')
  await page.getByLabel('Password baru', { exact: true }).fill('rumah2026')
  await page.getByLabel('Ulangi password baru', { exact: true }).fill('rumah2026')
  await page.getByRole('button', { name: 'Simpan password' }).click()
  await expect(page.getByRole('alert')).toContainText('Password lama salah.')
  await page.getByLabel('Password lama', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Simpan password' }).click()
  await expect(page).toHaveURL(/\/profile$/)
})

test('Google (mock) signs in, asks consent once, and lands on Home', async ({ page }) => {
  await useScenario(page, 'guest', '/login')
  await page.getByRole('button', { name: 'Lanjut dengan Google' }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByLabel('Nama Lengkap')).toHaveValue('Firdi Audi')
  await page.getByRole('button', { name: 'Mulai pakai Maxi' }).click({ force: true })
  await expect(page.getByText('Centang persetujuan Syarat & Ketentuan dan Kebijakan Privasi untuk lanjut.')).toBeVisible()
  await page.getByRole('button', { name: 'Kebijakan Privasi' }).click() // the link opens the text without ticking the box
  await expect(page.getByRole('dialog', { name: 'Kebijakan Privasi' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('checkbox', { name: /Syarat & Ketentuan dan Kebijakan Privasi/ })).not.toBeChecked()
  await page.getByRole('checkbox', { name: /Syarat & Ketentuan dan Kebijakan Privasi/ }).check()
  await page.getByRole('button', { name: 'Mulai pakai Maxi' }).click()
  await expect(page).toHaveURL(HOME)
})

test('login shows the Google error when the user cancels at Google', async ({ page }) => {
  await useScenario(page, 'guest', '/login?error=access_denied&error_description=cancelled')
  await expect(page.getByRole('alert')).toContainText('Masuk dengan Google dibatalkan atau gagal')
})
