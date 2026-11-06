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

  // Titik lokasi: pasting coordinates needs no search call; Geoapify tiles and the static map are stubbed.
  await page.route('**/*.geoapify.com/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }))
  await page.getByRole('button', { name: 'Tandai Lokasi' }).click()
  const located = page.getByRole('dialog', { name: 'Data properti' })
  await located.getByLabel('Kota / Kabupaten').fill('kota bek')
  await page.keyboard.press('Escape') // closes only the list
  await expect(located).toBeVisible()
  await located.getByLabel('Cari lokasi').fill('-6.2383, 106.9756')
  await located.getByRole('button', { name: 'Pakai titik ini' }).click()
  await expect(located.getByText('-6.238300, 106.975600')).toBeVisible()
  await located.getByRole('button', { name: 'Simpan Data Properti' }).click()
  await expect(located).toBeHidden()
  await expect(page.getByRole('img', { name: 'Peta lokasi properti' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buka di Google Maps' })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=-6.238300,106.975600')
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

test('penghasilan from the Take Over start fills Take Over; bank choices come first, data the setup skipped after the pick', async ({ page }) => {
  await useScenario(page, 'fresh', '/monitoring/intro')
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await fillKprStep(page)
  await activate(page)
  await page.getByRole('button', { name: 'Lihat Dashboard' }).click()

  // Explore's Take Over: no data gate, only the income the bank list ranks by.
  await page.goto('/optimize/start?mode=takeover')
  const noIncome = page.getByText('Penghasilan bulanan belum diisi, jadi pilihan bank belum dapat dihitung.')
  await expect(noIncome).toBeVisible()
  await fillIncome(page)
  await expect(noIncome).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lihat Kondisi KPR' })).toBeVisible()
  await page.goto('/')

  // The warning card's Take Over opens the bank list although data pribadi, pekerjaan and properti are still missing.
  await page.getByRole('button', { name: 'Bandingkan Take Over' }).click()
  await expect(page).toHaveURL(/optimize\/programs$/)
  await expect(page.getByRole('heading', { name: 'Pilihan Take Over' })).toBeVisible()
  await expect(page.getByText('Rekomendasi dari kami').first()).toBeVisible()
  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await page.getByRole('button', { name: /^Ajukan / }).click()
  await page.getByRole('button', { name: 'Lanjut Dokumen' }).click()
  // Bank picked: the missing forms come before Dokumen.
  await expect(page).toHaveURL(/optimize\/1$/)
  await expect(page.getByText('Lengkapi data pengajuan', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save(page)
  await expect(page).toHaveURL(/optimize\/1\/pekerjaan$/)
  await expect(page.getByLabel('Penghasilan bulanan (gross)')).toHaveValue('15.000.000') // not typed again
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  // New debts would change the price and drop the picked bank; none here, so the pick stays.
  await page.getByLabel('Cicilan kendaraan').fill('0')
  await page.getByLabel('Kartu kredit / paylater').fill('0')
  await save(page)
  await expect(page).toHaveURL(/optimize\/4$/) // Data KPR lama is known from the monitored KPR
  await page.getByLabel('Jenis properti').selectOption('landed_house')
  await page.getByLabel('Kota / Kabupaten').fill('bekasi')
  await page.getByRole('option', { name: /^Kota Bekasi/ }).click()
  await page.getByLabel('Alamat', { exact: true }).fill('Griya Asri Blok C2 No. 8')
  await page.getByLabel('Luas tanah').fill('72')
  await page.getByLabel('Luas bangunan').fill('45')
  await page.getByLabel('Status sertifikat').selectOption('shm')
  await save(page)
  await expect(page).toHaveURL(/optimize\/6/) // nothing left to ask
  await page.getByRole('button', { name: 'Unggah semua (demo)' }).click()
  await expect(page.getByRole('button', { name: 'Simpan & Lanjutkan' })).toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 })
  await save(page)

  await expect(page).toHaveURL(/optimize\/7/)
})

// The demo keeps its own clock (Supabase mode reads the real date): move it as if days passed.
async function setClock(page, date) {
  await page.evaluate((d) => {
    const key = 'ruangkpr:prototype:v1'
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), clock: d }))
  }, date)
  await page.reload()
}

test('sisa pokok: a payment mark changes nothing, a passed due date lowers it on every tab, labelled estimasi', async ({ page }) => {
  await useScenario(page, 'mortgage_active_normal', '/my-kpr/payment')
  // 22 Oct marked on 28 Sep: still to come, so the bank's figure stays.
  await page.getByRole('button', { name: 'Tandai Sudah Dibayar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tandai pembayaran' })
  await dialog.getByRole('button', { name: 'Simpan' }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('tab', { name: 'Overview' }).click()
  const summary = page.getByRole('region', { name: 'Ringkasan KPR' })
  await expect(summary).toContainText('Rp517.584.453')
  await expect(summary).toContainText('187 bulan')
  await expect(summary).toContainText('Apr 2042')
  await expect(summary.getByText('estimasi', { exact: true })).toHaveCount(0)

  await setClock(page, '2026-10-23') // the day after that due date
  await expect(summary).toContainText('Rp515.829.391')
  await expect(summary).toContainText('186 bulan')
  await expect(summary).toContainText('Apr 2042') // the payoff date does not slide a month
  await expect(summary.getByText('estimasi', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Property' }).click()
  await expect(page.getByRole('region', { name: 'Properti' })).toContainText('Rp515.829.391')
})

const money = (text) => Number(text.replace(/\D/g, ''))
const ddOf = (page, label) => page.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd')

test('after the fixed period: rate, cicilan and the Health ratio follow the floating estimate, labelled estimasi', async ({ page }) => {
  await useScenario(page, 'mortgage_active_h90', '/my-kpr/rate')
  await setClock(page, '2027-01-05') // fixed 5,50% ended 22 Dec 2026; floating estimate 9,00%
  await expect(page.locator('main')).toContainText('9,00% Floating')
  await expect(page.locator('main')).not.toContainText('5,50% Floating')
  await page.getByRole('tab', { name: 'Overview' }).click()
  await expect(ddOf(page, 'Bunga')).toHaveText('9,00% Floating')
  await page.getByRole('tab', { name: 'Payment' }).click()
  // The amount due equals that installment's pokok + bunga.
  const due = money(await page.getByText('Pembayaran berikutnya').locator('xpath=following-sibling::span[1]').innerText())
  const pokok = money(await ddOf(page, /^Pokok bulan/).innerText())
  const bunga = money(await ddOf(page, /^Bunga bulan/).innerText())
  expect(due).toBe(pokok + bunga)
  await page.goto('/my-kpr/health') // seeded income 15 jt, other installments 1,5 jt
  const ratio = (Math.round(((due + 1_500_000) / 15_000_000) * 1000) / 10).toLocaleString('id-ID', { minimumFractionDigits: 1 })
  await expect(page.locator('main')).toContainText(`${ratio}%`)
})

test('Home schedule widget starts where the full schedule does, even with the next month marked early', async ({ page }) => {
  await useScenario(page, 'mortgage_active_normal', '/my-kpr/payment')
  await page.getByRole('button', { name: 'Tandai Sudah Dibayar' }).click() // 22 Oct, marked on 28 Sep
  const dialog = page.getByRole('dialog', { name: 'Tandai pembayaran' })
  await dialog.getByRole('button', { name: 'Simpan' }).click()
  await expect(dialog).toHaveCount(0)
  await page.goto('/')
  const table = page.getByRole('table', { name: /Cicilan berikutnya/ })
  await expect(table.getByRole('row').nth(1)).toContainText('Okt 2026')
  await expect(page.getByText('Sisa 187 cicilan')).toBeVisible() // the same count as Sisa Tenor
})

test('bank figures that do not fit the cicilan get a warning in the setup', async ({ page }) => {
  await useScenario(page, 'fresh', '/monitoring/intro')
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await page.getByLabel('Bank', { exact: true }).selectOption('Bank ABC')
  await page.getByLabel('Jumlah pinjaman awal').fill('600000000')
  await page.getByLabel('Cicilan bulanan saat ini').fill('2751549')
  await page.getByLabel('Tenor awal').fill('240')
  await page.getByLabel('Tanggal akad').fill('2021-12-22')
  await page.getByLabel('Jatuh tempo setiap tanggal').fill('22')
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  await page.getByLabel('Bunga saat ini').fill('5,50')
  await page.getByLabel('Fixed berakhir').fill('2026-12-22')
  await page.getByLabel('Estimasi bunga floating').fill('9,00')
  await page.getByRole('radio', { name: 'Ya, ada angka dari bank' }).click()
  await page.getByLabel('Sisa pokok saat ini').fill('415000000')
  await page.getByLabel('Sisa tenor', { exact: true }).fill('183')
  const warning = page.getByText(/tidak cocok dengan sisa pokok, bunga, dan sisa tenor ini \(hitungannya sekitar Rp3\.355\.115\)/)
  await expect(warning).toBeVisible()
  await page.getByLabel('Cicilan bulanan saat ini').fill('3355115')
  await expect(warning).toHaveCount(0)
})

test('Edit Data KPR: a new cicilan fills bunga again, even when the saved bunga was typed', async ({ page }) => {
  await useScenario(page, 'mortgage_active_normal', '/monitoring/setup/1?edit=mykpr')
  const rate = page.getByLabel('Bunga saat ini')
  await rate.fill('5,60') // not what pinjaman, cicilan and tenor imply (5,50)
  await page.getByRole('button', { name: 'Simpan Perubahan' }).click()
  await expect(page).toHaveURL(/my-kpr\/overview/)
  await page.goto('/monitoring/setup/1?edit=mykpr')
  await expect(rate).toHaveValue('5,60')
  await page.getByLabel('Cicilan bulanan saat ini').fill('4500000')
  await expect(rate).toHaveValue('6,58')
  await expect(page.getByText('Dihitung otomatis dari pinjaman awal')).toBeVisible()
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
