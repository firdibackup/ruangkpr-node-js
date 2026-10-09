import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { CheckIcon, LockIcon, PencilIcon } from 'lucide-react'
import { PiCalculatorFill, PiEqualsFill, PiTrendDownFill, PiTrendUpFill } from 'react-icons/pi'
import { api } from '@/data/api'
import { calculateMaxPrincipal } from '@/calculations/finance'
import { useForm, useResource } from '@/lib/hooks'
import { BANKS, bpsInput, dateShort, intInput, moneyInput, percentBps, rupiah, rupiahShort, tenorLabel, toBps, toInt, toMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { CheckboxField, DateField, ErrorSummary, FormGrid, MoneyField, NumberField, RadioCards, RateField, SelectField, TextField } from '@/components/shared/fields'
import { UnsavedChangesGuard } from '@/components/shared/dialogs'
import { WizardProgress } from '@/components/shared/progress'
import { ErrorPanel, Notice, PageSkeleton, Spinner } from '@/components/shared/ui'
import { deriveMortgage } from './derive'
import { ReminderSettingsForm } from './ReminderSettingsForm'
import { SETUP_PERCENT, SETUP_STEPS, SETUP_TITLES, setupStepOf } from './setupMeta'
import { FIXED_PASSED, RATE_AUTO_HINT, impliedRate, remainingFromStart, validateLoanStep, validateReminders, withImpliedRate } from './validation'

const RETURN = { mykpr: '/my-kpr/overview', home: '/', profile: '/profile', rate: '/my-kpr/rate', explore: '/explore', review: '/monitoring/setup/2' }
const SCHEMES = [
  { value: 'conventional', label: 'Konvensional' },
  { value: 'sharia', label: 'Syariah' },
]
const RATE_TYPES = [
  { value: 'fixed', label: 'Masih fixed', description: 'Bunga dan cicilan tetap sampai tanggal tertentu.' },
  { value: 'floating', label: 'Sudah floating', description: 'Bunga mengikuti bank dan bisa berubah.' },
]
const KNOWS = [
  { value: 'yes', label: 'Ya, ada angka dari bank' },
  { value: 'no', label: 'Tidak, hitungkan perkiraan' },
]
// Pop-up entrance for live estimates: springs up from slightly below with a small overshoot so it catches the eye.
// Siblings jump to their new place (no layout animation) so the card pops into open space instead of under them.
const POP = {
  initial: { opacity: 0, scale: 0.85, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', bounce: 0.45, duration: 0.55 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
}

export function MortgageSetupWizard() {
  const { step } = useParams()
  const n = Number(step)
  const [params] = useSearchParams()
  const edit = params.get('edit')
  const navigate = useNavigate()
  const { data: snap, error, reload, setData } = useResource(() => api.dashboard.getSnapshot())

  // Links from older setups (e.g. setup/3, setup/6?edit=review) land on the last step.
  if (n > 2 && n <= 6) return <Navigate to="/monitoring/setup/2" replace />
  if (!(n >= 1 && n <= 2)) return <Navigate to="/monitoring/intro" replace />
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const draft = snap.mortgages.find((m) => m.status === 'draft')
  const active = snap.mortgages.find((m) => m.status === 'active')
  const editingActive = !!edit && edit !== 'review' && !draft && !!active
  // Nothing is stored until the first save: a new setup fills a blank draft that useSave creates on submit.
  const m = editingActive ? active : (draft ?? (!active && !edit && n === 1 ? { status: 'draft' } : null))
  if (!m) return <Navigate to={active ? '/my-kpr/overview' : '/monitoring/intro'} replace />
  // Reminders of an active KPR are managed in Profile → Reminder.
  if (editingActive && n === 2) return <Navigate to="/profile/reminders" replace />
  const reached = setupStepOf(m)
  if (m.status === 'draft' && n > reached) return <Navigate to={`/monitoring/setup/${reached}`} replace />

  const returnTo = edit ? RETURN[edit] ?? '/my-kpr/overview' : null
  const backTo = returnTo ?? (n === 1 ? '/monitoring/intro' : '/monitoring/setup/1')
  const onSaved = (saved) => {
    setData((s) => ({ ...s, mortgages: [saved, ...s.mortgages.filter((x) => x.id !== saved.id)] }))
    toast(edit ? 'Perubahan tersimpan.' : 'Tersimpan.')
    navigate(returnTo ?? `/monitoring/setup/${n + 1}`)
  }
  const common = { m, clock: snap.clock, reminderDefaults: snap.config.reminders, onSaved, editing: !!edit, backTo, navigate }

  return (
    <>
      <PageHeader title={edit ? 'Edit Data KPR' : 'Tambahkan KPR'} subtitle={SETUP_TITLES[n - 1]} back={backTo} />
      {!editingActive && (
        <WizardProgress
          label={`Bagian ${n} dari ${SETUP_STEPS.length} · ${SETUP_STEPS[n - 1]}`}
          steps={SETUP_STEPS}
          current={n}
          reached={Math.max(n, reached)}
          percent={Math.max(SETUP_PERCENT[n - 1], SETUP_PERCENT[reached - 1])}
          savedLabel="Tersimpan setiap klik Simpan & Lanjutkan"
        />
      )}
      {editingActive && (
        <Notice tone="info" title="Kamu sedang mengubah KPR aktif">
          Perubahan cicilan, bunga, atau sisa tenor akan menghitung ulang sisa pinjaman, reminder, dan KPR Health.
        </Notice>
      )}
      {n === 1 ? <LoanStep {...common} /> : <ReminderStep {...common} />}
    </>
  )
}

function SetupLayout({ children, footer, onSubmit, aside }) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 rounded-card bg-card p-5 shadow-card sm:p-7">
        {children}
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">{footer}</div>
      </div>
      <aside className="flex flex-[1_1_280px] flex-col gap-4 lg:sticky lg:top-6">
        {aside}
        <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-[22px]">
          <LockIcon className="size-5 text-primary" aria-hidden />
          <p className="text-sm leading-[21px] text-ink-2">Data yang kamu masukkan tidak dikirim ke bank sampai kamu sendiri memilih untuk mengajukan.</p>
        </div>
      </aside>
    </form>
  )
}

function Section({ title, desc, action, children }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-extrabold">{title}</h2>
          {desc && <p className="text-sm leading-[21px] text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Footer({ editing, backTo, navigate, saving, extra }) {
  return (
    <>
      <Button variant="neutral" onClick={() => navigate(backTo)}>
        {editing ? 'Batal' : 'Kembali'}
      </Button>
      <div className="flex flex-col-reverse gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-[18px]">
        {extra}
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan & Lanjutkan'}
        </Button>
      </div>
    </>
  )
}

function useSave(m, step, onSaved) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (values) => {
    setSaving(true)
    setError('')
    try {
      const id = m.id ?? (await api.mortgages.createSetup()).id
      onSaved(await api.mortgages.saveSetupStep(id, { step, values }))
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }
  return { saving, error, save }
}

// ---------- Step 1 · Data KPR (wajib) ----------
// Sisa pokok & tenor as they will be saved: the bank's figures, or the estimate the API makes from cicilan, bunga
// and sisa tenor (tenor awal minus cicilan since akad). `outstanding` stays null until every input is valid.
function loanPreview(v, clock) {
  const official = v.knowsOutstanding === 'yes'
  const remaining = official ? toInt(v.remainingTenorMonths) : remainingFromStart(v, clock)
  const payment = toMoney(v.currentPayment)
  const rateBps = toBps(v.currentRate)
  if (!(remaining >= 1 && remaining <= 360) || !(payment > 0) || !(rateBps > 0 && rateBps <= 3000)) return { remaining, outstanding: null }
  const outstanding = official ? toMoney(v.outstandingPrincipal) : v.scheme === 'sharia' ? null : calculateMaxPrincipal({ payment, annualRateBps: rateBps, termMonths: remaining })
  return { remaining, outstanding, payment, rateBps }
}

function floatingPreview(m, v, clock, loan) {
  const floatingBps = toBps(v.floatingRate)
  if (v.rateStatus !== 'fixed' || v.scheme === 'sharia' || !(v.fixedUntil > clock) || !(loan.outstanding > 0) || !(floatingBps > 0 && floatingBps <= 3000)) return null
  const preview = { ...m, scheme: 'conventional', currentRateType: 'fixed', fixedUntil: v.fixedUntil, currentRateBps: loan.rateBps, currentPayment: loan.payment, dueDay: toInt(v.dueDay), remainingTenorMonths: loan.remaining, estimatedFloatingRateBps: floatingBps, outstandingPrincipal: loan.outstanding }
  return deriveMortgage(preview, clock).floatingImpact
}

function LoanStep({ m, clock, onSaved, editing, backTo, navigate }) {
  const known = BANKS.some((b) => b.value === m.bankName)
  const official = m.outstandingEstimated === false && m.outstandingPrincipal > 0
  const validate = useCallback((v) => validateLoanStep(v, { today: clock }), [clock])
  const form = useForm(
    {
      bankName: !m.bankName ? '' : known ? m.bankName : 'Bank lainnya',
      bankOther: known ? '' : m.bankName ?? '',
      productName: m.productName ?? '',
      scheme: m.scheme ?? 'conventional',
      originalPrincipal: moneyInput(m.originalPrincipal),
      currentPayment: moneyInput(m.currentPayment),
      originalTenorMonths: intInput(m.originalTenorMonths),
      startDate: m.startDate ?? '',
      dueDay: intInput(m.dueDay),
      rateStatus: m.currentRateType ?? '',
      currentRate: bpsInput(m.currentRateBps),
      fixedUntil: m.fixedUntil ?? '',
      floatingRate: bpsInput(m.estimatedFloatingRateBps),
      knowsOutstanding: official ? 'yes' : m.outstandingEstimated ? 'no' : '',
      outstandingPrincipal: official ? moneyInput(m.outstandingPrincipal) : '',
      remainingTenorMonths: official ? intInput(m.remainingTenorMonths) : '',
    },
    validate,
  )
  const { saving, error, save } = useSave(m, 1, onSaved)
  const v = form.values
  const tenor = toInt(v.originalTenorMonths)
  const fixed = v.rateStatus === 'fixed'
  const passed = fixed && !!v.fixedUntil && v.fixedUntil <= clock
  // The Notice below carries the past-date error with its one-tap fix; repeating it under the field would push
  // that button down as the field blurs on tap.
  const fixedUntil = form.bind('fixedUntil')
  // Pinjaman, cicilan, tenor and jenis bunga keep an auto-filled bunga in step; it stays editable.
  const setRateSource = (patch) => form.setValues((p) => withImpliedRate(p, { ...p, ...patch }, 'currentRate', 'rateStatus'))
  const bindRateSource = (key) => ({ ...form.bind(key), onChange: (x) => setRateSource({ [key]: x }) })
  const rateIsAuto = v.currentRate !== '' && v.currentRate === impliedRate(v, v.rateStatus)
  const loan = loanPreview(v, clock)
  const impact = floatingPreview(m, v, clock, loan)
  const estimating = v.knowsOutstanding === 'no' && v.scheme !== 'sharia'
  // Live estimates sit in the sidebar so they stay in view (sticky on desktop) while the form is filled.
  // Each estimate pops in when it first appears; the impact one re-pops when its direction flips.
  // reducedMotion "user": transforms are skipped for prefers-reduced-motion, leaving only the fade.
  const previews = (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {estimating && loan.outstanding > 0 && (
          <motion.div key="outstanding" {...POP}>
            <Notice role="status" icon={PiCalculatorFill}>
              Perkiraan sisa pokok ± {rupiahShort(loan.outstanding)}, sisa tenor {loan.remaining} bulan ({tenorLabel(loan.remaining)}). Dihitung dari cicilan dan bunga, bukan saldo resmi bank.
            </Notice>
          </motion.div>
        )}
        {impact && (
          <motion.div key={impact.direction} {...POP}>
            {impact.direction === 'increase' ? (
              <Notice role="status" tone="warn" icon={PiTrendUpFill}>
                Setelah fixed, cicilan bisa naik jadi ± {rupiahShort(impact.estimatedNextPayment)}/bln (+{rupiahShort(impact.monthlyDelta)}) mulai {dateShort(impact.resetDate)}.
              </Notice>
            ) : impact.direction === 'decrease' ? (
              <Notice role="status" tone="ok" icon={PiTrendDownFill}>
                Setelah fixed, cicilan diperkirakan turun jadi ± {rupiahShort(impact.estimatedNextPayment)}/bln mulai {dateShort(impact.resetDate)}.
              </Notice>
            ) : (
              <Notice role="status" icon={PiEqualsFill}>Cicilan diperkirakan tidak berubah setelah fixed.</Notice>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )

  const onSubmit = form.submit((x) =>
    save({
      bankName: x.bankName === 'Bank lainnya' ? x.bankOther.trim() : x.bankName,
      productName: x.productName.trim() || null,
      scheme: x.scheme,
      originalPrincipal: toMoney(x.originalPrincipal),
      currentPayment: toMoney(x.currentPayment),
      originalTenorMonths: toInt(x.originalTenorMonths),
      startDate: x.startDate,
      dueDay: toInt(x.dueDay),
      currentRateType: x.rateStatus,
      currentRateBps: toBps(x.currentRate),
      fixedUntil: x.rateStatus === 'fixed' ? x.fixedUntil : null,
      estimatedFloatingRateBps: x.rateStatus === 'fixed' ? toBps(x.floatingRate) : null,
      // Official figures win; otherwise the API estimates sisa pokok from cicilan, bunga and this sisa tenor.
      ...(x.knowsOutstanding === 'yes'
        ? { outstandingPrincipal: toMoney(x.outstandingPrincipal), remainingTenorMonths: toInt(x.remainingTenorMonths), outstandingEstimated: false }
        : { outstandingPrincipal: null, remainingTenorMonths: remainingFromStart(x, clock), outstandingEstimated: null }),
    }),
  )

  return (
    <SetupLayout onSubmit={onSubmit} aside={previews} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}>
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Data KPR kamu" desc="Tanda * wajib diisi. Dipakai untuk reminder, jadwal amortisasi, dan simulasi.">
        <FormGrid>
          <SelectField label="Bank" required options={BANKS} {...form.bind('bankName')} />
          {v.bankName === 'Bank lainnya' ? <TextField label="Nama bank" required placeholder="Nama bank kamu" {...form.bind('bankOther')} /> : <TextField label="Nama produk KPR" optional placeholder="KPR Fixed 5 Tahun" maxLength={100} {...form.bind('productName')} />}
          {v.bankName === 'Bank lainnya' && <TextField label="Nama produk KPR" optional placeholder="KPR Fixed 5 Tahun" maxLength={100} span {...form.bind('productName')} />}
          <RadioCards label="Jenis KPR" required options={SCHEMES} span {...form.bind('scheme')} />
          {v.scheme === 'sharia' && (
            <Notice tone="warn" className="sm:col-span-2">
              KPR syariah: reminder tetap aktif, tetapi amortisasi dan perkiraan sisa pokok belum tersedia.
            </Notice>
          )}
          <MoneyField label="Jumlah pinjaman awal" required placeholder="600.000.000" {...bindRateSource('originalPrincipal')} />
          <NumberField label="Tenor awal" required placeholder="240" suffix="bulan" hint={tenor ? `${tenor} bulan = ${tenorLabel(tenor)}` : ''} {...bindRateSource('originalTenorMonths')} />
          <DateField label="Tanggal akad" required max={clock} {...form.bind('startDate')} />
          <NumberField label="Jatuh tempo setiap tanggal" required placeholder="22" maxLength={2} hint={toInt(v.dueDay) > 28 ? 'Di bulan tanpa tanggal ini, jatuh tempo pada hari terakhir bulan.' : ''} {...form.bind('dueDay')} />
        </FormGrid>
      </Section>

      <Section title="Cicilan & bunga">
        <FormGrid>
          <MoneyField label="Cicilan bulanan saat ini" required placeholder="4.250.000" {...bindRateSource('currentPayment')} />
          <RateField label="Bunga saat ini" required hint={rateIsAuto ? RATE_AUTO_HINT : ''} {...form.bind('currentRate')} />
          <RadioCards label="Jenis bunga" required options={RATE_TYPES} span {...bindRateSource('rateStatus')} />
          {fixed && <DateField label="Fixed berakhir" required hint="Lihat di surat akad atau aplikasi bank. Kalau hanya tahu bulannya, pilih tanggal 1." {...fixedUntil} error={passed ? undefined : fixedUntil.error} />}
          {fixed && <RateField label="Estimasi bunga floating" required placeholder="10,50" hint="Untuk amortisasi setelah fixed. Belum tahu? Tanyakan ke bank atau isi perkiraan dulu." {...form.bind('floatingRate')} />}
        </FormGrid>
        {passed && (
          <Notice
            tone="warn"
            role="status"
            action={
              <Button variant="outline" size="sm" onClick={() => setRateSource({ rateStatus: 'floating', fixedUntil: '' })}>
                Pilih Sudah floating
              </Button>
            }
          >
            {FIXED_PASSED}
          </Notice>
        )}
      </Section>

      <Section title="Sisa pinjaman">
        <FormGrid>
          <RadioCards label="Kamu tahu sisa pokok terbaru dari bank?" required hint="Lihat di aplikasi bank atau rekening koran KPR." options={KNOWS} span {...form.bind('knowsOutstanding')} />
          {v.knowsOutstanding === 'yes' && (
            <>
              <MoneyField label="Sisa pokok saat ini" required placeholder="415.000.000" {...form.bind('outstandingPrincipal')} />
              <NumberField label="Sisa tenor" required placeholder="183" suffix="bulan" {...form.bind('remainingTenorMonths')} />
            </>
          )}
        </FormGrid>
        {estimating && !(loan.outstanding > 0) && <p className="text-[13px] text-muted-foreground">Isi cicilan, bunga, tenor awal, dan tanggal akad untuk melihat perkiraan.</p>}
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 2 · Reminder & aktivasi ----------
function ReminderStep({ m, clock, reminderDefaults, navigate }) {
  const isFixed = m.currentRateType === 'fixed' && !!m.fixedUntil && m.fixedUntil > clock
  const [reminders, setReminders] = useState(() => {
    const r = structuredClone(m.reminders ?? reminderDefaults)
    return isFixed ? r : { ...r, fixedExpiry: [] }
  })
  const [agree, setAgree] = useState(false)
  const [tried, setTried] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const errors = validateReminders(reminders)
  const sections = [
    { title: 'KPR', to: '/monitoring/setup/1', lines: [`${m.bankName}${m.productName ? ` · ${m.productName}` : ''}`, `Pinjaman awal ${rupiah(m.originalPrincipal)} · ${tenorLabel(m.originalTenorMonths)}`, `Cicilan ${rupiah(m.currentPayment)}/bulan · jatuh tempo tgl ${m.dueDay}`, `Sisa pokok ${m.outstandingPrincipal ? `${rupiah(m.outstandingPrincipal)}${m.outstandingEstimated ? ' (perkiraan)' : ''}` : 'belum dihitung'} · sisa ${m.remainingTenorMonths} bulan`] },
    { title: 'Bunga', to: '/monitoring/setup/1', lines: m.currentRateType === 'fixed' ? [`Fixed ${percentBps(m.currentRateBps)} sampai ${dateShort(m.fixedUntil)}`, `Estimasi floating ${percentBps(m.estimatedFloatingRateBps)}`] : [`Floating ${percentBps(m.currentRateBps)}`] },
  ]

  const activate = async (e) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length || !agree || pending) return
    setPending(true)
    setError('')
    try {
      await api.mortgages.saveSetupStep(m.id, { step: 3, values: { reminders } })
      const res = await api.mortgages.activate(m.id, { confirmDataCorrect: true })
      navigate('/', { replace: true, state: { success: { scheduled: res.scheduledReminderCount } } })
    } catch (err) {
      setError(err.message)
      setPending(false)
    }
  }

  return (
    <SetupLayout
      onSubmit={activate}
      footer={
        <>
          <Button variant="neutral" onClick={() => navigate('/monitoring/setup/1')}>
            Kembali
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending} className={!agree ? 'bg-border text-ink-3 hover:bg-border' : ''}>
            {pending && <Spinner />}
            {pending ? 'Mengaktifkan…' : 'Aktifkan Pemantauan KPR'}
          </Button>
        </>
      }
    >
      <Section title="Atur reminder" desc="Pengaturan default sudah dipilih. Ubah bila perlu.">
        <ReminderSettingsForm value={reminders} onChange={setReminders} dueDay={m.dueDay} isFixed={isFixed} fixedUntil={m.fixedUntil} errors={tried ? errors : {}} />
      </Section>
      <Section title="Ringkasan data">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {sections.map((s) => (
            <div key={s.title} className="flex flex-col gap-2.5 rounded-[18px] border border-border px-5 py-[18px]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-extrabold">{s.title}</h3>
                <button type="button" onClick={() => navigate(`${s.to}?edit=review`)} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-primary">
                  <PencilIcon className="size-3.5" aria-hidden />
                  Edit
                </button>
              </div>
              {s.lines.map((l) => (
                <span key={l} className="text-sm leading-5 text-ink-2">
                  {l}
                </span>
              ))}
            </div>
          ))}
        </div>
      </Section>
      <CheckboxField label="Data yang saya masukkan benar" checked={agree} onChange={setAgree} error={tried && !agree ? 'Centang konfirmasi data dulu.' : undefined} />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckIcon className="size-3.5 text-success" aria-hidden />
        Aktivasi tidak membuat pengajuan ke bank.
      </p>
      {error && <Notice tone="bad" role="alert">{error} Draft dan pilihanmu tetap tersimpan.</Notice>}
    </SetupLayout>
  )
}
