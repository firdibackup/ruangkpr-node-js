import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { HandCoinsIcon, LinkIcon, ListOrderedIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useForm } from '@/lib/hooks'
import { GOALS, PURPOSES, moneyInput, rupiah, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ErrorSummary, FormGrid, MoneyField, RadioCards, SelectField, TextField } from '@/components/shared/fields'
import { ErrorPanel, IconBox, Notice, Panel, PageSkeleton, Spinner } from '@/components/shared/ui'
import { productName, resumePath } from '@/domains/applications/meta'
import { IncomeDialog } from '@/domains/profile/ProfilePages'
import { OptimizeHeader, modeName, useOptimize } from './shared'
import { validateGoal } from './validation'

const TENORS = [5, 10, 15, 20, 25].map((y) => ({ value: String(y * 12), label: `${y} tahun` }))

// Entry from Explore with an active mortgage: reuse its data, ask only the priorities or funds of the chosen ?mode (no
// duplicate wizard). Bank choices come first; the forms the KPR setup skipped are asked once a bank is picked.
export function GoalStartPage() {
  const [params] = useSearchParams()
  const initialMode = params.get('mode') === 'topup' ? 'topup' : 'takeover'
  const navigate = useNavigate()
  const { snap, app, otherApp, error, reload } = useOptimize()
  const m = snap?.mortgages.find((x) => x.status === 'active')
  const years = m?.remainingTenorMonths ? Math.min(25, Math.max(5, Math.round(m.remainingTenorMonths / 12 / 5) * 5)) : 15
  const form = useForm({ mode: initialMode, goal: 'lower_payment', tenorMonths: String((initialMode === 'topup' ? Math.max(years, 20) : years) * 12), maxPayment: '', requestedTopup: moneyInput(initialMode === 'topup' ? 100_000_000 : null), purpose: initialMode === 'topup' ? 'renovation' : '', purposeOther: '' }, validateGoal)
  const [pending, setPending] = useState(false)
  const [apiError, setApiError] = useState('')
  const [askIncome, setAskIncome] = useState(false)
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  if (!m) return <Navigate to={`/optimize/intro?mode=${initialMode}`} replace />
  // The reminder-only setup may not know the old loan's balance yet: ask for it before simulating.
  const loanReady = m.currentPayment > 0 && m.currentRateBps > 0 && m.remainingTenorMonths > 0 && m.outstandingPrincipal > 0
  if (!loanReady) {
    return (
      <>
        <OptimizeHeader title={`Simulasi ${modeName(initialMode)}`} subtitle="Memakai data KPR yang kamu pantau. Tidak ada data yang dikirim ke bank." back="/explore" />
        <Notice
          tone="warn"
          title="Data KPR belum cukup untuk simulasi"
          action={
            <Link to="/monitoring/setup/1?edit=explore" className="text-[13px] font-bold text-primary underline">
              Lengkapi data bunga
            </Link>
          }
        >
          Untuk simulasi, lengkapi bunga dan sisa tenor KPR kamu dulu.
        </Notice>
      </>
    )
  }
  const existing = app ?? otherApp
  const v = form.values
  // The bank list ranks by what the user can afford, so income is the one thing asked before it.
  const hasIncome = m.finance?.monthlyIncome > 0

  const onSubmit = form.submit(async (x) => {
    setPending(true)
    setApiError('')
    try {
      await api.simulations.run({
        source: { type: 'mortgage', id: m.id },
        input: { mode: x.mode, goal: x.mode === 'takeover' ? x.goal : null, tenorMonths: Number(x.tenorMonths), maxPayment: toMoney(x.maxPayment), requestedTopup: x.mode === 'topup' ? toMoney(x.requestedTopup) : 0, purpose: x.mode === 'topup' ? x.purpose : null },
      })
      navigate('/optimize/baseline')
    } catch (e) {
      setApiError(e.message)
      setPending(false)
    }
  })

  return (
    <>
      <OptimizeHeader title={`Simulasi ${modeName(v.mode)}`} subtitle="Memakai data KPR yang kamu pantau. Tidak ada data yang dikirim ke bank." back="/explore" />
      {existing && (
        <Notice tone="warn" title="Masih ada pengajuan aktif" action={<Link className="text-[13px] font-bold text-primary underline" to={existing.status === 'draft' ? resumePath(existing) : '/my-kpr/application'}>Buka {productName(existing)}</Link>}>
          Kamu tetap bisa simulasi, tetapi untuk mengajukan program baru selesaikan atau hapus pengajuan {productName(existing)} dulu.
        </Notice>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex items-center gap-2.5 rounded-xl bg-secondary px-4 py-3 text-[13px] font-semibold text-primary">
          <LinkIcon className="size-4" aria-hidden />
          Data diambil dari KPR yang kamu pantau: {m.bankName} · sisa pokok {rupiah(m.outstandingPrincipal)} · {m.remainingTenorMonths} bulan.
        </div>
        <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
        <Panel className="gap-5 sm:p-7">
          <div className="flex items-center gap-3">
            <IconBox icon={v.mode === 'topup' ? HandCoinsIcon : ListOrderedIcon} />
            <h2 className="text-lg font-extrabold">{v.mode === 'topup' ? 'Kebutuhan dana' : 'Prioritas hasil'}</h2>
          </div>
          <FormGrid>
            {v.mode === 'takeover' ? (
              <RadioCards label="Tujuan utama" layout="column" span options={GOALS} {...form.bind('goal')} />
            ) : (
              <>
                <MoneyField label="Dana tambahan yang dibutuhkan" span {...form.bind('requestedTopup')} />
                <SelectField label="Tujuan penggunaan" options={PURPOSES} {...form.bind('purpose')} />
                {v.purpose === 'other' && <TextField label="Jelaskan kebutuhan" {...form.bind('purposeOther')} />}
              </>
            )}
            <SelectField label="Tenor baru" options={TENORS} {...form.bind('tenorMonths')} />
            <MoneyField label="Batas cicilan nyaman" optional {...form.bind('maxPayment')} />
          </FormGrid>
        </Panel>
        {m.property?.estimatedValue == null && v.mode === 'topup' && (
          <Notice tone="warn" action={<Link to="/my-kpr/property?edit=1" className="text-[13px] font-bold text-primary underline">Lengkapi nilai properti</Link>}>
            Nilai properti belum diisi, jadi dana Top-up belum dapat dihitung.
          </Notice>
        )}
        {!hasIncome && (
          <Notice tone="warn" action={<Button type="button" size="xs" onClick={() => setAskIncome(true)}>Isi penghasilan</Button>}>
            Penghasilan bulanan belum diisi, jadi pilihan bank belum dapat dihitung.
          </Notice>
        )}
        {apiError && <Notice tone="bad" role="alert" title="Simulasi tidak dapat dihitung">{apiError}</Notice>}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending && <Spinner />}
            Lihat Kondisi KPR
          </Button>
        </div>
      </form>
      {askIncome && (
        <IncomeDialog
          finance={m.finance}
          onClose={() => setAskIncome(false)}
          onSaved={() => {
            setAskIncome(false)
            reload()
          }}
        />
      )}
    </>
  )
}
