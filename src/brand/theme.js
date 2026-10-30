// Theme engine for the admin brand page (spec 2026-10-20 brand CMS): turns brand settings (three base colours, exact
// overrides, fonts, card radius) into the CSS variables that differ from src/brand/tokens.css, and checks every
// text/background pair the UI uses. tokens.css stays the default and the source of every other role.
import tokensCss from './tokens.css?raw'

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
export const EDITABLE = ['primary', 'secondary', 'accent', 'neutral', 'success', 'warning', 'danger', 'info']

// ---------- colour math (sRGB hex ↔ OKLCH) ----------

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
export const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)
export const HEX_HINT = 'Isi warna hex 6 digit, mis. #003036.'

export function toOklch(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map((x) => toLinear(parseInt(x, 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(A, B), H: Math.atan2(B, A) }
}

function rgbOf({ L, C, H }) {
  const A = C * Math.cos(H)
  const B = C * Math.sin(H)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
}

// Out-of-gamut colours keep their lightness and hue and lose chroma until sRGB can show them.
export function toHex(lch) {
  const inGamut = (c) => rgbOf({ ...lch, C: c }).every((v) => v >= -1e-4 && v <= 1 + 1e-4)
  let c = lch.C
  if (!inGamut(c)) {
    // The most chroma sRGB can show at this lightness and hue.
    let lo = 0
    let hi = c
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2
      if (inGamut(mid)) lo = mid
      else hi = mid
    }
    c = lo
  }
  return '#' + rgbOf({ ...lch, C: c }).map((v) => Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255).toString(16).padStart(2, '0')).join('')
}

// ---------- WCAG contrast ----------

const luminance = (hex) => {
  const [r, g, b] = hex.slice(1).match(/../g).map((x) => toLinear(parseInt(x, 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// ---------- scales ----------

// Lightness and relative chroma per step, measured on the guideline's info and success palettes (the most even).
const TARGET_L = [0.97, 0.94, 0.88, 0.81, 0.71, 0.62, 0.52, 0.45, 0.39, 0.33, 0.24]
const CHROMA = [0.09, 0.2, 0.36, 0.6, 0.86, 1, 0.97, 0.83, 0.68, 0.56, 0.39]
const nearestStep = (L) => TARGET_L.reduce((best, t, i) => (Math.abs(t - L) < Math.abs(TARGET_L[best] - L) ? i : best), 0)

// The chosen colour sits exactly on the step nearest its lightness (or on the step an override already gives it);
// the other steps follow the target curve at its hue. `chromaAt` lets a palette desaturate that curve (text/grey).
function scaleOf(anchor, overrides, chromaAt = (a, i, k) => (a.C * CHROMA[i]) / CHROMA[k]) {
  const a = toOklch(anchor)
  const given = STEPS.findIndex((s) => overrides[s]?.toLowerCase() === anchor.toLowerCase())
  const k = given >= 0 ? given : nearestStep(a.L)
  const steps = STEPS.map((s, i) => overrides[s] ?? (i === k ? anchor.toLowerCase() : toHex({ L: TARGET_L[i], C: chromaAt(a, i, k), H: a.H })))
  steps[k] = anchor.toLowerCase()
  return { steps, anchor: k }
}

// The text/grey swatch: same curve as the others, desaturated so an odd pick still reads as grey off its own step.
const neutralChroma = (a, i) => 0.022 * Math.min(1, CHROMA[i] * 2)

// ---------- tokens.css ----------

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
export const FILE_VARS = Object.fromEntries([...stripComments(tokensCss).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]))

// A variable's colour value, with `vars` (the brand's) taking the place of the file's.
export function resolveVar(name, vars = {}, from = name) {
  const v = vars[name] ?? FILE_VARS[name]
  if (v === undefined) throw new Error(`${from} points at ${name}, which tokens.css does not define`)
  const ref = v.match(/^var\((--[\w-]+)\)$/)
  return ref ? resolveVar(ref[1], vars, from) : v
}

const familyOf = (stack) => stack.match(/^"([^"]+)"/)?.[1]

// The look the files ship with, as settings: what the admin page starts from and what "default" restores.
export const DEFAULT_SETTINGS = {
  colors: {
    primary: resolveVar('--primary'),
    secondary: resolveVar('--palette-secondary-500'),
    accent: resolveVar('--cta'),
    neutral: resolveVar('--palette-neutral-900'),
    success: resolveVar('--palette-success-500'),
    warning: resolveVar('--palette-warning-500'),
    danger: resolveVar('--palette-danger-500'),
    info: resolveVar('--palette-info-500'),
  },
  overrides: Object.fromEntries(EDITABLE.flatMap((p) => STEPS.map((s) => [`${p}-${s}`, resolveVar(`--palette-${p}-${s}`)]))),
  fonts: { body: familyOf(resolveVar('--body-font')), heading: familyOf(resolveVar('--heading-font')) },
  cardRadius: parseInt(resolveVar('--card-radius'), 10),
  logo: null,
  favicon: null,
}

// A brand saved before a palette became editable has no colour for it: that palette keeps the file's scale.
export function withDefaults(settings) {
  const missing = EDITABLE.filter((p) => !isHex(settings.colors?.[p]))
  return {
    ...settings,
    colors: Object.fromEntries(EDITABLE.map((p) => [p, missing.includes(p) ? DEFAULT_SETTINGS.colors[p] : settings.colors[p]])),
    overrides: { ...Object.fromEntries(missing.flatMap((p) => STEPS.map((s) => [`${p}-${s}`, DEFAULT_SETTINGS.overrides[`${p}-${s}`]]))), ...settings.overrides },
  }
}

// ---------- fonts ----------

// Google fonts with weights 400–800 (the UI uses 500–800) that read well in Indonesian and with rupiah figures.
export const FONTS = ['Plus Jakarta Sans', 'Inter', 'Manrope', 'DM Sans', 'Poppins', 'Figtree', 'Outfit', 'Sora', 'Lexend', 'Nunito Sans', 'Work Sans', 'Montserrat']
export const fontsUrl = (families) =>
  `https://fonts.googleapis.com/css2?${[...new Set(families)].map((f) => `family=${f.replaceAll(' ', '+')}:wght@400;500;600;700;800`).join('&')}&display=swap`
const fontStack = (family) => `"${family}", system-ui, sans-serif`

// ---------- settings → variables ----------

const WHITE = '#ffffff'
const overridesOf = (settings, palette) =>
  Object.fromEntries(STEPS.map((s) => [s, settings.overrides?.[`${palette}-${s}`]]).filter(([, v]) => isHex(v)))

export function brandVars(saved) {
  const settings = withDefaults(saved)
  const palettes = {
    primary: scaleOf(settings.colors.primary, overridesOf(settings, 'primary')),
    secondary: scaleOf(settings.colors.secondary, overridesOf(settings, 'secondary')),
    accent: scaleOf(settings.colors.accent, overridesOf(settings, 'accent')),
    neutral: scaleOf(settings.colors.neutral, overridesOf(settings, 'neutral'), neutralChroma),
    success: scaleOf(settings.colors.success, overridesOf(settings, 'success')),
    warning: scaleOf(settings.colors.warning, overridesOf(settings, 'warning')),
    danger: scaleOf(settings.colors.danger, overridesOf(settings, 'danger')),
    info: scaleOf(settings.colors.info, overridesOf(settings, 'info')),
  }
  const P = palettes.primary.steps
  const A = palettes.accent.steps
  const at = (steps, i) => steps[Math.min(STEPS.length - 1, Math.max(0, i))]

  // The primary is also a text colour (links, labels, soft buttons): from the chosen step, the first that holds
  // 4.5:1 on its own 50 step (and so on white).
  let p = palettes.primary.anchor
  while (p < STEPS.length - 1 && contrast(P[p], P[0]) < 4.5) p += 1
  const dark = p >= STEPS.indexOf(800)
  // The current-step dot: from 400, the first step that holds 3:1 on white.
  let dot = STEPS.indexOf(400)
  while (contrast(P[dot], WHITE) < 3) dot += 1
  // The CTA keeps whichever text colour reads better on it, stepping away from the middle until one reaches 4.5:1.
  const ctaText = (c) => (contrast(at(P, 9), c) >= contrast(WHITE, c) ? at(P, 9) : WHITE)
  let c = palettes.accent.anchor
  const way = toOklch(A[c]).L > 0.6 ? -1 : 1
  while (c > 0 && c < STEPS.length - 1 && contrast(ctaText(A[c]), A[c]) < 4.5) c += way
  const fg = ctaText(A[c])
  // Hover and pressed go a step and two darker, or lighter when darker would lose the text.
  const ctaShade = (n) => (contrast(fg, at(A, c + n)) >= 4.5 ? at(A, c + n) : at(A, c - n))

  return {
    ...Object.fromEntries(Object.entries(palettes).flatMap(([name, { steps }]) => steps.map((hex, i) => [`--palette-${name}-${STEPS[i]}`, hex]))),
    '--primary': P[p],
    '--primary-hover': dark ? at(P, STEPS.indexOf(600)) : at(P, p + 1),
    '--primary-pressed': dark ? at(P, STEPS.length - 1) : at(P, p + 2),
    '--step-current': P[dot],
    '--cta': A[c],
    '--cta-foreground': fg,
    '--cta-hover': ctaShade(1),
    '--cta-pressed': ctaShade(2),
    '--body-font': fontStack(settings.fonts.body),
    '--heading-font': fontStack(settings.fonts.heading),
    '--card-radius': `${settings.cardRadius}px`,
  }
}

// ---------- readability ----------

const TEXT = 4.5 // WCAG AA, normal text
const UI = 3 // WCAG AA, control outlines and indicators
const STATUSES = ['success', 'warning', 'danger', 'info']
// [foreground, background, minimum, what it is in the UI]
export const PAIRS = [
  ...['--background', '--card', '--muted'].flatMap((bg) => [
    ['--foreground', bg, TEXT, 'Teks utama'],
    ['--muted-foreground', bg, TEXT, 'Teks sekunder'],
  ]),
  ['--primary', '--card', TEXT, 'Teks warna utama di kartu'],
  ['--primary', '--secondary', TEXT, 'Tombol sekunder'],
  ['--link', '--card', TEXT, 'Link'],
  ['--link', '--background', TEXT, 'Link di latar halaman'],
  ['--highlight', '--card', TEXT, 'Tagline dan label brand'],
  ['--placeholder', '--field', TEXT, 'Placeholder input'],
  ...['--primary', '--primary-hover', '--primary-pressed'].map((bg) => ['--primary-foreground', bg, TEXT, 'Tombol utama']),
  ...['--secondary', '--secondary-hover'].map((bg) => ['--secondary-foreground', bg, TEXT, 'Tombol lembut']),
  ...['--cta', '--cta-hover', '--cta-pressed'].map((bg) => ['--cta-foreground', bg, TEXT, 'Tombol CTA']),
  ['--inverse-foreground', '--inverse', TEXT, 'Toast dan panel gelap'],
  ['--selection-foreground', '--selection', TEXT, 'Teks terpilih'],
  ['--palette-white', '--hero-to', TEXT, 'Teks di hero'],
  ['--palette-white', '--hero-from', TEXT, 'Teks di hero'],
  ['--palette-white', '--opp-dark', TEXT, 'Teks di tile potensi'],
  ['--muted-foreground', '--opp-mute', TEXT, 'Teks di kartu peluang'],
  ['--opp', '--card', TEXT, 'Tombol di banner KPR'],
  ['--opp', '--opp-mute', TEXT, 'Tombol di banner KPR (hover)'],
  ...STATUSES.flatMap((s) => [
    [`--${s}`, `--${s}-bg`, TEXT, 'Teks status'],
    [`--${s}`, '--card', TEXT, 'Teks status'],
    ['--palette-white', `--${s}-solid`, TEXT, 'Badge status'],
    [`--${s}-border`, '--card', UI, 'Border status'],
  ]),
  ['--input', '--card', UI, 'Border input'],
  ['--input', '--field', UI, 'Border input'],
  ['--border-strong', '--card', UI, 'Border checkbox'],
  ['--ring', '--card', UI, 'Fokus keyboard'],
  ['--ring', '--background', UI, 'Fokus keyboard'],
  ['--step-current', '--card', UI, 'Langkah aktif'],
]

// `color-mix(in srgb, white p, colour)`: the 15% glow over the opportunity tile and the monitoring highlight.
const whiten = (hex, p) => '#' + hex.slice(1).match(/../g).map((x) => Math.round(parseInt(x, 16) * (1 - p) + 255 * p).toString(16).padStart(2, '0')).join('')

// Every pair below its minimum with the brand's variables in force; empty means readable everywhere.
export function brandIssues(vars = {}) {
  const pairs = PAIRS.map(([fg, bg, min, label]) => ({ fg, bg, min, label, ratio: contrast(resolveVar(fg, vars), resolveVar(bg, vars)) }))
  pairs.push({ fg: '--palette-white', bg: '--opp', min: TEXT, label: 'Teks di tile potensi (kilau)', ratio: contrast(WHITE, whiten(resolveVar('--opp', vars), 0.15)) })
  return pairs.filter((x) => x.ratio < x.min)
}
