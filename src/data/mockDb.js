// The only module that touches localStorage (doc 05 §8.2). Stores serializable metadata only —
// never file bytes, OTPs, or amortization rows.
import { SCHEMA_VERSION, createSeed } from './seed'

export const STORAGE_KEY = 'ruangkpr:prototype:v1'

let memory = null // fallback when storage is unavailable (private mode / tests)

export function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const db = JSON.parse(raw)
      if (db?.schemaVersion === SCHEMA_VERSION) return db
    } else if (memory) return structuredClone(memory)
  } catch {
    if (memory) return structuredClone(memory)
    console.warn('[mockDb] Data demo rusak, direset ke skenario awal.')
    const db = createSeed('guest')
    db.meta.resetNotice = true
    saveDb(db)
    return db
  }
  const db = createSeed('guest')
  saveDb(db)
  return db
}

export function saveDb(db) {
  memory = structuredClone(db)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // storage full/blocked: keep the in-memory copy for this session
  }
}

export function resetDb(scenario) {
  const db = createSeed(scenario)
  saveDb(db)
  return db
}
