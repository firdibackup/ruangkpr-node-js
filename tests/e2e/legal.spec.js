import { expect, test } from '@playwright/test'

const documents = [
  ['legalitas', 'Legalitas'],
  ['kebijakan-privasi', 'Kebijakan Privasi'],
  ['syarat-dan-ketentuan', 'Syarat & Ketentuan'],
  ['kebijakan-keamanan-informasi', 'Kebijakan Keamanan Informasi'],
]

for (const width of [1440, 390]) {
  test(`legal documents are public and readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const [slug, title] of documents) {
      await page.goto(`/legal/${slug}`)
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Daftar isi' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await page.screenshot({ path: `test-results/legal-${width}.png`, fullPage: true })
  })
}

test('unknown legal document has a recovery link', async ({ page }) => {
  await page.goto('/legal/constructor')
  await expect(page.getByRole('heading', { name: 'Dokumen tidak ditemukan' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ke aplikasi' })).toBeVisible()
})
