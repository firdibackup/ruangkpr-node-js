import { expect, test } from '@playwright/test'
import { register, useScenario } from './helpers'

const handoff = mode => '/from-calculator?' + new URLSearchParams({
  source: 'maxi-calculator', v: '1', mode,
  bankId: mode === 'primary' ? 'bnk_abc' : 'bnk_xyz',
  productId: mode === 'primary' ? 'bpr_abc_primary_fix5_v4' : 'bpr_xyz_takeover_fix5_v3',
  productVersion: '1', price: '1000000000', months: '180', income: '0', otherDebt: '0', additionalCosts: '0',
  downPayment: '200000000', outstanding: '500000000', remainingMonths: '180', currentRate: '11', currentPayment: '0',
  fixedMonthsLeft: '0', currentFloatingRate: '11', penaltyRate: '2', exitAdmin: '0', requestedCash: '150000000', purpose: 'renovation',
})

for (const mode of ['primary', 'takeover', 'topup']) {
  test(`calculator ${mode}: bank first with unknown income, refresh and missing data afterwards`, async ({ page }) => {
    await useScenario(page, 'fresh', handoff(mode))
    await expect(page).toHaveURL(mode === 'primary' ? /\/apply\/primary\/5\/bpr_/ : /\/optimize\/programs\/bpr_/)
    await expect(page.getByText('Bagian 1 dari 3 · Pilihan Bank')).toBeVisible()
    await expect(page.getByLabel('NIK', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/penghasilan belum diisi/i).first()).toBeVisible()
    await page.reload()
    if (mode === 'primary') {
      await expect(page.getByText('Rp800.000.000', { exact: true }).first()).toBeVisible()
      await page.getByRole('button', { name: 'Pilih Program & Lanjutkan' }).click()
      await expect(page).toHaveURL(/\/apply\/primary\/3$/)
      await expect(page.getByLabel('Harga Properti')).toHaveValue('1.000.000.000')
    } else {
      await page.getByRole('button', { name: /Pilih.*Program|Ajukan/i }).click()
      await page.getByRole('button', { name: 'Lanjutkan Pengajuan' }).click()
      await expect(page).toHaveURL(/\/optimize\/2$/)
      await expect(page.getByRole('textbox', { name: /Sisa pokok/i })).toHaveValue('500.000.000')
    }
    await page.goto('/')
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
    await expect(page).toHaveURL(mode === 'primary' ? /\/apply\/primary\/3$/ : /\/optimize\/2$/)
  })
}

test('calculator query survives new account registration and OTP', async ({ page }) => {
  await useScenario(page, 'guest', handoff('primary'))
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/register')
  await register(page, { name: 'Nasabah Kalkulator', email: 'calculator@example.com' })
  await page.getByLabel('Digit 1 dari 6').fill('148260')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page).toHaveURL(/\/apply\/primary\/5\/bpr_abc_primary_fix5_v4$/)
  await expect(page.getByText('Bagian 1 dari 3 · Pilihan Bank')).toBeVisible()
})

test('primary calculator: complete property and profile after bank, then documents and submit', async ({ page }) => {
  await useScenario(page, 'fresh', handoff('primary'))
  await page.getByRole('button', { name: 'Pilih Program & Lanjutkan' }).click()
  await expect(page).toHaveURL(/\/apply\/primary\/3$/)
  await page.getByRole('button', { name: 'Isi data contoh' }).click()
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()
  // Changing the example property price requires updating its loan details.
  await expect(page).toHaveURL(/\/apply\/primary\/4$/)
  await page.getByRole('button', { name: 'Isi data contoh' }).click()
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()
  await expect(page).toHaveURL(/\/apply\/primary\/1$/)
  await page.getByRole('button', { name: 'Isi data contoh' }).click()
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()
  await expect(page).toHaveURL(/\/apply\/primary\/2$/)
  await page.getByRole('button', { name: 'Isi data contoh' }).click()
  await page.getByLabel('Penghasilan Bulanan (gross)').fill('100000000')
  await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()
  // Even with a changed quote, the confirmed bank is retained and documents follow directly.
  await expect(page).toHaveURL(/\/apply\/primary\/6$/)
  await page.getByRole('button', { name: 'Isi contoh', exact: true }).click()
  await expect(page.getByText('4 dari 4 terunggah')).toBeVisible({ timeout: 30000 })
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  await expect(page).toHaveURL(/\/apply\/primary\/7$/)
  await page.getByRole('checkbox', { name: /Data yang saya berikan benar/ }).check()
  await page.getByRole('checkbox', { name: /Saya setuju data saya dikirim/ }).check()
  await page.getByRole('button', { name: 'Submit Pengajuan' }).click()
  await expect(page.getByRole('heading', { name: 'Pengajuan berhasil dikirim' })).toBeVisible()
})

for (const mode of ['takeover', 'topup']) test(`${mode} calculator: complete data then go directly to documents`, async ({ page }) => {
  await useScenario(page, 'fresh', handoff(mode))
  await page.getByRole('button', { name: /^Ajukan / }).click()
  await page.getByRole('button', { name: 'Lanjutkan Pengajuan' }).click()
  for (const path of ['/optimize/2', '/optimize/4', '/optimize/1', '/optimize/1/pekerjaan']) {
    await expect(page).toHaveURL(new RegExp(path + '$'))
    await page.getByRole('button', { name: 'Isi contoh data' }).click()
    if (path.endsWith('pekerjaan')) await page.getByLabel('Penghasilan bulanan (gross)').fill('100000000')
    await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click()
  }
  await expect(page).toHaveURL(/\/optimize\/6$/)
})

test('calculator program details fit desktop and mobile', async ({ page }) => {
  for (const mode of ['primary', 'topup']) {
    await useScenario(page, 'fresh', handoff(mode))
    await expect(page.getByText('Bagian 1 dari 3 · Pilihan Bank')).toBeVisible()
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `C:/Users/jayac/AppData/Local/Temp/opencode/calculator-${mode}-${width}.png`, fullPage: true })
    }
  }
})
