import { expect, test } from '@playwright/test'
import { signIn, useScenario } from './helpers'

const adminNav = (page) => page.getByRole('navigation', { name: 'Navigasi admin' })

test('a regular user gets a 403 page at /admin, never the admin navigation', async ({ page }) => {
  await useScenario(page, 'fresh', '/admin')
  await expect(page.getByRole('heading', { name: 'Halaman ini khusus admin' })).toBeVisible()
  await expect(adminNav(page)).toHaveCount(0)
})

test('a guest opening /admin is sent to sign in', async ({ page }) => {
  await useScenario(page, 'guest', '/admin')
  await expect(page).toHaveURL(/\/login$/)
})

test('the admin signs in with email and password, lands on /admin without B2C navigation, and survives a refresh', async ({ page }) => {
  await useScenario(page, 'guest', '/login')
  await signIn(page, 'Admin Maxi', 'admin@ruangkpr.id')

  await expect(page).toHaveURL(/\/admin$/)
  await expect(adminNav(page)).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toHaveCount(0)
  await page.reload()
  await expect(adminNav(page)).toBeVisible()
})

test('super admin is kept out of B2C pages; unknown admin pages stay inside the admin layout; Keluar signs out', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/my-kpr')
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto('/admin/tidak-ada')
  await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible()
  await expect(adminNav(page)).toBeVisible()
  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('overview lists the team queue longest-waiting first and recovers from a failed load', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/tidak-ada')
  // Arm the failure in this page's module state, then navigate in-app so it is not reloaded away.
  await page.evaluate(() => window.__ruangkpr.failNext('admin.overview.get'))
  await page.getByRole('link', { name: 'Kembali ke Overview' }).click()
  await expect(page.getByText('Data gagal dimuat.')).toBeVisible()
  await page.getByRole('button', { name: 'Coba Lagi' }).click()

  const queue = page.getByRole('table', { name: 'Perlu tindakan tim' })
  await expect(queue.getByRole('row').nth(1)).toContainText('Agus Pratama')
  await expect(queue.getByRole('row').nth(1)).toContainText('14 hari')
  await expect(page.getByRole('table', { name: 'Produk bank' }).getByText('Data usang')).toBeVisible()
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 320, height: 568 } })
  test('admin navigation and Keluar stay reachable; the loaded overview never scrolls sideways', async ({ page }) => {
    await useScenario(page, 'admin_ops', '/admin')
    await expect(adminNav(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keluar admin' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Perlu tindakan tim' })).toBeVisible() // measure with the data in place
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
