import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

// All data filled, so Peluang and Health are unlocked and lead the default board.
const DEFAULT = ['Peluang KPR', 'Pembayaran Berikutnya', 'KPR Health', 'Jadwal Amortisasi', 'KPR Saya', 'Agenda terdekat']
const widget = (page, name) => page.getByRole('group', { name, exact: true })
const width = async (locator) => (await locator.boundingBox()).width
const fontSize = (locator) => locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
// Grid cells animate to their new size; wait for the CSS transition before measuring or dragging.
const settled = (locator) => locator.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
async function drag(page, handle, dx, dy) {
  const box = await handle.boundingBox()
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  await page.mouse.up()
}

test('home widgets: default board fits; hide, add, resize by keyboard and drag; saved across reloads; reset', async ({ page }) => {
  await useScenario(page, 'mortgage_active_normal', '/')
  await expect(page.getByText('POTENSI REFINANCING')).toBeVisible() // Peluang finished loading

  // Every widget on the default board fits its cell without scrolling.
  for (const name of DEFAULT) {
    const body = widget(page, name).locator(':scope > div:first-child > *')
    expect(await body.evaluate((el) => el.scrollHeight - el.clientHeight), name).toBeLessThanOrEqual(1)
  }
  // Figures keep their base size on the default board.
  expect(await fontSize(widget(page, 'Pembayaran Berikutnya').getByText('Rp4.127.324'))).toBe(28)

  await page.getByRole('button', { name: 'Atur Dashboard' }).click()
  await page.getByRole('button', { name: 'Atur Agenda terdekat' }).click()
  await page.getByRole('menuitem', { name: 'Sembunyikan' }).click()
  await expect(widget(page, 'Agenda terdekat')).toHaveCount(0)

  // Unsaved edits are not lost by accident.
  await page.getByRole('link', { name: 'Explore' }).click()
  await expect(page.getByRole('alertdialog', { name: 'Perubahan belum disimpan.' })).toBeVisible()
  await page.getByRole('button', { name: 'Tetap di Halaman' }).click()

  await page.getByRole('button', { name: 'Tambah widget' }).click()
  const picker = page.getByRole('dialog', { name: 'Tambah widget' })
  await picker.getByRole('button', { name: 'Tambah Sisa Pokok' }).click()
  await expect(picker).toBeHidden()
  const tile = widget(page, 'Sisa Pokok')
  // It fills the gap Agenda left under Jadwal Amortisasi instead of growing the board.
  expect((await tile.boundingBox()).x).toBeCloseTo((await widget(page, 'Jadwal Amortisasi').boundingBox()).x, 0)
  const start = await width(tile)

  // Keyboard: the ⋯ menu widens the widget by one column (here up to the grid's right edge).
  await page.getByRole('button', { name: 'Atur Sisa Pokok' }).press('Enter')
  await page.getByRole('menuitem', { name: 'Perlebar' }).press('Enter')
  await expect.poll(() => width(tile)).toBeGreaterThan(start)
  await settled(tile)

  // Pointer: the bottom-right corner pulls it taller, the top-left corner wider to the left; both snap to the grid.
  const before = await tile.boundingBox()
  await drag(page, tile.locator(':scope > .react-resizable-handle-se'), 0, 160)
  await expect.poll(async () => (await tile.boundingBox()).height).toBeGreaterThan(before.height + 100)
  await settled(tile)
  const taller = await tile.boundingBox()
  await drag(page, tile.locator(':scope > .react-resizable-handle-nw'), -190, 0)
  await expect.poll(() => width(tile)).toBeGreaterThan(taller.width + 100)
  await settled(tile)
  expect((await tile.boundingBox()).x).toBeLessThan(taller.x)
  // A cell grown on both sides zooms its key figure a little.
  expect(await fontSize(tile.getByText(/^Rp517\./))).toBeGreaterThan(28)
  const saved = await tile.boundingBox()

  await page.getByRole('button', { name: 'Simpan' }).click()
  await expect(page.getByText('Susunan dashboard disimpan.')).toBeVisible()

  await page.reload()
  await expect(tile).toBeVisible()
  const reloaded = await tile.boundingBox()
  expect([reloaded.width, reloaded.height]).toEqual([saved.width, saved.height])
  await expect(widget(page, 'Agenda terdekat')).toHaveCount(0)

  await page.getByRole('button', { name: 'Atur Dashboard' }).click()
  await page.getByRole('button', { name: 'Reset ke default' }).click()
  await page.getByRole('button', { name: 'Simpan' }).click()
  await expect(widget(page, 'Agenda terdekat')).toBeVisible()
  await expect(tile).toHaveCount(0)
})

test('gallery: live previews per tab; a widget missing data unlocks via its form; charts are opt-in', async ({ page }) => {
  await useScenario(page, 'mortgage_partial_property', '/')
  await expect(widget(page, 'Agenda terdekat')).toBeVisible()
  await expect(page.locator('main .recharts-surface')).toHaveCount(0) // default board has no charts
  await page.getByRole('button', { name: 'Atur Dashboard' }).click()
  await page.getByRole('button', { name: 'Tambah widget' }).click()
  const gallery = page.getByRole('dialog', { name: 'Tambah widget' })
  await expect(gallery.getByRole('button', { name: 'Tambah KPR Health' })).toHaveCount(0) // already on the board
  await gallery.getByRole('tab', { name: 'Angka' }).click()

  // Equity needs the property value: no Tambah, the card points to the missing data instead.
  await expect(gallery.getByRole('button', { name: 'Tambah Equity Rumah' })).toHaveCount(0)
  await expect(gallery.getByText('Butuh nilai properti')).toBeVisible()
  await gallery.getByRole('button', { name: 'Lengkapi data untuk Equity Rumah' }).click()
  const property = page.getByRole('dialog', { name: 'Data properti' })
  await property.getByLabel('Estimasi nilai saat ini').fill('850000000')
  await property.getByRole('button', { name: 'Simpan Data Properti' }).click()
  await expect(property).toBeHidden()

  await page.getByRole('button', { name: 'Tambah widget' }).click()
  await gallery.getByRole('tab', { name: 'Angka' }).click()
  await gallery.getByRole('button', { name: 'Tambah Equity Rumah' }).click()
  await expect(widget(page, 'Equity Rumah')).toContainText('rumah sudah milik kamu')

  await page.getByRole('button', { name: 'Tambah widget' }).click()
  await gallery.getByRole('tab', { name: 'Grafik' }).click()
  await expect(gallery.locator('.recharts-surface')).toHaveCount(5) // live chart previews
  await gallery.getByRole('button', { name: 'Tambah Proyeksi Sisa Pokok' }).click()
  await expect(widget(page, 'Proyeksi Sisa Pokok').locator('.recharts-surface')).toBeVisible()
  await page.getByRole('button', { name: 'Simpan' }).click()
  await expect(page.getByText('Susunan dashboard disimpan.')).toBeVisible()

  await page.reload()
  await expect(widget(page, 'Proyeksi Sisa Pokok').locator('.recharts-surface')).toBeVisible()
  await expect(widget(page, 'Equity Rumah')).toBeVisible()
})

test('phone: widgets stack in reading order at natural height; hiding still works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await useScenario(page, 'mortgage_active_normal', '/')
  await expect(widget(page, 'Agenda terdekat')).toBeVisible()
  const tops = []
  for (const name of DEFAULT) tops.push((await widget(page, name).boundingBox()).y)
  expect(tops).toEqual([...tops].sort((a, b) => a - b))
  expect(await fontSize(widget(page, 'Pembayaran Berikutnya').getByText('Rp4.127.324'))).toBe(28) // no zoom in the list

  await page.getByRole('button', { name: 'Atur Dashboard' }).click()
  await expect(page.getByRole('button', { name: 'Atur KPR Health' })).toHaveCount(0) // no move/resize menu on a phone
  await page.getByRole('button', { name: 'Sembunyikan KPR Health' }).click()
  await page.getByRole('button', { name: 'Simpan' }).click()
  await expect(widget(page, 'KPR Health')).toHaveCount(0)
})
