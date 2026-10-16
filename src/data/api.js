import { createMockApi } from './mockApi'
import { demoActive, setDemo } from './mockDb'
import { createSupabaseApi } from './supabase'

// Single switch point for the data adapter (doc 05 §17, spec 2026-10-09). Real data (Supabase) by default; the
// localStorage mock only when asked for (`VITE_DATA_SOURCE=mock`: Playwright), under Vitest, or for a visitor demo
// started from /login (spec Amandemen 5). Components never import an adapter directly.
const source = import.meta.env.VITE_DATA_SOURCE
export const isDemo = demoActive()
export const isMock = isDemo || source === 'mock' || (!source && import.meta.env.MODE === 'test')
export const api = isMock ? createMockApi({ latencyMs: import.meta.env.MODE === 'test' ? 0 : 300 }) : createSupabaseApi()

// The adapter is picked once at load, so entering or leaving the demo reloads the page.
export function startDemo(scenario, path) {
  setDemo(scenario)
  window.location.assign(path)
}

export function exitDemo() {
  setDemo(null)
  window.location.assign('/login')
}
