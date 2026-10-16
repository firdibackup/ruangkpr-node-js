import { expect, test } from '@playwright/test'
import { signIn, useScenario } from './helpers'

test('a new KPR Health formula is previewed, published with a reason, and users are scored by it', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await page.getByRole('link', { name: 'Atur formula KPR Health' }).click()
  await page.getByLabel('Bobot Beban cicilan').fill('3')
  await page.getByRole('button', { name: 'Pratinjau dampak' }).click()
  await expect(page.getByRole('table', { name: 'Dampak ke contoh' }).getByRole('row', { name: /Rasio cicilan 48%/ })).toBeVisible()
  await page.getByRole('button', { name: 'Terbitkan versi 2' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Beban cicilan paling menentukan')
  await page.getByRole('button', { name: 'Ya, terbitkan' }).click()
  await expect(page.getByText('Versi 2 berlaku')).toBeVisible()

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Yoga Saputra', 'yoga.saputra@example.com')
  await page.goto('/my-kpr/health')
  await expect(page.getByText(/formula KPR Health versi 2/)).toBeVisible()
})

test('upload limits are saved with a reason and land in the admin activity', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await page.getByLabel('Ukuran maksimal').fill('2')
  await page.getByRole('checkbox', { name: 'PDF' }).click()
  await page.getByRole('button', { name: 'Simpan batas unggah' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Batas bank mitra')
  await page.getByRole('button', { name: 'Ya, simpan' }).click()
  await expect(page.getByText('JPG atau PNG · maks 2MB')).toBeVisible()
  await page.goto('/admin')
  await expect(page.getByRole('list', { name: 'Aktivitas admin terbaru' })).toContainText('Ubah konfigurasi')
})

test('the CS contact is saved with a reason; the tracker opens WhatsApp and the booking page with the user and their email filled in', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await page.getByLabel('Nomor WhatsApp CS').fill('0812 3456 7890')
  await page.getByRole('button', { name: 'Simpan kontak CS' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Nomor CS baru')
  await page.getByRole('button', { name: 'Ya, simpan' }).click()
  await expect(page.getByLabel('Nomor WhatsApp CS')).toHaveValue('6281234567890')

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Firdi Audi', 'firdi.audi@email.com')
  await page.goto('/my-kpr/application')
  await page.getByRole('button', { name: 'Hubungi CS' }).click()
  const dialog = page.getByRole('dialog', { name: 'Hubungi CS RuangKPR' })
  await expect(dialog.getByRole('link', { name: 'Chat WhatsApp' })).toHaveAttribute('href', 'https://wa.me/6281234567890?text=Halo%20CS%20RuangKPR%2C%20saya%20Firdi%20Audi.%0AEmail%20akun%3A%20firdi.audi%40email.com%0ASaya%20ingin%20bertanya%20tentang%20pengajuan%20KPR%20Primary%20di%20Bank%20ABC.')
  await expect(dialog.getByRole('link', { name: 'Jadwalkan Konsultasi Live' })).toHaveAttribute(
    'href',
    'https://cal.com/creative-karsindo-wr7vhx/konsultasi-kpr?name=Firdi+Audi&email=firdi.audi%40email.com&notes=Konsultasi+pengajuan+KPR+Primary+di+Bank+ABC.',
  )
  await expect(dialog).toContainText('Atau email cs@ruangkpr.id dari firdi.audi@email.com')
  await expect(dialog).not.toContainText('app_')

  // The email in the message finds the application in the admin queue.
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Keluar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keluar' }).click()
  await signIn(page, 'Admin RuangKPR', 'admin@ruangkpr.id')
  await page.goto('/admin/applications')
  await page.getByLabel('Cari pengajuan').fill('firdi.audi@email.com')
  await expect(page.getByRole('table', { name: 'Antrean pengajuan' }).getByRole('link')).toHaveText(['Firdi Audi'])
})

test('the consultation calendar shows on Jadwal once its Google Calendar ID is saved', async ({ page }) => {
  await page.route('https://calendar.google.com/**', (route) => route.abort())
  await useScenario(page, 'admin_ops', '/admin/schedule')
  await expect(page.getByRole('heading', { name: 'Kalender belum diatur' })).toBeVisible()
  await page.getByRole('link', { name: 'Atur di Configuration' }).click()
  await page.getByLabel('Calendar ID Google').fill('tim.cs@gmail.com')
  await page.getByRole('button', { name: 'Simpan kontak CS' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Kalender marketing')
  await page.getByRole('button', { name: 'Ya, simpan' }).click()
  await expect(page.getByText('Kontak CS tersimpan.')).toBeVisible()

  await page.getByRole('navigation', { name: 'Navigasi admin' }).getByRole('link', { name: 'Jadwal' }).click()
  await expect(page.locator('iframe[title="Kalender konsultasi"]')).toHaveAttribute('src', /^https:\/\/calendar\.google\.com\/calendar\/embed\?src=tim\.cs%40gmail\.com&ctz=Asia%2FJakarta&/)
  await expect(page.getByRole('link', { name: 'Kelola booking di cal.com' })).toHaveAttribute('href', 'https://app.cal.com/bookings/upcoming')
})
