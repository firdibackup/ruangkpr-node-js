import { expect, test } from '@playwright/test'
import { signIn, useScenario } from './helpers'

const openApplication = async (page, name) => {
  await page.goto('/admin/applications')
  await page.getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

const move = async (page, action, note, fill = async () => {}) => {
  await page.getByRole('button', { name: action }).click()
  await fill(page.getByRole('dialog'))
  await page.getByLabel('Catatan perubahan status').fill(note)
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan status' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('admin verifies, asks for a new KTP, and the user sees the request after signing in', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openApplication(page, 'Rina Hartati')
  await move(page, 'Mulai verifikasi dokumen', 'Dokumen awal lengkap')
  await move(page, 'Minta revisi dokumen', 'KTP tidak terbaca', async (dialog) => {
    await dialog.getByRole('checkbox', { name: 'KTP' }).check()
    await dialog.getByLabel('Pesan untuk user').fill('Foto KTP buram, mohon unggah ulang.')
  })
  await expect(page.getByText('Perlu Dokumen Tambahan').first()).toBeVisible()
  await expect(page.getByRole('list', { name: 'Riwayat status' })).toContainText('Verifikasi Dokumen')

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Rina Hartati', 'rina.hartati@example.com')
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  await page.goto('/my-kpr/application')
  await expect(page.getByText('Foto KTP buram, mohon unggah ulang.').first()).toBeVisible()
})

test('only legal moves are offered; akad takes final terms prefilled from the program and disbursement closes it', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openApplication(page, 'Firdi Audi')
  await expect(page.getByRole('button', { name: 'Masuk tahap appraisal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tolak pengajuan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Teruskan ke bank' })).toHaveCount(0)

  await openApplication(page, 'Agus Pratama')
  await move(page, 'Catat akad', 'Akad dijadwalkan bank', async (dialog) => {
    await expect(dialog.getByLabel('Plafon final')).toHaveValue('500.000.000')
    await dialog.getByLabel('Tanggal akad').fill('2026-10-05')
  })
  await move(page, 'Tandai sudah cair', 'Dana sudah cair')
  await expect(page.getByText('Pengajuan selesai').first()).toBeVisible()
})
