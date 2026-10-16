import { expect } from '@playwright/test'

// Seeded and staff accounts in the mock (src/data/seed.js DEMO_PASSWORD).
export const DEMO_PASSWORD = 'ruangkpr123'

// Dev-only hook exposed by DevPanel (never in production builds). Page tours start as already seen so
// their overlay never blocks a journey; pass { tours: true } to let them auto-run.
export async function useScenario(page, scenario, path = '/', { tours = false } = {}) {
  await page.goto('/login')
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

// From the login page: an account this browser knows signs in with the demo password; consent on first sign-in.
export async function signIn(page, name, email) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => !/\/login$/.test(url.pathname))
  if (new URL(page.url()).pathname === '/welcome') {
    await page.getByLabel('Nama Lengkap').fill(name)
    await page.getByRole('checkbox', { name: /Syarat & Ketentuan dan Kebijakan Privasi/ }).check()
    await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click()
    await expect(page).not.toHaveURL(/\/welcome$/)
  }
}

// Fills and sends the /register form (the code page follows unless the email already has an account).
export async function register(page, { name, email, password = 'rumah2026' }) {
  await page.getByLabel('Nama Lengkap').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Ulangi password', { exact: true }).fill(password)
  await page.getByRole('checkbox', { name: /Syarat & Ketentuan dan Kebijakan Privasi/ }).check()
  await page.getByRole('button', { name: 'Daftar', exact: true }).click()
}

export async function fillMoney(page, label, value) {
  await page.getByLabel(label, { exact: true }).fill(String(value))
}

export async function expectNoSecondary(page) {
  await expect(page.locator('body')).not.toContainText(/secondary/i)
}
