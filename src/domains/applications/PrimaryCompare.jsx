import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRightIcon, CircleCheckIcon, LandmarkIcon, LightbulbIcon, SearchXIcon, StarIcon, TriangleAlertIcon } from 'lucide-react'
import { api } from '@/data/api'
import { simulateLoan } from '@/calculations/programs'
import { useResource } from '@/lib/hooks'
import { dateShort, percentBps, rupiah, rupiahShort, tenorLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/shared/fields'
import { Chip, Disclaimer, EmptyState, ErrorPanel, EstimateTag, HeroCard, IconBox, LoadingCards, Notice, Panel, Spinner, StatTile } from '@/components/shared/ui'

const SORTS = [
  ['total', 'Total pembayaran'],
  ['cicilan', 'Cicilan terendah'],
  ['biaya', 'Biaya awal terendah'],
  ['fixed', 'Fixed terlama'],
]
const ELIGIBILITY = {
  estimated_eligible: ['Estimasi sesuai profil', 'ok'],
  needs_review: ['Perlu ditinjau bank', 'warn'],
  not_eligible: ['Estimasi tidak sesuai profil', 'bad'],
}

function CapacityHero({ capacity, income, debts }) {
  return (
    <HeroCard scenery={false} className="flex-row flex-wrap items-center gap-4 p-6 sm:p-6">
      <IconBox icon={LightbulbIcon} tone="glass" size="xl" />
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <span className="text-[13px] font-semibold text-white/80">Kapasitas cicilan kamu</span>
        <span className="text-2xl font-extrabold tabular">{rupiah(Math.max(0, capacity.remainingCapacity))}/bln</span>
        <span className="text-[13px] text-white/80">
          35% dari penghasilan {rupiah(income)}, dikurangi cicilan lain {rupiah(debts)}. Estimasi panduan, bukan keputusan bank.
        </span>
      </div>
    </HeroCard>
  )
}

export function PrimaryCompareStep({ app, go, fromReview }) {
  const [sort, setSort] = useState('total')
  const { data, error, loading, reload } = useResource(() => api.bankProducts.compare({ applicationId: app.id, sort }), [app.id, sort])
  const e = app.data.employment
  const income = e.monthlyIncome + (e.jointIncome ? e.partnerIncome ?? 0 : 0)
  const debts = (e.vehicleDebt ?? 0) + (e.cardDebt ?? 0) + (e.otherDebt ?? 0)

  return (
    <div className="flex flex-col gap-5">
      {data && <CapacityHero capacity={data.capacity} income={income} debts={debts} />}
      <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Urutkan program">
        <span className="text-[13px] font-semibold text-ink-3">Urutkan</span>
        {SORTS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={cn('h-10 rounded-full border px-4 text-[13px] font-bold', sort === k ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground hover:bg-muted')}>
            {label}
          </button>
        ))}
      </div>
      {loading && !data && <LoadingCards count={3} label="Memuat program bank" />}
      {error && !data && <ErrorPanel title="Gagal memuat data bank" message={error.code === 'CALCULATION_INPUT_INCOMPLETE' ? error.message : 'Periksa koneksi, lalu coba lagi. Kami tidak menampilkan program yang tidak bisa dimuat.'} onRetry={reload} />}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={SearchXIcon}
          title="Belum ada program yang cocok dengan data ini."
          action={
            <Button size="md" variant="secondary" onClick={() => go('/apply/primary/4')}>
              Ubah Data Pinjaman
            </Button>
          }
        >
          <ul className="flex flex-col gap-1 text-left">
            {data.excluded.map((x) => (
              <li key={x.productId}>
                <b>{x.bank.name}</b>: {x.reasons.join(', ')}.
              </li>
            ))}
          </ul>
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3', loading && 'opacity-60')} aria-busy={loading}>
          {data.items.map((x) => {
            const [eligLabel, eligTone] = ELIGIBILITY[x.eligibility]
            const selected = app.selection?.bankProductId === x.productId
            return (
              <article key={x.productId} className={cn('flex flex-col gap-4 rounded-card bg-card p-6 shadow-card', x.recommended ? 'ring-2 ring-primary' : 'ring-1 ring-border')}>
                <div className="flex items-center gap-3">
                  <IconBox icon={LandmarkIcon} tone="muted" size="lg" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="text-base font-extrabold">{x.bank.name}</h3>
                    <span className="text-[13px] text-muted-foreground">
                      {x.name} · fixed {x.fixedMonths / 12} th
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {x.recommended && (
                    <Chip tone="info" icon={StarIcon}>
                      Rekomendasi
                    </Chip>
                  )}
                  {selected && <Chip tone="solid">Dipilih</Chip>}
                  <Chip tone={eligTone}>{eligLabel}</Chip>
                  {!x.withinCapacity && (
                    <Chip tone="warn" icon={TriangleAlertIcon}>
                      Melebihi kapasitas cicilan
                    </Chip>
                  )}
                  {data.previouslyRejectedProductIds.includes(x.productId) && <Chip tone="bad">✕ Ditolak sebelumnya</Chip>}
                  {x.stale && <Chip tone="warn">Data perlu dicek ulang</Chip>}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <StatTile label={`Bunga fixed ${x.fixedMonths / 12} th`} value={percentBps(x.fixedRateBps)} />
                  <StatTile label="Cicilan awal" value={rupiah(x.payment)} />
                  <StatTile label="Setelah fixed (estimasi)" value={x.paymentAfterFixed ? rupiah(x.paymentAfterFixed) : '—'} tone={x.paymentAfterFixed ? 'warn' : undefined} />
                  <StatTile label="Biaya admin + provisi" value={rupiahShort(x.fees.total)} />
                </div>
                <div className="flex justify-between gap-2.5 text-[13px]">
                  <span className="text-muted-foreground">Total bayar {tenorLabel(app.data.loan.tenorMonths)}</span>
                  <span className="font-bold">{rupiahShort(x.totalPayment)}</span>
                </div>
                <span className={cn('text-xs', x.stale ? 'font-semibold text-warning-text' : 'text-muted-foreground')}>
                  {x.stale ? `Data produk terakhir diverifikasi ${dateShort(x.lastVerifiedAt)}. Angka bisa berbeda.` : `Data produk per ${dateShort(x.lastVerifiedAt)} · floating estimasi ${percentBps(x.floatingRateBps)}`}
                </span>
                <Button variant="secondary" size="sm" className="mt-auto justify-between" onClick={() => go(`/apply/primary/6/${x.productId}`, { state: fromReview ? { from: 'review' } : undefined })}>
                  Lihat Detail
                  <ArrowRightIcon aria-hidden />
                </Button>
              </article>
            )
          })}
        </div>
      )}
      <Disclaimer>Rekomendasi berbasis aturan dari data produk terbaru, bukan jaminan persetujuan. Bunga floating setelah masa fixed adalah estimasi; angka final mengikuti penawaran bank.</Disclaimer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="neutral" onClick={() => go(fromReview ? '/apply/primary/7' : '/apply/primary/5')}>
          Kembali
        </Button>
        {app.selection && (
          <Button onClick={() => go('/apply/primary/7')}>
            Lanjut dengan {app.selection.bankName}
            <ArrowRightIcon aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}

export function PrimaryProgramDetail({ app, productId, onSaved, go }) {
  const { data, error, reload } = useResource(() => api.bankProducts.compare({ applicationId: app.id }), [app.id])
  const item = data?.items.find((x) => x.productId === productId)
  if (error && !data) return <ErrorPanel onRetry={reload} />
  if (!data) return <LoadingCards count={2} className="md:grid-cols-2 xl:grid-cols-2" />
  if (!item) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Program tidak ditemukan"
        action={
          <Button size="md" onClick={() => go('/apply/primary/6')}>
            Kembali ke Daftar Program
          </Button>
        }
      >
        Program ini tidak tersedia untuk data pengajuan kamu saat ini.
      </EmptyState>
    )
  }
  return <ProgramSimulator key={item.productId} app={app} item={item} capacity={data.capacity} onSaved={onSaved} go={go} />
}

function ProgramSimulator({ app, item, capacity, onSaved, go }) {
  const { price } = app.data.property
  const dp = app.data.loan.downPayment ?? 0
  const maxLoan = price - dp
  const minLoan = Math.max(50_000_000, Math.floor((maxLoan * 0.5) / 5_000_000) * 5_000_000)
  const maxYears = Math.min(30, Math.floor(item.product.eligibility.maximumTenorMonths / 12))
  const [plafon, setPlafon] = useState(Math.min(app.data.loan.amount, maxLoan))
  const [years, setYears] = useState(Math.min(Math.round(app.data.loan.tenorMonths / 12), maxYears))
  const [ackStale, setAckStale] = useState(false)
  const [pending, setPending] = useState(false)
  const [apiError, setApiError] = useState('')
  const sim = useMemo(() => simulateLoan({ product: item.product, principal: plafon, termMonths: years * 12 }), [item.product, plafon, years])
  const room = capacity.remainingCapacity - sim.payment
  const scale = Math.max(sim.payment, capacity.remainingCapacity, 1) * 1.15

  const confirm = async () => {
    if (item.stale && !ackStale) return setApiError('Centang konfirmasi data produk dulu.')
    setPending(true)
    setApiError('')
    try {
      const saved = await api.applications.selectProgram(app.id, { bankProductId: item.productId, loanAmount: plafon, tenorMonths: years * 12 })
      onSaved(saved)
      toast('Program tersimpan.')
      go('/apply/primary/7')
    } catch (e) {
      setApiError(e.message)
      setPending(false)
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel className="gap-6 sm:p-7">
        <div className="flex items-center gap-3">
          <IconBox icon={LandmarkIcon} tone="muted" size="lg" />
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-extrabold">{item.bank.name}</h2>
            <span className="text-[13px] text-muted-foreground">
              {item.name} · bunga {percentBps(item.fixedRateBps)} fixed {item.fixedMonths / 12} th, lalu floating <EstimateTag>estimasi {percentBps(item.floatingRateBps)}</EstimateTag>
            </span>
          </div>
        </div>
        <Slider id="rk-plafon" label="Plafon" valueText={rupiah(plafon)} min={minLoan} max={maxLoan} step={5_000_000} value={plafon} onChange={setPlafon} minLabel={rupiahShort(minLoan)} maxLabel={`${rupiahShort(maxLoan)} (Harga − DP)`} />
        <Slider id="rk-tenor" label="Tenor" valueText={`${years} tahun`} min={5} max={maxYears} step={1} value={years} onChange={setYears} minLabel="5 tahun" maxLabel={`${maxYears} tahun`} />
        <dl className="flex flex-col rounded-[18px] bg-muted px-[18px] py-1.5" aria-live="polite">
          {[
            ['Cicilan per bulan (masa fixed)', rupiah(sim.payment), 'text-[22px]'],
            ...(sim.paymentAfterFixed ? [['Cicilan setelah fixed (estimasi)', rupiah(sim.paymentAfterFixed), 'text-[15px] text-warning-text']] : []),
            [`Total bunga (${years} tahun)`, rupiah(sim.totalInterest), 'text-[15px]'],
            ['Total bayar', rupiah(sim.totalPayment), 'text-[15px]'],
            ['Biaya admin + provisi', rupiah(Math.round((plafon * item.product.fees.provisionBps) / 10_000) + item.product.fees.admin), 'text-[15px]'],
          ].map(([k, v, cls]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-border py-3.5 last:border-b-0">
              <dt className="text-sm text-ink-3">{k}</dt>
              <dd className={cn('font-extrabold tabular', cls)}>{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <div className="flex min-w-0 flex-col gap-6">
        <Panel>
          <h2 className="text-lg font-extrabold">Cicilan vs kapasitas</h2>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">Kapasitas kamu</span>
            <span className="font-extrabold">{rupiah(Math.max(0, capacity.remainingCapacity))}/bln</span>
          </div>
          <div className="relative h-3.5 rounded-full bg-[#edf0f5]" role="img" aria-label={`Cicilan ${rupiah(sim.payment)} dibanding kapasitas ${rupiah(capacity.remainingCapacity)}`}>
            <div className={cn('absolute inset-y-0 left-0 rounded-full', room < 0 ? 'bg-warning-accent' : 'bg-primary')} style={{ width: `${(sim.payment / scale) * 100}%` }} />
            <div className="absolute -inset-y-1.5 w-[3px] rounded-sm bg-foreground" style={{ left: `${(Math.max(0, capacity.remainingCapacity) / scale) * 100}%` }} title="Batas kapasitas" />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Cicilan program ini</span>
            <span>▮ batas kapasitas</span>
          </div>
          {room < 0 ? (
            <Chip tone="warn" icon={TriangleAlertIcon} className="w-full rounded-xl px-3.5 py-2.5 text-[13px]">
              Melebihi kapasitas {rupiah(-room)}
            </Chip>
          ) : (
            <Chip tone="ok" icon={CircleCheckIcon} className="w-full rounded-xl px-3.5 py-2.5 text-[13px]">
              Masih dalam kapasitas · sisa {rupiah(room)}
            </Chip>
          )}
          <Disclaimer>Geser plafon atau tenor untuk melihat perubahan cicilan. Simulasi ini tidak mengubah data pengajuan sampai kamu konfirmasi.</Disclaimer>
        </Panel>
        {item.stale && (
          <Notice tone="warn" title="Data produk perlu dicek ulang">
            Data {item.bank.name} terakhir diverifikasi {dateShort(item.lastVerifiedAt)}. Angka bisa berbeda saat pengajuan diproses.
            <div className="mt-2">
              <CheckboxField label="Saya mengerti dan tetap ingin memilih program ini." checked={ackStale} onChange={setAckStale} />
            </div>
          </Notice>
        )}
        {apiError && (
          <Notice tone="bad" role="alert">
            {apiError}
          </Notice>
        )}
        <Button onClick={confirm} disabled={pending} aria-busy={pending}>
          {pending && <Spinner />}
          Pilih Program &amp; Lanjutkan
        </Button>
        <Button variant="neutral" size="sm" onClick={() => go('/apply/primary/6')}>
          Kembali ke daftar program
        </Button>
      </div>
    </div>
  )
}

export function Slider({ id, label, valueText, min, max, step, value, onChange, minLabel, maxLabel }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <span className="text-lg font-extrabold text-primary tabular">{valueText}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={valueText} className="h-6 w-full cursor-pointer" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}
