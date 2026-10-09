import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRightIcon, CircleCheckIcon, CircleXIcon, InfoIcon, SearchXIcon, StarIcon, TriangleAlertIcon } from 'lucide-react'
import { api } from '@/data/api'
import { evaluateTakeoverProduct, TAKEOVER_SORTS } from '@/calculations/programs'
import { useResource } from '@/lib/hooks'
import { PURPOSES, dateShort, labelOf, monthYear, percentBps, percentRatio, rupiah, rupiahShort, tenorLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/domains/applications/PrimaryCompare'
import { BankMark, Chip, Disclaimer, EmptyState, ErrorPanel, EstimateTag, HeroCard, LoadingCards, Notice, Panel, PageSkeleton, Spinner, StatTile, SummaryRows } from '@/components/shared/ui'
import { activeApplication } from '@/domains/home/selectHomeState'
import { takeoverScreenOf } from '@/domains/applications/meta'
import { HEALTH_SENTENCE, HealthRing } from '@/domains/home/dashboardWidgets'
import { applicationHealth, simulationTeaser } from './insights'
import { OptimizeHeader, modeName, useOptimize } from './shared'

const ELIG = { estimated_eligible: ['Estimasi layak', 'ok'], needs_review: ['Perlu ditinjau', 'warn'], not_eligible: ['Berisiko ditolak', 'bad'] }
const COST_LABEL = {
  old_bank_penalty: (c) => `Penalti bank lama (${percentBps(c.rateBps)})`,
  old_bank_admin: () => 'Administrasi bank lama',
  provision: (c) => `Provisi (${percentBps(c.rateBps)})`,
  admin: () => 'Administrasi',
  appraisal: () => 'Appraisal',
  notary: () => 'Notaris & APHT',
  insurance: () => 'Asuransi',
}
const markOf = (name) => String(name ?? '').replace(/^Bank\s+/i, '').slice(0, 3).toUpperCase()

// Current simulation; re-runs it for a resumed Take Over draft that already passed step 5.
function useSimulation(sort) {
  return useResource(async () => {
    const snap = await api.dashboard.getSnapshot()
    const app = activeApplication(snap.applications)
    const draft = app?.productType === 'takeover' && app.status === 'draft' && app.currentStep >= 6 ? app : null
    if (draft && snap.simulation?.source?.id !== draft.id) await api.simulations.run({ source: { type: 'application', id: draft.id }, input: draft.data.goal })
    // `draft` rides along so the progress keeps the furthest saved screen (Dokumen/Review) when revisiting programs.
    return { ...(await api.simulations.getCurrent({ sort })), draft }
  }, [sort])
}

function NoSimulation({ error, onRetry }) {
  if (error?.code === 'RESOURCE_NOT_FOUND') {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Belum ada simulasi"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="md">
              <Link to="/explore">Buka Explore</Link>
            </Button>
            <Button asChild size="md" variant="outline">
              <Link to="/optimize/intro">Mulai Take Over</Link>
            </Button>
          </div>
        }
      >
        Mulai dari Explore (KPR aktif) atau pengajuan Take Over.
      </EmptyState>
    )
  }
  return <ErrorPanel title={error?.code === 'CALCULATION_FAILED' || error?.code === 'CALCULATION_INPUT_INCOMPLETE' ? 'Simulasi tidak dapat dihitung' : 'Data produk tidak tersedia'} message={error?.message} onRetry={onRetry} />
}

function Header({ sim, title, subtitle, back }) {
  const fromApp = sim?.source.type === 'application'
  return <OptimizeHeader screen={fromApp ? 7 : null} reached={sim?.draft ? takeoverScreenOf(sim.draft) : 7} title={title} subtitle={subtitle} back={back} />
}

// Phase 2 milestone (application flow only): the now-complete KPR Health score + one teaser from the simulation.
function PhaseTwoBanner({ sim, app, clock, healthConfig }) {
  const h = applicationHealth(app.data, clock, app.data.property?.estimatedValue ?? null, healthConfig)
  const weakest = h.components.filter((x) => x.score !== null).sort((a, b) => a.score - b.score)[0]
  // Same sentence logic as the Properti step's HealthAside.
  const sentence = h.tone === 'ok' ? 'Kondisi KPR kamu sehat.' : weakest?.key === 'rate' && h.rate.mode === 'floating' ? 'Bunga kamu sudah floating.' : HEALTH_SENTENCE[weakest?.key]
  return (
    <section aria-labelledby="phase2-title" className="flex flex-col gap-4 rounded-card bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-7">
      <HealthRing health={h} size={88} />
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <h2 id="phase2-title" className="flex items-center gap-2 text-lg font-extrabold">
          <CircleCheckIcon className="size-5 text-success-strong" aria-hidden />
          Tahap 2 selesai
        </h2>
        <Chip tone={h.tone}>
          Kesehatan KPR: {h.label}
          {h.partial ? ' · parsial' : ''}
        </Chip>
        {sentence && <p className="text-[13px] leading-5 font-semibold text-ink-2">{sentence}</p>}
        <p className="text-sm font-bold text-primary">{simulationTeaser(sim)}</p>
      </div>
    </section>
  )
}

export function BaselinePage() {
  const navigate = useNavigate()
  const { data: sim, error, reload, loading } = useSimulation()
  const { app, snap } = useOptimize() // the draft behind an application simulation, for the phase 2 banner
  if (!sim) return loading ? <PageSkeleton /> : <NoSimulation error={error} onRetry={reload} />
  const b = sim.baseline
  const topup = sim.input.mode === 'topup'
  const back = sim.source.type === 'application' ? '/optimize/5' : `/optimize/start?mode=${sim.input.mode}`
  return (
    <>
      <Header sim={sim} title="Kondisi KPR kamu" subtitle="Pembanding sebelum melihat program bank baru." back={back} />
      {sim.source.type === 'application' && app && <PhaseTwoBanner sim={sim} app={app} clock={snap.clock} healthConfig={snap.config.health} />}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="gap-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <BankMark mark={markOf(sim.oldBank.name)} tone="muted" />
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-extrabold">KPR kamu saat ini</h2>
                <span className="text-[13px] text-muted-foreground">
                  {sim.oldBank.name} · {sim.oldBank.productName ?? 'KPR'}
                </span>
              </div>
            </div>
            <Chip tone={sim.oldBank.estimated ? 'warn' : 'ok'}>{sim.oldBank.estimated ? 'Estimasi dari cicilan' : 'Angka resmi dari bank'}</Chip>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Sisa pokok" value={rupiah(b.outstanding)} />
            <StatTile label="Bunga saat ini" value={`${percentBps(b.rateBps)}${b.rateType ? ` · ${b.rateType === 'fixed' ? 'Fixed' : 'Floating'}` : ''}`} />
            <StatTile label="Cicilan saat ini" value={rupiah(b.currentPayment)} />
            <StatTile label="Sisa tenor" value={`${b.remainingMonths} bulan`} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="pb-1.5 text-sm font-extrabold">Estimasi biaya keluar dari bank lama</h3>
            <SummaryRows
              rows={[
                { k: `Penalti bank lama (${percentBps(b.exit.penaltyBps)})`, v: rupiah(b.exit.penalty), tag: b.exit.penaltyEstimated && <EstimateTag /> },
                { k: 'Administrasi dokumen', v: rupiah(b.exit.admin), tag: <EstimateTag /> },
                { k: 'Total', v: rupiah(b.exit.total), strong: true },
              ]}
            />
          </div>
          <Disclaimer>Biaya final mengikuti bank lama. Penalti tanpa angka resmi memakai perkiraan kebijakan produk.</Disclaimer>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel className="gap-1.5">
            <h2 className="pb-1.5 text-base font-extrabold">Jika tetap di {sim.oldBank.name}</h2>
            <SummaryRows
              size="sm"
              rows={[
                { k: 'Sisa pembayaran', v: rupiah(b.totalPayment) },
                { k: 'Sisa bunga', v: rupiah(b.totalInterest) },
                { k: 'Perkiraan lunas', v: monthYear(b.payoffDate) },
              ]}
            />
            <Disclaimer className="pt-1.5">{b.fixedMonthsLeft != null ? `Cicilan saat ini sampai fixed berakhir, lalu estimasi floating.` : 'Dengan asumsi bunga saat ini tidak berubah.'}</Disclaimer>
          </Panel>
          {topup && (
            <section className="flex flex-col gap-1.5 rounded-card bg-secondary px-6 py-5">
              <span className="text-xs font-extrabold text-primary">KEBUTUHAN DANA TAMBAHAN</span>
              <span className="text-2xl font-extrabold">{rupiah(sim.input.requestedTopup)}</span>
              <span className="text-[13px] text-ink-3">
                Untuk {labelOf(PURPOSES, sim.input.purpose)} · tenor {tenorLabel(sim.input.tenorMonths)}
              </span>
            </section>
          )}
          <Button onClick={() => navigate('/optimize/programs')}>
            Bandingkan Program
            <ArrowRightIcon aria-hidden />
          </Button>
        </div>
      </div>
    </>
  )
}

export function ProgramsPage() {
  const navigate = useNavigate()
  const [sort, setSort] = useState(undefined)
  const { data: sim, error, reload, loading } = useSimulation(sort)
  if (!sim) return loading ? <><Header title="Pilihan program" /><LoadingCards count={3} /></> : <NoSimulation error={error} onRetry={reload} />
  const topup = sim.input.mode === 'topup'
  const b = sim.baseline
  const sorts = topup ? ['rekomendasi', 'cicilan', 'total'] : ['total', 'cicilan', 'fixed', 'bunga']
  return (
    <>
      <Header sim={sim} title={`Pilihan ${modeName(sim.input.mode)}`} subtitle="Estimasi berdasarkan profil kamu. Pilih satu program." back="/optimize/baseline" />
      <HeroCard scenery={false} className="flex-row flex-wrap items-center justify-between gap-4 px-[22px] py-[18px] sm:px-[22px] sm:py-[18px]">
        <div className="flex items-center gap-3">
          <BankMark mark={markOf(sim.oldBank.name)} tone="glass" size="sm" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-white/80">Pembanding · KPR saat ini</span>
            <span className="text-sm font-bold">
              {sim.oldBank.name} · {rupiah(b.currentPayment)}/bln · {percentBps(b.rateBps)} · {b.remainingMonths} bulan
            </span>
          </div>
        </div>
        {topup && <Chip tone="glass">Butuh {rupiahShort(sim.input.requestedTopup)} · {labelOf(PURPOSES, sim.input.purpose)}</Chip>}
      </HeroCard>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-[15px] font-bold text-ink-3">{sim.items.length} program sesuai estimasi profil</span>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Urutkan program">
          <span className="text-[13px] font-semibold text-ink-3">Urutkan</span>
          <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
            {sorts.map((k) => (
              <button key={k} type="button" aria-pressed={sim.sort === k} onClick={() => setSort(k)} className={cn('h-9 rounded-full px-3.5 text-[13px] font-bold', sim.sort === k ? 'bg-primary text-white' : 'text-ink-3')}>
                {TAKEOVER_SORTS[k].label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {!sim.items.length && <EmptyState icon={SearchXIcon} title="Belum ada program yang cocok" action={<Button size="md" variant="secondary" onClick={() => navigate(sim.source.type === 'application' ? '/optimize/5' : `/optimize/start?mode=${sim.input.mode}`)}>Ubah tujuan</Button>}>Coba tenor lebih panjang atau kurangi dana tambahan.</EmptyState>}
      <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3', loading && 'opacity-60')} aria-busy={loading}>
        {sim.items.map((x) => (
          <ProgramCard key={x.productId} x={x} sim={sim} onOpen={() => navigate(`/optimize/programs/${x.productId}`)} />
        ))}
      </div>
      <Disclaimer>Urutan berbasis aturan dari data produk terbaru. Kelayakan, plafon, dan dana bersih adalah estimasi sebelum verifikasi dan appraisal resmi.</Disclaimer>
    </>
  )
}

function statusLine(x) {
  if (x.mode === 'topup') {
    if (!x.purposeOk) return { tone: 'bad', icon: CircleXIcon, t: x.reasons[0] }
    if (!x.topup) return { tone: 'warn', icon: TriangleAlertIcon, t: 'Nilai properti belum diisi, dana bersih belum dapat dihitung.' }
    if (x.topup.fundingGap > 0) return { tone: 'warn', icon: TriangleAlertIcon, t: `Belum memenuhi kebutuhan dana. Kurang ${rupiah(x.topup.fundingGap)}.` }
    return { tone: 'ok', icon: CircleCheckIcon, t: 'Kebutuhan dana terpenuhi (estimasi).' }
  }
  if (x.reasons.length) return { tone: x.eligibility === 'not_eligible' ? 'bad' : 'warn', icon: TriangleAlertIcon, t: `${x.reasons.join('. ')}.` }
  return null
}

const TONE_BOX = { ok: 'bg-success-bg text-success', warn: 'bg-warning-bg text-warning', bad: 'bg-danger-bg text-danger-strong' }

function ProgramCard({ x, sim, onOpen }) {
  const topup = sim.input.mode === 'topup'
  const [eligLabel, eligTone] = ELIG[x.eligibility]
  const st = statusLine(x)
  const stats = topup
    ? [
        ['Plafon baru', rupiah(x.principal)],
        ['Pelunasan KPR lama', rupiah(sim.baseline.outstanding)],
        ['Estimasi biaya', rupiah(x.feesTotal)],
        ['Dana bersih diterima', x.topup ? rupiah(x.topup.netTopup) : 'Belum tersedia', x.topup?.fundingGap > 0 ? 'warn' : 'ok'],
        ['Cicilan baru', rupiah(x.payment)],
        [`LTV baru · tenor ${x.tenorMonths / 12} th`, x.ltvRatio != null ? percentRatio(x.ltvRatio) : 'Belum tersedia'],
      ]
    : [
        ['Cicilan baru', rupiah(x.payment)],
        ['Selisih per bulan', `${x.monthlyDiff > 0 ? '−' : '+'}${rupiah(Math.abs(x.monthlyDiff))}`, x.monthlyDiff > 0 ? 'ok' : 'bad'],
        ['Biaya pindah', rupiah(x.upfrontCosts)],
        ['Break-even', x.breakEven.month ? `${x.breakEven.month} bulan` : 'Tidak ada', x.breakEven.month ? undefined : 'bad'],
        ['Floating setelah fixed', `est. ${percentBps(x.floatingRateBps)}`],
        ['Estimasi DTI', percentRatio(x.dtiRatio), eligTone],
      ]
  return (
    <article className={cn('flex flex-col gap-[18px] rounded-card border-2 bg-card p-6 shadow-card', x.recommended ? 'border-primary' : 'border-card')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <BankMark mark={x.bank.mark} />
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[17px] font-extrabold">{x.bank.name}</h3>
            <span className="text-[13px] text-muted-foreground">
              {x.name} · {percentBps(x.fixedRateBps)} fixed {x.fixedMonths / 12} th
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {x.recommended && <Chip tone="solid" icon={StarIcon}>Rekomendasi dari kami</Chip>}
          {x.recommended && !topup && <Chip tone="info">Sesuai tujuan kamu</Chip>}
          <Chip tone={eligTone}>{eligLabel}</Chip>
          {sim.excludedProductIds.includes(x.productId) && <Chip tone="bad">Pernah ditolak</Chip>}
          {x.stale && <Chip tone="warn">Data perlu dicek ulang</Chip>}
        </div>
      </div>
      <SummaryRows size="sm" rows={stats.map(([k, v, tone]) => ({ k, v, tone }))} />
      {st && (
        <div className={cn('flex items-center gap-2 rounded-xl px-3.5 py-3 text-[13px] font-bold', TONE_BOX[st.tone])}>
          <st.icon className="size-4 shrink-0" aria-hidden />
          {st.t}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <span className={cn('text-xs', x.stale ? 'font-semibold text-warning-text' : 'text-muted-foreground')}>{x.stale ? `Data produk terakhir diperbarui ${dateShort(x.lastVerifiedAt)}. Angka bisa berbeda.` : `Data produk diperbarui ${dateShort(x.lastVerifiedAt)}`}</span>
        <Button variant="outline" size="sm" onClick={onOpen}>
          Lihat Detail
          <ArrowRightIcon aria-hidden />
        </Button>
      </div>
    </article>
  )
}

export function ProgramDetailPage() {
  const { productId } = useParams()
  const { data: sim, error, reload, loading } = useSimulation()
  if (!sim) return loading ? <PageSkeleton /> : <NoSimulation error={error} onRetry={reload} />
  const item = sim.items.find((x) => x.productId === productId)
  if (!item) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Program tidak ditemukan"
        action={
          <Button asChild size="md">
            <Link to="/optimize/programs">Kembali ke Daftar Program</Link>
          </Button>
        }
      />
    )
  }
  return <ProgramDetail key={productId} sim={sim} item={item} />
}

function ProgramDetail({ sim, item }) {
  const navigate = useNavigate()
  const topup = sim.input.mode === 'topup'
  const b = sim.baseline
  const [years, setYears] = useState(item.tenorMonths / 12)
  const [plafon, setPlafon] = useState(item.principal)
  const [saving, setSaving] = useState(false)
  // Same pure function as the adapter, so slider results match the program list (doc 03 §20).
  const x = useMemo(() => evaluateTakeoverProduct({ product: item.product, baseline: b, input: sim.input, asOf: sim.asOf, plafonOverride: topup ? plafon : null, tenorMonthsOverride: years * 12 }), [item.product, b, sim.input, sim.asOf, topup, plafon, years])
  const [eligLabel, eligTone] = ELIG[x.eligibility]
  const maxSlider = Math.max(x.minPlafon, x.maxPlafon ?? x.minPlafon)
  const warn = x.monthlyDiff <= 0 && !topup ? 'Cicilan baru tidak lebih ringan, jadi tidak ada break-even dari penghematan cicilan bulanan. Pertimbangkan hanya jika tujuanmu fixed lebih lama atau tenor lebih pendek.' : x.stale ? `Data produk ${x.bank.name} terakhir diperbarui ${dateShort(x.lastVerifiedAt)}. Angka bisa berbeda.` : ''
  const finish = async () => {
    setSaving(true)
    try {
      await api.simulations.save(sim.id)
      toast('Riwayat simulasi belum tersedia pada versi ini. Tidak ada data yang dikirim ke bank.')
      navigate(sim.source.type === 'mortgage' ? '/explore' : '/')
    } finally {
      setSaving(false)
    }
  }
  const compareRows = [
    [topup ? 'Pinjaman' : 'Pokok', rupiah(b.outstanding), rupiah(x.principal)],
    ['Bunga', `${percentBps(b.rateBps)}${b.rateType ? ` ${b.rateType}` : ''}`, `${percentBps(x.fixedRateBps)} fixed ${x.fixedMonths / 12} th`],
    ['Setelah fixed', b.fixedMonthsLeft != null ? 'Floating (estimasi)' : '—', `Floating est. ${percentBps(x.floatingRateBps)}`],
    ['Cicilan / bulan', rupiah(b.currentPayment), rupiah(x.payment), x.payment < b.currentPayment ? 'ok' : 'bad'],
    ['Tenor', `${b.remainingMonths} bln tersisa`, `${x.tenorMonths} bulan`],
    ['Total bunga', rupiah(b.totalInterest), rupiah(x.totalInterest)],
    ['Total pembayaran', rupiah(b.totalPayment), rupiah(x.totalPayment)],
  ]
  return (
    <>
      <Header sim={sim} title={`${x.bank.name} · ${x.name}`} subtitle="Detail program & simulasi" back="/optimize/programs" />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="relative gap-0 overflow-x-auto px-6 py-6 sm:px-7">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">Perbandingan KPR lama dan program baru</caption>
              <thead>
                <tr className="border-b border-border text-xs font-extrabold">
                  <th scope="col" className="pb-3 text-left" />
                  <th scope="col" className="pb-3 text-left text-muted-foreground">
                    {sim.oldBank.name} · saat ini
                  </th>
                  <th scope="col" className="pb-3 text-left text-primary">
                    {x.bank.name} · baru
                  </th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map(([k, a, n, tone]) => (
                  <tr key={k} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-3 text-left font-normal text-ink-3">
                      {k}
                    </th>
                    <td className="py-3 font-bold tabular">{a}</td>
                    <td className={cn('py-3 font-extrabold tabular', tone === 'ok' && 'text-success', tone === 'bad' && 'text-danger')}>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel className="gap-5 sm:p-7">
            <h2 className="text-base font-extrabold">Atur simulasi</h2>
            <Slider id="to-tenor" label="Tenor baru" valueText={`${years} tahun`} min={5} max={Math.min(25, x.product?.eligibility.maximumTenorMonths / 12 || 25)} step={1} value={years} onChange={setYears} minLabel="5 th" maxLabel={`${Math.min(25, item.product.eligibility.maximumTenorMonths / 12)} th`} />
            {topup && maxSlider > x.minPlafon && <Slider id="to-plafon" label="Plafon baru" valueText={rupiah(x.principal)} min={x.minPlafon} max={maxSlider} step={5_000_000} value={plafon} onChange={setPlafon} minLabel={rupiahShort(x.minPlafon)} maxLabel={rupiahShort(maxSlider)} />}
          </Panel>
          {topup && (
            <Panel className="gap-1 sm:p-7">
              <h2 className="pb-1.5 text-base font-extrabold">Rincian dana Top-up</h2>
              {x.topup ? (
                <>
                  <SummaryRows
                    rows={[
                      { k: 'Plafon baru', v: rupiah(x.principal) },
                      { k: 'Pelunasan KPR lama', v: `−${rupiah(b.outstanding)}` },
                      { k: 'Top-up kotor', v: rupiah(x.topup.grossTopup) },
                      { k: 'Biaya dipotong', v: `−${rupiah(x.topup.deductedCosts)}` },
                      { k: 'Dana bersih diterima', v: rupiah(x.topup.netTopup), tone: x.topup.fundingGap > 0 ? 'warn' : 'ok', strong: true },
                      { k: `LTV baru (maks ${item.product.eligibility.maximumLtvBps / 100}%)`, v: percentRatio(x.topup.newLtvRatio), tone: x.topup.withinLtv ? undefined : 'bad' },
                    ]}
                  />
                  <div className={cn('mt-2.5 flex items-center gap-2 rounded-xl px-3.5 py-3 text-[13px] font-bold', !x.purposeOk ? TONE_BOX.bad : x.topup.fundingGap > 0 ? TONE_BOX.warn : TONE_BOX.ok)}>
                    {!x.purposeOk ? x.reasons[0] : x.topup.fundingGap > 0 ? `Kurang ${rupiah(x.topup.fundingGap)} dari kebutuhan ${rupiah(sim.input.requestedTopup)}. Naikkan plafon atau pilih bank lain.` : `Kebutuhan dana ${rupiah(sim.input.requestedTopup)} terpenuhi.`}
                  </div>
                </>
              ) : (
                <Notice tone="warn">Nilai properti belum diisi, jadi dana Top-up belum dapat dihitung.</Notice>
              )}
            </Panel>
          )}
          <Panel className="gap-1 sm:p-7">
            <h2 className="pb-1.5 text-base font-extrabold">{topup ? 'Biaya (dipotong dari pencairan)' : 'Biaya pindah'}</h2>
            <SummaryRows rows={[...x.costs.map((c) => ({ k: COST_LABEL[c.code](c), v: rupiah(c.amount), tag: c.estimated && <EstimateTag /> })), { k: 'Total', v: rupiah(x.feesTotal), strong: true }]} />
          </Panel>
        </div>
        <aside className="flex flex-col gap-3.5 rounded-card bg-card p-6 shadow-card xl:sticky xl:top-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-[13px] font-extrabold text-ink-3">{topup ? 'Dana bersih diterima' : 'Selisih cicilan per bulan'}</span>
            <Chip tone={eligTone}>{eligLabel}</Chip>
          </div>
          <span className={cn('text-[34px] leading-tight font-extrabold tracking-[-0.6px] tabular', topup ? (x.topup?.fundingGap > 0 ? 'text-warning-text' : 'text-success-strong') : x.monthlyDiff > 0 ? 'text-success-strong' : 'text-danger')}>
            {topup ? (x.topup ? rupiah(x.topup.netTopup) : 'Belum tersedia') : x.monthlyDiff > 0 ? `−${rupiah(x.monthlyDiff)}` : `+${rupiah(Math.abs(x.monthlyDiff))}`}
          </span>
          <SummaryRows
            size="sm"
            rows={
              topup
                ? [
                    { k: 'Cicilan baru', v: `${rupiah(x.payment)}/bln`, tone: x.paymentWithinCap ? undefined : 'bad' },
                    { k: 'Total bunga', v: rupiah(x.totalInterest) },
                    { k: 'Total pembayaran', v: rupiah(x.totalPayment) },
                    { k: 'Estimasi DTI', v: `${percentRatio(x.dtiRatio)} (batas ${x.maxDtiBps / 100}%)`, tone: eligTone },
                  ]
                : [
                    { k: 'Break-even', v: x.breakEven.month ? `${x.breakEven.month} bulan` : 'Tidak ada titik impas', tone: x.breakEven.month ? undefined : 'bad' },
                    x.breakEven.month && x.sustainedBreakEvenMonth !== x.breakEven.month && { k: 'Break-even bertahan', v: x.sustainedBreakEvenMonth ? `${x.sustainedBreakEvenMonth} bulan` : 'Tidak bertahan', tone: 'warn' },
                    { k: `Net saving sampai ${tenorLabel(x.horizonMonths)}`, v: rupiah(x.netSaving), tone: x.netSaving >= 0 ? 'ok' : 'bad' },
                    { k: 'Total bunga', v: rupiah(x.totalInterest) },
                    { k: 'Estimasi DTI', v: `${percentRatio(x.dtiRatio)} (batas ${x.maxDtiBps / 100}%)`, tone: eligTone },
                  ]
            }
          />
          {warn && (
            <div className="flex items-start gap-2 rounded-xl bg-warning-bg px-3.5 py-3 text-[13px] leading-[19px] font-semibold text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {warn}
            </div>
          )}
          <Button onClick={() => navigate(`/optimize/programs/${x.productId}/confirm`, { state: { tenorMonths: x.tenorMonths, plafon: topup ? x.principal : null } })}>
            Ajukan {x.bank.name}
            <ArrowRightIcon aria-hidden />
          </Button>
          <Button variant="outline" size="md" onClick={finish} disabled={saving}>
            {saving && <Spinner />}
            Selesai Simulasi
          </Button>
          <Disclaimer>Selesai Simulasi tidak mengirim data ke bank dan tidak membuat pengajuan. Semua angka estimasi sebelum appraisal dan persetujuan.</Disclaimer>
        </aside>
      </div>
    </>
  )
}

export function ConfirmProgramPage() {
  const { productId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { data: sim, error, reload, loading } = useSimulation()
  const [pending, setPending] = useState(false)
  const [apiError, setApiError] = useState('')
  if (!sim) return loading ? <PageSkeleton /> : <NoSimulation error={error} onRetry={reload} />
  const item = sim.items.find((x) => x.productId === productId)
  if (!item) return <Navigate to="/optimize/programs" replace />
  const topup = sim.input.mode === 'topup'
  const x = evaluateTakeoverProduct({ product: item.product, baseline: sim.baseline, input: sim.input, asOf: sim.asOf, plafonOverride: state?.plafon ?? null, tenorMonthsOverride: state?.tenorMonths ?? item.tenorMonths })
  const apply = async () => {
    setPending(true)
    setApiError('')
    try {
      await api.simulations.apply({ bankProductId: x.productId, tenorMonths: x.tenorMonths, plafon: topup ? x.principal : null })
      toast(`${x.bank.name} dipilih. Lanjut unggah dokumen.`)
      navigate('/optimize/6')
    } catch (e) {
      setApiError(e.message)
      setPending(false)
    }
  }
  return (
    <>
      <Header sim={sim} title="Konfirmasi pilihan" subtitle="1 pengajuan untuk 1 bank/program." back={`/optimize/programs/${productId}`} />
      <div className="flex justify-center">
        <section className="flex w-full max-w-[620px] flex-col gap-5 rounded-card bg-card p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3.5">
            <BankMark mark={x.bank.mark} size="lg" />
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-extrabold">{x.bank.name}</h2>
              <span className="text-sm text-muted-foreground">
                {x.name} · {percentBps(x.fixedRateBps)}
              </span>
            </div>
          </div>
          <SummaryRows
            rows={[
              { k: 'Plafon', v: rupiah(x.principal) },
              { k: 'Tenor', v: tenorLabel(x.tenorMonths) },
              { k: 'Estimasi cicilan', v: `${rupiah(x.payment)}/bln` },
              { k: 'Estimasi biaya', v: rupiah(x.feesTotal) },
              topup && x.topup && { k: 'Dana bersih diterima', v: rupiah(x.topup.netTopup) },
            ]}
          />
          <div className="flex items-center gap-2.5 rounded-xl bg-secondary px-4 py-3.5 text-[13px] font-semibold text-ink-2">
            <InfoIcon className="size-4 shrink-0 text-primary" aria-hidden />
            Pengajuan ini hanya dikirim ke satu bank/program. Kamu bisa memilih bank lain jika pengajuan ini tidak disetujui.
          </div>
          {apiError && (
            <Notice tone="bad" role="alert" action={apiError.includes('pengajuan aktif') ? <Link to="/my-kpr" className="text-[13px] font-bold text-primary underline">Buka My KPR</Link> : null}>
              {apiError}
            </Notice>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex-[1_1_160px]" onClick={() => navigate(`/optimize/programs/${productId}`)}>
              Kembali
            </Button>
            <Button className="flex-[1_1_200px]" onClick={apply} disabled={pending} aria-busy={pending}>
              {pending && <Spinner />}
              Lanjut Dokumen
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
