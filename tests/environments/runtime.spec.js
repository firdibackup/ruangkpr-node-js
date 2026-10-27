import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // These checks exercise built frontends against a deterministic, unauthenticated backend.
  await page.route('https://backend.test/**', (route) => {
    const settings = route.request().url().includes('/auth/v1/settings')
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings ? { external: { google: false } } : null) })
  })
})

test('the built login exposes demo only on staging', async ({ page }, testInfo) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible()
  const demo = page.getByRole('button', { name: 'Demo KPR Primary' })
  if (testInfo.project.name === 'staging') {
    await expect(demo).toBeVisible()
    // Normal staging sessions do not show mock credentials or scenario controls.
    await expect(page.getByText(/akun contoh memakai password/)).toHaveCount(0)
  } else {
    await expect(demo).toHaveCount(0)
    await expect(page.getByText(/mode demo/i)).toHaveCount(0)
  }
})

test('production ignores stale demo state and uses real authentication', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'production')
  await page.addInitScript(() => {
    sessionStorage.setItem('ruangkpr:demo', '1')
    localStorage.setItem('ruangkpr:prototype:v1', JSON.stringify({ schemaVersion: 6, session: { status: 'authenticated' }, user: { name: 'Demo User' } }))
  })
  await page.goto('/apply/primary/1')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('button', { name: 'Demo KPR Primary' })).toHaveCount(0)
  await expect(page.getByText('Demo User')).toHaveCount(0)
  expect(await page.evaluate(() => typeof window.__ruangkpr)).toBe('undefined')
  await page.route('https://backend.test/auth/v1/token*', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }) }))
  await page.getByLabel('Email', { exact: true }).fill('user@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  const request = page.waitForRequest((r) => r.url().includes('/auth/v1/token'))
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  expect((await request).method()).toBe('POST')
})
