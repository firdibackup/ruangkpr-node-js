import { expect } from '@playwright/test'

// Dev-only hook exposed by DevPanel (never in production builds). Page tours start as already seen so
// their overlay never blocks a journey; pass { tours: true } to let them auto-run.
export async function useScenario(page, scenario, path = '/', { tours = false } = {}) {
  await page.goto('/register')
  await page.waitForFunction(() => window.__ruangkpr)
  await page.evaluate(
    ([s, t]) => {
      window.__ruangkpr.reset(s)
      if (!t) window.__ruangkpr.seeAllTours()
    },
    [scenario, tours],
  )
  await page.goto(path)
}

export const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 mock') })

// From the sign-in page: email → OTP 148260 → consent on first sign-in. One browser keeps every account.
export async function signIn(page, name, email) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Kirim kode' }).click()
  await page.getByLabel('Digit 1 dari 6').fill('148260')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await page.waitForURL((url) => !/\/(register|verify)$/.test(url.pathname))
  if (new URL(page.url()).pathname === '/welcome') {
    await page.getByLabel('Nama Lengkap').fill(name)
    await page.getByRole('checkbox', { name: /Syarat & Ketentuan/ }).check()
    await page.getByRole('checkbox', { name: /Kebijakan Privasi/ }).check()
    await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click()
    await expect(page).not.toHaveURL(/\/welcome$/)
  }
}

export async function fillMoney(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value))
}

export async function expectNoSecondary(page) {
  await expect(page.locator('body')).not.toContainText(/secondary/i)
}
