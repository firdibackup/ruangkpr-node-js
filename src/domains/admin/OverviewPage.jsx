import { useId } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheckIcon, CircleXIcon, ClockIcon, ScrollTextIcon, TriangleAlertIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { dateLong, dateShort, dayMonth } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Chip, ErrorPanel, PageSkeleton, Panel, PanelTitle, StatTile } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABEL, productName } from '@/domains/applications/meta'
import { ActivityFeed, AdminHeader, Change, CountChart, DonutLegend, Kpi, Meter, OutcomeDonut, StatusChip, Swatch } from './shared'

// Stages still in process, in flow order, grouped by whose move it is; the colour marks the group in the share bar.
const FLOW = [
  { owner: 'Giliran tim', color: 'var(--chart-principal)', stages: ['docs_verification'] },
  { owner: 'Giliran user', color: 'var(--chart-warn)', stages: ['additional_docs_requested'] },
  { owner: 'Di bank', color: 'var(--chart-step)', stages: ['bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad'] },
]
const days = (n) => (n === 0 ? 'Hari ini' : `${n} hari`)
const TYPE_LABEL = { primary: 'KPR Primary', takeover: 'Take Over', topup: 'Take Over + Top-up' }
const productTypeLabel = (types) => types.map((t) => TYPE_LABEL[t]).join(', ')

function MeterRow({ label, value, max, note }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-extrabold tabular">
          {value}
          {note && <span className="ml-1.5 font-semibold text-muted-foreground">{note}</span>}
        </span>
      </div>
      <Meter value={value} max={max} />
    </li>
  )
}

function FlowPanel({ byStatus }) {
  const n = (s) => byStatus[s] ?? 0
  const groups = FLOW.map((g) => ({ ...g, total: g.stages.reduce((sum, s) => sum + n(s), 0) }))
  const inProcess = groups.reduce((sum, g) => sum + g.total, 0)
  return (
    <Panel>
      <PanelTitle sub="Pengajuan yang masih berjalan, per tahap dan menurut siapa yang perlu bergerak.">{inProcess} pengajuan sedang diproses</PanelTitle>
      {inProcess > 0 && (
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {groups
            .filter((g) => g.total)
            .map((g) => (
              <span key={g.owner} style={{ flexGrow: g.total, background: g.color }} />
            ))}
        </div>
      )}
      <ul className="flex flex-wrap gap-5">
        {groups.map((g) => (
          <li key={g.owner} className="flex min-w-0 flex-col gap-2.5" style={{ flex: `${g.stages.length} 1 ${Math.max(150, g.stages.length * 112)}px` }}>
            <Swatch color={g.color}>
              <span className="font-bold text-foreground">{g.owner}</span>
              <span className="tabular">· {g.total}</span>
            </Swatch>
            <ol aria-label={g.owner} className="grid grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-2">
              {g.stages.map((s) => (
                <li key={s} className="flex flex-col-reverse justify-end gap-1.5 rounded-xl bg-muted px-3.5 py-3">
                  <span className="text-xs leading-4 font-semibold text-muted-foreground">{STATUS_LABEL[s]}</span>
                  <span className={cn('text-2xl leading-none font-extrabold', !n(s) && 'text-muted-foreground')}>{n(s)}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function TrendPanel({ trend, previous }) {
  const total = trend.reduce((sum, d) => sum + d.submitted, 0)
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <PanelTitle sub={`14 hari terakhir, ${dayMonth(trend[0].from)} – ${dateShort(trend.at(-1).to)}.`}>Pengajuan masuk</PanelTitle>
        <span className="flex items-center gap-2.5">
          <span className="text-[26px] leading-none font-extrabold">{total}</span>
          <Change value={total - previous} vs="14 hari sebelumnya" />
        </span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada pengajuan baru dalam 14 hari terakhir.</p>
      ) : (
        <CountChart className="h-auto min-h-56 flex-1" data={trend} series={[{ key: 'submitted', name: 'Diajukan', color: 'var(--chart-principal)' }]} desc={`${total} pengajuan masuk dalam 14 hari terakhir, ${previous} di 14 hari sebelumnya.`} />
      )}
    </Panel>
  )
}

// Every submitted application by where it stands now, then how far the whole lot has come.
function OutcomePanel({ byStatus, funnel }) {
  const total = Object.values(byStatus).reduce((sum, v) => sum + v, 0)
  const done = byStatus.disbursed ?? 0
  const rejected = byStatus.rejected ?? 0
  const parts = [
    { name: 'Sedang diproses', value: total - done - rejected, color: 'var(--chart-step)', icon: ClockIcon },
    { name: 'Selesai (cair)', value: done, color: 'var(--chart-ok)', icon: CircleCheckIcon },
    { name: 'Ditolak', value: rejected, color: 'var(--chart-bad)', icon: CircleXIcon },
  ]
  const share = (v, of = total) => (of ? `${Math.round((v / of) * 100)}%` : '—')
  const max = Math.max(1, funnel.submitted)
  return (
    <Panel>
      <PanelTitle sub="Semua pengajuan yang pernah dikirim, menurut posisinya sekarang.">Hasil pengajuan</PanelTitle>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada pengajuan yang dikirim.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <OutcomeDonut parts={parts} total={total} unit="diajukan" desc={parts.map((p) => `${p.name} ${p.value}`).join(', ')} />
          <DonutLegend parts={parts} label="Hasil pengajuan" share={share} />
        </div>
      )}
      <div className="flex flex-col gap-3.5 border-t border-border pt-4">
        <h3 className="text-sm font-bold">Konversi</h3>
        <ul className="flex flex-col gap-3.5">
          <MeterRow label="Diajukan" value={funnel.submitted} max={max} />
          <MeterRow label="Disetujui" value={funnel.approved} max={max} note={share(funnel.approved, funnel.submitted)} />
          <MeterRow label="Selesai (cair)" value={funnel.disbursed} max={max} note={share(funnel.disbursed, funnel.submitted)} />
        </ul>
      </div>
    </Panel>
  )
}

function QueuePanel({ queue }) {
  const titleId = useId()
  return (
    <Panel>
      <PanelTitle sub="Pengajuan yang menunggu langkah tim, terlama di atas.">
        <span id={titleId}>Perlu tindakan tim</span>
      </PanelTitle>
      {queue.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada pengajuan yang menunggu tim.</p>
      ) : (
        <Table aria-labelledby={titleId}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-bold text-muted-foreground">Pemohon & program</TableHead>
              <TableHead className="text-xs font-bold text-muted-foreground">Status</TableHead>
              <TableHead className="text-right text-xs font-bold text-muted-foreground">Menunggu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="min-w-44 py-3 whitespace-normal">
                  <span className="flex flex-col">
                    <Link to={`/admin/applications/${q.id}`} className="w-fit font-bold text-primary underline-offset-4 hover:underline">
                      {q.userName}
                    </Link>
                    <span className="text-xs text-muted-foreground">{[productName(q), q.bankName, q.productName].filter(Boolean).join(' · ')}</span>
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <StatusChip status={q.status} />
                </TableCell>
                <TableCell className="py-3 text-right font-bold tabular">{days(q.waitingDays)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  )
}

function ProductsPanel({ products }) {
  const titleId = useId()
  return (
    <Panel>
      <PanelTitle sub="Produk yang tampil di pencocokan, diurutkan dari masa berlaku terdekat.">
        <span id={titleId}>Produk bank</span>
      </PanelTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Aktif" value={products.active} />
        <StatTile label="Draft" value={products.draft} />
        <StatTile label="Kedaluwarsa" value={products.expired} />
        <StatTile label="Data usang" value={products.stale} tone={products.stale ? 'warn' : undefined} />
      </div>
      <Table aria-labelledby={titleId}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-bold text-muted-foreground">Produk</TableHead>
            <TableHead className="text-xs font-bold text-muted-foreground">Jenis</TableHead>
            <TableHead className="text-xs font-bold text-muted-foreground">Berlaku sampai</TableHead>
            <TableHead className="text-right text-xs font-bold text-muted-foreground">Sisa</TableHead>
            <TableHead className="text-xs font-bold text-muted-foreground">Verifikasi data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.nearestExpiry.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="py-3">
                <span className="flex flex-col">
                  <Link to={`/admin/products/${p.id}`} className="w-fit font-bold text-primary underline-offset-4 hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{p.bankName}</span>
                </span>
              </TableCell>
              <TableCell className="py-3 text-foreground">{productTypeLabel(p.productTypes)}</TableCell>
              <TableCell className="py-3 text-foreground tabular">{dateShort(p.effectiveUntil)}</TableCell>
              <TableCell className="py-3 text-right font-bold tabular">{days(p.daysLeft)}</TableCell>
              <TableCell className="py-3">
                {p.stale ? (
                  <Chip tone="warn" icon={TriangleAlertIcon}>
                    Data usang
                  </Chip>
                ) : (
                  <span className="text-foreground tabular">{dateShort(p.lastVerifiedAt)}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  )
}

// Operations overview (admin plan §4.1).
export function OverviewPage() {
  const { data, error, reload } = useResource(() => api.admin.overview.get())
  const apps = data?.applications

  return (
    <>
      <AdminHeader title="Overview" subtitle={data && `Data per ${dateLong(data.asOf)}`} />
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <>
          <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Kpi label="Perlu review" value={apps.needsReview} hint="Menunggu atau sedang verifikasi dokumen" />
            <Kpi label="Menunggu dokumen user" value={apps.waitingOnUser} hint="Revisi dokumen belum diunggah" />
            <Kpi label="Di proses bank" value={apps.atBank} hint="Proses bank sampai akad" />
            <Kpi label="User terdaftar" value={data.users.total} />
          </dl>

          <FlowPanel byStatus={apps.byStatus} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <TrendPanel trend={apps.trend} previous={apps.previousSubmitted} />
            <OutcomePanel byStatus={apps.byStatus} funnel={apps.funnel} />
          </div>

          <QueuePanel queue={apps.queue} />

          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <PanelTitle sub="Lima perubahan terakhir oleh admin. Buka datanya, atau lihat nilai sebelum dan sesudahnya di sini.">Aktivitas admin terbaru</PanelTitle>
              <Button asChild size="sm" variant="neutral">
                <Link to="/admin/audit-log">
                  <ScrollTextIcon aria-hidden />
                  Lihat semua log
                </Link>
              </Button>
            </div>
            <ActivityFeed events={data.recentActivity} label="Aktivitas admin terbaru" empty="Belum ada aktivitas admin. Perubahan data, status, dan konfigurasi akan tercatat di sini." />
          </Panel>

          <ProductsPanel products={data.products} />
        </>
      )}
    </>
  )
}
