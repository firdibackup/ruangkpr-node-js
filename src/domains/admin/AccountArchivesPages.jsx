import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { dateLong, dateShort, rupiah } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { TextAreaField, TextField } from '@/components/shared/fields'
import { ConfirmDialog } from '@/components/shared/dialogs'
import { Chip, ErrorPanel, Notice, PageSkeleton, Panel, SummaryRows } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AdminHeader, StatusChip } from './shared'
import { FIELD_LABEL } from './labels'
import { ReasonHint } from './ReasonHint'

const ROOT = '/admin/account-archives'

export function AccountArchiveListPage() {
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const { data, error, reload } = useResource(() => api.admin.archives.list({ query, offset }), [query, offset])
  return <>
    <AdminHeader title="Arsip Akun" subtitle="Riwayat akun yang dihapus. Disimpan tanpa batas waktu sampai dihapus manual." />
    <TextField label="Cari arsip" type="search" placeholder="Nama atau email akun lama" value={query} onChange={(v) => { setQuery(v); setOffset(0) }} />
    {error ? <ErrorPanel onRetry={reload} /> : !data ? <PageSkeleton /> : <Panel>
      {!data.length ? <p className="text-sm text-muted-foreground">{query ? 'Tidak ada arsip yang cocok dengan pencarian ini.' : 'Belum ada arsip akun pada halaman ini. Arsip dibuat saat pengguna menghapus akun.'}</p> :
        <Table aria-label="Arsip akun">
          <TableHeader><TableRow><TableHead>Nama & kontak lama</TableHead><TableHead>Dihapus pada</TableHead><TableHead>Pengajuan</TableHead><TableHead>KPR</TableHead><TableHead>Berkas</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((a) => <TableRow key={a.id}>
            <TableCell><Link to={`${ROOT}/${a.id}`} className="font-bold text-primary hover:underline">{a.name || 'Tanpa nama'}</Link><p className="text-xs text-muted-foreground">{a.contact}</p></TableCell>
            <TableCell>{dateShort(a.closedAt)}</TableCell><TableCell>{a.applicationCount}</TableCell><TableCell>{a.mortgageCount}</TableCell><TableCell>{a.fileCount}</TableCell>
            <TableCell><Chip tone={a.status === 'deleting' ? 'warn' : 'mute'}>{a.status === 'deleting' ? 'Penghapusan belum selesai' : 'Diarsipkan'}</Chip></TableCell>
          </TableRow>)}</TableBody>
        </Table>}
      <div className="flex items-center justify-between gap-3">
        <Button variant="neutral" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Sebelumnya</Button>
        <span className="text-sm text-muted-foreground">Halaman {offset / 50 + 1}</span>
        <Button variant="neutral" disabled={data.length < 50} onClick={() => setOffset(offset + 50)}>Berikutnya</Button>
      </div>
    </Panel>}
  </>
}

// Read-only expandable records preserve the complete historical payload without active-account links.
function RecordTree({ value }) {
  if (value == null || value === '') return <span className="text-muted-foreground">—</span>
  if (typeof value !== 'object') return <span className="break-words whitespace-pre-wrap">{typeof value === 'boolean' ? (value ? 'Ya' : 'Tidak') : String(value)}</span>
  const entries = Object.entries(value)
  if (!entries.length) return <span className="text-muted-foreground">Tidak ada data.</span>
  return <dl className="flex min-w-0 flex-col divide-y divide-border">{entries.map(([k, v]) => <div key={k} className="grid min-w-0 gap-1 py-2 sm:grid-cols-[minmax(120px,1fr)_minmax(0,3fr)] sm:gap-4">
    <dt className="text-muted-foreground">{FIELD_LABEL[k] ?? k}</dt>
    <dd className="min-w-0">{v && typeof v === 'object' ? <details><summary className="w-fit cursor-pointer font-semibold">Lihat rincian ({Object.keys(v).length})</summary><RecordTree value={v} /></details> : <RecordTree value={v} />}</dd>
  </div>)}</dl>
}

export function AccountArchiveDetailPage() {
  const { archiveId } = useParams()
  const navigate = useNavigate()
  const { data: a, error, reload } = useResource(() => api.admin.archives.get(archiveId), [archiveId])
  const [confirm, setConfirm] = useState(false)
  const [reason, setReason] = useState('')
  const [opening, setOpening] = useState(null)
  const openFile = async (f) => {
    setOpening(f.path)
    // Open synchronously so the browser does not block the async signed-link download.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await api.admin.archives.documentUrl(archiveId, f.bucket, f.path)
      if (tab) tab.location.replace(url)
      else toast.error('Izinkan pop-up untuk mengunduh berkas, lalu coba lagi.')
    } catch (e) { tab?.close(); toast.error(e.message) } finally { setOpening(null) }
  }
  if (!a) return <><AdminHeader title="Detail arsip akun" back={ROOT} />{error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />}</>
  const s = a.snapshot
  return <>
    <AdminHeader title={a.name || 'Arsip akun'} subtitle={`${a.contact ?? ''} · dihapus ${dateLong(a.closedAt)}`} back={ROOT} />
    <Notice tone="info" title="Riwayat tersimpan">Arsip ini hanya untuk internal. Pendaftaran ulang membuat akun baru dan tidak mengambil data atau dokumen dari arsip ini.</Notice>
    {a.status === 'deleting' && <Notice tone="warn" title="Penghapusan belum selesai">Sebagian berkas mungkin sudah dihapus. Ulangi Hapus Arsip Permanen untuk menyelesaikannya.</Notice>}
    <Panel><h2 className="text-lg font-bold">Profil & penghasilan</h2>
      <SummaryRows rows={[{ k: 'ID akun lama', v: a.originalUserId }, { k: 'Penghasilan bulanan', v: rupiah(s.finance?.monthlyIncome) }, { k: 'Batas penyimpanan', v: 'Tanpa batas waktu' }]} />
      <details><summary className="cursor-pointer font-semibold">Data pribadi</summary><div className="mt-3 text-sm"><RecordTree value={s.profile} /></div></details>
      <details><summary className="cursor-pointer font-semibold">Data keuangan</summary><div className="mt-3 text-sm"><RecordTree value={s.finance} /></div></details>
    </Panel>
    <Panel><h2 className="text-lg font-bold">Riwayat pengajuan ({s.applications?.length ?? 0})</h2>
      {!s.applications?.length && <p className="text-sm text-muted-foreground">Tidak ada pengajuan.</p>}
      {s.applications?.map((app) => <details key={app.id} className="border-b border-border pb-3 last:border-0"><summary className="cursor-pointer"><span className="mr-3 font-semibold">{app.id}</span><StatusChip status={app.status} /></summary><div className="mt-3 text-sm"><RecordTree value={app} /></div></details>)}
    </Panel>
    <Panel><h2 className="text-lg font-bold">Riwayat KPR ({s.mortgages?.length ?? 0})</h2>
      {!s.mortgages?.length && <p className="text-sm text-muted-foreground">Tidak ada KPR.</p>}
      {s.mortgages?.map((m) => <details key={m.id}><summary className="cursor-pointer font-semibold">{m.bankName || 'KPR'} · {m.id}</summary><div className="mt-3 text-sm"><RecordTree value={m} /></div></details>)}
    </Panel>
    <Panel><h2 className="text-lg font-bold">Dokumen & bukti pembayaran ({a.files.length})</h2>
      {!a.files.length && <p className="text-sm text-muted-foreground">Tidak ada berkas tersimpan.</p>}
      {a.files.map((f) => <div key={`${f.bucket}/${f.path}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2 last:border-0">
        <div className="min-w-0"><p className="break-all text-sm font-semibold">{f.name || f.path.split('/').at(-1)}</p><p className="break-all text-xs text-muted-foreground">{f.bucket} / {f.path.split('/').slice(1, -1).join('/')}</p></div>
        <Button variant="neutral" disabled={opening !== null || a.status === 'deleting'} onClick={() => openFile(f)}>{opening === f.path ? 'Membuka…' : 'Unduh berkas'}</Button>
      </div>)}
    </Panel>
    <Panel><h2 className="text-lg font-bold">Aktivitas & catatan tersimpan</h2>
      {Object.entries({ activities: 'Aktivitas', userChanges: 'Perubahan data', adminNotes: 'Catatan admin', coverLetters: 'Surat pengantar', consents: 'Persetujuan', reminders: 'Pengingat', profileRecord: 'Data profil lengkap', kept: 'Data pengajuan tersimpan', simulation: 'Simulasi' }).filter(([key]) => s[key] != null).map(([key, label]) =>
        <details key={key}><summary className="cursor-pointer font-semibold">{label}</summary><div className="mt-3 text-sm"><RecordTree value={s[key]} /></div></details>)}
    </Panel>
    <Panel><h2 className="text-lg font-bold">Hapus arsip</h2><p className="text-sm text-muted-foreground">Menghapus data arsip beserta dokumen dan bukti pembayaran secara permanen. Akun baru pengguna tidak terpengaruh.</p>
      <Button variant="destructive" className="w-fit" onClick={() => setConfirm(true)}>Hapus Arsip Permanen</Button>
    </Panel>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Hapus arsip secara permanen?" body="Seluruh isi arsip dan berkasnya akan dihapus. Tindakan ini tidak bisa dibatalkan." confirmLabel="Hapus Permanen" confirmDisabled={reason.trim().length < 5} onConfirm={async () => {
      await api.admin.archives.remove(archiveId, { reason })
      toast.success('Arsip dan berkasnya sudah dihapus.')
      navigate(ROOT, { replace: true })
    }}><TextAreaField label="Alasan penghapusan" required value={reason} onChange={setReason} hint={<ReasonHint action="accountArchive.delete" />} /></ConfirmDialog>
  </>
}
