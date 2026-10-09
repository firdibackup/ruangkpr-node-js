import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

test('Google (mock) signs in, asks consent once, and lands on Home', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  await page.getByRole('button', { name: 'Lanjut dengan Google' }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByLabel('Nama Lengkap')).toHaveValue('Firdi Audi')
  await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click({ force: true })
  await expect(page.getByText('Centang persetujuan Syarat & Ketentuan untuk lanjut.')).toBeVisible()
  await page.getByRole('checkbox', { name: /Syarat & Ketentuan/ }).check()
  await page.getByRole('checkbox', { name: /Kebijakan Privasi/ }).check()
  await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click()
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
})

test('register shows the Google error when the user cancels at Google', async ({ page }) => {
  await useScenario(page, 'guest', '/register?error=access_denied&error_description=cancelled')
  await expect(page.getByRole('alert')).toContainText('Masuk dengan Google dibatalkan atau gagal')
})

test('verify page: wrong code, then back to change the email', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  await page.getByRole('button', { name: 'Kirim kode' }).click({ force: true })
  await expect(page.getByText('Masukkan email yang valid.')).toBeVisible()
  await page.getByLabel('Email').fill('nadia@example.com')
  await page.getByRole('button', { name: 'Kirim kode' }).click()
  await expect(page.getByText('na***@example.com')).toBeVisible()
  await page.getByLabel('Digit 1 dari 6').fill('000000')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Kode salah')
  await page.getByRole('button', { name: 'Ubah email' }).click()
  await expect(page).toHaveURL(/\/register$/)
})
