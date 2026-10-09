import { expect, test } from '@playwright/test'
import { fillMoney, useScenario } from './helpers'

const openUser = async (page, query, name) => {
  await page.goto('/admin/users')
  await page.getByLabel('Cari user').fill(query)
  await page.getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

const confirmWithReason = async (page, reason) => {
  await page.getByRole('button', { name: 'Lanjut' }).click()
  await page.getByLabel('Alasan perubahan').fill(reason)
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
}

test('admin corrects a profile with a reason; the change and its reason land in the history', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openUser(page, 'budi', 'Budi Santoso')
  await expect(page.getByText('3276********0002')).toBeVisible() // NIK masked by default

  await page.getByRole('button', { name: 'Ubah profil' }).click()
  await page.getByLabel('Alamat KTP').fill('Jl. Melati Baru No. 9, Kota Bekasi')
  await confirmWithReason(page, 'Koreksi alamat sesuai KTP')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Jl. Melati Baru No. 9, Kota Bekasi')).toBeVisible()
  const history = page.getByRole('list', { name: 'Riwayat perubahan' })
  await expect(history).toContainText('Ubah profil')
  await expect(history).toContainText('Koreksi alamat sesuai KTP')
})

test('a finance edit tells the admin which figures were recalculated', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openUser(page, 'sari', 'Sari Wulandari')
  await page.getByRole('button', { name: 'Ubah keuangan' }).click()
  await fillMoney(page, 'Penghasilan bulanan', 20000000)
  await confirmWithReason(page, 'Slip gaji terbaru')
  await expect(page.getByText(/DTI dan KPR Health/)).toBeVisible()
  await expect(page.getByText('Rp20.000.000')).toBeVisible()
})
