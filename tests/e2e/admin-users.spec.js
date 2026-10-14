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
  await expect(page.getByText('Jl. Melati Baru No. 9, Kota Bekasi', { exact: true })).toBeVisible()
  const history = page.getByRole('list', { name: 'Riwayat perubahan' })
  await expect(history).toContainText('Ubah profil')
  await expect(history).toContainText('Koreksi alamat sesuai KTP')
})

test('admin opens a KPR from the user profile and sees its full detail', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openUser(page, 'sari', 'Sari Wulandari')
  await page.getByRole('link', { name: 'Bank ABC · KPR Fixed 5 Tahun' }).click()

  await expect(page).toHaveURL(/\/admin\/users\/usr_sample_05\/kpr\/mtg_sample_05$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Bank ABC · KPR Fixed 5 Tahun' })).toBeVisible()
  for (const name of ['Ringkasan', 'Bunga', 'Jadwal amortisasi', 'KPR Health', 'Keuangan & DTI', 'Properti', 'Pembayaran', 'Reminder']) {
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('table', { name: 'Jadwal amortisasi per tahun' })).toBeVisible()
  await expect(page.getByText('Jl. Contoh No. 5, Kota Bekasi')).toBeVisible()
  const kprHistory = page.getByRole('list', { name: 'Riwayat perubahan KPR' })
  await expect(kprHistory).toContainText('Ubah data KPR')
  await expect(kprHistory).toContainText('Estimasi nilai properti: Rp820.000.000 → Rp850.000.000')
  await expect(kprHistory).toContainText('oleh Sari Wulandari (user)')
  await expect(kprHistory).not.toContainText('Ubah profil')

  await page.getByRole('link', { name: 'Kembali' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sari Wulandari' })).toBeVisible()
})

test('the full change history has its own page with filters; the profile panel shows the latest five', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openUser(page, 'sari', 'Sari Wulandari')
  await expect(page.getByRole('list', { name: 'Riwayat perubahan', exact: true }).getByRole('listitem')).toHaveCount(5)
  await page.getByRole('link', { name: 'Lihat semua riwayat (6)' }).click()

  await expect(page).toHaveURL(/\/admin\/users\/usr_sample_05\/riwayat$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Riwayat perubahan' })).toBeVisible()
  const list = page.getByRole('list', { name: 'Riwayat perubahan', exact: true })
  await expect(page.getByText('6 catatan')).toBeVisible()
  await expect(list).toContainText('Alamat: Jl. Melati No. 2, Kota Bekasi → Jl. Contoh No. 5, Kota Bekasi')
  await expect(list).toContainText('WIB')

  await page.getByLabel('Jenis').selectOption('profile')
  await expect(page.getByText('3 catatan')).toBeVisible()
  await expect(list).not.toContainText('Ubah data KPR')
  await page.getByLabel('Oleh').selectOption('admin')
  await expect(page.getByText('Tidak ada perubahan yang cocok dengan filter ini.')).toBeVisible()

  // The KPR page links to its own part of the history through the URL.
  await page.goto('/admin/users/usr_sample_05/riwayat?jenis=kpr')
  await expect(page.getByLabel('Jenis')).toHaveValue('kpr')
  await expect(page.getByText('2 catatan')).toBeVisible()
  await expect(list).toContainText('Ubah data KPR · Bank ABC · KPR Fixed 5 Tahun')
  await expect(list).toContainText('Kanal reminder: In-app → In-app, Email')

  await page.getByRole('link', { name: 'Kembali' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sari Wulandari' })).toBeVisible()
})

test('a finance edit tells the admin which figures were recalculated', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openUser(page, 'sari', 'Sari Wulandari')
  await page.getByRole('button', { name: 'Ubah keuangan' }).click()
  await fillMoney(page, 'Penghasilan bulanan', 20000000)
  await confirmWithReason(page, 'Slip gaji terbaru')
  await expect(page.getByText(/DTI dan KPR Health/)).toBeVisible()
  await expect(page.getByText('Rp20.000.000', { exact: true })).toBeVisible()
  // The admin edit, old → new, above the user's own earlier edits.
  const history = page.getByRole('list', { name: 'Riwayat perubahan', exact: true })
  await expect(history.getByRole('listitem').first()).toContainText('Penghasilan bulanan: Rp16.000.000 → Rp20.000.000')
  await expect(history.getByRole('listitem').first()).toContainText('oleh Admin RuangKPR')
  await expect(history).toContainText('Nomor ponsel: 081200000100 → 081200000105')
  await expect(history).toContainText('oleh Sari Wulandari (user)')
})
