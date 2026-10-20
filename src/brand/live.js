// The brand in force (spec 2026-10-20 brand CMS): the one the admin published, painted by main.jsx before the first
// render, or a draft an admin previews until the page reloads. It paints the variables theme.js derives inline on
// <html>; with neither, every value comes from the files (tokens.css, brand.js, public/brand/).
import { useSyncExternalStore } from 'react'
import { brand } from './brand'
import { DEFAULT_SETTINGS, brandVars, fontsUrl } from './theme'

let state = { published: null, preview: null }
let painted = []
const listeners = new Set()

// Google Fonts the files do not already load (index.html loads the default family).
export function loadFonts(families, id) {
  const wanted = [...new Set(families)].filter((f) => f && f !== DEFAULT_SETTINGS.fonts.body)
  let link = document.getElementById(id)
  if (!wanted.length) return link?.remove()
  if (!link) {
    link = Object.assign(document.createElement('link'), { id, rel: 'stylesheet' })
    document.head.append(link)
  }
  link.href = fontsUrl(wanted)
}

function paint() {
  const settings = state.preview ?? state.published
  const root = document.documentElement
  for (const name of painted) root.style.removeProperty(name)
  const vars = settings ? brandVars(settings) : {}
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
  painted = Object.keys(vars)
  loadFonts(settings ? [settings.fonts.body, settings.fonts.heading] : [], 'brand-fonts')
  const icon = document.querySelector('link[rel="icon"]')
  if (icon) {
    icon.href = settings?.favicon?.url ?? '/brand/favicon.svg'
    icon.type = settings?.favicon ? '' : 'image/svg+xml'
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--primary'] ?? brand.themeColor)
  for (const l of listeners) l()
}

export function setPublishedBrand(settings) {
  state = { ...state, published: settings ?? null }
  paint()
}

// A draft on the whole site for this admin only; null ends it.
export function previewBrand(settings) {
  state = { ...state, preview: settings ?? null }
  paint()
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useLiveBrand = () => useSyncExternalStore(subscribe, () => state)
export const logoOf = (s) => (s.preview ?? s.published)?.logo?.url ?? '/brand/logo.svg'
