import { expect, test } from '@playwright/test'
import { fillMoney, useScenario } from './helpers'

test('admin drafts a product, sees what blocks publishing, previews it, publishes it, and archives it', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/products')
  await page.getByRole('link', { name: 'Produk baru' }).click()
  await page.getByLabel('Bank', { exact: true }).selectOption({ label: 'Bank ABC' })
  await page.getByLabel('Nama produk').fill('KPR Promo Uji 3 Tahun')
  await page.getByRole('button', { name: 'Simpan draft' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'KPR Promo Uji 3 Tahun' })).toBeVisible()
  await expect(page.getByText('Belum bisa diterbitkan')).toBeVisible()

  await page.getByLabel('Masa fixed').fill('36')
  await page.getByLabel('Bunga fixed').fill('4,75')
  await page.getByLabel('Estimasi bunga floating').fill('10,25')
  await page.getByLabel('Provisi').fill('1')
  await fillMoney(page, 'Biaya administrasi', 1000000)
  await page.getByLabel('DTI maksimal').fill('40')
  await page.getByLabel('LTV maksimal').fill('90')
  await page.getByLabel('Tenor maksimal').fill('300')
  await fillMoney(page, 'Penghasilan minimum', 5000000)
  await page.getByLabel('Usia minimum').fill('21')
  await page.getByLabel('Usia maksimal saat lunas').fill('60')
  await page.getByRole('checkbox', { name: 'Karyawan Swasta' }).check()
  await page.getByRole('checkbox', { name: 'Rumah Tapak' }).check()
  await page.getByLabel('Berlaku dari').fill('2026-09-01')
  await page.getByLabel('Berlaku sampai').fill('2026-12-31')
  await page.getByLabel('Data diverifikasi').fill('2026-09-28')
  await page.getByRole('button', { name: 'Simpan draft' }).click()
  await expect(page.getByText('Belum bisa diterbitkan')).toHaveCount(0)

  await page.getByRole('button', { name: 'Hitung simulasi' }).click()
  await expect(page.getByText('Cicilan masa fixed')).toBeVisible()

  await page.getByRole('button', { name: 'Terbitkan' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Promo kuartal 4')
  await page.getByRole('button', { name: 'Ya, terbitkan' }).click()
  await expect(page.getByText('Terbit · versi 1')).toBeVisible()

  await page.getByRole('button', { name: 'Arsipkan' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Promo selesai')
  await page.getByRole('button', { name: 'Ya, arsipkan' }).click()
  await expect(page.getByText('Diarsipkan').first()).toBeVisible()
})

test('a bank is switched off with a reason and shows as inactive', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/banks')
  const row = page.getByRole('row', { name: /Bank GHI/ })
  await row.getByRole('button', { name: 'Ubah' }).click()
  await page.getByRole('checkbox', { name: 'Bank aktif (produknya ikut pencocokan)' }).uncheck()
  await page.getByLabel('Alasan perubahan').fill('Kerja sama dihentikan')
  await page.getByRole('button', { name: 'Simpan bank' }).click()
  await expect(row.getByText('Nonaktif')).toBeVisible()
})
