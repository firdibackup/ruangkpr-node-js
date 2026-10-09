import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { DownloadIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { DateField, SelectField } from '@/components/shared/fields'
import { ErrorPanel, PageSkeleton, Panel, PanelTitle, Spinner } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABEL, productName } from '@/domains/applications/meta'
import { PRODUCT_TYPES } from './labels'
import { AdminHeader, Kpi, Meter } from './shared'

const head = 'text-xs font-bold text-ink-3'
const percent = (bps) => (bps === null ? '—' : `${Math.round(bps / 100)}%`)
const dayCount = (n) => (n === null ? '—' : `${n.toLocaleString('id-ID')} hari`)

function StagesPanel({ stages }) {
  const titleId = useId()
  const submitted = stages[0].count
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
                <TableCell className="py-3 font-semibold text-ink-2">{STATUS_LABEL[s.status]}</TableCell>
                <TableCell className="py-3">
                  <span className="flex items-center gap-3">
                    <Meter value={s.count} max={submitted} className="hidden w-40 shrink-0 sm:block" />
                    <span className="font-bold tabular">{s.count}</span>
                  </span>
                </TableCell>
                <TableCell className="py-3 text-right text-ink-2 tabular">{percent(s.conversionBps)}</TableCell>
                <TableCell className="py-3 text-right text-ink-2 tabular">{dayCount(s.avgDays)}</TableCell>
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
                <TableCell className="hidden py-3 text-ink-2 sm:table-cell">{productName(p)}</TableCell>
                <TableCell className="py-3 text-right font-bold tabular">{p.count}</TableCell>
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
            <Kpi label="Pendaftar baru" value={data.users.registered} hint={`${data.users.withApplication} ${narrowed ? 'mengajukan produk sesuai filter' : 'sudah membuat pengajuan'}`} />
            <Kpi label="Pengajuan dibuat" value={data.applications.created} hint="Termasuk draft" />
            <Kpi label="Diajukan" value={data.applications.submitted} />
            <Kpi label="Disetujui" value={data.applications.approved} />
            <Kpi label="Ditolak" value={data.applications.rejected} />
            <Kpi label="Cair" value={data.applications.disbursed} />
          </dl>
          <StagesPanel stages={data.stages} />
          <ProductsPanel products={data.products} />
        </>
      )}
    </>
  )
}
