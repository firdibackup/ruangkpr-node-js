import { createSupabaseApi } from './supabase'

export const api = createSupabaseApi()
export const demoEnabled = false
export const isDemo = false
export const isMock = false
export const showDemoControls = false
export const mockControls = null
export const DEMO_PASSWORD = null
// Compatibility with shared UI imports; these functions never touch browser storage.
export function startDemo() { return false }
export function exitDemo() { return false }
