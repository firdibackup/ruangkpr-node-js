import { bottom, cloneLayout, getFirstCollision, getLayoutItem, moveElement, verticalCompactor } from 'react-grid-layout/core'

// Home widget board model, shared by the board UI and mockApi validation. Units are grid cells:
// a widget h rows tall is h·ROW_HEIGHT + (h−1)·GAP px.
export const COLS = 12
export const ROW_HEIGHT = 30
export const GAP = 20
export const MAX_H = 16
// Narrower boards show one natural-height column in reading order; sizes only apply to the grid.
export const GRID_MIN_WIDTH = 900

// Gallery tabs. `ownLock` widgets draw their own locked state; every other lockable widget gets the
// shared one (see widgets/widgetData.js widgetLock).
export const CATEGORIES = [
  { id: 'summary', label: 'Ringkasan' },
  { id: 'chart', label: 'Grafik' },
  { id: 'figure', label: 'Angka' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'activity', label: 'Pengingat' },
]

export const WIDGETS = [
  { id: 'opportunity', category: 'summary', ownLock: true, title: 'Peluang KPR', description: 'Potensi Take Over dan Refinancing dari KPR kamu.', w: 7, h: 12, minW: 5, minH: 8 },
  { id: 'health', category: 'summary', ownLock: true, title: 'KPR Health', description: 'Skor kesehatan KPR dan penyebab utamanya.', w: 5, h: 5, minW: 4, minH: 4 },
  { id: 'nextPayment', category: 'summary', title: 'Pembayaran Berikutnya', description: 'Cicilan dan tanggal jatuh tempo terdekat.', w: 5, h: 5, minW: 4, minH: 5 },
  { id: 'amortization', category: 'summary', title: 'Jadwal Amortisasi', description: 'Pokok dan bunga cicilan berikutnya.', w: 5, h: 8, minW: 4, minH: 7 },
  { id: 'myKpr', category: 'summary', title: 'KPR Saya', description: 'Ringkasan bank, sisa pokok, bunga, dan tenor.', w: 7, h: 12, minW: 4, minH: 7 },
  { id: 'agenda', category: 'summary', title: 'Agenda terdekat', description: 'Pengingat yang perlu kamu siapkan.', w: 5, h: 6, minW: 4, minH: 6 },
  { id: 'outstanding', category: 'summary', title: 'Sisa Pokok', description: 'Sisa pokok pinjaman kamu saat ini.', w: 4, h: 4, minW: 3, minH: 4 },
  { id: 'rate', category: 'summary', title: 'Bunga & Masa Fixed', description: 'Bunga berjalan dan kapan masa fixed berakhir.', w: 4, h: 4, minW: 3, minH: 4 },
  { id: 'progress', category: 'summary', title: 'Progres Pelunasan', description: 'Persentase pokok yang sudah lunas.', w: 4, h: 4, minW: 3, minH: 4 },
  { id: 'balanceProjection', category: 'chart', title: 'Proyeksi Sisa Pokok', description: 'Jalur sisa pokok dari sekarang sampai lunas.', w: 7, h: 7, minW: 5, minH: 6 },
  { id: 'amortizationChart', category: 'chart', title: 'Grafik Amortisasi', description: 'Pokok vs bunga tiap cicilan dan sisa pokok sampai lunas.', w: 7, h: 8, minW: 5, minH: 7 },
  { id: 'floatingImpact', category: 'chart', title: 'Dampak Floating', description: 'Cicilan sekarang dibanding setelah masa fixed berakhir.', w: 5, h: 6, minW: 4, minH: 5 },
  { id: 'paymentSplit', category: 'chart', title: 'Komposisi Cicilan', description: 'Porsi pokok dan bunga di cicilan berikutnya.', w: 4, h: 6, minW: 4, minH: 5 },
  { id: 'yearlyBreakdown', category: 'chart', title: 'Pokok vs Bunga per Tahun', description: 'Pembayaran pokok dan bunga 10 tahun ke depan.', w: 7, h: 7, minW: 5, minH: 6 },
  { id: 'interestLeft', category: 'figure', title: 'Total Bunga Tersisa', description: 'Total bunga yang masih akan dibayar sampai lunas.', w: 4, h: 4, minW: 3, minH: 4 },
  { id: 'equity', category: 'figure', title: 'Equity Rumah', description: 'Bagian rumah yang sudah jadi milik kamu.', w: 4, h: 5, minW: 3, minH: 5 },
  { id: 'dti', category: 'figure', title: 'Rasio Cicilan', description: 'Porsi cicilan dan utang dari penghasilan bulanan.', w: 4, h: 5, minW: 3, minH: 5 },
  { id: 'journey', category: 'timeline', title: 'Perjalanan KPR', description: 'Dari akad, periode bunga, sampai perkiraan lunas.', w: 5, h: 8, minW: 4, minH: 7 },
  { id: 'fixedCountdown', category: 'timeline', title: 'Hitung Mundur Fixed', description: 'Sisa hari masa fixed dan tahapan pengingatnya.', w: 5, h: 5, minW: 4, minH: 5 },
  { id: 'paymentHistory', category: 'timeline', title: 'Riwayat Pembayaran', description: 'Status cicilan 3 bulan terakhir dan 3 bulan ke depan.', w: 6, h: 5, minW: 4, minH: 5 },
  { id: 'reminders', category: 'activity', title: 'Pengingat Aktif', description: 'Pengingat terdekat dan kanal pengirimannya.', w: 5, h: 6, minW: 4, minH: 5 },
  { id: 'recentActivity', category: 'activity', title: 'Aktivitas Terbaru', description: 'Notifikasi terbaru tentang KPR kamu.', w: 5, h: 6, minW: 4, minH: 6 },
  { id: 'reading', category: 'activity', title: 'Bacaan Untukmu', description: 'Artikel yang relevan dengan kondisi KPR kamu.', w: 5, h: 6, minW: 4, minH: 5 },
]
export const WIDGET = Object.fromEntries(WIDGETS.map((w) => [w.id, w]))

// The board a user who never customised it sees (WidgetBoard picks one by data). While Peluang or Health is
// locked, the KPR itself comes first: KPR Saya → Peluang on the left, Pembayaran → Amortisasi → Health → Agenda.
export const DEFAULT_LAYOUT = [
  { i: 'myKpr', x: 0, y: 0, w: 7, h: 12 },
  { i: 'nextPayment', x: 7, y: 0, w: 5, h: 5 },
  { i: 'amortization', x: 7, y: 5, w: 5, h: 8 },
  { i: 'opportunity', x: 0, y: 12, w: 7, h: 12 },
  { i: 'health', x: 7, y: 13, w: 5, h: 5 },
  { i: 'agenda', x: 7, y: 18, w: 5, h: 6 },
]
// Once both unlock they lead: Peluang → KPR Saya on the left, Pembayaran → Health → Amortisasi → Agenda.
export const UNLOCKED_LAYOUT = [
  { i: 'opportunity', x: 0, y: 0, w: 7, h: 11 },
  { i: 'nextPayment', x: 7, y: 0, w: 5, h: 5 },
  { i: 'health', x: 7, y: 5, w: 5, h: 5 },
  { i: 'amortization', x: 7, y: 10, w: 5, h: 8 },
  { i: 'myKpr', x: 0, y: 11, w: 7, h: 12 },
  { i: 'agenda', x: 7, y: 18, w: 5, h: 6 },
]

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const int = (v, fallback) => (Number.isInteger(v) ? v : fallback)
const pick = ({ i, x, y, w, h }) => ({ i, x, y, w, h })
// The compactor can shift input items while resolving collisions, so it always gets a copy.
const compact = (layout) => verticalCompactor.compact(cloneLayout(layout), COLS).map(pick)

// Drops unknown and duplicate widgets, clamps sizes to each widget's limits, then closes gaps and overlaps.
// Anything that isn't an array (never saved, corrupted) falls back to the default board.
export function normalizeLayout(raw) {
  if (!Array.isArray(raw)) return DEFAULT_LAYOUT.map(pick)
  const items = []
  for (const l of raw) {
    const meta = WIDGET[l?.i]
    if (!meta || items.some((o) => o.i === l.i)) continue
    const w = clamp(int(l.w, meta.w), meta.minW, COLS)
    items.push({ i: l.i, x: clamp(int(l.x, 0), 0, COLS - w), y: Math.max(int(l.y, bottom(items)), 0), w, h: clamp(int(l.h, meta.h), meta.minH, MAX_H) })
  }
  return compact(items)
}

// Content zoom for a grid cell, as a font-size its em-sized figures follow: 16px (1×) at the widget's default
// size on the widest board (content is at most 1120px wide), up to 22px (1.375×) as the cell grows. The side
// that grew least sets the zoom, so scaled content still fits.
const WIDEST_COL = (1120 - (COLS - 1) * GAP) / COLS
// Pixel size of a widget's default cell on the widest board; the gallery renders previews at this size.
export function defaultCellSize(id) {
  const { w, h } = WIDGET[id]
  return { width: w * WIDEST_COL + (w - 1) * GAP, height: h * ROW_HEIGHT + (h - 1) * GAP }
}
export function contentZoom(id) {
  const { width, height } = defaultCellSize(id)
  return `clamp(16px, min(${(1600 / width).toFixed(3)}cqi, ${(1600 / height).toFixed(3)}cqb), 22px)`
}

export const readingOrder = (layout) => [...layout].sort((a, b) => a.y - b.y || a.x - b.x)

const key = (layout) =>
  layout
    .map((l) => `${l.i}:${l.x},${l.y},${l.w},${l.h}`)
    .sort()
    .join('|')
export const sameLayout = (a, b) => key(a) === key(b)

// A new widget takes the first free spot it fits in reading order, so it fills gaps before growing the board.
export function addWidget(layout, id) {
  const { w, h } = WIDGET[id]
  for (let y = 0; ; y++) {
    for (let x = 0; x + w <= COLS; x++) {
      if (!getFirstCollision(layout, { i: id, x, y, w, h })) return compact([...layout, { i: id, x, y, w, h }])
    }
  }
}

export const removeWidget = (layout, id) => compact(layout.filter((l) => l.i !== id))

// Keyboard twin of dragging: up/down trade places with the nearest widget that way, left/right shift one column.
export function moveWidget(layout, id, dir) {
  const next = cloneLayout(layout)
  const l = getLayoutItem(next, id)
  const inColumn = (o) => o.i !== id && o.x < l.x + l.w && l.x < o.x + o.w
  let { x, y } = l
  if (dir === 'up') {
    const above = next.filter((o) => inColumn(o) && o.y + o.h <= l.y).sort((a, b) => b.y + b.h - (a.y + a.h))[0]
    if (!above) return layout
    y = above.y
  } else if (dir === 'down') {
    const below = next.filter((o) => inColumn(o) && o.y >= l.y + l.h).sort((a, b) => a.y - b.y)[0]
    if (!below) return layout
    y = below.y + below.h - l.h
  } else {
    x = clamp(l.x + (dir === 'left' ? -1 : 1), 0, COLS - l.w)
    if (x === l.x) return layout
  }
  return compact(moveElement(next, l, x, y, true, false, 'vertical', COLS))
}

// Keyboard twin of the resize corner: grows right and down only, within the widget's limits.
export function resizeWidget(layout, id, dw, dh) {
  const { minW, minH } = WIDGET[id]
  return compact(layout.map((l) => (l.i === id ? { ...l, w: clamp(l.w + dw, minW, COLS - l.x), h: clamp(l.h + dh, minH, MAX_H) } : l)))
}
