import { expect, test } from '@playwright/test'
import { signIn, useScenario } from './helpers'

// From /admin/configuration: change the upload size limit, confirmed with a reason.
async function saveUploadLimit(page, mb, reason) {
  await page.getByLabel('Ukuran maksimal').fill(mb)
  await page.getByRole('button', { name: 'Simpan batas unggah' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill(reason)
  await page.getByRole('button', { name: 'Ya, simpan' }).click()
  await expect(page.getByText(`maks ${mb}MB`)).toBeVisible()
}

test('the audit log shows who changed what and why, with the before and after values', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await saveUploadLimit(page, '2', 'Batas bank mitra')

  await page.getByRole('link', { name: 'Audit Log' }).click()
  const entry = page.getByRole('list', { name: 'Log audit' }).getByRole('listitem').first()
  await expect(entry).toContainText('Ubah konfigurasi · Unggah dokumen')
  await expect(entry).toContainText('“Batas bank mitra”')
  await entry.getByText('Lihat detail').click()
  await expect(entry.getByRole('row', { name: /Ukuran maksimal/ })).toHaveText(/Ukuran maksimal\s*5\s*2/)
})

test('the overview activity feed unfolds a change, opens its record, and leads to the full log', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await saveUploadLimit(page, '2', 'Batas bank mitra')

  await page.getByRole('link', { name: 'Overview' }).click()
  const entry = page.getByRole('list', { name: 'Aktivitas admin terbaru' }).getByRole('listitem').first()
  await expect(entry).toContainText('Ubah konfigurasi · Unggah dokumen')
  await entry.getByText('Lihat detail').click()
  await expect(entry.getByRole('row', { name: /Ukuran maksimal/ })).toHaveText(/Ukuran maksimal\s*5\s*2/)
  await entry.getByRole('link', { name: 'Buka konfigurasi' }).click()
  await expect(page).toHaveURL(/\/admin\/configuration$/)

  await page.getByRole('link', { name: 'Overview' }).click()
  await page.getByRole('link', { name: 'Lihat semua log' }).click()
  await expect(page).toHaveURL(/\/admin\/audit-log$/)
  await expect(page.getByRole('list', { name: 'Log audit' }).getByRole('listitem')).toHaveCount(1)
})

test('with two super admins, each change carries who made it and the log filters by admin', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await saveUploadLimit(page, '2', 'Batas bank mitra')
  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Sinta Maharani', 'sinta@ruangkpr.id')
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto('/admin/configuration')
  await saveUploadLimit(page, '3', 'Hemat penyimpanan')

  await page.getByRole('link', { name: 'Audit Log' }).click()
  const entries = page.getByRole('list', { name: 'Log audit' }).getByRole('listitem')
  await expect(entries).toHaveCount(2)
  await page.getByLabel('Oleh admin').selectOption({ label: 'Sinta Maharani' })
  await expect(entries).toHaveCount(1)
  await expect(entries).toContainText('oleh Sinta Maharani')
})
