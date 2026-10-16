import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

test('admin sets office defaults, then prints a prefilled cover letter for an application at the bank', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await page.getByLabel('Kantor RE/MAX').fill('RE/MAX Eagle Citraland')
  await page.getByLabel('Nama MA default').fill('Like')
  await page.getByLabel('No. ID RE/MAX MA default').fill('R230021')
  await page.getByLabel('Nama Business Owner').fill('Budiono Yuwono')
  await page.getByLabel('Rekening marketing fee').fill('Rek. Bank BCA 511.010.6060 a/n PT. BUANA JAYA MAPAN')
  await page.getByRole('button', { name: 'Simpan default surat' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Data kantor RE/MAX')
  await page.getByRole('button', { name: 'Ya, simpan' }).click()
  await expect(page.getByText('Default surat pengantar tersimpan.')).toBeVisible()

  await page.goto('/admin/applications')
  await page.getByRole('link', { name: 'Firdi Audi' }).click()
  await page.getByRole('link', { name: 'Surat pengantar' }).click()
  const sheet = page.getByRole('article', { name: 'Pratinjau surat pengantar' })
  await expect(sheet).toContainText('Mengajukan aplikasi KPR – Bank ABC untuk :')
  await expect(sheet).toContainText('Rp. 400.000.000,00')
  await expect(sheet).toContainText('(Empat Ratus Juta Rupiah)')
  await expect(sheet).toContainText('RE/MAX Eagle Citraland')
  await expect(page.getByRole('checkbox', { name: 'Copy NPWP / SPT PPh 21 Pribadi — Pegawai' })).toBeChecked()

  await page.getByLabel('Sales Officer bank').fill('Hilda')
  await expect(sheet).toContainText('Pengajuan ke Sales Officer Bank ABC : Hilda')
  await page.evaluate(() => {
    window.printed = 0
    window.print = () => {
      window.printed += 1
    }
  })
  await page.getByRole('button', { name: 'Cetak' }).click()
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1)

  await page.reload()
  await expect(page.getByLabel('Sales Officer bank')).toHaveValue('Hilda')
  await expect(page.getByRole('button', { name: 'Simpan' })).toBeDisabled()
})

test('an application not yet at the bank has no cover letter', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/applications')
  await page.getByRole('link', { name: 'Rina Hartati' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Rina Hartati' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Surat pengantar' })).toHaveCount(0)
  await page.goto('/admin/applications/app_sample_01/surat-pengantar')
  await expect(page.getByText('Surat pengantar tersedia setelah pengajuan diteruskan ke bank.')).toBeVisible()
})

test('the saved toast never prints on the letter', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/applications/app_sample_05/surat-pengantar')
  await page.getByLabel('Nama Marketing Associate').fill('Like')
  await page.getByLabel('No. ID RE/MAX').fill('R230021')
  await page.getByLabel('Kantor RE/MAX').fill('RE/MAX Eagle Citraland')
  await page.getByLabel('Nama Business Owner').fill('Budiono Yuwono')
  await page.getByLabel('Rekening marketing fee').fill('Rek. Bank BCA 511.010.6060')
  await page.getByRole('button', { name: 'Simpan' }).click()
  const toast = page.getByText('Surat pengantar disimpan.')
  await expect(toast).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(toast).toBeHidden({ timeout: 1000 }) // well before the toast closes on its own
})
