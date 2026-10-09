import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { DateField, SelectField, TextField } from '@/components/shared/fields'
import { ErrorPanel, PageSkeleton, Panel } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABEL } from '@/domains/applications/meta'
import { ACTION_LABEL, FIELD_LABEL } from './labels'
import { AdminHeader } from './shared'

const head = 'text-xs font-bold text-ink-3'
const RESOURCE_LABEL = { user: 'User', application: 'Pengajuan', product: 'Produk', bank: 'Bank', article: 'Artikel', report: 'Laporan', config: 'Konfigurasi', health_config: 'Formula KPR Health' }
const PUBLISHING = { published: 'Terbit', archived: 'Diarsipkan' }

// Times read in WIB (open question §12 Q5 recommends Asia/Jakarta for the backend too).
const at = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

// Values arrive already masked (NIK); this only makes them readable.
function readable(key, v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak'
  if (typeof v === 'number') return v.toLocaleString('id-ID')
  if (key === 'status') return STATUS_LABEL[v] ?? PUBLISHING[v] ?? v
  if (key === 'formats') return v.map((f) => f.toUpperCase()).join(', ')
  if (Array.isArray(v) && v.every((x) => typeof x !== 'object')) return v.join(', ')
  return typeof v === 'string' ? v : JSON.stringify(v)
}

function Changes({ e }) {
  const keys = [...new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})])]
  return (
    <details className="group">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-primary [&::-webkit-details-marker]:hidden">
        Lihat detail
        <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-2 pt-1">
        {keys.length > 0 && (
          <Table aria-label={`Perubahan ${e.id}`}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={head}>Data</TableHead>
                <TableHead className={head}>Sebelum</TableHead>
                <TableHead className={head}>Sesudah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k}>
                  <TableCell className="py-2 font-semibold text-ink-2">{FIELD_LABEL[k] ?? k}</TableCell>
                  <TableCell className="max-w-64 py-2 break-words whitespace-normal text-ink-2">{readable(k, e.before?.[k])}</TableCell>
                  <TableCell className="max-w-64 py-2 break-words whitespace-normal text-ink-2">{readable(k, e.after?.[k])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <span className="text-xs text-muted-foreground tabular">
          ID {e.id} · request {e.requestId}
        </span>
      </div>
    </details>
  )
}

// Read-only, append-only record of every admin write (admin plan §4.8).
export function AuditLogPage() {
  const [f, setF] = useState({ resourceType: '', actorId: '', from: '', to: '', query: '' })
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const { data, error, reload } = useResource(
    () => api.admin.audit.list({ resourceType: f.resourceType || undefined, actorId: f.actorId || undefined, from: f.from || undefined, to: f.to || undefined, query: f.query }),
    [JSON.stringify(f)],
  )
  return (
    <>
      <AdminHeader title="Audit Log" subtitle="Semua perubahan oleh admin, terbaru di atas. Hanya bisa dibaca; tidak ada yang bisa diubah atau dihapus." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <TextField label="Cari" type="search" placeholder="Alasan, data, atau admin" value={f.query} onChange={set('query')} />
        <SelectField label="Jenis data" placeholder="Semua" value={f.resourceType} onChange={set('resourceType')} options={Object.entries(RESOURCE_LABEL).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Oleh admin" placeholder="Semua" value={f.actorId} onChange={set('actorId')} options={(data?.actors ?? []).map((a) => ({ value: a.id, label: a.name }))} />
        <DateField label="Dari" value={f.from} onChange={set('from')} />
        <DateField label="Sampai" value={f.to} onChange={set('to')} />
      </div>
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <Panel>
          <p className="text-sm font-semibold text-ink-3">{data.items.length} catatan</p>
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada perubahan admin yang cocok dengan filter ini.</p>
          ) : (
            <ul aria-label="Log audit" className="flex flex-col">
              {data.items.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 border-b border-line py-3.5 first:pt-0 last:border-b-0 last:pb-0">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[15px] font-bold">
                      {ACTION_LABEL[e.action] ?? e.action}
                      {e.resource.label && <span className="font-semibold text-ink-3"> · {e.resource.label}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground tabular">{at(e.occurredAt)} WIB</span>
                  </span>
                  {e.reason && <span className="text-sm text-ink-2">“{e.reason}”</span>}
                  <span className="text-xs text-muted-foreground">
                    {RESOURCE_LABEL[e.resource.type] ?? e.resource.type} · oleh {e.actor.name} ({e.actor.contact})
                  </span>
                  <Changes e={e} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  )
}
