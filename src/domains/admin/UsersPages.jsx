import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/data/api'
import { useForm, useResource } from '@/lib/hooks'
import { EMPTY, GENDERS, MARITAL, OCCUPATIONS, dateLong, dateShort, labelOf, percentBps, rupiah, toInt, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { FormGrid, SelectField, TextField } from '@/components/shared/fields'
import { ErrorPanel, PageSkeleton, Panel, PanelTitle, SummaryRows } from '@/components/shared/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { productName } from '@/domains/applications/meta'
import { profileFormValues, toPersonal, validatePersonal } from '@/domains/applications/validation'
import { validateEmploymentBasic } from '@/domains/optimize/validation'
import { filledOnly } from '@/domains/mortgages/validation'
import { IncomeFields, JobFields, PersonalFields } from '@/domains/profile/ProfilePages'
import { AdminHeader, AuditList, EditDialog, StatusChip } from './shared'

const CHOICE = { '': undefined, yes: true, no: false }
const head = 'text-xs font-bold text-ink-3'

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
          <p className="text-sm font-semibold text-ink-3">{data.length} user</p>
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
                    <TableCell className="py-3 text-ink-2">{u.hasActiveMortgage ? 'Ya' : '—'}</TableCell>
                    <TableCell className="py-3 text-ink-2 tabular">{dateShort(u.createdAt)}</TableCell>
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
const rows = (items, render, empty) => (items.length ? <ul className="flex flex-col">{items.map(render)}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>)
const row = 'flex items-center justify-between gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0'

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
                    <span className="text-sm font-bold">{[m.bankName, m.productName].filter(Boolean).join(' · ')}</span>
                    <span className="text-xs text-muted-foreground">
                      Sisa pokok {rupiah(m.outstandingPrincipal)} · cicilan {rupiah(m.currentPayment)} · {m.currentRateType === 'floating' ? 'floating' : 'fixed'} {percentBps(m.currentRateBps)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-ink-3">{MORTGAGE_STATUS[m.status] ?? m.status}</span>
                </li>
              ),
              'Belum ada KPR yang dipantau.',
            )}
          </Panel>
          <Panel>
            <PanelTitle>Riwayat perubahan</PanelTitle>
            <AuditList events={data.audit} label="Riwayat perubahan" subject={false} empty="Belum ada perubahan oleh admin." />
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
