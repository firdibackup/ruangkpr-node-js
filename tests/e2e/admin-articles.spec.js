import { expect, test } from '@playwright/test'
import { signIn, useScenario } from './helpers'

test('admin writes an article with a live preview and publishes it; a user then reads it on the education page', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/articles')
  await page.getByRole('link', { name: 'Artikel baru' }).click()
  await page.getByLabel('Judul').fill('Cara membaca SLIK OJK')
  await page.getByLabel('Slug').fill('cara-membaca-slik')
  await page.getByLabel('Tag').fill('Persiapan')
  await page.getByLabel('Ikon').selectOption({ label: 'Struk (biaya)' })
  await page.getByLabel('Ringkasan').fill('Riwayat kredit yang dicek bank sebelum menyetujui KPR.')
  await page.getByLabel('Menit baca').fill('3')
  await page.getByLabel('Isi artikel').fill('SLIK mencatat riwayat cicilan kamu.\n\nLunasi tunggakan kecil sebelum mengajukan KPR.')
  await expect(page.getByRole('region', { name: 'Pratinjau' })).toContainText('Lunasi tunggakan kecil sebelum mengajukan KPR.')
  await page.getByRole('button', { name: 'Simpan draft' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cara membaca SLIK OJK' })).toBeVisible()

  await page.getByRole('button', { name: 'Terbitkan' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Konten edukasi baru')
  await page.getByRole('button', { name: 'Ya, terbitkan' }).click()
  await expect(page.getByText('Terbit · tampil di Explore')).toBeVisible()

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Firdi Audi', 'firdi.audi@email.com')
  await page.goto('/education/cara-membaca-slik')
  await expect(page.getByText('Lunasi tunggakan kecil sebelum mengajukan KPR.')).toBeVisible()
})
