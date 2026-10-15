import { expect, test } from '@playwright/test'
import { expectNoSecondary, pdf, register, useScenario } from './helpers'

test('primary: register (name, password, consent) → email code → 7 steps → submit → tracker (resume at step 6)', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  // Looks disabled (aria-disabled) but stays clickable so users learn what is missing; no API call happens.
  await page.getByRole('button', { name: 'Daftar', exact: true }).click({ force: true })
  await expect(page.getByText('Nama minimal 3 huruf.')).toBeVisible()
  await register(page, { name: 'Firdi Audi', email: 'firdi@example.com' })
  await expect(page).toHaveURL(/\/verify$/)
  await expect(page.getByText('Step')).toHaveCount(0) // signing up is not an application step

  await page.getByLabel('Digit 1 dari 6').fill('000000')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Kode salah')
  await page.getByLabel('Digit 1 dari 6').fill('148260')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  // Consent was given on the registration form: straight to Home, no /welcome.
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)

  const products = page.getByRole('list', { name: 'Produk KPR' }).getByRole('listitem')
  await expect(products).toHaveCount(3) // Multiguna is hidden on Home for now (HomePage.jsx)
  await expectNoSecondary(page)
  await page.getByRole('button', { name: /Mulai Pengajuan KPR/ }).click()

  // Product is already chosen on Home: step 1 is personal data, the draft is created on its first save.
  await expect(page).toHaveURL(/apply\/primary\/1/)
  await expect(page.getByText('Bagian 1 dari 3 · Tentang Kamu')).toBeVisible()
  await expect(page.getByText('0% selesai.', { exact: true })).toBeAttached()
  await page.getByLabel('NIK').fill('3174012345678901')
  await page.getByLabel('Tempat Lahir').fill('Bekasi')
  await page.getByLabel('Tanggal Lahir').fill('1996-04-12')
  await page.getByRole('radio', { name: 'Laki-laki' }).click()
  await page.getByLabel('Status Perkawinan').selectOption('single')
  await page.getByLabel('Alamat sesuai KTP').fill('Jl. Melati No. 12, Bekasi Selatan')
  await page.getByLabel('Nomor Ponsel').fill('081234567890') // no longer filled from sign-up: sign-in is email only
  await page.getByLabel('Email').fill('firdi@example.com')
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

  await expect(page).toHaveURL(/apply\/primary\/2/)
  await expect(page.getByText('30% selesai.')).toBeAttached()
  // "Lainnya" swaps in a free-text job; picking a listed job hides it again.
  await page.getByRole('radio', { name: 'Lainnya — tulis pekerjaanmu' }).click()
  await expect(page.getByLabel('Jenis Pekerjaan lainnya')).toBeFocused()
  await page.getByLabel('Jenis Pekerjaan lainnya').fill('Guru Honorer')
  await page.getByLabel('Jenis Pekerjaan lainnya').fill('') // cleared text keeps the box open
  await expect(page.getByLabel('Jenis Pekerjaan lainnya')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Lainnya — tulis pekerjaanmu' })).toBeChecked()
  await page.getByRole('radio', { name: 'Karyawan tetap swasta' }).click()
  await expect(page.getByLabel('Jenis Pekerjaan lainnya')).toHaveCount(0)
  await page.getByLabel('Nama Perusahaan').fill('PT Nusantara Digital')
  await page.getByLabel('Jabatan').fill('Product Designer')
  await page.getByLabel('Lama Bekerja (tahun)').fill('4')
  await page.getByLabel('Lama Bekerja (bulan)').fill('6')
  await page.getByLabel('Penghasilan Bulanan (gross)').fill('15000000')
  for (const l of ['Cicilan Kendaraan', 'Kartu Kredit / Paylater', 'Pinjaman Lain']) await page.getByLabel(l).fill('0')
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

  // Phase 1 closes with a milestone computed from the saved profile.
  await expect(page).toHaveURL(/apply\/primary\/3/)
  await expect(page.getByRole('heading', { name: 'Tahap 1 selesai' })).toBeVisible()
  await expect(page.getByText('Cicilan aman')).toBeVisible()
  await expect(page.getByText('Plafon KPR hingga')).toBeVisible()
  await expect(page.getByText('3 program bank terbuka untuk profilmu')).toBeVisible()
  // Going back to edit keeps the saved progress instead of dropping it.
  await page.getByRole('button', { name: 'Kembali', exact: true }).last().click()
  await expect(page).toHaveURL(/apply\/primary\/2/)
  await expect(page.getByText('55% selesai.')).toBeAttached()
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()
  await page.getByRole('button', { name: /Lanjut ke Tahap 2/ }).click()

  await expect(page).toHaveURL(/apply\/primary\/3/)
  await expect(page.getByText('Bagian 2 dari 3 · Rumah & Pinjaman')).toBeVisible()
  await page.getByRole('radio', { name: /Rumah baru dari developer/ }).click()
  await page.getByLabel('Nama Developer').fill('PT Griya Asri')
  await page.getByLabel('Jenis Properti').selectOption('landed_house')
  await page.getByLabel('Kota / Kabupaten').fill('bekasi')
  await page.getByRole('option', { name: /^Kota Bekasi/ }).click()
  await page.getByLabel('Alamat Properti').fill('Griya Asri Blok C2 No. 8, Bekasi')
  await page.getByLabel('Harga Properti').fill('500000000')
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

  await expect(page).toHaveURL(/apply\/primary\/4/)
  await page.getByLabel('Uang Muka (DP)').fill('100000000')
  await expect(page.getByLabel('Jumlah Pinjaman')).toHaveValue('400.000.000') // auto Harga − DP
  await page.getByLabel('Tenor').selectOption('240')
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

  await expect(page).toHaveURL(/apply\/primary\/5/)
  await expect(page.getByRole('heading', { name: 'Tahap 2 selesai' })).toBeVisible()
  await expect(page.getByText('Program cocok')).toBeVisible()
  await expect(page.getByText('80% selesai.')).toBeAttached()
  // Pick the bank first, then upload documents (step 6), then Review.
  await page.getByRole('button', { name: /Lanjut ke Tahap 3/ }).click()
  await expect(page).toHaveURL(/apply\/primary\/5$/)
  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await expect(page.getByRole('heading', { name: 'Cicilan vs kapasitas' })).toBeVisible()
  await page.getByRole('button', { name: 'Pilih Program & Lanjutkan' }).click()

  await expect(page).toHaveURL(/apply\/primary\/6/)
  await expect(page.getByRole('heading', { name: 'Dokumen pengajuan' })).toBeVisible()
  const inputs = page.locator('input[type=file]')
  for (let i = 0; i < 4; i++) {
    await inputs.nth(i).setInputFiles(pdf(`doc-${i}.pdf`))
    await expect(page.getByText('✓ Terunggah')).toHaveCount(i + 1)
  }
  await page.reload() // resume: files and step persist
  await expect(page).toHaveURL(/apply\/primary\/6/)
  await expect(page.getByRole('status').filter({ hasText: '4 dari 4 terunggah' })).toBeVisible()
  await page.getByRole('button', { name: 'Lanjutkan' }).click()

  await expect(page).toHaveURL(/apply\/primary\/7/)
  const submit = page.getByRole('button', { name: 'Submit Pengajuan' })
  await submit.click({ force: true }) // consents missing → stays
  await expect(page).toHaveURL(/apply\/primary\/7/)
  await page.getByRole('checkbox', { name: /Data yang saya berikan benar/ }).check()
  await page.getByRole('checkbox', { name: /Saya setuju data saya dikirim/ }).check()
  await submit.click()

  await expect(page.getByRole('heading', { name: 'Pengajuan berhasil dikirim' })).toBeVisible()
  await page.getByRole('button', { name: 'Lihat Dashboard' }).click()
  await page.getByRole('link', { name: 'Lihat detail', exact: true }).click()
  await expect(page).toHaveURL(/my-kpr\/application/)
  await expect(page.getByText('Status: Diajukan')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Batalkan Pengajuan' })).toBeVisible()
  // post-submit is read-only: the form route redirects to the tracker
  await page.goto('/apply/primary/2')
  await expect(page).toHaveURL(/my-kpr\/application/)
})

test('rejected: clone to another bank keeps history, fix & resubmit returns to step 2', async ({ page }) => {
  await useScenario(page, 'application_rejected_dti', '/')
  await expect(page.getByText('Pengajuan Ditolak')).toBeVisible()
  await page.getByRole('button', { name: 'Ajukan ke Bank Lain' }).click()
  await expect(page).toHaveURL(/apply\/primary\/5$/)
  await expect(page.getByText('✕ Ditolak sebelumnya')).toBeVisible()

  await useScenario(page, 'application_rejected_dti', '/my-kpr/application')
  await page.getByRole('button', { name: 'Perbaiki & Ajukan Ulang' }).click()
  await expect(page).toHaveURL(/apply\/primary\/2/)
  await expect(page.getByText('Perbaiki data sebelum ajukan ulang')).toBeVisible()
})

test('cancel dialog does not delete before confirm; additional document can be re-uploaded in place', async ({ page }) => {
  await useScenario(page, 'application_additional_docs', '/my-kpr/application')
  await page.getByRole('button', { name: 'Batalkan Pengajuan' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Batal', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Pengajuan KPR Primary/ })).toBeVisible()

  await page.locator('input[type=file]').nth(2).setInputFiles(pdf('slip-gaji-terbaru.pdf'))
  await expect(page.getByText('Status: Verifikasi Dokumen')).toBeVisible()
  await expect(page.getByText('Permintaan tim RuangKPR')).toHaveCount(0)
})
