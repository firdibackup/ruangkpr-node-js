import { describe, expect, it } from 'vitest'
import { CATEGORIES, COLS, DEFAULT_LAYOUT, MAX_H, UNLOCKED_LAYOUT, WIDGET, WIDGETS, addWidget, moveWidget, normalizeLayout, readingOrder, removeWidget, resizeWidget, sameLayout } from './dashboardLayout'
import { WIDGET_VIEWS } from './widgets'

const at = (layout, id) => layout.find((l) => l.i === id)
const overlaps = (layout) => layout.some((a, i) => layout.slice(i + 1).some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h))
const ids = (layout) => readingOrder(layout).map((l) => l.i)

describe('normalizeLayout', () => {
  it('falls back to the default board when nothing valid was saved', () => {
    expect(normalizeLayout(undefined)).toEqual(DEFAULT_LAYOUT)
    expect(normalizeLayout('rusak')).toEqual(DEFAULT_LAYOUT)
    expect(normalizeLayout([])).toEqual([]) // an emptied board stays empty
  })

  it('drops unknown and duplicate widgets, clamps sizes, and closes gaps', () => {
    const layout = normalizeLayout([
      { i: 'health', x: 10, y: 40, w: 1, h: 99 },
      { i: 'health', x: 0, y: 0, w: 6, h: 6 },
      { i: 'chart', x: 0, y: 0, w: 4, h: 4 },
      { i: 'agenda', x: 0, y: 0 },
    ])
    expect(layout).toEqual([
      { i: 'health', x: 8, y: 0, w: 4, h: MAX_H }, // minW 4 pulls x back inside the grid; gap closed
      { i: 'agenda', x: 0, y: 0, w: 5, h: 6 }, // missing size → widget default
    ])
  })

  it('gives every widget a view and a gallery tab, and keeps charts off the default board (PRD §11.1)', () => {
    expect(WIDGETS.filter((w) => !WIDGET_VIEWS[w.id] || !CATEGORIES.some((c) => c.id === w.category)).map((w) => w.id)).toEqual([])
    expect(DEFAULT_LAYOUT.filter((l) => WIDGET[l.i].category === 'chart')).toEqual([])
  })

  it('puts KPR Saya, Pembayaran and Amortisasi first in the default reading order', () => {
    expect(ids(DEFAULT_LAYOUT)).toEqual(['myKpr', 'nextPayment', 'amortization', 'opportunity', 'health', 'agenda'])
  })

  it('leads with Peluang and Health once they unlock, on an already compact board', () => {
    expect(ids(UNLOCKED_LAYOUT)).toEqual(['opportunity', 'nextPayment', 'health', 'amortization', 'myKpr', 'agenda'])
    expect(sameLayout(normalizeLayout(UNLOCKED_LAYOUT), UNLOCKED_LAYOUT)).toBe(true)
    expect(at(UNLOCKED_LAYOUT, 'opportunity').h).toBe(WIDGET.opportunity.h - 1) // unlocked, its content ends a row early
  })
})

describe('board edits', () => {
  it('adds widgets into the first gap they fit, side by side, and removes without leaving a gap', () => {
    const tiles = ['outstanding', 'rate', 'progress'].reduce(addWidget, DEFAULT_LAYOUT)
    expect(['outstanding', 'rate', 'progress'].map((id) => at(tiles, id))).toMatchObject([
      { x: 0, y: 24, w: 4, h: 4 },
      { x: 4, y: 24 },
      { x: 8, y: 24 },
    ])
    const noAgenda = removeWidget(DEFAULT_LAYOUT, 'agenda')
    expect(at(addWidget(noAgenda, 'outstanding'), 'outstanding')).toMatchObject({ x: 7, y: 18 }) // under Health
    expect(at(removeWidget(DEFAULT_LAYOUT, 'health'), 'agenda').y).toBe(13)
  })

  it('moving up/down trades places with the neighbour in the same column', () => {
    const up = moveWidget(DEFAULT_LAYOUT, 'amortization', 'up')
    expect(ids(up).slice(0, 3)).toEqual(['myKpr', 'amortization', 'nextPayment'])
    expect(sameLayout(moveWidget(up, 'amortization', 'down'), DEFAULT_LAYOUT)).toBe(true)
    const oppFirst = moveWidget(DEFAULT_LAYOUT, 'opportunity', 'up')
    expect(at(oppFirst, 'opportunity').y).toBe(0)
    expect(at(oppFirst, 'myKpr').y).toBe(12)
  })

  it('moves nothing past the edges and never overlaps', () => {
    expect(moveWidget(DEFAULT_LAYOUT, 'myKpr', 'up')).toBe(DEFAULT_LAYOUT)
    expect(moveWidget(DEFAULT_LAYOUT, 'myKpr', 'left')).toBe(DEFAULT_LAYOUT)
    expect(moveWidget(DEFAULT_LAYOUT, 'health', 'right')).toBe(DEFAULT_LAYOUT)
    const shifted = moveWidget(DEFAULT_LAYOUT, 'myKpr', 'right')
    expect(at(shifted, 'myKpr').x).toBe(1)
    expect(overlaps(shifted)).toBe(false)
  })

  it('resizes within the widget limits and the grid edge, pushing neighbours down', () => {
    expect(at(resizeWidget(DEFAULT_LAYOUT, 'health', 3, 0), 'health').w).toBe(COLS - 7)
    expect(at(resizeWidget(DEFAULT_LAYOUT, 'health', -3, -3), 'health')).toMatchObject({ w: 4, h: 4 })
    const taller = resizeWidget(DEFAULT_LAYOUT, 'health', 0, 2)
    expect(at(taller, 'agenda').y).toBe(20)
    expect(overlaps(taller)).toBe(false)
  })
})
