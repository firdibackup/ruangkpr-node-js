import { expect, test } from '@playwright/test'

// Visitor demo from /login (spec Amandemen 5): the forms fill from "Isi data contoh", documents from the demo upload.
test('demo KPR Primary: sample data on every step → submit → bank simulation → exit back to the real login', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Demo KPR Primary' }).click()
  await expect(page).toHaveURL(/apply\/primary\/1$/)
  await expect(page.getByText('Mode demo')).toBeVisible()

  const sample = page.getByRole('button', { name: 'Isi data contoh' })
  const next = page.getByRole('button', { name: 'Simpan & Lanjutkan' })
  for (const step of [1, 2]) {
    await expect(page).toHaveURL(new RegExp(`apply/primary/${step}$`))
    await sample.click()
    await next.click()
  }
  await page.getByRole('button', { name: /Lanjut ke Tahap 2/ }).click()
  for (const step of [3, 4]) {
    await expect(page).toHaveURL(new RegExp(`apply/primary/${step}$`))
    await sample.click()
    await next.click()
  }
  await page.getByRole('button', { name: /Lanjut ke Tahap 3/ }).click()
  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await page.getByRole('button', { name: 'Pilih Program & Lanjutkan' }).click()

  await expect(page).toHaveURL(/apply\/primary\/6$/)
  await page.getByRole('button', { name: 'Isi contoh' }).click()
  await expect(page.getByRole('status').filter({ hasText: '4 dari 4 terunggah' })).toBeVisible()
  await page.getByRole('button', { name: 'Lanjutkan' }).click()

  await expect(page).toHaveURL(/apply\/primary\/7$/)
  await page.getByRole('checkbox', { name: /Data yang saya berikan benar/ }).check()
  await page.getByRole('checkbox', { name: /Saya setuju data saya dikirim/ }).check()
  await page.getByRole('button', { name: 'Submit Pengajuan' }).click()
  await expect(page.getByRole('heading', { name: 'Pengajuan berhasil dikirim' })).toBeVisible()
  await page.getByRole('button', { name: 'Lihat Dashboard' }).click()
  await page.getByRole('link', { name: 'Lihat detail', exact: true }).click()
  await expect(page.getByText('MODE DEMO · SIMULASI RESPONS BANK')).toBeVisible()

  await page.getByRole('button', { name: 'Keluar demo' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Mode demo', { exact: true })).toHaveCount(0)
})

test('demo Take Over: a monitored KPR on floating shows Peluang on Home → bank programs → documents → submit; signing out leaves the demo', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Demo Take Over' }).click()
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  await page.getByRole('button', { name: 'Lewati' }).click() // the dashboard tour runs once for a new visitor
  await expect(page.getByText('Mode demo')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ada ruang untuk cicilan lebih ringan.' })).toBeVisible()

  // The KPR already holds every figure Take Over needs: the Peluang tile goes straight to the bank list.
  await page.getByRole('button', { name: /POTENSI TAKE OVER/ }).click()
  await expect(page).toHaveURL(/optimize\/programs$/)
  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await page.getByRole('button', { name: /^Ajukan / }).click()
  await page.getByRole('button', { name: 'Lanjut Dokumen' }).click()
  await expect(page).toHaveURL(/optimize\/6$/)
  const save = page.getByRole('button', { name: 'Simpan & Lanjutkan' })
  await page.getByRole('button', { name: 'Unggah semua (demo)' }).click()
  await expect(save).toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 })
  await save.click()
  await expect(page).toHaveURL(/optimize\/7$/)
  await page.getByRole('checkbox', { name: /Data yang saya berikan benar/ }).check()
  await page.getByRole('checkbox', { name: /Saya setuju data dikirim/ }).check()
  await page.getByRole('button', { name: 'Submit Pengajuan' }).click()
  await expect(page.getByRole('heading', { name: 'Pengajuan berhasil dikirim' })).toBeVisible()
  await page.getByRole('button', { name: 'Lihat Dashboard' }).click()
  await page.getByRole('link', { name: 'Lihat detail', exact: true }).click()
  await expect(page.getByText('MODE DEMO · SIMULASI RESPONS BANK')).toBeVisible()

  await page.goto('/profile')
  await page.getByRole('button', { name: 'Keluar', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keluar', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Demo Take Over' })).toBeVisible()
})

test('demo: deleting the demo account also ends the demo', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Demo KPR Primary' }).click()
  await expect(page.getByText('Mode demo')).toBeVisible()
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Hapus Akun' }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('checkbox', { name: /Saya mengerti/ }).check()
  await dialog.getByRole('button', { name: 'Hapus Akun' }).click()
  await expect(page).toHaveURL(/\/login$/)
  // The mock login reloads into the real one; the page may be mid-reload when asked.
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('ruangkpr:demo')).catch(() => 'reloading')).toBeNull()
})
