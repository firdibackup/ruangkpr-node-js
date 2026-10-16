import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, exitDemo, isDemo } from '@/data/api'
import { PageSkeleton } from '@/components/shared/ui'

const SessionContext = createContext(null)

// The only app-wide context (doc 05 §6.1): session + logout. Pages load their own data.
export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setSession(await api.auth.getSession())
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [])

  useEffect(() => {
    let alive = true
    api.auth
      .getSession()
      .then((s) => alive && setSession(s))
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [])

  // Supabase mode: another tab signing out or an expired session reaches every guard.
  useEffect(() => api.auth.onChange?.(refresh), [refresh])

  const logout = useCallback(async () => {
    // Leaving the demo goes back to the real sign-in page, not the mock one.
    if (isDemo) return exitDemo()
    await api.auth.logout()
    await refresh()
  }, [refresh])

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-extrabold">Data akun belum dapat ditampilkan</p>
        <button type="button" className="h-11 rounded-full bg-primary px-5 text-sm font-bold text-white" onClick={refresh}>
          Coba Lagi
        </button>
      </div>
    )
  }
  if (!session) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <PageSkeleton />
      </div>
    )
  }
  return <SessionContext.Provider value={{ session, refresh, logout }}>{children}</SessionContext.Provider>
}

export const useSession = () => useContext(SessionContext)
