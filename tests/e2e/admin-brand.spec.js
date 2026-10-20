import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

// Brand CMS (spec 2026-10-20): the super admin drafts a brand, walks the user pages with it, publishes it, and a
// visitor who is not signed in gets it from the first render; resetting brings back the files' look.
const rootVar = (page, name) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name)

test('a draft brand is previewed on the whole site and published for every visitor', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/brand')
  await expect(page.getByRole('heading', { name: 'Brand', exact: true })).toBeVisible()
  await expect(page.getByText('Semua teks dan kontrol terbaca.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()

  await page.getByLabel('Warna utama', { exact: true }).fill('#7c3aed')
  await page.getByLabel('Font judul').selectOption('Sora')
  await page.getByRole('button', { name: 'Simpan draft' }).click()
  await expect(page.getByText('Draft brand tersimpan.')).toBeVisible()

  // The admin walks the user pages with the draft; nobody else sees it.
  await page.getByRole('button', { name: 'Pratinjau di seluruh situs' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('status').filter({ hasText: 'Pratinjau draft brand' })).toBeVisible()
  expect(await rootVar(page, '--primary')).toBe('#7c3aed')
  await page.getByRole('button', { name: 'Kembali ke editor' }).click()
  await expect(page).toHaveURL(/\/admin\/brand$/)

  await page.getByRole('button', { name: 'Publish' }).click()
  await page.getByLabel('Alasan').fill('Rebrand ungu')
  await page.getByRole('button', { name: 'Ya, publish' }).click()
  await expect(page.getByText('Brand terbit untuk semua pengunjung.')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Pratinjau draft brand' })).toHaveCount(0)

  // A visitor who is not signed in gets the published brand from the first render.
  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible()
  expect(await rootVar(page, '--primary')).toBe('#7c3aed')
  expect(await rootVar(page, '--heading-font')).toContain('Sora')
})

test('reset brings every visitor back to the files’ look', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/brand')
  await page.getByLabel('Warna utama', { exact: true }).fill('#be123c')
  await page.getByRole('button', { name: 'Simpan draft' }).click()
  await expect(page.getByText('Draft brand tersimpan.')).toBeVisible()
  await page.getByRole('button', { name: 'Publish' }).click()
  await page.getByLabel('Alasan').fill('Coba merah')
  await page.getByRole('button', { name: 'Ya, publish' }).click()
  await expect(page.getByText('Brand terbit untuk semua pengunjung.')).toBeVisible()
  expect(await rootVar(page, '--primary')).toBe('#be123c')

  await page.getByRole('button', { name: 'Kembalikan ke default' }).click()
  await page.getByLabel('Alasan').fill('Kembali ke teal')
  await page.getByRole('button', { name: 'Ya, kembalikan' }).click()
  await expect(page.getByText('Brand kembali ke tampilan default.')).toBeVisible()
  expect(await rootVar(page, '--primary')).toBe('')
  await page.reload()
  expect(await rootVar(page, '--primary')).toBe('')
})
