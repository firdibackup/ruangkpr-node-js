import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BRAND_FILES, brand } from './brand'
import { FILE_VARS, PAIRS, STEPS, brandIssues, contrast, resolveVar } from './theme'

// Guards for the brand parameters (BRANDING.md): a clone that swaps colours, fonts or assets finds out here,
// not in production. Paths are relative to the repo root, where Vitest runs.
const read = (p) => fs.readFileSync(path.resolve(p), 'utf8')
const vars = FILE_VARS
const resolve = (name, from) => resolveVar(name, {}, from)

describe('brand tokens', () => {
  it('defines all eleven steps of every palette', () => {
    for (const p of ['primary', 'secondary', 'accent', 'neutral', 'success', 'danger', 'warning', 'info']) {
      for (const step of STEPS) expect(vars[`--palette-${p}-${step}`], `--palette-${p}-${step}`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('resolves every variable a token refers to', () => {
    for (const [name, value] of Object.entries(vars)) {
      for (const [, ref] of value.matchAll(/var\((--[\w-]+)\)/g)) expect(() => resolve(ref, name)).not.toThrow()
    }
  })

  // The same pairs the admin brand page checks before publishing (src/brand/theme.js).
  it.each(PAIRS)('%s on %s reaches %s:1', (fg, bg, min) => {
    expect(contrast(resolve(fg), resolve(bg))).toBeGreaterThanOrEqual(min)
  })

  it('reads everywhere, including white text under the 15% glow on the opportunity colour', () => {
    expect(brandIssues()).toEqual([])
  })
})

describe('brand identity', () => {
  it('uses the primary colour as the theme colour', () => {
    expect(brand.themeColor.toLowerCase()).toBe(resolve('--primary').toLowerCase())
  })

  it('loads every font family the tokens name', () => {
    for (const font of ['--body-font', '--heading-font']) {
      const family = resolve(font).match(/^"([^"]+)"/)?.[1]
      expect(family, `${font} starts with a quoted family`).toBeTruthy()
      expect(brand.fontsUrl).toContain(`family=${family.replaceAll(' ', '+')}`)
    }
  })

  it('ships every brand file in public/brand/', () => {
    for (const f of BRAND_FILES) expect(fs.existsSync(path.resolve('public/brand', f)), f).toBe(true)
  })

  it('carries the brand into the Supabase email templates', () => {
    for (const t of ['otp', 'recovery']) {
      const html = read(`supabase/templates/${t}.html`).toLowerCase()
      expect(html, t).toContain(brand.name.toLowerCase())
      expect(html, t).toContain(brand.themeColor.toLowerCase())
    }
  })
})

describe('no colour outside the brand', () => {
  const files = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) return p === path.join('src', 'brand') ? [] : files(p)
      return /\.(jsx?|css)$/.test(e.name) && !/\.test\.jsx?$/.test(e.name) ? [p] : []
    })

  it('has no hex colour in src/ outside src/brand/', () => {
    const hits = files('src').flatMap((f) =>
      read(f)
        .split('\n')
        .flatMap((line, i) => (/#[0-9a-f]{3,8}(?![0-9a-z])/i.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])),
    )
    expect(hits, 'use a token from src/brand/tokens.css').toEqual([])
  })
})
