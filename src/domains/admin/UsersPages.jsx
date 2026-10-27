import { Suspense, useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRightIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useForm, useResource } from '@/lib/hooks'
import { CERTIFICATES, EMPTY, GENDERS, MARITAL, OCCUPATIONS, PROPERTY_TYPES, dateLong, dateShort, daysLabel, labelOf, monthYear, percentBps, percentProgress, percentRatio, rupiah, signedRupiah, tenorLabel, toInt, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { DateField, FormGrid, SelectField, TextField } from '@/components/shared/fields'
import { Chip, ErrorPanel, EstimateTag, Notice, PageSkeleton, Panel, PanelTitle, ProgressBar, Skeleton, StatTile, SummaryRows } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { productName } from '@/domains/applications/meta'
import { profileFormValues, toPersonal, validatePersonal } from '@/domains/applications/validation'
import { validateEmploymentBasic } from '@/domains/optimize/validation'
import { filledOnly } from '@/domains/mortgages/validation'
import { deriveMortgage } from '@/domains/mortgages/derive'
import { rateTypeLabel } from '@/domains/mortgages/setupMeta'
import { HealthRing } from '@/domains/home/dashboardWidgets'
import { WIDGET } from '@/domains/home/dashboardLayout'
import { WIDGET_VIEWS } from '@/domains/home/widgets'
import { DtiGauge } from '@/domains/home/widgets/figures'
import { WidgetBoundary } from '@/domains/home/widgets/WidgetBody'
import { widgetLock } from '@/domains/home/widgets/widgetData'
import { IncomeFields, JobFields, PersonalFields } from '@/domains/profile/ProfilePages'
import { AdminHeader, AuditList, EditDialog, StatusChip } from './shared'
import { formatValue } from './labels'

const CHOICE = { '': undefined, yes: true, no: false }
const head = 'text-xs font-bold text-muted-foreground'

export function UserListPage() {
  const [query, setQuery] = useState('')
  const [inProcess, setInProcess] = useState('')
  const [mortgage, setMortgage] = useState('')
  const { data, error, reload } = useResource(() => api.admin.users.list({ query, inProcess: CHOICE[inProcess], hasActiveMortgage: CHOICE[mortgage] }), [query, inProcess, mortgage])
  return (
    <>
      <AdminHeader title="Users" subtitle="Semua akun user di aplikasi, terbaru di atas." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <TextField label="Cari user" type="search" placeholder="Nama, nomor ponsel, atau email" value={query} onChange={setQuery} />
        <SelectField label="Pengajuan" placeholder="Semua" value={inProcess} onChange={setInProcess} options={[{ value: 'yes', label: 'Sedang diproses' }, { value: 'no', label: 'Tidak sedang diproses' }]} />
        <SelectField label="KPR aktif" placeholder="Semua" value={mortgage} onChange={setMortgage} options={[{ value: 'yes', label: 'Punya KPR aktif' }, { value: 'no', label: 'Belum punya' }]} />
      </div>
      {!data && error && <ErrorPanel onRetry={reload} />}
      {!data && !error && <PageSkeleton />}
      {data && (
        <Panel>
          <p className="text-sm font-semibold text-muted-foreground">{data.length} user</p>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada user yang cocok dengan pencarian atau filter ini.</p>
          ) : (
            <Table aria-label="Daftar user">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={head}>Nama & kontak</TableHead>
                  <TableHead className={head}>Pengajuan terakhir</TableHead>
                  <TableHead className={head}>KPR aktif</TableHead>
                  <TableHead className={head}>Bergabung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="py-3">
                      <span className="flex flex-col">
                        <Link to={`/admin/users/${u.id}`} className="w-fit font-bold text-primary underline-offset-4 hover:underline">
                          {u.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">{u.contact}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3">{u.activeApplicationStatus ? <StatusChip status={u.activeApplicationStatus} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="py-3 text-foreground">{u.hasActiveMortgage ? 'Ya' : '—'}</TableCell>
                    <TableCell className="py-3 text-foreground tabular">{dateShort(u.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      )}
    </>
  )
}

const MORTGAGE_STATUS = { active: 'Aktif', draft: 'Setup belum selesai', replaced: 'Diganti (Take Over)', closed: 'Lunas' }
const mortgageName = (m) => [m.bankName, m.productName].filter(Boolean).join(' · ') || 'KPR'
const rows = (items, render, empty) => (items.length ? <ul className="flex flex-col">{items.map(render)}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>)
const row = 'flex items-center justify-between gap-3 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0'

// History panels show the latest few; the history page has all of it. KPR events name their KPR, the user's own
// record never repeats the user's name.
const PREVIEW = 5
const kprName = (e) => e.resource.type === 'mortgage' && e.resource.label
function AllHistory({ to, count, children }) {
  return (
    <Link to={to} className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline">
      {children} ({count})
      <ArrowRightIcon className="size-4" aria-hidden />
    </Link>
  )
}

export function UserDetailPage() {
  const { userId } = useParams()
  const { data, error, reload, setData } = useResource(() => api.admin.users.get(userId), [userId])
  const [editing, setEditing] = useState(null)
  if (!data) {
    return (
      <>
        <AdminHeader title="Detail user" back="/admin/users" />
        {error ? <ErrorPanel onRetry={reload} title={error.code === 'RESOURCE_NOT_FOUND' ? 'User tidak ditemukan.' : undefined} message={error.code === 'RESOURCE_NOT_FOUND' ? 'Akun ini mungkin sudah dihapus.' : undefined} /> : <PageSkeleton />}
      </>
    )
  }
  const { user, profile: p, finance: f } = data
  const saved = (next, message) => {
    setData(next)
    setEditing(null)
    toast(message)
  }
  const reloadAfterConflict = () => {
    setEditing(null)
    reload()
  }
  return (
    <>
      <AdminHeader title={user.name} subtitle={`${user.contact} · bergabung ${dateLong(user.createdAt)}`} back="/admin/users" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PanelTitle sub="NIK selalu ditampilkan tersamar.">Profil</PanelTitle>
              <Button variant="outline" size="sm" onClick={() => setEditing('profile')}>
                Ubah profil
              </Button>
            </div>
            <SummaryRows
              rows={[
                { k: 'Nama sesuai KTP', v: p.fullName || EMPTY },
                { k: 'NIK', v: p.nikMasked ?? EMPTY },
                { k: 'Tempat, tanggal lahir', v: p.birthDate ? `${p.birthPlace ? `${p.birthPlace}, ` : ''}${dateLong(p.birthDate)}` : EMPTY },
                { k: 'Jenis kelamin', v: p.gender ? labelOf(GENDERS, p.gender) : EMPTY },
                { k: 'Status perkawinan', v: p.maritalStatus ? labelOf(MARITAL, p.maritalStatus) : EMPTY },
                { k: 'Alamat', v: p.address || EMPTY },
                { k: 'Nomor ponsel', v: p.phone || EMPTY },
                { k: 'Email', v: p.email || EMPTY },
                { k: 'Pekerjaan', v: p.occupation ? labelOf(OCCUPATIONS, p.occupation) : EMPTY },
                { k: 'Perusahaan', v: p.companyName || EMPTY },
                { k: 'Jabatan', v: p.jobTitle || EMPTY },
                { k: 'Lama bekerja', v: p.workYears != null ? `${p.workYears} tahun ${p.workMonths ?? 0} bulan` : EMPTY },
              ]}
            />
          </Panel>
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PanelTitle sub="Dipakai untuk DTI dan KPR Health.">Keuangan</PanelTitle>
              <Button variant="outline" size="sm" onClick={() => setEditing('finance')}>
                Ubah keuangan
              </Button>
            </div>
            <SummaryRows
              rows={[
                { k: 'Penghasilan bulanan', v: rupiah(f.monthlyIncome) },
                f.jointIncome && { k: 'Penghasilan pasangan', v: rupiah(f.partnerIncome) },
                { k: 'Cicilan kendaraan', v: rupiah(f.vehicleDebt) },
                { k: 'Kartu kredit / paylater', v: rupiah(f.cardDebt) },
                { k: 'Pinjaman lain', v: rupiah(f.otherDebt) },
              ]}
            />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelTitle>Pengajuan</PanelTitle>
            {rows(
              data.applications,
              (a) => (
                <li key={a.id} className={row}>
                  <span className="flex min-w-0 flex-col">
                    {a.status === 'draft' ? (
                      <span className="text-sm font-bold">{productName(a)}</span>
                    ) : (
                      <Link to={`/admin/applications/${a.id}`} className="w-fit text-sm font-bold text-primary underline-offset-4 hover:underline">
                        {productName(a)}
                      </Link>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {[a.bankName, a.productName].filter(Boolean).join(' · ') || 'Program belum dipilih'}
                      {a.submittedAt && ` · diajukan ${dateShort(a.submittedAt)}`}
                    </span>
                  </span>
                  <StatusChip status={a.status} />
                </li>
              ),
              'Belum ada pengajuan.',
            )}
          </Panel>
          <Panel>
            <PanelTitle>KPR</PanelTitle>
            {rows(
              data.mortgages,
              (m) => (
                <li key={m.id} className={row}>
                  <span className="flex min-w-0 flex-col">
                    {m.status === 'draft' ? (
                      <span className="text-sm font-bold">{mortgageName(m)}</span>
                    ) : (
                      <Link to={`/admin/users/${user.id}/kpr/${m.id}`} className="w-fit text-sm font-bold text-primary underline-offset-4 hover:underline">
                        {mortgageName(m)}
                      </Link>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Sisa pokok {rupiah(m.outstandingPrincipal)} · cicilan {rupiah(m.currentPayment)} · {m.currentRateType === 'floating' ? 'floating' : 'fixed'} {percentBps(m.currentRateBps)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">{MORTGAGE_STATUS[m.status] ?? m.status}</span>
                </li>
              ),
              'Belum ada KPR yang dipantau.',
            )}
          </Panel>
          <Panel>
            <PanelTitle sub="Oleh admin (dengan alasan) dan oleh user sendiri.">Riwayat perubahan</PanelTitle>
            <AuditList events={data.audit.slice(0, PREVIEW)} label="Riwayat perubahan" subject={kprName} values empty="Belum ada perubahan." />
            {data.audit.length > PREVIEW && (
              <AllHistory to={`/admin/users/${user.id}/riwayat`} count={data.audit.length}>
                Lihat semua riwayat
              </AllHistory>
            )}
          </Panel>
        </div>
      </div>
      {editing === 'profile' && <ProfileDialog data={data} onClose={() => setEditing(null)} onReload={reloadAfterConflict} onSaved={(next) => saved(next, 'Profil user tersimpan.')} />}
      {editing === 'finance' && (
        <FinanceDialog
          data={data}
          onClose={() => setEditing(null)}
          onReload={reloadAfterConflict}
          onSaved={(next) => saved(next, `Keuangan tersimpan. ${next.recalculated.includes('health') ? 'DTI dan KPR Health' : 'DTI'} user dihitung ulang dari data baru.`)}
        />
      )}
    </>
  )
}

const SOURCE = { monitoring: 'Pantau KPR', application: 'Dari pengajuan' }
const months = (n) => (n ? `${n} bulan (${tenorLabel(n)})` : EMPTY)
const link = 'text-primary underline-offset-4 hover:underline'

// Read-only: everything the user entered for one KPR plus what My KPR derives from it, on the user's figures.
// The user's own dashboard widgets (home/widgets), so admin and user read the KPR off the same charts. Only widgets
// whose data exists show: filling a locked one is the user's move, not the admin's.
function KprWidget({ id, widgetProps }) {
  if (widgetLock(id, widgetProps.m, widgetProps.d)) return null
  const View = WIDGET_VIEWS[id]
  return (
    <WidgetBoundary title={WIDGET[id].title}>
      <Suspense fallback={<Skeleton className="h-64 rounded-card" />}>
        <View {...widgetProps} />
      </Suspense>
    </WidgetBoundary>
  )
}
const HEALTH_FILL = { ok: 'var(--chart-ok)', warn: 'var(--chart-warn)', bad: 'var(--chart-bad)' }

export function UserMortgagePage() {
  const { userId, mortgageId } = useParams()
  const { data, error, reload } = useResource(() => api.admin.users.get(userId), [userId])
  const back = `/admin/users/${userId}`
  // Drafts are not linked: schedule and due dates need data the setup has not collected yet.
  const m = data?.mortgages.find((x) => x.id === mortgageId && x.status !== 'draft')
  if (!m) {
    const missing = data || error?.code === 'RESOURCE_NOT_FOUND'
    return (
      <>
        <AdminHeader title="Detail KPR" back={back} />
        {missing ? <ErrorPanel title="KPR tidak ditemukan." message="KPR ini mungkin sudah dihapus atau pengaturannya belum selesai." /> : error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />}
      </>
    )
  }
  const d = deriveMortgage(m, data.asOf, data.health)
  const s = d.schedule
  const p = m.property ?? {}
  const f = m.finance ?? {}
  const r = m.reminders
  const fi = d.floatingImpact
  const history = data.audit.filter((e) => e.resource.type === 'mortgage' && e.resource.id === m.id)
  const widgetProps = { m, d, clock: data.asOf }
  return (
    <>
      <AdminHeader title={mortgageName(m)} subtitle={`${data.user.name} · KPR ${m.scheme === 'sharia' ? 'Syariah' : 'Konvensional'}`} back={back} actions={<Chip tone={m.status === 'active' ? 'ok' : 'mute'}>{MORTGAGE_STATUS[m.status] ?? m.status}</Chip>} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelTitle sub={`Dari data yang diisi user, dihitung per ${dateLong(data.asOf)}.`}>Ringkasan</PanelTitle>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-extrabold text-muted-foreground">Sisa pokok {(m.outstandingEstimated || m.outstandingProjected) && <EstimateTag />}</span>
              <span className="text-[30px] font-extrabold tracking-[-0.6px] tabular">{rupiah(m.outstandingPrincipal)}</span>
              {d.paidRatio == null ? (
                <span className="text-sm text-muted-foreground">Progres pelunasan belum diketahui.</span>
              ) : (
                <>
                  <ProgressBar value={d.paidRatio * 100} label="Progres pokok lunas" />
                  <span className="text-sm font-bold text-primary">{percentProgress(d.paidRatio)} lunas</span>
                </>
              )}
            </div>
            <SummaryRows
              rows={[
                { k: 'Sumber', v: m.applicationId ? <Link to={`/admin/applications/${m.applicationId}`} className={link}>Dari pengajuan</Link> : (SOURCE[m.source] ?? EMPTY) },
                { k: 'Pinjaman awal', v: rupiah(m.originalPrincipal) },
                { k: 'Cicilan saat ini', v: rupiah(m.currentPayment) },
                m.previousFixedPayment && { k: 'Cicilan saat fixed', v: rupiah(m.previousFixedPayment) },
                { k: 'Tenor awal', v: months(m.originalTenorMonths) },
                { k: 'Sisa tenor', v: months(m.remainingTenorMonths) },
                { k: 'Mulai (akad)', v: dateLong(m.startDate) },
                { k: 'Jatuh tempo', v: m.dueDay ? `Setiap tanggal ${m.dueDay}` : EMPTY },
                m.status === 'active' && { k: 'Pembayaran berikutnya', v: `${dateLong(d.nextDue)} · ${daysLabel(d.daysToNextDue)}` },
                { k: 'Estimasi lunas', v: monthYear(d.estimatedEndDate) },
                { k: 'Diaktifkan', v: dateLong(m.activatedAt) },
                m.updatedAt && { k: 'Terakhir diubah', v: dateLong(m.updatedAt) },
              ]}
            />
          </Panel>
          <Panel>
            <PanelTitle>Bunga</PanelTitle>
            <SummaryRows
              rows={[
                { k: 'Bunga saat ini', v: m.currentRateBps ? `${percentBps(m.currentRateBps)} ${rateTypeLabel(m.currentRateType)}` : rateTypeLabel(m.currentRateType) },
                m.fixedUntil && { k: 'Fixed berakhir', v: `${dateLong(m.fixedUntil)}${d.daysUntilFixedEnd > 0 ? ` · ${daysLabel(d.daysUntilFixedEnd)}` : ''}` },
                d.mode !== 'floating' && { k: 'Estimasi floating', v: percentBps(m.estimatedFloatingRateBps), tag: m.estimatedFloatingRateBps > 0 && <EstimateTag /> },
                fi && { k: 'Dampak cicilan', v: `${rupiah(fi.currentPayment)} → ${rupiah(fi.estimatedNextPayment)} (${signedRupiah(fi.monthlyDelta)}/bln)`, tag: <EstimateTag /> },
              ]}
            />
            <h3 className="text-sm font-extrabold">Riwayat periode bunga</h3>
            {rows(
              m.rateHistory ?? [],
              (h) => (
                <li key={h.id} className={row}>
                  <span className="text-sm font-bold">
                    {rateTypeLabel(h.type)} {percentBps(h.rateBps)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular">
                    {dateShort(h.startDate)} – {h.endDate ? dateShort(h.endDate) : 'sekarang'}
                  </span>
                </li>
              ),
              'Belum ada perubahan periode bunga.',
            )}
          </Panel>
          <KprWidget id="journey" widgetProps={widgetProps} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelTitle sub={`Formula versi ${d.health.version}. Bukan skor kredit bank.`}>KPR Health</PanelTitle>
            <div className="flex flex-wrap items-center gap-5">
              {d.health.score != null && <HealthRing health={d.health} size={104} />}
              <div className="flex min-w-48 flex-1 flex-col gap-3">
                <Chip tone={d.health.tone}>{d.health.partial && d.health.score != null ? `${d.health.label} · parsial` : d.health.label}</Chip>
                <ul aria-label="Komponen KPR Health" className="flex flex-col gap-2.5">
                  {d.health.components.map((c) => (
                    <li key={c.key} className="flex flex-col gap-1">
                      <span className="flex justify-between gap-3 text-[13px]">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <span className={c.score == null ? 'text-muted-foreground' : 'font-extrabold tabular'}>{c.score ?? 'Belum dapat dihitung'}</span>
                      </span>
                      {c.score != null && (
                        <span className="h-1.5 rounded-full bg-chart-track" aria-hidden>
                          <span className="block h-full rounded-full" style={{ width: `${c.score}%`, background: HEALTH_FILL[c.tone] }} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
          <Panel>
            <PanelTitle sub="Salinan keuangan di KPR ini; ikut berubah lewat Ubah keuangan di profil user.">Keuangan & DTI</PanelTitle>
            {!widgetLock('dti', m, d) && (
              <div className="flex flex-col gap-2">
                <DtiGauge d={d} showZone />
              </div>
            )}
            <SummaryRows
              rows={[
                { k: 'Penghasilan bulanan', v: rupiah(f.monthlyIncome) },
                f.jointIncome && { k: 'Penghasilan pasangan', v: rupiah(f.partnerIncome) },
                { k: 'Cicilan KPR', v: rupiah(m.currentPayment) },
                { k: 'Cicilan lain per bulan', v: rupiah(d.otherDebt) },
                { k: 'DTI', v: percentRatio(d.dti?.dtiRatio) },
              ]}
            />
          </Panel>
          <Panel>
            <PanelTitle sub="Nilai properti diisi user, bukan appraisal resmi.">Properti</PanelTitle>
            <SummaryRows
              rows={[
                { k: 'Alamat', v: p.address || EMPTY },
                { k: 'Kota / kabupaten', v: p.city || EMPTY },
                { k: 'Jenis', v: p.type ? labelOf(PROPERTY_TYPES, p.type) : EMPTY },
                { k: 'Luas tanah / bangunan', v: p.landArea || p.buildingArea ? `${p.landArea ?? '–'} / ${p.buildingArea ?? '–'} m²` : EMPTY },
                { k: 'Sertifikat', v: p.certificateType ? labelOf(CERTIFICATES, p.certificateType) : EMPTY },
                { k: 'Pemilik sertifikat', v: p.certificateOwner || EMPTY },
                { k: 'Sedang bersengketa', v: p.disputed == null ? EMPTY : p.disputed ? 'Ya' : 'Tidak', tone: p.disputed ? 'warn' : undefined },
                { k: 'Estimasi nilai', v: rupiah(p.estimatedValue), tag: p.estimatedValue > 0 && <EstimateTag /> },
                { k: 'Nilai per', v: dateLong(p.valueAsOf) },
                { k: 'Estimasi equity', v: rupiah(d.property?.equity), tone: d.property ? (d.property.equity >= 0 ? 'ok' : 'bad') : undefined },
                { k: 'LTV', v: percentRatio(d.property?.ltvRatio), tone: d.property?.ltvRatio > 1 ? 'bad' : undefined },
              ]}
            />
          </Panel>
          <Panel>
            <PanelTitle sub="Ditandai sendiri oleh user, tidak dikonfirmasi bank.">Pembayaran</PanelTitle>
            {rows(
              [...(m.payments ?? [])].sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
              (x) => (
                <li key={x.id} className={row}>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-bold">Jatuh tempo {dateShort(x.dueDate)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Dibayar {dateShort(x.paidAt)}
                      {x.proof && ` · bukti ${x.proof.fileName}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular">{rupiah(x.amount)}</span>
                </li>
              ),
              'Belum ada pembayaran yang ditandai.',
            )}
          </Panel>
          <Panel>
            <PanelTitle>Reminder</PanelTitle>
            <SummaryRows
              rows={[
                { k: 'Jatuh tempo cicilan', v: formatValue('reminders.payment', r?.payment ?? []) },
                { k: 'Akhir masa fixed', v: formatValue('reminders.fixedExpiry', r?.fixedExpiry ?? []) },
                { k: 'Channel', v: formatValue('reminders.channels', r?.channels ?? {}) },
              ]}
            />
          </Panel>
          <Panel>
            <PanelTitle sub="Perubahan yang dilakukan user sendiri, termasuk tanda pembayaran.">Riwayat perubahan KPR</PanelTitle>
            <AuditList events={history.slice(0, PREVIEW)} label="Riwayat perubahan KPR" subject={false} values empty="Belum ada perubahan dari user." />
            {history.length > PREVIEW && (
              <AllHistory to={`${back}/riwayat?jenis=kpr`} count={history.length}>
                Lihat semua riwayat KPR
              </AllHistory>
            )}
          </Panel>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {['balanceProjection', 'paymentSplit', 'floatingImpact'].map((id) => (
          <KprWidget key={id} id={id} widgetProps={widgetProps} />
        ))}
      </div>
      <KprWidget id="amortizationChart" widgetProps={widgetProps} />
      <Panel>
        <PanelTitle sub="Proyeksi anuitas dari sisa pokok hari ini. Bunga floating selalu estimasi.">Jadwal amortisasi</PanelTitle>
        {s ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Total cicilan" value={rupiah(s.totals.payment)} />
              <StatTile label="Total pokok" value={rupiah(s.totals.principal)} />
              <StatTile label="Total bunga" value={rupiah(s.totals.interest)} />
              <StatTile label="Periode" value={`${monthYear(s.rows[0].dueDate)} – ${monthYear(s.rows.at(-1).dueDate)}`} />
            </div>
            <Table aria-label="Jadwal amortisasi per tahun" className="tabular">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Tahun', 'Suku bunga', 'Cicilan', 'Pokok', 'Bunga', 'Sisa pokok'].map((h, i) => (
                    <TableHead key={h} className={`${head} ${i > 1 ? 'text-right' : ''}`}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.yearly.map((y) => (
                  <TableRow key={y.year}>
                    <TableCell className="py-2.5 font-bold">{y.year}</TableCell>
                    <TableCell className={`py-2.5 ${y.containsEstimate ? 'text-warning' : 'text-foreground'}`}>
                      {y.minRateBps === y.maxRateBps ? percentBps(y.minRateBps) : `${percentBps(y.minRateBps)}–${percentBps(y.maxRateBps)}`}
                      {y.containsEstimate && '*'}
                    </TableCell>
                    {['payment', 'principal', 'interest', 'closingBalance'].map((k) => (
                      <TableCell key={k} className="py-2.5 text-right">
                        {rupiah(y[k])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {s.yearly.some((y) => y.containsEstimate) && <p className="text-xs text-muted-foreground">* Memakai estimasi bunga floating.</p>}
          </>
        ) : (
          <Notice tone="muted">{d.scheduleError ? `Jadwal tidak dapat dihitung: ${d.scheduleError.message}` : `Belum dapat dihitung. Data yang belum tersedia: ${d.scheduleMissing.join(', ')}.`}</Notice>
        )}
      </Panel>
    </>
  )
}

// Admin edits and the user's own, by kind; anything that is not profile or finance is the KPR (data, activation, payments).
const KIND = { profile: 'profile', 'user.profile.update': 'profile', finance: 'finance', 'user.finance.update': 'finance' }
const KINDS = [
  { value: 'profile', label: 'Profil' },
  { value: 'finance', label: 'Keuangan' },
  { value: 'kpr', label: 'KPR & pembayaran' },
]
const BY = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
]
const FILTERS = ['jenis', 'oleh', 'dari', 'sampai']

// Every change to one user's data, filterable. Filters live in the URL, so the KPR page can link to its own part.
export function UserHistoryPage() {
  const { userId } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, error, reload } = useResource(() => api.admin.users.get(userId), [userId])
  const back = `/admin/users/${userId}`
  if (!data) {
    return (
      <>
        <AdminHeader title="Riwayat perubahan" back={back} />
        {error ? <ErrorPanel onRetry={reload} title={error.code === 'RESOURCE_NOT_FOUND' ? 'User tidak ditemukan.' : undefined} message={error.code === 'RESOURCE_NOT_FOUND' ? 'Akun ini mungkin sudah dihapus.' : undefined} /> : <PageSkeleton />}
      </>
    )
  }
  const f = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? '']))
  const set = (k) => (v) => setParams(Object.fromEntries(Object.entries({ ...f, [k]: v }).filter(([, x]) => x)), { replace: true })
  const day = (e) => e.occurredAt.slice(0, 10) // same day rule as the Audit Log filter
  const items = data.audit.filter(
    (e) =>
      (!f.jenis || (KIND[e.action] ?? 'kpr') === f.jenis) &&
      (!f.oleh || (e.actor.role === 'user' ? 'user' : 'admin') === f.oleh) &&
      (!f.dari || day(e) >= f.dari) &&
      (!f.sampai || day(e) <= f.sampai),
  )
  return (
    <>
      <AdminHeader title="Riwayat perubahan" subtitle={`${data.user.name} · oleh admin dan oleh user sendiri, terbaru di atas`} back={back} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <SelectField label="Jenis" placeholder="Semua" value={f.jenis} onChange={set('jenis')} options={KINDS} />
        <SelectField label="Oleh" placeholder="Semua" value={f.oleh} onChange={set('oleh')} options={BY} />
        <DateField label="Dari" value={f.dari} onChange={set('dari')} />
        <DateField label="Sampai" value={f.sampai} onChange={set('sampai')} />
      </div>
      <Panel>
        <p className="text-sm font-semibold text-muted-foreground">{items.length} catatan</p>
        <AuditList events={items} label="Riwayat perubahan" subject={kprName} values withTime empty={FILTERS.some((k) => f[k]) ? 'Tidak ada perubahan yang cocok dengan filter ini.' : 'Belum ada perubahan.'} />
      </Panel>
    </>
  )
}

// Only what the admin actually filled is sent; an empty NIK keeps the stored one (it is never read back).
function profilePayload(v) {
  const { nik, ...personal } = toPersonal(v)
  const job = { occupation: v.occupation.trim(), companyName: v.companyName.trim(), jobTitle: v.jobTitle.trim(), workYears: toInt(v.workYears), workMonths: toInt(v.workMonths) }
  return Object.fromEntries(Object.entries({ ...personal, ...(nik ? { nik } : {}), ...job }).filter(([, x]) => x !== '' && x != null))
}

function ProfileDialog({ data, onClose, onSaved, onReload }) {
  const validate = useCallback((v) => filledOnly({ ...validatePersonal(v, { today: data.asOf }), ...validateEmploymentBasic(v) }, v, ['fullName']), [data.asOf])
  const form = useForm(profileFormValues({ ...data.profile, nik: '' }, {}), validate)
  const payload = profilePayload(form.values)
  const changed = Object.keys(payload).filter((k) => k === 'nik' || JSON.stringify(payload[k]) !== JSON.stringify(data.profile[k] ?? null))
  return (
    <EditDialog
      title="Ubah profil"
      reasonAction="user.profile"
      description="Email login tidak bisa diubah di sini karena dipakai untuk masuk (Google atau kode email)."
      form={form}
      changed={changed}
      onClose={onClose}
      onReload={onReload}
      onSave={async (reason) => onSaved(await api.admin.users.updateProfile(data.user.id, { values: Object.fromEntries(changed.map((k) => [k, payload[k]])), reason, expectedVersion: data.user.version }))}
    >
      <PersonalFields form={form} clock={data.asOf} required={['fullName']} nikHint={`Kosongkan bila tidak diganti. Saat ini ${data.profile.nikMasked ?? 'belum diisi'}.`} />
      <FormGrid>
        <JobFields form={form} />
      </FormGrid>
    </EditDialog>
  )
}

const FINANCE_KEYS = ['monthlyIncome', 'jointIncome', 'partnerIncome', 'vehicleDebt', 'cardDebt', 'otherDebt']
const validateFinance = (v) => filledOnly(validateEmploymentBasic(v), v, ['monthlyIncome', 'partnerIncome'])

function FinanceDialog({ data, onClose, onSaved, onReload }) {
  const initial = profileFormValues({}, data.finance)
  const form = useForm(Object.fromEntries(FINANCE_KEYS.map((k) => [k, initial[k]])), validateFinance)
  const v = form.values
  const payload = { monthlyIncome: toMoney(v.monthlyIncome), jointIncome: v.jointIncome, partnerIncome: v.jointIncome ? toMoney(v.partnerIncome) : null, vehicleDebt: toMoney(v.vehicleDebt), cardDebt: toMoney(v.cardDebt), otherDebt: toMoney(v.otherDebt) }
  const current = { jointIncome: false, ...data.finance }
  const changed = FINANCE_KEYS.filter((k) => JSON.stringify(payload[k] ?? null) !== JSON.stringify(current[k] ?? null))
  return (
    <EditDialog
      title="Ubah keuangan"
      reasonAction="user.finance"
      description="Dipakai untuk DTI dan, bila user punya KPR, KPR Health."
      form={form}
      changed={changed}
      onClose={onClose}
      onReload={onReload}
      onSave={async (reason) => onSaved(await api.admin.users.updateFinance(data.user.id, { values: Object.fromEntries(changed.map((k) => [k, payload[k]])), reason, expectedVersion: data.user.version }))}
    >
      <FormGrid>
        <IncomeFields form={form} required={['monthlyIncome', 'partnerIncome']} />
      </FormGrid>
    </EditDialog>
  )
}
