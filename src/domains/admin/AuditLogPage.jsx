import { useState } from 'react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { DateField, SelectField, TextField } from '@/components/shared/fields'
import { ErrorPanel, PageSkeleton, Panel } from '@/components/shared/ui'
import { ActivityFeed, AdminHeader } from './shared'

const RESOURCE_LABEL = { user: 'User', application: 'Pengajuan', product: 'Produk', bank: 'Bank', article: 'Artikel', report: 'Laporan', config: 'Konfigurasi', health_config: 'Formula KPR Health' }

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
          {/* The same timeline as the overview's recent activity: open the record, or unfold its before/after values. */}
          <ActivityFeed events={data.items} label="Log audit" empty="Belum ada perubahan admin yang cocok dengan filter ini." />
        </Panel>
      )}
    </>
  )
}
