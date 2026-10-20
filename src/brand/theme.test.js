import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, FILE_VARS, STEPS, brandIssues, brandVars, contrast, resolveVar, toHex, toOklch } from './theme'

const settings = (colors, extra = {}) => ({ ...DEFAULT_SETTINGS, overrides: {}, colors, ...extra })

describe('theme engine', () => {
  it('round-trips colours through OKLCH', () => {
    for (const hex of ['#003036', '#00fbf0', '#c6322c', '#ffffff', '#000000', '#7c3aed']) expect(toHex(toOklch(hex))).toBe(hex)
  })

  it('reproduces tokens.css from the default settings', () => {
    const vars = brandVars(DEFAULT_SETTINGS)
    for (const [name, value] of Object.entries(vars)) expect(value, name).toBe(resolveVar(name))
    expect(brandIssues(vars)).toEqual([])
  })

  it.each([
    ['blue', { primary: '#0066ff', secondary: '#14b8a6', accent: '#facc15' }],
    ['red', { primary: '#e11d48', secondary: '#0f766e', accent: '#22d3ee' }],
    ['violet', { primary: '#7c3aed', secondary: '#db2777', accent: '#a3e635' }],
    ['light primary', { primary: '#f59e0b', secondary: '#0ea5e9', accent: '#1e3a8a' }],
    ['grey accent', { primary: '#1f2937', secondary: '#6b7280', accent: '#808080' }],
  ])('keeps a %s brand readable without overrides', (_, colors) => {
    const vars = brandVars(settings(colors))
    expect(brandIssues(vars)).toEqual([])
    for (const p of ['primary', 'secondary', 'accent']) {
      const steps = STEPS.map((s) => vars[`--palette-${p}-${s}`])
      expect(steps, p).toContain(colors[p])
      // Lighter to darker, step by step.
      for (let i = 1; i < steps.length; i += 1) expect(toOklch(steps[i]).L, `${p}-${STEPS[i]}`).toBeLessThan(toOklch(steps[i - 1]).L)
    }
  })

  it('moves a light primary to the first step that reads on white', () => {
    const vars = brandVars(settings({ primary: '#f59e0b', secondary: '#0ea5e9', accent: '#1e3a8a' }))
    expect(vars['--primary']).not.toBe('#f59e0b')
    expect(contrast(vars['--primary'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('lets an override replace one step and keeps the chosen colour on its step', () => {
    const vars = brandVars(settings({ primary: '#0066ff', secondary: '#14b8a6', accent: '#facc15' }, { overrides: { 'secondary-700': '#0b4f4a' } }))
    expect(vars['--palette-secondary-700']).toBe('#0b4f4a')
    expect(Object.values(vars)).toContain('#0066ff')
  })

  it('reports the pairs an override breaks', () => {
    const issues = brandIssues(brandVars(settings(DEFAULT_SETTINGS.colors, { overrides: { 'secondary-700': '#7fe0d0' } })))
    expect(issues.map((i) => i.fg)).toContain('--link')
  })

  it('reads every role from the file when no brand is published', () => {
    expect(resolveVar('--link')).toBe(FILE_VARS['--palette-secondary-700'])
  })
})
