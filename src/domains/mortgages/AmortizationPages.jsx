import { Fragment, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRightIcon, TriangleAlertIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { dateShort, monthYear, percentBps, rupiah, rupiahShort, tenorLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { PageTour } from '@/components/shared/PageTour'
import { Disclaimer, ErrorPanel, Notice, Panel, PageSkeleton, StatTile, SummaryRows } from '@/components/shared/ui'
import { deriveMortgage } from './derive'

const DISCLAIMER = 'Proyeksi berdasarkan data KPR yang kamu masukkan. Bunga floating dan pembayaran aktual dapat berubah mengikuti kebijakan bank.'

function useMortgageSchedule() {
  const res = useResource(() => api.dashboard.getSnapshot())
  const m = res.data?.mortgages.find((x) => x.status === 'active') ?? null
  return { ...res, m, d: m ? deriveMortgage(m, res.data.clock) : null }
}

function PartialSchedule({ d }) {
  const navigate = useNavigate()
  if (d.scheduleError) {
    return (
      <Notice tone="bad" title="Jadwal amortisasi belum dapat dihitung." action={<Button size="xs" onClick={() => navigate('/monitoring/setup/1?edit=mykpr')}>Perbaiki Data</Button>}>
        {d.scheduleError.message} Periksa sisa pokok, tenor, dan periode bunga.
      </Notice>
    )
  }
  return (
    <section className="flex flex-col items-start gap-2.5 rounded-card border border-warning-border bg-card p-7">
      <h2 className="text-[17px] font-extrabold">Jadwal belum bisa dihitung lengkap.</h2>
      <p className="text-sm text-ink-3">Data yang belum tersedia: {d.scheduleMissing.join(', ')}. Kami tidak menampilkan jadwal perkiraan tanpa data ini.</p>
      <Button size="md" onClick={() => navigate('/monitoring/setup/1?edit=mykpr')}>
        Lengkapi Data Bunga
      </Button>
    </section>
  )
}

export function AmortizationPage() {
  const { data, error, reload, m, d } = useMortgageSchedule()
  if (!data) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  if (!m) return <Navigate to="/my-kpr" replace />
  const s = d.schedule
  const header = <PageHeader title="Jadwal Amortisasi" subtitle={`${m.bankName} · KPR Aktif`} crumb="KPR Saya › Payment › Amortisasi" back="/my-kpr/payment" actions={s && <PageTour id="amortization" seen={data.toursSeen} />} />
  if (!s) {
    return (
      <>
        {header}
        <PartialSchedule d={d} />
      </>
    )
  }
  const last = s.rows.at(-1)
  const maxPay = Math.max(...s.yearly.map((y) => y.payment))
  const floating = s.assumptions.find((a) => a.rateType === 'floating' && a.estimated)
  return (
    <>
      {header}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel data-tour="amort-summary" className="gap-1 sm:p-7">
          <SummaryRows
            rows={[
              { k: 'Sisa pinjaman', v: rupiah(m.outstandingPrincipal) },
              { k: 'Sisa tenor', v: `${s.rows.length} bulan (${tenorLabel(s.rows.length)})` },
              { k: 'Periode', v: `${monthYear(s.rows[0].dueDate)} – ${monthYear(last.dueDate)}` },
              { k: 'Metode', v: 'Anuitas' },
            ]}
          />
          <div className="h-3" />
          <SummaryRows
            rows={[
              { k: 'Pokok', v: rupiah(s.totals.principal) },
              { k: 'Estimasi bunga', v: rupiah(s.totals.interest) },
              { k: 'Total pembayaran', v: rupiah(s.totals.payment) },
              { k: 'Sisa pokok akhir', v: rupiah(s.totals.endingBalance) },
            ]}
          />
          <div data-tour="amort-rate" className="mt-3.5 flex flex-col gap-1 rounded-xl bg-muted px-4 py-3.5">
            <span className="text-xs font-extrabold text-ink-3">Asumsi rate</span>
            <span className="text-sm font-bold">
              {s.assumptions.map((a) => `${percentBps(a.annualRateBps)} ${a.rateType}${a.estimated ? ' (estimasi)' : ''}`).join(' → ')}
            </span>
          </div>
        </Panel>
        <Panel data-tour="amort-chart" className="sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-extrabold">Komposisi Pembayaran per Tahun</h2>
            <div className="flex gap-3.5 text-xs font-bold text-ink-3" aria-hidden>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] bg-primary" />
                Pokok
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] bg-chart-interest" />
                Bunga
              </span>
            </div>
          </div>
          <div role="img" aria-label={`Komposisi pokok dan bunga per tahun, ${s.yearly.length} tahun. Detail tersedia di tabel jadwal.`} className="flex h-60 items-stretch gap-1 border-b border-border pt-2 sm:gap-1.5">
            {s.yearly.map((y) => (
              <div key={y.year} title={`${y.year}: pokok ${rupiahShort(y.principal)}, bunga ${rupiahShort(y.interest)}`} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                <div className="flex w-full max-w-[30px] flex-col overflow-hidden rounded-t-md" style={{ height: `${(y.payment / maxPay) * 100}%` }}>
                  <div className="bg-chart-interest" style={{ height: `${(y.interest / y.payment) * 100}%` }} />
                  <div className="flex-1 bg-primary" />
                </div>
              </div>
            ))}
          </div>
          <div className="-mt-2 flex gap-1 sm:gap-1.5" aria-hidden>
            {s.yearly.map((y, i) => (
              <span key={y.year} className="min-w-0 flex-1 text-center text-[10px] text-muted-foreground sm:text-[11px]">
                {s.yearly.length > 12 && i % 2 ? '' : `'${y.year.slice(2)}`}
              </span>
            ))}
          </div>
          <table className="sr-only">
            <caption>Total pokok dan bunga per tahun</caption>
            <thead>
              <tr>
                <th scope="col">Tahun</th>
                <th scope="col">Pokok</th>
                <th scope="col">Bunga</th>
              </tr>
            </thead>
            <tbody>
              {s.yearly.map((y) => (
                <tr key={y.year}>
                  <th scope="row">{y.year}</th>
                  <td>{rupiah(y.principal)}</td>
                  <td>{rupiah(y.interest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {floating && (
            <Notice tone="warn" icon={TriangleAlertIcon}>
              Mulai {dateShort(s.rows[floating.startMonth].dueDate)} memakai estimasi floating {percentBps(floating.annualRateBps)}.
            </Notice>
          )}
          <Button asChild className="w-fit" data-tour="amort-full">
            <Link to="/my-kpr/amortization/jadwal">
              Lihat Jadwal Lengkap
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </Panel>
      </div>
      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </>
  )
}

const HEAD = ['Saldo Awal', 'Cicilan', 'Pokok', 'Bunga', 'Sisa Pokok']

export function AmortizationSchedulePage() {
  const { data, error, reload, m, d } = useMortgageSchedule()
  const [params, setParams] = useSearchParams()
  const [defaultView] = useState(() => (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches ? 'tahunan' : 'bulanan'))
  if (!data) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  if (!m) return <Navigate to="/my-kpr" replace />
  const s = d.schedule
  const header = <PageHeader title="Jadwal Lengkap" subtitle={`${m.bankName} · KPR Aktif`} crumb="KPR Saya › Payment › Amortisasi › Jadwal Lengkap" back="/my-kpr/amortization" />
  if (!s) {
    return (
      <>
        {header}
        <PartialSchedule d={d} />
      </>
    )
  }
  const view = params.get('view') ?? defaultView
  const years = s.yearly.map((y) => y.year)
  const year = years.includes(params.get('year')) ? params.get('year') : years[0]
  const set = (patch) => setParams({ view, year, ...patch }, { replace: true })
  const floatingLabel = (bps) => `Mulai periode floating — estimasi ${percentBps(bps)}`
  const rows =
    view === 'bulanan'
      ? s.rows.filter((r) => r.dueDate.startsWith(year)).map((r) => ({ key: r.month, label: dateShort(r.dueDate), rate: `${percentBps(r.annualRateBps)}${r.estimatedRate ? '*' : ''}`, estimate: r.estimatedRate, cells: [r.openingBalance, r.payment, r.principal, r.interest, r.closingBalance], banner: r.periodChanged && r.rateType === 'floating' ? floatingLabel(r.annualRateBps) : r.periodChanged ? `Mulai periode bunga ${percentBps(r.annualRateBps)}` : '' }))
      : s.yearly.map((y) => ({ key: y.year, label: y.year, rate: `${y.minRateBps === y.maxRateBps ? percentBps(y.minRateBps) : `${percentBps(y.minRateBps)}–${percentBps(y.maxRateBps)}`}${y.containsEstimate ? '*' : ''}`, estimate: y.containsEstimate, cells: [y.openingBalance, y.payment, y.principal, y.interest, y.closingBalance], banner: y.containsTransition ? floatingLabel(y.maxRateBps) : '' }))

  return (
    <>
      {header}
      <Panel className="gap-[18px] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="text-sm font-semibold text-ink-3" id="view-label">
              Tampilan
            </span>
            <div role="group" aria-labelledby="view-label" className="flex gap-1 rounded-full bg-muted p-1">
              {[
                ['bulanan', 'Bulanan'],
                ['tahunan', 'Tahunan'],
              ].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={view === k} onClick={() => set({ view: k })} className={cn('h-10 rounded-full px-[18px] text-[13px] font-bold', view === k ? 'bg-card text-primary shadow-sm' : 'text-ink-3')}>
                  {l}
                </button>
              ))}
            </div>
            {view === 'bulanan' && (
              <label className="flex items-center gap-2.5 text-sm font-semibold text-ink-3">
                Tahun
                <select value={year} onChange={(e) => set({ year: e.target.value })} className="h-11 rounded-lg border border-input bg-field px-3.5 text-sm font-bold text-foreground">
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <span className="text-[13px] text-muted-foreground">Sumber: KPR aktif · sisa pokok</span>
        </div>
        <div className="relative overflow-x-auto rounded-2xl border border-border" tabIndex={0} role="region" aria-label="Tabel jadwal amortisasi (dapat digeser)">
          <table className="w-full min-w-[860px] border-collapse text-[13px] tabular">
            <caption className="sr-only">Jadwal amortisasi {view === 'bulanan' ? `bulanan tahun ${year}` : 'tahunan'}. Tanda * = bunga estimasi.</caption>
            <thead className="bg-muted text-xs font-extrabold text-ink-3">
              <tr>
                <th scope="col" className="sticky left-0 bg-muted px-[18px] py-3.5 text-left">
                  {view === 'bulanan' ? 'Tanggal Angsuran' : 'Tahun'}
                </th>
                <th scope="col" className="px-3 py-3.5 text-left">
                  Bunga Tahunan
                </th>
                {HEAD.map((h) => (
                  <th key={h} scope="col" className="px-3 py-3.5 text-right last:pr-[18px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.key}>
                  {r.banner && (
                    <tr>
                      <td colSpan={7} className="border-t border-warning-border bg-warning-soft px-[18px] py-2.5 text-[13px] font-bold text-warning">
                        <span className="flex items-center gap-2">
                          <TriangleAlertIcon className="size-4" aria-hidden />
                          {r.banner}
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-line">
                    <th scope="row" className="sticky left-0 bg-card px-[18px] py-3 text-left font-bold">
                      {r.label}
                    </th>
                    <td className={cn('px-3 py-3 font-semibold', r.estimate && 'text-warning-text')}>{r.rate}</td>
                    {r.cells.map((c, i) => (
                      <td key={HEAD[i]} className={cn('px-3 py-3 text-right last:pr-[18px]', i === 1 && 'font-bold')}>
                        {rupiah(c)}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <StatTile label="Total Cicilan" value={rupiah(s.totals.payment)} />
          <StatTile label="Total Pokok" value={rupiah(s.totals.principal)} />
          <StatTile label="Total Bunga" value={rupiah(s.totals.interest)} />
          <StatTile label="Sisa Pokok" value={rupiah(s.totals.endingBalance)} />
        </div>
        <Disclaimer>{DISCLAIMER} Tanda * = bunga estimasi. Cicilan terakhir disesuaikan untuk pembulatan.</Disclaimer>
      </Panel>
    </>
  )
}
