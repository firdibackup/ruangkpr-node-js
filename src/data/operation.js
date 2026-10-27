import { ApiError } from './apiError'
import { canOpen } from './roles'

// Store conflicts retry against fresh data; both adapters use the same authorization contract.
export function createOperation(store, beforeCall) {
  return (name, fn, { auth = true, admin = false } = {}) => async (...args) => {
    await beforeCall?.(name)
    for (let attempt = 1; ; attempt += 1) {
      const db = await store.load({ admin: Boolean(admin) })
      if (auth && db.session.status !== 'authenticated') throw new ApiError({ code: 'AUTH_REQUIRED', message: 'Sesi berakhir. Silakan masuk lagi.' }, { status: 401 })
      if (admin && !canOpen(db.user.role, admin === true ? null : admin)) throw new ApiError({ code: 'FORBIDDEN', message: 'Halaman ini di luar akses akun kamu.' }, { status: 403 })
      const result = fn(db, ...args)
      try {
        await store.save(db)
      } catch (error) {
        if (error?.conflict && attempt < 3) continue
        throw error
      }
      return result === undefined ? undefined : structuredClone(result)
    }
  }
}
