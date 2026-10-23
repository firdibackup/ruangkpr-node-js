import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/data/api'
import { STAFF } from '@/data/roles'
import { useSession } from '@/domains/session/SessionProvider'
import { Button } from '@/components/ui/button'
import { HANDOFF_KEY, parseCalculatorHandoff } from './calculatorHandoff'
import { calculatorNextPath } from './calculatorFlow'

export function CalculatorHandoffPage() {
  const { session } = useSession()
  const { search } = useLocation()
  const navigate = useNavigate()
  const started = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true
    async function receive() {
      try {
        if (search) {
          parseCalculatorHandoff(search)
          sessionStorage.setItem(HANDOFF_KEY, search)
          // Keep the payload through login/OTP/OAuth, without keeping it in the address bar.
          window.history.replaceState(window.history.state, '', '/from-calculator')
        }
        const saved = sessionStorage.getItem(HANDOFF_KEY)
        if (!saved) throw new Error('Data simulasi tidak ditemukan. Buka kembali dari kalkulator Maxi.')
        const handoff = parseCalculatorHandoff(saved)
        if (session.status !== 'authenticated') {
          navigate(({ pending: '/verify', recovery: '/reset-password', onboarding: '/welcome' })[session.status] ?? '/login', { replace: true })
          return
        }
        if (STAFF[session.role]) throw new Error('Gunakan akun nasabah untuk melanjutkan simulasi.')
        const app = await api.applications.create({ productType: handoff.mode === 'primary' ? 'primary' : 'takeover', mode: handoff.mode === 'primary' ? null : handoff.mode, calculatorSearch: saved })
        sessionStorage.removeItem(HANDOFF_KEY)
        navigate(calculatorNextPath(app), { replace: true })
      } catch (e) {
        setError(e.message || 'Data simulasi belum dapat diterima.')
      }
    }
    void receive()
  }, [navigate, search, session])

  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-6">
    <h1 className="text-2xl font-bold">{error ? 'Simulasi belum dilanjutkan' : 'Menyiapkan simulasi kamu…'}</h1>
    {error ? <>
      <p role="alert" className="text-sm leading-6 text-muted-foreground">{error}</p>
      <Button onClick={() => window.location.reload()}>Coba lagi</Button>
      <Button asChild variant="outline"><Link to="/" onClick={() => sessionStorage.removeItem(HANDOFF_KEY)}>Kembali ke aplikasi</Link></Button>
    </> : <p role="status" className="text-sm text-muted-foreground">Memuat data KPR dan pilihan bank.</p>}
  </main>
}
