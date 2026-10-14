import { expect, test } from '@playwright/test'
import { pdf, signIn, useScenario } from './helpers'

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

test('admin reviews each document, sends the rejected one with its reason, and forwards to the bank once all are Sesuai', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openApplication(page, 'Rina Hartati')
  await move(page, 'Mulai verifikasi dokumen', 'Dokumen awal lengkap')
  await expect(page.getByRole('button', { name: 'Teruskan ke bank' })).toBeDisabled()
  for (const doc of ['KTP', 'Slip Gaji / Bukti Penghasilan', 'Dokumen Properti']) {
    await page.getByRole('button', { name: `Sesuai ${doc}` }).click()
    await expect(page.getByRole('button', { name: `Sesuai ${doc}` })).toBeDisabled()
  }
  await page.getByRole('button', { name: 'Tolak NPWP' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Alasan').selectOption({ label: 'Buram / tidak terbaca' })
  await dialog.getByLabel('Catatan untuk user').fill('angka NPWP tidak terbaca')
  await dialog.getByRole('button', { name: 'Simpan penolakan' }).click()
  await expect(page.getByText('Ditolak · belum dikirim')).toBeVisible()
  await expect(page.getByText('4 dari 4 dokumen wajib diperiksa · 1 ditolak')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Teruskan ke bank' })).toBeDisabled()
  await move(page, 'Kirim permintaan revisi ke user', 'NPWP buram', async (d) => {
    await expect(d.getByRole('list', { name: 'Dokumen yang ditolak' })).toContainText('NPWP — Buram / tidak terbaca: angka NPWP tidak terbaca')
  })
  await expect(page.getByText('Perlu Dokumen Tambahan').first()).toBeVisible()

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Rina Hartati', 'rina.hartati@example.com')
  await expect(page.getByRole('heading', { name: 'Ada dokumen yang perlu diunggah ulang' })).toBeVisible()
  await expect(page.getByText('Buram / tidak terbaca: angka NPWP tidak terbaca')).toBeVisible()
  await page.getByRole('link', { name: 'Upload ulang' }).click()
  await page.locator('input[type=file]').nth(1).setInputFiles(pdf('npwp-baru.pdf'))
  await expect(page.getByText('Status: Verifikasi Dokumen')).toBeVisible()

  await page.goto('/profile')
  await page.getByRole('button', { name: 'Keluar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keluar' }).click()
  await signIn(page, 'Admin RuangKPR', 'admin@ruangkpr.id')
  await openApplication(page, 'Rina Hartati')
  await page.getByRole('button', { name: 'Sesuai NPWP' }).click()
  await expect(page.getByRole('button', { name: 'Teruskan ke bank' })).toBeEnabled()
  await move(page, 'Teruskan ke bank', 'Dokumen lengkap dan jelas')
  await expect(page.getByRole('list', { name: 'Riwayat status' })).toContainText('Proses Bank')
})

test('the team records the appraisal agreed on WhatsApp; until then the user sees it waiting for confirmation', async ({ page }) => {
  await useScenario(page, 'application_in_process', '/my-kpr/application')
  await page.getByRole('button', { name: 'Majukan ke: Appraisal' }).click()
  await page.goto('/')
  await expect(page.getByText('Menunggu konfirmasi')).toBeVisible()
  await expect(page.getByText('Jadwal appraisal akan dikonfirmasi tim lewat WhatsApp.')).toBeVisible()

  await useScenario(page, 'admin_ops', '/admin')
  await openApplication(page, 'Firdi Audi')
  await page.getByLabel('Pesan untuk user').fill('Bank sedang menganalisis, estimasi 5 hari kerja.')
  await page.getByRole('button', { name: 'Simpan info' }).click()
  await expect(page.getByText(/Terakhir diubah/)).toBeVisible()
  await move(page, 'Masuk tahap appraisal', 'Bank menjadwalkan appraisal')
  await expect(page.getByText('Belum diisi. User melihat: jadwal menunggu konfirmasi tim via WhatsApp.')).toBeVisible()
  await expect(page.getByLabel('Catatan untuk user')).toHaveValue('')
  await page.getByLabel('Tanggal appraisal').fill('2026-10-18')
  await page.getByLabel('Jam appraisal').fill('10:00')
  await page.getByLabel('Lokasi appraisal').fill('Jl. Melati 12, Bekasi')
  await page.getByLabel('Catatan untuk user').fill('Siapkan IMB/PBG asli.')
  await page.getByRole('button', { name: 'Simpan info' }).click()
  await expect(page.getByText(/Terakhir diubah/)).toBeVisible()

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Firdi Audi', 'firdi.audi@email.com')
  await expect(page.getByText('Jl. Melati 12, Bekasi')).toBeVisible()
  await expect(page.getByText('Siapkan IMB/PBG asli.')).toBeVisible()
  await expect(page.getByText('Menunggu konfirmasi')).toHaveCount(0)
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
