import { createMockApi } from './mockApi'
import { createSupabaseApi } from './supabase'

// Single switch point for the data adapter (doc 05 §17, spec 2026-10-09). Real data (Supabase) by default; the
// localStorage mock only when asked for (`VITE_DATA_SOURCE=mock`: Playwright) or under Vitest. Components never import
// an adapter directly. The env values are replaced at build time, so the unused adapter is dropped from the bundle.
const source = import.meta.env.VITE_DATA_SOURCE
export const isMock = source === 'mock' || (!source && import.meta.env.MODE === 'test')
export const api = isMock ? createMockApi({ latencyMs: import.meta.env.MODE === 'test' ? 0 : 300 }) : createSupabaseApi()
