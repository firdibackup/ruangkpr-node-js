import { expect, test } from '@playwright/test'
import { signIn, useScenario } from './helpers'

test('a content writer signs in to Articles only; other admin pages refuse and B2C pages send them back', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  await signIn(page, 'Penulis Konten', 'penulis@ruangkpr.id')
  await expect(page).toHaveURL(/\/admin\/articles$/)
  await expect(page.getByRole('navigation', { name: 'Navigasi admin' }).getByRole('link')).toHaveText(['Articles'])
  await expect(page.getByText('Content writer', { exact: true }).first()).toBeVisible()

  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Halaman ini di luar akses kamu' })).toBeVisible()
  await page.getByRole('link', { name: 'Kembali ke Articles' }).click()
  await expect(page.getByRole('table', { name: 'Daftar artikel' })).toBeVisible()

  for (const path of ['/admin', '/my-kpr']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/admin\/articles$/)
  }
})
