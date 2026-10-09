import { useId } from 'react'
import { Link } from 'react-router-dom'
import { TriangleAlertIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { dateLong, dateShort } from '@/lib/format'
import { Chip, ErrorPanel, PageSkeleton, Panel, PanelTitle, StatTile } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABEL, productName } from '@/domains/applications/meta'
import { AdminHeader, AuditList, Kpi, Meter, StatusChip } from './shared'

// Queue stages in flow order, then the two outcomes.
const PIPELINE = ['submitted', 'docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad']
const OUTCOMES = ['disbursed', 'rejected']
const days = (n) => (n === 0 ? 'Hari ini' : `${n} hari`)
const productTypeLabel = (types) => types.map((t) => (t === 'primary' ? 'KPR Primary' : 'Take Over')).join(', ')

function MeterRow({ label, value, max, note }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink-2">{label}</span>
        <span className="font-extrabold tabular">
          {value}
          {note && <span className="ml-1.5 font-semibold text-muted-foreground">{note}</span>}
        </span>
      </div>
      <Meter value={value} max={max} />
    </li>
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
              <TableHead className="text-xs font-bold text-ink-3">Pemohon & program</TableHead>
              <TableHead className="text-xs font-bold text-ink-3">Status</TableHead>
              <TableHead className="text-right text-xs font-bold text-ink-3">Menunggu</TableHead>
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
            <TableHead className="text-xs font-bold text-ink-3">Produk</TableHead>
            <TableHead className="text-xs font-bold text-ink-3">Jenis</TableHead>
            <TableHead className="text-xs font-bold text-ink-3">Berlaku sampai</TableHead>
            <TableHead className="text-right text-xs font-bold text-ink-3">Sisa</TableHead>
            <TableHead className="text-xs font-bold text-ink-3">Verifikasi data</TableHead>
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
              <TableCell className="py-3 text-ink-2">{productTypeLabel(p.productTypes)}</TableCell>
              <TableCell className="py-3 text-ink-2 tabular">{dateShort(p.effectiveUntil)}</TableCell>
              <TableCell className="py-3 text-right font-bold tabular">{days(p.daysLeft)}</TableCell>
              <TableCell className="py-3">
                {p.stale ? (
                  <Chip tone="warn" icon={TriangleAlertIcon}>
                    Data usang
                  </Chip>
                ) : (
                  <span className="text-ink-2 tabular">{dateShort(p.lastVerifiedAt)}</span>
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
  const pipelineMax = apps ? Math.max(1, ...Object.values(apps.byStatus)) : 1
  const pct = (n) => (apps?.funnel.submitted ? `${Math.round((n / apps.funnel.submitted) * 100)}%` : '—')

  return (
    <>
      <AdminHeader title="Overview" subtitle={data && `Data per ${dateLong(data.asOf)}`} />
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <>
          <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Kpi label="Perlu review" value={apps.needsReview} hint="Baru diajukan atau sedang diverifikasi" />
            <Kpi label="Menunggu dokumen user" value={apps.waitingOnUser} hint="Revisi dokumen belum diunggah" />
            <Kpi label="Di proses bank" value={apps.atBank} hint="Proses bank sampai akad" />
            <Kpi label="User terdaftar" value={data.users.total} />
          </dl>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <QueuePanel queue={apps.queue} />
              <Panel>
                <PanelTitle sub="Dari semua pengajuan yang pernah diajukan.">Konversi</PanelTitle>
                <ul className="flex flex-col gap-3.5">
                  <MeterRow label="Diajukan" value={apps.funnel.submitted} max={Math.max(1, apps.funnel.submitted)} />
                  <MeterRow label="Disetujui" value={apps.funnel.approved} max={Math.max(1, apps.funnel.submitted)} note={pct(apps.funnel.approved)} />
                  <MeterRow label="Selesai (cair)" value={apps.funnel.disbursed} max={Math.max(1, apps.funnel.submitted)} note={pct(apps.funnel.disbursed)} />
                </ul>
              </Panel>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <Panel>
                <PanelTitle sub="Semua pengajuan yang sudah dikirim, per tahap.">Pengajuan per tahap</PanelTitle>
                <ul className="flex flex-col gap-3.5">
                  {PIPELINE.map((s) => (
                    <MeterRow key={s} label={STATUS_LABEL[s]} value={apps.byStatus[s] ?? 0} max={pipelineMax} />
                  ))}
                </ul>
                <ul className="flex flex-col gap-3.5 border-t border-line pt-4">
                  {OUTCOMES.map((s) => (
                    <MeterRow key={s} label={STATUS_LABEL[s]} value={apps.byStatus[s] ?? 0} max={pipelineMax} />
                  ))}
                </ul>
              </Panel>
              <Panel>
                <PanelTitle sub="Lima perubahan terakhir oleh admin.">Aktivitas admin terbaru</PanelTitle>
                <AuditList events={data.recentActivity} label="Aktivitas admin terbaru" empty="Belum ada aktivitas admin. Perubahan data, status, dan konfigurasi akan tercatat di sini." />
              </Panel>
            </div>
          </div>

          <ProductsPanel products={data.products} />
        </>
      )}
    </>
  )
}
