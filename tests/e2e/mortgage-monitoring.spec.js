import { expect, test } from '@playwright/test'
import { pdf, useScenario } from './helpers'

const save = (page) => page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

// Step 1 (wajib): everything reminders and amortization need. Sisa pokok is estimated, not typed.
async function fillKprStep(page) {
  await page.getByLabel('Bank', { exact: true }).selectOption('Bank ABC')
  await page.getByLabel('Jumlah pinjaman awal').fill('600000000')
  await page.getByLabel('Cicilan bulanan saat ini').fill('4127324')
  await page.getByLabel('Tenor awal').fill('240')
  await page.getByLabel('Tanggal akad').fill('2021-12-22')
  await page.getByLabel('Jatuh tempo setiap tanggal').fill('22')
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  await page.getByLabel('Bunga saat ini').fill('5,50')
  await page.getByLabel('Fixed berakhir').fill('2026-12-22')
  await page.getByLabel('Estimasi bunga floating').fill('9,00')
  await page.getByRole('radio', { name: 'Tidak, hitungkan perkiraan' }).click()
  await expect(page.getByText(/Perkiraan sisa pokok ± .*, sisa tenor 183 bulan/)).toBeVisible()
  await expect(page.getByText(/Setelah fixed, cicilan bisa naik jadi/)).toBeVisible()
  await save(page)
}

async function activate(page) {
  await page.getByRole('checkbox', { name: 'Data yang saya masukkan benar' }).check()
  await page.getByRole('button', { name: 'Aktifkan Pemantauan KPR' }).click()
  await expect(page.getByRole('heading', { name: 'Pemantauan KPR aktif' })).toBeVisible()
}

// KPR Health unlocks on Home with penghasilan only; the pop-up asks nothing else.
async function fillIncome(page) {
  await page.getByRole('button', { name: 'Isi Penghasilan' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Isi penghasilan' })
  const income = dialog.getByLabel('Penghasilan bulanan')
  await dialog.getByRole('button', { name: 'Simpan Penghasilan' }).click()
  await expect(income).toHaveAttribute('aria-invalid', 'true')
  await expect(income).toBeFocused()
  await income.fill('15000000')
  await dialog.getByRole('button', { name: 'Simpan Penghasilan' }).click()
  await expect(dialog).toBeHidden()
}

test('monitoring: 2-step setup (Data KPR → Reminder) → locked widgets unlock → payment → amortization; no application created', async ({ page }) => {
  await useScenario(page, 'fresh', '/')
  await page.getByRole('link', { name: /Pantau KPR Saya/ }).click()
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/1/)
  await expect(page.getByText('Bagian 1 dari 2 · Data KPR')).toBeVisible()
  await expect(page.getByText('0% selesai.', { exact: true })).toBeAttached()
  // Nothing is stored before the first save: backing out leaves no draft on Home.
  await page.goto('/')
  await expect(page.getByText('Lanjutkan pengaturan KPR kamu')).toHaveCount(0)
  await page.goto('/monitoring/intro')
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()

  // Step 1 is required: an empty submit stops on the errors.
  await save(page)
  await expect(page).toHaveURL(/setup\/1/)
  await expect(page.getByLabel('Jumlah pinjaman awal')).toHaveAttribute('aria-invalid', 'true')
  // A past end date means the rate is already floating: one tap fixes the answer.
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  await page.getByLabel('Fixed berakhir').fill('2026-09-01')
  await expect(page.getByText('Tanggal ini sudah lewat, berarti bunga kamu sudah floating.')).toBeVisible()
  await page.getByRole('button', { name: 'Pilih Sudah floating' }).click()
  await expect(page.getByRole('radio', { name: /Sudah floating/ })).toHaveAttribute('aria-checked', 'true')
  await fillKprStep(page)

  // Straight to Reminder: profile and property data are filled later, from Home.
  await expect(page).toHaveURL(/setup\/2$/)
  await expect(page.getByText('Bagian 2 dari 2 · Reminder')).toBeVisible()
  await expect(page.getByText('95% selesai.')).toBeAttached()
  const payment = page.getByRole('group', { name: 'Pembayaran bulanan' })
  await expect(payment.getByRole('checkbox', { name: 'H-7' })).toHaveAttribute('aria-checked', 'true')
  await expect(payment.getByRole('checkbox', { name: 'Hari-H' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('group', { name: 'Masa fixed berakhir' }).getByRole('checkbox', { name: 'H-90' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('checkbox', { name: /WhatsApp/ })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('heading', { name: 'Bunga', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Properti', exact: true })).toHaveCount(0) // summary is KPR data only
  await activate(page)
  await expect(page).toHaveURL(/localhost:\d+\/$/)
  await page.getByRole('button', { name: 'Lihat Dashboard' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await expect(page.getByText('Fixed rate berakhir 85 hari lagi')).toBeVisible()
  // KPR Health waits for penghasilan, Peluang also for the property value; the old property banner is gone.
  await expect(page.getByRole('button', { name: 'Lengkapi Data Properti' })).toHaveCount(0)
  await expect(page.getByText(/Lengkapi penghasilan dan nilai properti untuk melihat potensi/)).toBeVisible()
  // Locked cards blur an example of the whole card under a lock prompt; the example is never exposed as real data.
  await expect(page.getByRole('heading', { name: 'Buka peluang KPR kamu' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Buka KPR Health' })).toBeVisible()
  await expect(page.getByRole('img', { name: /KPR Health \d+ dari 100/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Eksplorasi Pilihan' })).toHaveCount(0)
  for (const name of ['Peluang KPR', 'KPR Health']) {
    const body = page.getByRole('group', { name, exact: true }).locator(':scope > div:first-child > *')
    expect(await body.evaluate((el) => el.scrollHeight - el.clientHeight), name).toBeLessThanOrEqual(1) // fits its default cell
  }
  // Locked cards wait below the KPR itself on the default board.
  const top = async (name) => (await page.getByRole('group', { name, exact: true }).boundingBox()).y
  expect(await top('KPR Saya')).toBeLessThan(await top('Peluang KPR'))
  await expect(page.getByRole('link', { name: 'Lihat penyebab' })).toHaveCount(0)
  await fillIncome(page)
  await expect(page.getByRole('img', { name: /KPR Health \d+ dari 100/ })).toBeVisible()
  await expect(page.getByText(/Lengkapi nilai properti untuk melihat potensi/)).toBeVisible()
  // KPR Health opens the same pop-up from the row's corner, without leaving the page.
  await page.goto('/my-kpr/health')
  // The ⓘ says what KPR Health is (and is not); each component shows its bands with the user's own marked.
  await page.getByRole('button', { name: 'Tentang KPR Health' }).click()
  await expect(page.getByRole('dialog').getByText(/Bukan skor kredit bank/)).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Cara menghitung Beban cicilan' }).click()
  await expect(page.getByRole('dialog').getByText(/· kamu$/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText(/Skor sementara — lengkapi estimasi nilai properti/)).toBeVisible()
  await page.getByRole('button', { name: 'Isi nilai properti' }).click()
  await expect(page.getByRole('dialog', { name: 'Data properti' })).toBeVisible()
  await expect(page).toHaveURL(/my-kpr\/health$/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Data properti' })).toBeHidden()
  await page.goto('/')
  // Peluang opens the property pop-up right on Home; only the value is required.
  await page.getByRole('button', { name: 'Isi Nilai Properti' }).click()
  const property = page.getByRole('dialog', { name: 'Data properti' })
  const value = property.getByLabel('Estimasi nilai saat ini')
  await property.getByRole('button', { name: 'Simpan Data Properti' }).click()
  await expect(value).toHaveAttribute('aria-invalid', 'true')
  await expect(property.getByLabel('Alamat')).not.toHaveAttribute('aria-invalid', 'true')
  await value.fill('850000000')
  await property.getByRole('button', { name: 'Simpan Data Properti' }).click()
  await expect(property).toBeHidden()
  await expect(page.getByRole('button', { name: /POTENSI REFINANCING/ })).toBeVisible() // the real tile, not the locked example
  await expect(page.getByRole('button', { name: /POTENSI TAKE OVER/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eksplorasi Pilihan' })).toBeVisible()
  // Every field filled: the default board now leads with Peluang and Health, without a reload.
  await expect.poll(async () => (await top('Peluang KPR')) < (await top('KPR Saya')) && (await top('KPR Health')) < (await top('KPR Saya'))).toBe(true)
  await expect(page.locator('main canvas, main .recharts-surface')).toHaveCount(0) // default board has no charts; they are opt-in widgets (PRD §11.1)
  await expect(page.getByRole('table', { name: /Cicilan berikutnya/ }).getByRole('row')).toHaveCount(4) // header + 3 cicilan
  await expect(page.getByRole('link', { name: 'Lihat jadwal amortisasi' })).toHaveAttribute('href', '/my-kpr/amortization')

  await page.goto('/my-kpr/property')
  await page.getByRole('button', { name: 'Lengkapi Data Properti' }).click() // same pop-up as on Home
  await expect(page.getByRole('dialog', { name: 'Data properti' }).getByLabel('Estimasi nilai saat ini')).toHaveValue('850.000.000')
  await page.keyboard.press('Escape')
  await page.goto('/my-kpr')
  await expect(page).toHaveURL(/my-kpr\/overview/) // no application was created
  await page.getByRole('tab', { name: 'Payment' }).click()
  await expect(page.getByText(/user-recorded/)).toBeVisible()
  await page.getByRole('button', { name: 'Tandai Sudah Dibayar' }).click()
  const markPaid = page.getByRole('dialog', { name: 'Tandai pembayaran' })
  await markPaid.locator('input[type=file]').setInputFiles(pdf('bukti-transfer.pdf'))
  await expect(markPaid.getByText('bukti-transfer.pdf')).toBeVisible()
  await markPaid.getByRole('button', { name: 'Simpan' }).click()
  await expect(markPaid).toHaveCount(0)
  await expect(page.getByText('bukti-transfer.pdf')).toBeVisible() // proof shows in history
  await page.getByRole('button', { name: 'Lihat Jadwal Amortisasi' }).click()
  await expect(page.getByText('Komposisi Pembayaran per Tahun')).toBeVisible()
  await page.getByRole('link', { name: 'Lihat Jadwal Lengkap' }).click()
  await expect(page.getByRole('columnheader', { name: 'Sisa Pokok' })).toBeVisible()
  await page.getByLabel('Tahun').selectOption('2027')
  await expect(page.getByText('Mulai periode floating — estimasi 9,00%')).toBeVisible()
})

test('old setup draft resumes on the last step in the new 2-step language', async ({ page }) => {
  await useScenario(page, 'mortgage_setup_step_3', '/')
  await expect(page.getByText('Bagian 2 dari 2 · Reminder')).toBeVisible()
  await page.getByRole('button', { name: 'Lanjutkan Pengaturan' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/2$/)
  await expect(page.getByText('Ringkasan data')).toBeVisible()
  await page.goto('/monitoring/setup/6?edit=review') // link from the old 6-step setup
  await expect(page).toHaveURL(/monitoring\/setup\/2$/)
  await page.goto('/my-kpr')
  await expect(page.locator('main ol > li')).toHaveText([/Data KPR/, /Reminder/])
})

test('penghasilan from the Home pop-up fills Take Over; data the setup no longer asks comes before the bank choices', async ({ page }) => {
  await useScenario(page, 'fresh', '/monitoring/intro')
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await fillKprStep(page)
  await activate(page)
  await page.getByRole('button', { name: 'Lihat Dashboard' }).click()
  await fillIncome(page)

  // The warning card's Take Over skips the bank list until the missing data is filled.
  await page.getByRole('button', { name: 'Bandingkan Take Over' }).click()
  await expect(page).toHaveURL(/optimize\/start\?mode=takeover$/)
  await expect(page.getByText('Lengkapi data pengajuan dulu')).toBeVisible()
  await expect(page.getByText(/belum lengkap: data pribadi, pekerjaan, data properti\./)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lihat Kondisi KPR' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Lengkapi Data' }).click()
  await expect(page).toHaveURL(/optimize\/1$/)
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save(page)
  await expect(page).toHaveURL(/optimize\/1\/pekerjaan$/)
  await expect(page.getByLabel('Penghasilan bulanan (gross)')).toHaveValue('15.000.000') // not typed again
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save(page)
  await expect(page).toHaveURL(/optimize\/4$/) // Data KPR lama is known from the monitored KPR
  await expect(page.getByText('Lengkapi data pengajuan', { exact: true })).toBeVisible()
  await page.getByLabel('Jenis properti').selectOption('landed_house')
  await page.getByLabel('Kota / Kabupaten').selectOption('Kota Bekasi')
  await page.getByLabel('Alamat', { exact: true }).fill('Griya Asri Blok C2 No. 8')
  await page.getByLabel('Luas tanah').fill('72')
  await page.getByLabel('Luas bangunan').fill('45')
  await page.getByLabel('Status sertifikat').selectOption('shm')
  await save(page)
  await expect(page).toHaveURL(/optimize\/5$/) // Tujuan, then the bank choices
  await page.getByRole('radio', { name: /Pindah KPR tanpa dana tambahan/ }).click()
  await page.getByRole('radio', { name: 'Cicilan bulanan lebih ringan' }).click()
  await page.getByLabel('Tenor baru yang diinginkan').selectOption('180')
  await page.getByRole('button', { name: 'Lihat Kondisi KPR' }).click()
  await expect(page).toHaveURL(/optimize\/baseline/)
  await page.getByRole('button', { name: 'Bandingkan Program' }).click()
  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await page.getByRole('button', { name: /^Ajukan / }).click()
  await page.getByRole('button', { name: 'Lanjut Dokumen' }).click()
  await expect(page).toHaveURL(/optimize\/6/) // nothing left to ask
  await page.getByRole('button', { name: 'Unggah semua (demo)' }).click()
  await expect(page.getByRole('button', { name: 'Simpan & Lanjutkan' })).toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 })
  await save(page)

  await expect(page).toHaveURL(/optimize\/7/)
})

test('warning & partial states: H-90 warning is first, partial rate shows no fake table', async ({ page }) => {
  await useScenario(page, 'mortgage_active_h90', '/')
  await expect(page.getByText('Peringatan bunga · H-90')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Minta repricing' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Bandingkan Take Over' }).click()
  await expect(page).toHaveURL(/optimize\/programs$/) // straight to the bank list
  await expect(page.getByRole('button', { name: 'Lihat Detail' }).first()).toBeVisible()

  // Peluang tiles also open the bank list directly.
  await page.goto('/')
  await page.getByRole('button', { name: /POTENSI REFINANCING/ }).click()
  await expect(page).toHaveURL(/optimize\/programs$/)
  await expect(page.getByRole('heading', { name: 'Pilihan Refinancing + Top-up' })).toBeVisible()
  await page.goto('/')
  await page.getByRole('button', { name: /POTENSI TAKE OVER/ }).click()
  await expect(page).toHaveURL(/optimize\/programs$/)
  await expect(page.getByRole('heading', { name: 'Pilihan Take Over' })).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Tetap di bank sekarang' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('fixed rate tinggal 60 hari')
  await dialog.getByRole('button', { name: 'Ya, Sembunyikan' }).click()
  await expect(page.getByText('Peringatan bunga · H-90')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('POTENSI REFINANCING')).toBeVisible() // dashboard loaded
  await expect(page.getByText('Peringatan bunga · H-90')).toHaveCount(0) // hidden until H-60

  await useScenario(page, 'mortgage_active_h90', '/')
  await page.getByRole('button', { name: 'Lihat Pilihan' }).click()
  await expect(page).toHaveURL(/my-kpr\/rate/)
  await expect(page.getByText('estimasi').first()).toBeVisible()

  await useScenario(page, 'mortgage_partial_rate', '/my-kpr/amortization')
  await expect(page.getByText('Jadwal belum bisa dihitung lengkap.')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('explore without mortgage shows education only', async ({ page }) => {
  await useScenario(page, 'fresh', '/explore')
  await expect(page.getByText('Edukasi')).toBeVisible()
  await expect(page.getByRole('button', { name: /Take Over/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Multiguna/ })).toHaveCount(0)
})
