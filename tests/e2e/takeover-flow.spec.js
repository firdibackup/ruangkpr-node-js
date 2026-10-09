import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

async function openFirstProgram(page, mode) {
  await page.goto(`/optimize/start?mode=${mode}`)
  await page.getByRole('button', { name: 'Lihat Kondisi KPR' }).click()
  await expect(page).toHaveURL(/optimize\/baseline/)
  await expect(page.getByText('Estimasi biaya keluar dari bank lama')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tahap 2 selesai' })).toHaveCount(0) // Explore simulation is not an application
  await page.getByRole('button', { name: 'Bandingkan Program' }).click()
  await expect(page).toHaveURL(/optimize\/programs$/)
  await page.getByRole('button', { name: 'Lihat Detail' }).first().click()
  await expect(page).toHaveURL(/optimize\/programs\/bpr_/)
}

test('take over from Explore: simulation creates no application; apply → docs → review → submit → settlement stage', async ({ page }) => {
  await useScenario(page, 'mortgage_active_floating', '/explore')
  await page.getByRole('button', { name: /^Take Over/ }).click()
  await expect(page).toHaveURL(/optimize\/start\?mode=takeover/)
  await openFirstProgram(page, 'takeover')
  await expect(page.getByRole('heading', { name: 'Biaya pindah' })).toBeVisible()
  await page.getByRole('button', { name: 'Selesai Simulasi' }).click()
  await expect(page).toHaveURL(/\/explore$/)
  await page.goto('/my-kpr')
  await expect(page).toHaveURL(/my-kpr\/overview/) // still no application

  await openFirstProgram(page, 'takeover')
  await page.getByRole('button', { name: /^Ajukan / }).click()
  await expect(page.getByText('Pengajuan ini hanya dikirim ke satu bank/program.')).toBeVisible()
  await page.getByRole('button', { name: 'Lanjut Dokumen' }).click()
  // The monitored KPR has everything the forms need, so Dokumen comes next.
  await expect(page).toHaveURL(/optimize\/6/)
  await expect(page.getByText('KPR LAMA', { exact: true })).toBeVisible() // take-over specific documents
  await page.getByRole('button', { name: 'Unggah semua (demo)' }).click()
  await expect(page.getByRole('button', { name: 'Simpan & Lanjutkan' })).toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 })
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

  await expect(page).toHaveURL(/optimize\/7/)
  // Revisiting the program list from Review keeps the furthest saved percent.
  await page.goto('/optimize/programs')
  await expect(page.getByText('95% selesai.')).toBeAttached()
  await page.goto('/optimize/7')
  await page.getByRole('checkbox', { name: /Data yang saya berikan benar/ }).check()
  await page.getByRole('checkbox', { name: /Saya setuju data dikirim/ }).check()
  await page.getByRole('button', { name: 'Submit Pengajuan' }).click()
  await expect(page.getByRole('heading', { name: 'Pengajuan berhasil dikirim' })).toBeVisible()
  await expect(page.getByText('Tetap bayar cicilan bank lama')).toBeVisible()
  await page.getByRole('button', { name: 'Lihat Dashboard' }).click()
  await page.getByRole('link', { name: 'Lihat detail', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Status pengajuan' })).toContainText('Pelunasan KPR Lama')
})

test('cold-entry take over: 5 data steps (official figures) → baseline → programs', async ({ page }) => {
  await useScenario(page, 'fresh', '/')
  await page.getByRole('button', { name: /^Take Over/ }).click()
  await expect(page).toHaveURL(/optimize\/intro/)
  await page.getByRole('button', { name: 'Mulai' }).click()
  const save = () => page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()

  await expect(page).toHaveURL(/optimize\/1\?mode=takeover$/)
  await expect(page.getByText('Bagian 1 dari 3 · Kamu & KPR Lama')).toBeVisible()
  await expect(page.getByText('0% selesai.', { exact: true })).toBeAttached()
  // Nothing is stored before the first save: backing out leaves no draft on Home.
  await page.goto('/')
  await expect(page.getByText('Lanjutkan pengajuan kamu')).toHaveCount(0)
  await page.goto('/optimize/1?mode=takeover')
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()
  await expect(page).toHaveURL(/optimize\/1\/pekerjaan/)
  await expect(page.getByText('30% selesai.')).toBeAttached() // Pekerjaan is its own progress screen
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()
  await expect(page).toHaveURL(/optimize\/2$/)
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  // Bunga is always asked; only sisa pokok may be estimated, live from cicilan, bunga and sisa tenor.
  await page.getByRole('radio', { name: 'Tidak' }).click()
  await expect(page.getByText(/Perkiraan sisa pokok ±/)).toBeVisible()
  await page.getByRole('radio', { name: 'Ya' }).click()
  await save()

  // Phase 1 milestone (/optimize/3 has no form): what staying with the old bank looks like.
  await expect(page).toHaveURL(/optimize\/3$/)
  await expect(page.getByRole('heading', { name: 'Tahap 1 selesai' })).toBeVisible()
  await expect(page.getByText('55% selesai.')).toBeAttached()
  await expect(page.getByText('Sisa bunga jika tetap')).toBeVisible()
  await expect(page.getByText('Pokok sudah lunas')).toBeVisible()
  await expect(page.getByText('Floating', { exact: true })).toBeVisible()
  // Debts come from Pekerjaan: (5 jt KPR + 1,5 jt lain) / 15 jt is above the 35% guideline.
  await expect(page.getByText(/Rasio cicilan \(DTI\)/)).toBeVisible()
  await expect(page.getByText(/Di atas batas aman 35%/)).toBeVisible()
  await page.getByRole('button', { name: 'Lanjut ke Tahap 2' }).click()

  await expect(page).toHaveURL(/optimize\/4/) // Properti
  // Going back to edit keeps the furthest saved percent instead of dropping it.
  await page.goto('/optimize/1/pekerjaan')
  await expect(page.getByText('65% selesai.')).toBeAttached()
  await page.goto('/optimize/4')
  await expect(page.getByText('Bagian 2 dari 3 · Kondisi & Tujuan')).toBeVisible()
  await expect(page.getByText('Kesehatan KPR kamu')).toBeVisible()
  await expect(page.getByText('Isi estimasi nilai')).toBeVisible()
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await expect(page.getByText('Isi estimasi nilai')).toBeHidden() // LTV follows the typed property value
  await save()
  await expect(page).toHaveURL(/optimize\/5/) // Tujuan: last data step, runs the simulation
  await expect(page.getByRole('region', { name: 'Kondisi keuangan: Tanpa dana tambahan' })).toContainText('Biaya keluar bank lama')
  await expect(page.getByRole('region', { name: 'Kondisi keuangan: Tanpa dana tambahan' })).not.toContainText('Dana kamu untuk biaya') // never asked, so not shown
  await expect(page.getByRole('region', { name: 'Kondisi keuangan: + Dana tambahan' })).toContainText('Top-up kotor maksimum')
  await page.getByRole('radio', { name: /Pindah KPR tanpa dana tambahan/ }).click()
  await page.getByRole('radio', { name: 'Cicilan bulanan lebih ringan' }).click()
  await page.getByLabel('Tenor baru yang diinginkan').selectOption('180')
  await page.getByRole('button', { name: 'Lihat Kondisi KPR' }).click()

  await expect(page).toHaveURL(/optimize\/baseline/)
  await expect(page.getByRole('heading', { name: 'Tahap 2 selesai' })).toBeVisible()
  await expect(page.getByText('80% selesai.')).toBeAttached()
  await expect(page.getByText(/\d+ program cocok/)).toBeVisible()
  await expect(page.getByText('Angka resmi dari bank')).toBeVisible()
  await page.getByRole('button', { name: 'Bandingkan Program' }).click()
  await expect(page.getByText('Sesuai tujuan kamu')).toBeVisible()
  await expect(page.getByText('Data perlu dicek ulang')).toBeVisible() // stale product flagged, not recommended

  // Home resumes the draft in the same 3-phase language as the wizard.
  await page.goto('/')
  await expect(page.getByText('Take Over · Bagian 3 dari 3')).toBeVisible()
  await expect(page.getByText('Pilih Bank & Kirim')).toBeVisible()
})

test('a deleted Take Over draft keeps what was typed: starting again opens filled-in forms', async ({ page }) => {
  await useScenario(page, 'fresh', '/')
  const start = async () => {
    await page.getByRole('button', { name: /^Take Over/ }).click()
    await expect(page).toHaveURL(/optimize\/intro/)
    await page.getByRole('button', { name: 'Mulai', exact: true }).click()
    await expect(page).toHaveURL(/optimize\/1\?mode=takeover$/)
  }
  const save = () => page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()
  await start()
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()
  await expect(page).toHaveURL(/optimize\/1\/pekerjaan/)
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()
  await expect(page).toHaveURL(/optimize\/2$/)
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
  await save()
  await expect(page.getByRole('heading', { name: 'Tahap 1 selesai' })).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Batal & mulai produk lain' }).click()
  await expect(page.getByText('Data yang sudah kamu isi tetap tersimpan')).toBeVisible()
  await page.getByRole('button', { name: 'Ya, Hapus' }).click()
  await expect(page.getByText('Draft dihapus.')).toBeVisible()

  await start()
  await expect(page.getByLabel('NIK')).not.toHaveValue('') // data pribadi, from the profile
  await save()
  await expect(page).toHaveURL(/optimize\/1\/pekerjaan/)
  await expect(page.getByLabel('Penghasilan bulanan (gross)')).toHaveValue('15.000.000')
  await expect(page.getByLabel('Cicilan kendaraan')).toHaveValue('1.000.000')
  await save()
  await expect(page).toHaveURL(/optimize\/2$/)
  await expect(page.getByLabel('Bunga saat ini')).toHaveValue('10,50')
  await expect(page.getByLabel('Sisa pokok saat ini')).toHaveValue('421.500.000')
  await save()
  await expect(page.getByRole('heading', { name: 'Tahap 1 selesai' })).toBeVisible()
})

test('top-up branch shows gross/net funds and LTV', async ({ page }) => {
  await useScenario(page, 'mortgage_active_floating', '/')
  await openFirstProgram(page, 'topup')
  await expect(page.getByText('Rincian dana Top-up')).toBeVisible()
  await expect(page.getByText('Top-up kotor')).toBeVisible()
  await expect(page.getByText('Dana bersih diterima').first()).toBeVisible()
  await expect(page.getByText(/LTV baru/)).toBeVisible()
})

test('benefit ≤ 0 never shows a positive break-even', async ({ page }) => {
  await useScenario(page, 'takeover_no_break_even', '/')
  await openFirstProgram(page, 'takeover')
  await expect(page.getByText('Tidak ada titik impas')).toBeVisible()
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 320, height: 568 } })
  test('bottom nav works and pages have no horizontal overflow', async ({ page }) => {
    await useScenario(page, 'mortgage_active_h90', '/')
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' }).last()
    await expect(nav.getByRole('link')).toHaveCount(5)
    for (const [label, url] of [['My KPR', /my-kpr/], ['Explore', /explore/], ['Activity', /activity/], ['Profile', /profile/], ['Home', /\/$/]]) {
      await nav.getByRole('link', { name: label }).click()
      await expect(page).toHaveURL(url)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `horizontal overflow on ${label}`).toBeLessThanOrEqual(0)
    }
  })

  // Status steppers scroll sideways; their sr-only labels must not widen the page.
  test('status steppers do not overflow the page', async ({ page }) => {
    for (const scenario of ['application_in_process', 'takeover_in_process']) {
      for (const path of ['/', '/my-kpr/application']) {
        await useScenario(page, scenario, path)
        await expect(page.getByRole('list', { name: /Tahapan pengajuan|Status pengajuan/ }).first()).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `horizontal overflow on ${scenario} ${path}`).toBeLessThanOrEqual(0)
      }
    }
  })
})
