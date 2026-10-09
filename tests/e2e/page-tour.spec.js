import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

const tooltip = (page) => page.getByRole('alertdialog')
const next = (page) => tooltip(page).getByRole('button', { name: 'Lanjut' })
const skip = (page) => tooltip(page).getByRole('button', { name: 'Lewati' })
// Longer than PageTour's auto-start delay, so "no tour" is really no tour.
const settle = (page) => page.waitForTimeout(800)

test('fresh home: tour runs once by itself, walks every step, replays from Panduan, Esc ends it', async ({ page }) => {
  await useScenario(page, 'fresh', '/', { tours: true })
  await expect(tooltip(page)).toContainText('Selamat datang di RuangKPR')
  await expect(tooltip(page)).toContainText('1 dari 5')
  for (let i = 0; i < 4; i++) await next(page).click()
  await expect(tooltip(page)).toContainText('5 dari 5')
  await tooltip(page).getByRole('button', { name: 'Selesai' }).click()
  await expect(tooltip(page)).toBeHidden()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sudah punya KPR yang berjalan?' })).toBeVisible()
  await settle(page)
  await expect(tooltip(page)).toBeHidden()

  await page.getByRole('button', { name: 'Panduan halaman ini' }).click()
  await expect(tooltip(page)).toContainText('1 dari 5')
  await page.keyboard.press('Escape')
  await expect(tooltip(page)).toBeHidden()
})

test('dashboard: tour auto-runs; Atur Dashboard runs its own tour once; Batal brings neither back', async ({ page }) => {
  await useScenario(page, 'mortgage_active_normal', '/', { tours: true })
  await expect(tooltip(page)).toContainText('Ringkasan KPR kamu')
  await expect(tooltip(page)).toContainText('1 dari 7')
  await skip(page).click()
  await expect(tooltip(page)).toBeHidden()

  await page.getByRole('button', { name: 'Atur Dashboard' }).click()
  await expect(tooltip(page)).toContainText('Mode Atur Dashboard')
  await expect(tooltip(page)).toContainText('1 dari 5') // desktop grid: no "Sembunyikan" step
  await skip(page).click()
  await page.getByRole('button', { name: 'Batal' }).click()
  await settle(page)
  await expect(tooltip(page)).toBeHidden()
})

test('My KPR and amortization each have their own tour', async ({ page }) => {
  await useScenario(page, 'mortgage_active_normal', '/my-kpr/overview', { tours: true })
  await expect(tooltip(page)).toContainText('Overview')
  await expect(tooltip(page)).toContainText('1 dari 4')
  await skip(page).click()

  await page.goto('/my-kpr/amortization')
  await expect(tooltip(page)).toContainText('Sisa yang akan dibayar')
  await expect(tooltip(page)).toContainText('1 dari 4')
})

test('phone: the menu step points at the bottom bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await useScenario(page, 'fresh', '/', { tours: true })
  await expect(tooltip(page)).toContainText('1 dari 5')
  for (let i = 0; i < 3; i++) await next(page).click()
  await expect(tooltip(page)).toContainText('Menu utama')
  const nav = await page.locator('nav[data-tour="nav"]:visible').boundingBox()
  await expect.poll(async () => {
    const tip = await tooltip(page).boundingBox()
    return tip.y + tip.height <= nav.y
  }).toBe(true)
})
