import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

test('reports follow the filters, and the CSV download carries no personal data', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/reports')
  const submitted = page.getByRole('table', { name: 'Tahapan pengajuan' }).getByRole('row', { name: /^Diajukan/ }).getByRole('cell').nth(1)
  await expect(submitted).toHaveText('8')
  await expect(page.getByRole('table', { name: 'Produk paling banyak dipilih' }).getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('4')

  await page.getByLabel('Jenis produk').selectOption({ label: 'Take Over' })
  await expect(submitted).toHaveText('1')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Unduh CSV' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('laporan-pengajuan-2026-08-30-2026-09-28.csv')
  const csv = await readFile(await file.path(), 'utf8')
  expect(csv).toContain('app_sample_05')
  expect(csv).not.toContain('Sari')
})
