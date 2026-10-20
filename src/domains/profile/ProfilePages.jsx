import { useCallback, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BellIcon, BriefcaseIcon, HeadsetIcon, KeyRoundIcon, LogOutIcon, PencilIcon, ShieldCheckIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useForm, useResource } from '@/lib/hooks'
import { GENDERS, MARITAL, OCCUPATIONS, dateLong, initials, labelOf, maskNik, rupiah, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { LogoutDialog, PageHeader } from '@/components/layout/AppShell'
import { CheckboxField, DateField, ErrorSummary, FormGrid, MoneyField, NumberField, RadioCards, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { ConfirmDialog, ContactCsDialog, FormDialog, UnsavedChangesGuard } from '@/components/shared/dialogs'
import { WizardProgress } from '@/components/shared/progress'
import { Disclaimer, ErrorPanel, IconBox, Notice, Panel, PageSkeleton, Spinner, SummaryRows } from '@/components/shared/ui'
import { useSession } from '@/domains/session/SessionProvider'
import { IN_PROCESS } from '@/domains/home/selectHomeState'
import { ReminderSettingsForm, reminderSummary } from '@/domains/mortgages/ReminderSettingsForm'
import { filledOnly, validateReminders } from '@/domains/mortgages/validation'
import { validateEmploymentBasic } from '@/domains/optimize/validation'
import { profileFormValues, validatePersonal } from '@/domains/applications/validation'
import { productName } from '@/domains/applications/meta'
import { brand } from '@/brand/brand'

export function ProfilePage() {
  const navigate = useNavigate()
  const { refresh } = useSession()
  const { data: snap, error, reload } = useResource(() => api.dashboard.getSnapshot())
  const [confirm, setConfirm] = useState(false)
  const [del, setDel] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [cs, setCs] = useState(false)
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const p = snap.profile ?? {}
  const f = snap.finance ?? {}
  const m = snap.mortgages.find((x) => x.status === 'active')
  const r = m ? reminderSummary(m.reminders, m.currentRateType === 'fixed' && m.fixedUntil > snap.clock) : null
  const incomplete = !p.nik || !p.birthDate || !p.occupation
  // Same rule as auth.deleteAccount: an application at the bank can't lose its account.
  const inProcess = snap.applications.find((a) => IN_PROCESS.includes(a.status))

  return (
    <>
      <PageHeader title="Profile" subtitle="Akun dan data pribadi kamu." />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="gap-1.5 sm:p-7">
            <div className="mb-2.5 flex items-center gap-3.5">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary text-[22px] font-extrabold text-white" aria-hidden>
                {initials(snap.user?.name)}
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-extrabold">{p.fullName || snap.user?.name}</h2>
                <span className="text-[13px] text-muted-foreground">Akun terverifikasi</span>
              </div>
            </div>
            <SummaryRows
              rows={[
                { k: 'No. HP', v: p.phone || 'Belum diisi', tone: p.phone ? undefined : 'mute' },
                { k: 'Email', v: p.email || 'Belum diisi', tone: p.email ? undefined : 'mute' },
                { k: 'NIK', v: p.nik ? maskNik(p.nik) : 'Belum diisi' },
                { k: 'Tanggal lahir', v: p.birthDate ? dateLong(p.birthDate) : 'Belum diisi', tone: p.birthDate ? undefined : 'mute' },
                { k: 'Status', v: p.maritalStatus ? labelOf(MARITAL, p.maritalStatus) : 'Belum diisi' },
              ]}
            />
            <Button variant="outline" size="md" className="mt-3 w-fit" onClick={() => navigate('/profile/edit')}>
              <PencilIcon aria-hidden />
              {incomplete ? 'Lengkapi Profil' : 'Edit Profil'}
            </Button>
          </Panel>
          <Panel className="gap-1.5 sm:p-7">
            <div className="mb-1.5 flex items-center gap-3">
              <IconBox icon={BriefcaseIcon} />
              <h2 className="text-[17px] font-extrabold">Pekerjaan & penghasilan</h2>
            </div>
            <SummaryRows
              rows={[
                { k: 'Pekerjaan', v: p.occupation ? labelOf(OCCUPATIONS, p.occupation) : 'Belum diisi' },
                { k: 'Perusahaan', v: p.companyName || 'Belum diisi', tone: p.companyName ? undefined : 'mute' },
                { k: 'Penghasilan bulanan', v: f.monthlyIncome ? rupiah(f.monthlyIncome) : 'Belum diisi', tone: f.monthlyIncome ? undefined : 'mute' },
              ]}
            />
            <Button variant="outline" size="md" className="mt-3 w-fit" onClick={() => navigate('/profile/edit', { state: { step: 2 } })}>
              <PencilIcon aria-hidden />
              {f.monthlyIncome ? 'Edit Penghasilan' : 'Isi Penghasilan'}
            </Button>
            <Disclaimer className="pt-2">Mengubah profil tidak mengubah data pengajuan yang sudah dikirim ke bank.</Disclaimer>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="gap-1.5 sm:p-7">
            <div className="mb-1.5 flex items-center gap-3">
              <IconBox icon={BellIcon} />
              <h2 className="text-[17px] font-extrabold">Pengaturan Reminder</h2>
            </div>
            {m ? (
              <>
                <SummaryRows
                  rows={[
                    { k: 'Pembayaran', v: r.pay },
                    { k: 'Fixed', v: r.fixed },
                    { k: 'Kanal', v: r.ch },
                  ]}
                />
                <Button variant="outline" size="md" className="mt-3 w-fit" onClick={() => navigate('/profile/reminders')}>
                  Ubah Pengaturan
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Reminder aktif setelah kamu menambahkan KPR untuk dipantau.</p>
            )}
          </Panel>
          <Panel className="gap-2.5 sm:p-7">
            <div className="flex items-center gap-3">
              <IconBox icon={HeadsetIcon} />
              <h2 className="text-[17px] font-extrabold">Bantuan</h2>
            </div>
            <p className="text-sm leading-[21px] text-muted-foreground">Tanya soal KPR atau pengajuan kamu lewat WhatsApp, atau jadwalkan konsultasi live dengan tim {brand.name}.</p>
            <Button variant="outline" size="md" className="mt-1 w-fit" onClick={() => setCs(true)}>
              <HeadsetIcon aria-hidden />
              Hubungi CS
            </Button>
          </Panel>
          <Panel className="gap-2.5 sm:p-7">
            <div className="flex items-center gap-3">
              <IconBox icon={ShieldCheckIcon} />
              <h2 className="text-[17px] font-extrabold">Privasi & persetujuan</h2>
            </div>
            <p className="text-sm leading-[21px] text-muted-foreground">Data kamu tidak dikirim ke bank tanpa persetujuan dan klik Submit. {brand.name} tidak pernah meminta password, PIN, atau OTP perbankan.</p>
            {(p.consents ?? []).map((c) => (
              <span key={c.type} className="text-[13px] text-muted-foreground">
                {c.type === 'terms' ? 'Syarat & Ketentuan' : 'Kebijakan Privasi'} v{c.version} · disetujui {dateLong(c.acceptedAt)}
              </span>
            ))}
            <div className="mt-2 flex flex-wrap gap-2.5">
              <Button variant="neutral" size="md" className="w-fit" onClick={() => navigate('/profile/password')}>
                <KeyRoundIcon aria-hidden />
                Ubah Password
              </Button>
              <Button variant="neutral" size="md" className="w-fit text-danger" onClick={() => setConfirm(true)}>
                <LogOutIcon aria-hidden />
                Keluar
              </Button>
              <Button
                variant="destructive-soft"
                size="md"
                className="w-fit"
                onClick={() => {
                  setAgreed(false)
                  setDel(true)
                }}
              >
                <Trash2Icon aria-hidden />
                Hapus Akun
              </Button>
            </div>
          </Panel>
        </div>
      </div>
      <LogoutDialog open={confirm} onOpenChange={setConfirm} />
      <ContactCsDialog
        open={cs}
        onOpenChange={setCs}
        support={snap.config.support}
        name={p.fullName || snap.user?.name}
        email={p.email || snap.user?.contact}
        topic={inProcess && `pengajuan ${productName(inProcess)} di ${inProcess.selection?.bankName}`}
      />
      {inProcess ? (
        <ConfirmDialog
          open={del}
          onOpenChange={setDel}
          destructive={false}
          title="Akun belum bisa dihapus"
          body="Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun."
          confirmLabel="Lihat Pengajuan"
          onConfirm={() => navigate('/my-kpr/application')}
        />
      ) : (
        <ConfirmDialog
          open={del}
          onOpenChange={setDel}
          title={`Hapus akun ${brand.name}?`}
          body={`Semua data kamu di ${brand.name} akan dihapus permanen dan tidak bisa dikembalikan:`}
          confirmLabel="Hapus Akun"
          confirmDisabled={!agreed}
          onConfirm={async () => {
            await api.auth.deleteAccount()
            await refresh()
            toast('Akun kamu sudah dihapus.')
            navigate('/login', { replace: true })
          }}
        >
          <ul className="-mt-2 list-disc pl-5 text-sm leading-[21px] text-muted-foreground">
            <li>Profil, data pribadi & penghasilan</li>
            <li>KPR yang dipantau & pengaturan reminder</li>
            <li>Draft pengajuan & hasil simulasi</li>
            <li>Riwayat di Activity</li>
          </ul>
          <Disclaimer>Pengajuan yang sudah dikirim ke bank tetap tersimpan di bank sesuai ketentuan bank.</Disclaimer>
          <CheckboxField label="Saya mengerti data ini tidak bisa dikembalikan." name="deleteConsent" checked={agreed} onChange={setAgreed} />
        </ConfirmDialog>
      )}
    </>
  )
}

export function ProfileEditPage() {
  const { data: snap, error, reload } = useResource(() => api.dashboard.getSnapshot())
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  return <ProfileForm snap={snap} />
}

const PROFILE_STEPS = ['Data pribadi', 'Pekerjaan & penghasilan']

function ProfileForm({ snap }) {
  const navigate = useNavigate()
  const location = useLocation()
  const p = snap.profile ?? {}
  const f = snap.finance ?? {}
  const validate = useCallback((v) => ({ ...validatePersonal(v, { today: snap.clock }), ...validateEmploymentBasic(v) }), [snap.clock])
  const form = useForm(profileFormValues(p, f), validate)
  // "Edit Penghasilan" opens step 2 directly, unless step 1 still has gaps that would block Simpan there.
  const [step, setStep] = useState(() => (location.state?.step === 2 && !Object.keys(validatePersonal(form.values, { today: snap.clock })).length ? 2 : 1))
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  // Same as a route change in AppShell: back to the top, focus on <main> for screen readers.
  const toStep = (n) => {
    setStep(n)
    window.scrollTo(0, 0)
    document.getElementById('main')?.focus({ preventScroll: true })
  }
  // Step 1 only gates its own fields (marked via touch), so step 2 doesn't open already red.
  const next = (e) => {
    e.preventDefault()
    const own = e.currentTarget
    const bad = Object.keys(validatePersonal(form.values, { today: snap.clock }))
    if (!bad.length) return toStep(2)
    bad.forEach((k) => form.blur(k))
    setTimeout(() => own.querySelector('[aria-invalid="true"]')?.focus(), 0)
  }
  const onSubmit = form.submit(async (x) => {
    setSaving(true)
    setApiError('')
    try {
      await api.profile.update({
        fullName: x.fullName.trim(), nik: x.nik, birthPlace: x.birthPlace.trim(), birthDate: x.birthDate, gender: x.gender, maritalStatus: x.maritalStatus, address: x.address.trim(), phone: x.phone.replace(/[\s-]/g, ''), email: x.email.trim(),
        occupation: x.occupation.trim(), companyName: x.companyName.trim(), jobTitle: x.jobTitle.trim(), workYears: Number(x.workYears), workMonths: Number(x.workMonths),
        finance: {
          monthlyIncome: toMoney(x.monthlyIncome), jointIncome: x.jointIncome, partnerIncome: x.jointIncome ? toMoney(x.partnerIncome) : null,
          vehicleDebt: toMoney(x.vehicleDebt), cardDebt: toMoney(x.cardDebt), otherDebt: toMoney(x.otherDebt),
        },
      })
      form.markClean()
      toast('Profil tersimpan.')
      navigate('/profile')
    } catch (e) {
      setApiError(e.message)
      setSaving(false)
    }
  })
  return (
    <>
      <PageHeader title="Edit profil" subtitle="Dipakai untuk mengisi otomatis pengajuan berikutnya." back="/profile" />
      <form onSubmit={step === 1 ? next : onSubmit} noValidate className="flex max-w-[860px] flex-col gap-5">
        <UnsavedChangesGuard when={form.dirty && !saving} />
        <WizardProgress label={`Langkah ${step} dari 2 · ${PROFILE_STEPS[step - 1]}`} steps={PROFILE_STEPS} current={step} savedLabel="Tersimpan setelah klik Simpan Profil" />
        <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
        {step === 1 ? (
          <>
            <Notice tone="info">Perubahan tidak memengaruhi snapshot pengajuan yang sudah dikirim. Email login belum bisa diubah pada versi ini.</Notice>
            <Panel className="gap-5 sm:p-7">
              <div className="flex items-center gap-3">
                <IconBox icon={UserIcon} />
                <h2 className="text-lg font-extrabold">Data pribadi</h2>
              </div>
              <PersonalFields form={form} clock={snap.clock} />
            </Panel>
          </>
        ) : (
          <Panel className="gap-5 sm:p-7">
            <div className="flex items-center gap-3">
              <IconBox icon={BriefcaseIcon} />
              <h2 className="text-lg font-extrabold">Pekerjaan & penghasilan</h2>
            </div>
            <FormGrid>
              <JobFields form={form} />
              <IncomeFields form={form} />
            </FormGrid>
          </Panel>
        )}
        {apiError && <Notice tone="bad" role="alert">{apiError}</Notice>}
        <div className="flex justify-between gap-3">
          {step === 1 ? (
            <Button variant="neutral" onClick={() => navigate('/profile')}>
              Batal
            </Button>
          ) : (
            <Button variant="neutral" onClick={() => toStep(1)}>
              Kembali
            </Button>
          )}
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving && <Spinner />}
            {step === 1 ? 'Lanjut' : 'Simpan Profil'}
          </Button>
        </div>
      </form>
    </>
  )
}

// One form for the profile data Take Over reuses.
// `required` lists the keys this form marks with *; each caller decides (the Home income pop-up asks only Penghasilan).
export function PersonalFields({ form, clock, required = [], nikHint }) {
  const req = (k) => required.includes(k)
  return (
    <FormGrid>
      <TextField label="Nama sesuai KTP" required={req('fullName')} span {...form.bind('fullName')} />
      <TextField label="NIK" required={req('nik')} inputMode="numeric" maxLength={16} hint={nikHint} {...form.bind('nik')} onChange={(x) => form.set('nik', x.replace(/\D/g, '').slice(0, 16))} />
      <TextField label="Tempat lahir" required={req('birthPlace')} {...form.bind('birthPlace')} />
      <DateField label="Tanggal lahir" required={req('birthDate')} max={clock} {...form.bind('birthDate')} />
      <RadioCards label="Jenis kelamin" required={req('gender')} options={GENDERS} {...form.bind('gender')} />
      <SelectField label="Status perkawinan" required={req('maritalStatus')} options={MARITAL} {...form.bind('maritalStatus')} />
      <TextAreaField label="Alamat KTP" required={req('address')} span {...form.bind('address')} />
      <TextField label="Nomor ponsel" required={req('phone')} inputMode="tel" {...form.bind('phone')} />
      <TextField label="Email" required={req('email')} type="email" disabled hint="Email login, tidak bisa diubah di sini." {...form.bind('email')} />
    </FormGrid>
  )
}

// Job and income are separate pieces (rendered inside a FormGrid) so the setup can put income first.
export function JobFields({ form, required = [] }) {
  const req = (k) => required.includes(k)
  return (
    <>
      <RadioCards label="Jenis pekerjaan" required={req('occupation')} layout="column" options={OCCUPATIONS} other="Lainnya — tulis pekerjaanmu" span {...form.bind('occupation')} />
      <TextField label="Nama perusahaan / usaha" required={req('companyName')} {...form.bind('companyName')} />
      <TextField label="Jabatan / bidang usaha" required={req('jobTitle')} {...form.bind('jobTitle')} />
      <NumberField label="Lama bekerja" required={req('workYears')} suffix="tahun" {...form.bind('workYears')} />
      <NumberField label="Tambahan bulan" required={req('workMonths')} suffix="bulan" {...form.bind('workMonths')} />
    </>
  )
}

export function IncomeFields({ form, required = [] }) {
  const req = (k) => required.includes(k)
  const v = form.values
  return (
    <>
      <MoneyField label="Penghasilan bulanan" required={req('monthlyIncome')} span {...form.bind('monthlyIncome')} />
      <CheckboxField label="Gabungkan pendapatan pasangan" span checked={v.jointIncome} onChange={(x) => form.setValues({ ...v, jointIncome: x, partnerIncome: x ? v.partnerIncome : '' })} />
      {v.jointIncome && <MoneyField label="Penghasilan pasangan" required={req('partnerIncome')} span {...form.bind('partnerIncome')} />}
      <MoneyField label="Cicilan kendaraan" optional {...form.bind('vehicleDebt')} />
      <MoneyField label="Kartu kredit / paylater" optional {...form.bind('cardDebt')} />
      <MoneyField label="Pinjaman lain" optional span hint="Dipakai untuk rasio cicilan di KPR Health." {...form.bind('otherDebt')} />
    </>
  )
}

const INCOME = ['monthlyIncome', 'jointIncome', 'partnerIncome', 'vehicleDebt', 'cardDebt', 'otherDebt']
const INCOME_REQUIRED = ['monthlyIncome', 'partnerIncome']
const validateIncome = (v) => filledOnly(validateEmploymentBasic(v), v, INCOME_REQUIRED)

// Unlocks KPR Health on Home: Penghasilan is the only required field, the other debts sharpen the ratio.
export function IncomeDialog({ finance, onClose, onSaved }) {
  const initial = profileFormValues({}, finance ?? {})
  const form = useForm(Object.fromEntries(INCOME.map((k) => [k, initial[k]])), validateIncome)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const onSubmit = form.submit(async (x) => {
    setSaving(true)
    setError('')
    try {
      await api.profile.update({
        finance: {
          monthlyIncome: toMoney(x.monthlyIncome),
          jointIncome: x.jointIncome,
          partnerIncome: x.jointIncome ? toMoney(x.partnerIncome) : null,
          vehicleDebt: toMoney(x.vehicleDebt),
          cardDebt: toMoney(x.cardDebt),
          otherDebt: toMoney(x.otherDebt),
        },
      })
      toast('Penghasilan tersimpan.')
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  })
  return (
    <FormDialog open onOpenChange={(open) => !open && !saving && onClose()} title="Isi penghasilan" description="Dipakai untuk rasio beban cicilan di KPR Health. Cicilan lain boleh dikosongkan." className="max-w-[560px]">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormGrid>
          <IncomeFields form={form} required={INCOME_REQUIRED} />
        </FormGrid>
        {error && <Notice tone="bad" role="alert">{error}</Notice>}
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          {saving ? 'Menyimpan…' : 'Simpan Penghasilan'}
        </Button>
      </form>
    </FormDialog>
  )
}

export function ReminderSettingsPage() {
  const { data: snap, error, reload } = useResource(() => api.dashboard.getSnapshot())
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const m = snap.mortgages.find((x) => x.status === 'active')
  if (!m) return <Navigate to="/profile" replace />
  return <ReminderEditor m={m} clock={snap.clock} />
}

function ReminderEditor({ m, clock }) {
  const navigate = useNavigate()
  const isFixed = m.currentRateType === 'fixed' && m.fixedUntil > clock
  const [value, setValue] = useState(() => structuredClone(m.reminders))
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const errors = validateReminders(value)
  const save = async (e) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) return
    setSaving(true)
    setApiError('')
    try {
      await api.mortgages.update(m.id, { reminders: value })
      toast('Pengaturan reminder tersimpan.')
      navigate('/profile')
    } catch (err) {
      setApiError(err.message)
      setSaving(false)
    }
  }
  return (
    <>
      <PageHeader title="Pengaturan reminder" subtitle={`${m.bankName} · jatuh tempo tanggal ${m.dueDay}`} back="/profile" />
      <form onSubmit={save} className="flex max-w-[760px] flex-col gap-5">
        <Panel className="sm:p-7">
          <ReminderSettingsForm value={value} onChange={setValue} dueDay={m.dueDay} isFixed={isFixed} fixedUntil={m.fixedUntil} errors={tried ? errors : {}} />
        </Panel>
        <Notice tone="muted">Jika izin notifikasi perangkat ditolak, reminder email tetap aktif dan semua reminder tetap tercatat di Activity.</Notice>
        {apiError && <Notice tone="bad" role="alert">{apiError} Pilihan kamu tetap tersimpan di halaman ini.</Notice>}
        <div className="flex justify-between gap-3">
          <Button variant="neutral" onClick={() => navigate('/profile')}>
            Batal
          </Button>
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving && <Spinner />}
            Simpan
          </Button>
        </div>
        <Link to="/activity" className="text-[13px] font-bold text-primary underline">
          Lihat riwayat reminder di Activity
        </Link>
      </form>
    </>
  )
}
