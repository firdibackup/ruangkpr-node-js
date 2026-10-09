import { expect, test } from '@playwright/test'
import { signIn, useScenario } from './helpers'

test('a new KPR Health formula is previewed, published with a reason, and users are scored by it', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await page.getByRole('link', { name: 'Atur formula KPR Health' }).click()
  await page.getByLabel('Bobot Beban cicilan').fill('3')
  await page.getByRole('button', { name: 'Pratinjau dampak' }).click()
  await expect(page.getByRole('table', { name: 'Dampak ke contoh' }).getByRole('row', { name: /Rasio cicilan 48%/ })).toBeVisible()
  await page.getByRole('button', { name: 'Terbitkan versi 2' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Beban cicilan paling menentukan')
  await page.getByRole('button', { name: 'Ya, terbitkan' }).click()
  await expect(page.getByText('Versi 2 berlaku')).toBeVisible()

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Yoga Saputra', 'yoga.saputra@example.com')
  await page.goto('/my-kpr/health')
  await expect(page.getByText(/formula KPR Health versi 2/)).toBeVisible()
})

test('upload limits are saved with a reason and land in the admin activity', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await page.getByLabel('Ukuran maksimal').fill('2')
  await page.getByRole('checkbox', { name: 'PDF' }).click()
  await page.getByRole('button', { name: 'Simpan batas unggah' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Batas bank mitra')
  await page.getByRole('button', { name: 'Ya, simpan' }).click()
  await expect(page.getByText('JPG atau PNG · maks 2MB')).toBeVisible()
  await page.goto('/admin')
  await expect(page.getByRole('list', { name: 'Aktivitas admin terbaru' })).toContainText('Ubah konfigurasi')
})
