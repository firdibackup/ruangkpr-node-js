import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CircleDotIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { percentRatio, rupiah, rupiahShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { Chip, Disclaimer, ErrorPanel, InfoTip, Notice, Panel, PageSkeleton, ProgressBar } from '@/components/shared/ui'
import { HEALTH_ABOUT, HEALTH_SENTENCE, HealthRing, healthMissing } from '@/domains/home/dashboardWidgets'
import { HEALTH_V1, deriveMortgage } from './derive'
import { PropertyDialog } from './MyKprTabs'
import { progressGap } from './setupMeta'

const BAR = { ok: 'bg-success-strong', warn: 'bg-warning-accent', bad: 'bg-brand-red' }
const TEXT = { ok: 'text-success', warn: 'text-warning-text', bad: 'text-danger' }
const MEANING = {
  ok: 'Sehat berarti kondisi KPR kamu secara umum aman.',
  warn: 'Perlu perhatian berarti belum berisiko, tapi ada komponen yang skornya rendah dan perlu dipantau.',
  bad: 'Berisiko berarti beberapa komponen membebani KPR kamu dan perlu segera ditindaklanjuti.',
}
const MEASURES = {
  dti: 'Total cicilan bulanan (KPR dan cicilan lain) dibanding penghasilan. Makin kecil, makin ringan.',
  ltv: 'Sisa pokok dibanding estimasi nilai rumah. Makin kecil, makin besar equity kamu.',
  rate: 'Seberapa dekat KPR kamu ke bunga floating, yang biasanya membuat cicilan naik.',
  progress: 'Porsi pokok pinjaman yang sudah lunas, bukan jumlah bulan yang sudah berjalan.',
}
const pct = (bps) => percentRatio(bps / 10_000, 0)
const sign = (n) => (n > 0 ? '+' : '')

// Bands of the published formula, best score first, marking the one the user falls in (same rule as healthScore).
function bandRows(key, p, d) {
  const rows = (steps, value, fmt, scale = 1) =>
    steps.map((s, i) => ({
      range: s.upTo === null ? `> ${fmt(steps[i - 1].upTo)}` : `≤ ${fmt(s.upTo)}`,
      score: s.score,
      mine: value != null && i === steps.findIndex((t) => t.upTo === null || value <= t.upTo / scale),
    }))
  if (key === 'dti') return rows(p.dti, d.dti?.dtiRatio, pct, 10_000)
  if (key === 'ltv') return rows(p.ltv, d.property?.ltvRatio, pct, 10_000)
  if (key !== 'rate') return null
  const days = d.mode === 'normal' || d.mode === 'warning' ? (d.daysUntilFixedEnd ?? Infinity) : null
  const fixed = rows(p.rate.fixedDays, days, (n) => `${n} hari`).map((r) => ({ ...r, range: `Fixed berakhir ${r.range} lagi` }))
  return [...fixed.reverse(), { range: 'Sudah floating', score: p.rate.floating, mine: d.mode === 'floating' }]
}

function componentHint(key, p, rows) {
  const better = rows?.[rows.findIndex((r) => r.mine) - 1]
  if (key === 'dti') return better && `Skor naik ke ${better.score} bila rasio cicilan turun ke ${better.range}.`
  if (key === 'ltv') return better && `Skor naik ke ${better.score} bila LTV turun ke ${better.range}, misalnya lewat pelunasan sebagian.`
  if (key === 'rate') return 'Skor turun saat masa fixed mendekati akhir. Bandingkan opsi sebelum floating.'
  return `Skor = ${p.progress.base} + ${p.progress.perPaid} × porsi pokok lunas, maksimal 100.`
}

export function HealthPage() {
  const navigate = useNavigate()
  const { data, error, reload } = useResource(() => api.dashboard.getSnapshot())
  const [askProperty, setAskProperty] = useState(false)
  if (!data) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const m = data.mortgages.find((x) => x.status === 'active')
  if (!m) return <Navigate to="/my-kpr" replace />
  const d = deriveMortgage(m, data.clock, data.config.health)
  const p = (data.config.health ?? HEALTH_V1).params
  // Locked until penghasilan is filled; Home asks for it.
  if (!(d.income > 0)) return <Navigate to="/" replace />
  const h = d.health
  const weakest = h.components.filter((c) => c.score !== null).sort((a, b) => a.score - b.score)[0]
  const counted = h.components.filter((c) => c.score !== null && p.weights[c.key] > 0)
  const equalWeights = counted.every((c) => p.weights[c.key] === p.weights[counted[0].key])
  const levels = [
    { tone: 'ok', label: `Sehat ≥ ${p.labels.healthy}` },
    { tone: 'warn', label: `Perlu perhatian ${p.labels.attention}–${p.labels.healthy - 1}` },
    { tone: 'bad', label: `Berisiko < ${p.labels.attention}` },
  ]
  const fi = d.floatingImpact
  // One "Lengkapi" action per component that cannot be scored yet; the property value opens the same pop-up as Home.
  const complete = {
    ltv: { label: 'Isi nilai properti', onClick: () => setAskProperty(true) },
    rate: { label: 'Isi jenis bunga', to: '/monitoring/setup/1?edit=mykpr' },
    progress: progressGap(m, 'mykpr'),
  }
  const evidence = {
    dti: d.dti ? `Rasio cicilan ${percentRatio(d.dti.dtiRatio)} dari penghasilan` : 'Penghasilan belum diisi',
    ltv: d.property ? `LTV ${percentRatio(d.property.ltvRatio)} (sisa pokok ÷ estimasi nilai rumah)` : 'Nilai properti belum diisi',
    rate: d.mode == null ? 'Jenis bunga belum diketahui' : d.mode === 'floating' ? 'Sudah menggunakan bunga floating' : d.daysUntilFixedEnd != null ? `Fixed berakhir ${d.daysUntilFixedEnd} hari lagi` : 'Tanggal akhir fixed belum diisi',
    progress: d.paidRatio == null ? 'Progres pelunasan belum diketahui' : `${Math.round(d.paidRatio * 100)}% pokok sudah lunas`,
  }
  const todo = [
    d.mode === 'warning' && d.floatingImpact && `Siapkan kenaikan cicilan sekitar ${rupiah(d.floatingImpact.monthlyDelta)}/bln setelah fixed berakhir (estimasi).`,
    (d.mode === 'warning' || d.mode === 'floating') && 'Bandingkan opsi Take Over atau repricing sebelum/selama floating.',
    d.dti && d.dti.dtiRatio > 0.35 && 'Rasio cicilan di atas 35%: hindari utang baru dan pertimbangkan tenor atau opsi lain.',
    !d.property && 'Lengkapi nilai properti untuk menghitung equity dan LTV.',
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            KPR Health
            <InfoTip label="Tentang KPR Health">{HEALTH_ABOUT}</InfoTip>
          </span>
        }
        subtitle={h.score == null ? 'Belum lengkap · lengkapi data di bawah' : `${h.score}/100 · ${h.label}${h.partial ? ' · skor sementara' : ''}`}
        back="/"
      />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel className="gap-1.5 sm:p-7">
          {h.score == null ? (
            <p className="mb-2.5 text-[15px] leading-[22px] font-semibold text-ink-2">Lengkapi data di bawah untuk melihat KPR Health.</p>
          ) : (
            <div className="mb-2.5 flex items-center gap-4">
              <HealthRing health={h} size={96} />
              <div className="flex min-w-0 flex-col items-start gap-2">
                <Chip tone={h.tone}>{h.label}</Chip>
                <p className="text-[15px] leading-[22px] font-semibold text-ink-2">{h.tone === 'ok' ? 'Kondisi KPR kamu sehat.' : HEALTH_SENTENCE[weakest?.key]}</p>
              </div>
            </div>
          )}
          {h.score != null && (
            <div className="flex flex-col gap-2.5 rounded-2xl bg-muted px-4 py-3.5 text-[13px] leading-5 text-ink-2">
              <p>
                Skor {h.score} adalah {equalWeights ? `rata-rata ${counted.length} komponen di bawah: (${counted.map((c) => c.score).join(' + ')}) ÷ ${counted.length}` : `rata-rata berbobot ${counted.length} komponen di bawah`}. {MEANING[h.tone]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {levels.map((l) => (
                  <Chip key={l.tone} tone={l.tone === h.tone ? l.tone : 'mute'} className={l.tone !== h.tone && 'bg-card'}>
                    {l.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {h.partial && h.score != null && (
            <Notice tone="warn" className="mt-1.5">
              Skor sementara — lengkapi {healthMissing(h)} agar penilaian lebih lengkap.
            </Notice>
          )}
          <ul className="flex flex-col">
            {h.components.map((c) => {
              const rows = bandRows(c.key, p, d)
              const hint = componentHint(c.key, p, rows)
              return (
                <li key={c.key} className="flex flex-col gap-2 border-b border-line py-3.5 last:border-b-0">
                  <div className="flex items-center justify-between gap-3 text-[15px] font-extrabold">
                    <span className="flex items-center gap-2">
                      {c.name}
                      <InfoTip label={`Cara menghitung ${c.name}`}>
                        <p>{MEASURES[c.key]}</p>
                        {rows && (
                          <ul className="mt-2.5 flex flex-col" aria-label="Rentang skor">
                            {rows.map((r) => (
                              <li key={r.range} className={cn('-mx-2 flex justify-between gap-3 rounded-lg px-2 py-1', r.mine && 'bg-muted font-extrabold')}>
                                <span>{r.range}</span>
                                <span className="tabular">{r.mine ? `${r.score} · kamu` : r.score}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {hint && <p className="mt-2.5 text-ink-3">{hint}</p>}
                      </InfoTip>
                    </span>
                    {c.score !== null ? (
                      <span className={TEXT[c.tone]}>{c.score}/100</span>
                    ) : complete[c.key].to ? (
                      <Button asChild variant="outline" size="sm">
                        <Link to={complete[c.key].to}>{complete[c.key].label}</Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={complete[c.key].onClick}>
                        {complete[c.key].label}
                      </Button>
                    )}
                  </div>
                  {c.score !== null && <ProgressBar value={c.score} label={`${c.name} ${c.score} dari 100`} barClassName={BAR[c.tone]} />}
                  <span className="text-[13px] text-ink-3">{evidence[c.key]}</span>
                  {c.key === 'rate' && fi && (
                    <span className="text-[13px] text-ink-3">
                      {`Cicilan ${rupiahShort(fi.currentPayment)} → estimasi ${rupiahShort(fi.estimatedNextPayment)} setelah fixed (${sign(fi.monthlyDelta)}${rupiahShort(fi.monthlyDelta)}/bln, ${sign(fi.relativeDelta)}${percentRatio(fi.relativeDelta)})`}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <Disclaimer>Dihitung dengan formula KPR Health versi {h.version}. Bobot final menunggu validasi produk.</Disclaimer>
        </Panel>
        <section className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-7">
          <h2 className="text-[17px] font-extrabold">Yang perlu diperhatikan</h2>
          {todo.length ? (
            <ul className="flex flex-col gap-2.5">
              {todo.map((t) => (
                <li key={t} className="flex gap-2.5 text-sm leading-[21px]">
                  <CircleDotIcon className="mt-0.5 size-4 shrink-0 text-warning-accent" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Tidak ada hal mendesak. Tetap bayar tepat waktu.</p>
          )}
          <Button className="w-fit" onClick={() => navigate('/explore')}>
            Lihat Pilihan
          </Button>
          <Disclaimer>KPR Health bukan skor kredit dan tidak menentukan persetujuan bank.</Disclaimer>
        </section>
      </div>
      {askProperty && (
        <PropertyDialog
          m={m}
          clock={data.clock}
          onClose={() => setAskProperty(false)}
          onSaved={() => {
            setAskProperty(false)
            reload()
          }}
        />
      )}
    </>
  )
}
