import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { DownloadIcon, HourglassIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { daysUntil } from '@/calculations/dates'
import { dateShort } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { DateField, SelectField } from '@/components/shared/fields'
import { Chip, ErrorPanel, PageSkeleton, Panel, PanelTitle, Spinner } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABEL, productName } from '@/domains/applications/meta'
import { PRODUCT_TYPES } from './labels'
import { AdminHeader, CountChart, Kpi, Meter, Swatch } from './shared'

const head = 'text-xs font-bold text-muted-foreground'
const percent = (bps) => (bps === null ? '—' : `${Math.round(bps / 100)}%`)
const dayCount = (n) => (n === null ? '—' : `${n.toLocaleString('id-ID')} hari`)
const span = ({ from, to }) => daysUntil({ fromDate: from, targetDate: to }) + 1
const BUCKET = { 1: 'hari', 7: 'minggu', 30: '30 hari' }
const TREND = [
  { key: 'submitted', name: 'Diajukan', color: 'var(--chart-step)' },
  { key: 'approved', name: 'Disetujui', color: 'var(--chart-principal)' },
]

function TrendPanel({ trend, filters }) {
  const total = (key) => trend.reduce((sum, b) => sum + b[key], 0)
  const empty = !total('submitted') && !total('approved')
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <PanelTitle sub={`Per ${BUCKET[span(trend[0])] ?? 'periode'}, ${dateShort(filters.from)} – ${dateShort(filters.to)}.`}>Tren pengajuan</PanelTitle>
        {!empty && (
          <span className="flex gap-4 pt-1">
            {TREND.map((s) => (
              <Swatch key={s.key} color={s.color}>
                {s.name}
              </Swatch>
            ))}
          </span>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">Belum ada pengajuan yang diajukan atau disetujui di periode ini.</p>
      ) : (
        <CountChart data={trend} series={TREND} desc={`${total('submitted')} pengajuan diajukan dan ${total('approved')} disetujui, ${dateShort(filters.from)} sampai ${dateShort(filters.to)}.`} />
      )}
    </Panel>
  )
}

// Centred bars narrow stage by stage into a funnel; the stage that holds applications longest gets a flag.
function StagesPanel({ stages }) {
  const titleId = useId()
  const submitted = stages[0].count
  const slowest = Math.max(0, ...stages.map((s) => s.avgDays ?? 0))
  return (
    <Panel>
      <PanelTitle sub="Pengajuan yang diajukan di periode ini, dan sejauh mana prosesnya sampai hari ini.">
        <span id={titleId}>Tahapan pengajuan</span>
      </PanelTitle>
      {submitted === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada pengajuan yang diajukan di periode ini.</p>
      ) : (
        <Table aria-labelledby={titleId}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={head}>Tahap</TableHead>
              <TableHead className={head}>Pengajuan</TableHead>
              <TableHead className={`${head} text-right`}>Lanjut dari tahap sebelumnya</TableHead>
              <TableHead className={`${head} text-right`}>Rata-rata di tahap ini</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((s) => (
              <TableRow key={s.status}>
                <TableCell className="py-3 font-semibold text-foreground">{STATUS_LABEL[s.status]}</TableCell>
                <TableCell className="py-3">
                  <span className="flex items-center gap-3">
                    <span className="hidden h-6 w-40 shrink-0 justify-center sm:flex lg:w-56" aria-hidden>
                      {s.count > 0 && <span className="h-full rounded-[4px] bg-primary" style={{ width: `${(s.count / submitted) * 100}%` }} />}
                    </span>
                    <span className="font-bold tabular">{s.count}</span>
                  </span>
                </TableCell>
                <TableCell className="py-3 text-right text-foreground tabular">{percent(s.conversionBps)}</TableCell>
                <TableCell className="py-3 text-right text-foreground tabular">
                  <span className="flex items-center justify-end gap-2">
                    {s.avgDays === slowest && slowest > 0 && (
                      <Chip tone="warn" icon={HourglassIcon}>
                        Terlama
                      </Chip>
                    )}
                    {dayCount(s.avgDays)}
                  </span>
                </TableCell>
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
      <PanelTitle sub="Dari pengajuan yang dibuat di periode ini, termasuk draft.">
        <span id={titleId}>Produk paling banyak dipilih</span>
      </PanelTitle>
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada produk yang dipilih di periode ini.</p>
      ) : (
        <Table aria-labelledby={titleId}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={head}>Produk</TableHead>
              <TableHead className={`${head} hidden sm:table-cell`}>Jenis</TableHead>
              <TableHead className={`${head} text-right`}>Dipilih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="min-w-48 py-3 whitespace-normal">
                  <span className="flex flex-col">
                    <Link to={`/admin/products/${p.id}`} className="w-fit font-bold text-primary underline-offset-4 hover:underline">
                      {p.productName}
                    </Link>
                    <span className="text-xs text-muted-foreground">{p.bankName}</span>
                  </span>
                </TableCell>
                <TableCell className="hidden py-3 text-foreground sm:table-cell">{productName(p)}</TableCell>
                <TableCell className="py-3 text-right font-bold tabular">
                  <span className="flex items-center justify-end gap-3">
                    <Meter value={p.count} max={products[0].count} className="hidden w-32 sm:block" />
                    {p.count}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  )
}

// Period report (admin plan §4.6). Every number arrives computed from the data layer; the page only lays it out.
export function ReportsPage() {
  const [filters, setFilters] = useState({})
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }))
  const { data, error, reload } = useResource(() => api.admin.reports.get(filters), [JSON.stringify(filters)])
  const [exporting, setExporting] = useState(false)
  const fieldError = Object.fromEntries((error?.fieldErrors ?? []).map((x) => [x.field, x.message]))
  const ready = data && !error
  const narrowed = ready && (data.filters.productType || data.filters.bankName)
  const vs = ready && `${span(data.previous)} hari sebelumnya`
  const change = (key) => ({ change: data.applications[key] - data.previous.applications[key], vs })

  const download = async () => {
    setExporting(true)
    try {
      const { filename, csv, rows } = await api.admin.reports.exportCsv(filters)
      // BOM so spreadsheet apps read the text as UTF-8.
      const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
      Object.assign(document.createElement('a'), { href: url, download: filename }).click()
      setTimeout(() => URL.revokeObjectURL(url))
      toast(`${rows} pengajuan diunduh, tanpa data pribadi.`)
    } catch (e) {
      toast(e.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <AdminHeader
        title="Reports"
        subtitle="Kinerja pengajuan per periode, dari data semua user."
        actions={
          <Button size="sm" variant="neutral" onClick={download} disabled={!ready || exporting} aria-busy={exporting}>
            {exporting ? <Spinner /> : <DownloadIcon aria-hidden />}
            Unduh CSV
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DateField label="Dari" value={filters.from || data?.filters.from || ''} onChange={set('from')} error={fieldError.from} />
        <DateField label="Sampai" value={filters.to || data?.filters.to || ''} onChange={set('to')} error={fieldError.to} />
        <SelectField label="Jenis produk" placeholder="Semua" value={filters.productType ?? ''} onChange={set('productType')} options={PRODUCT_TYPES} />
        <SelectField label="Bank" placeholder="Semua" value={filters.bankName ?? ''} onChange={set('bankName')} options={(data?.banks ?? []).map((b) => ({ value: b, label: b }))} />
      </div>
      {error && !error.fieldErrors?.length && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {ready && (
        <>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Kpi label="Pendaftar baru" value={data.users.registered} change={data.users.registered - data.previous.users.registered} vs={vs} hint={`${data.users.withApplication} ${narrowed ? 'mengajukan produk sesuai filter' : 'sudah membuat pengajuan'}`} />
            <Kpi label="Pengajuan dibuat" value={data.applications.created} {...change('created')} hint="Termasuk draft" />
            <Kpi label="Diajukan" value={data.applications.submitted} {...change('submitted')} />
            <Kpi label="Disetujui" value={data.applications.approved} {...change('approved')} />
            <Kpi label="Ditolak" value={data.applications.rejected} {...change('rejected')} upIsGood={false} />
            <Kpi label="Cair" value={data.applications.disbursed} {...change('disbursed')} />
          </dl>
          <TrendPanel trend={data.trend} filters={data.filters} />
          <StagesPanel stages={data.stages} />
          <ProductsPanel products={data.products} />
        </>
      )}
    </>
  )
}
