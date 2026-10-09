import { useCallback, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import {
  BriefcaseIcon,
  CalculatorIcon,
  CreditCardIcon,
  HandCoinsIcon,
  HeartPulseIcon,
  HouseIcon,
  IdCardIcon,
  InfoIcon,
  LandmarkIcon,
  ListOrderedIcon,
  LockIcon,
  PercentIcon,
  TargetIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";
import { api } from "@/data/api";
import { uploadHint } from "@/data/documentRules";
import { calculateTopupScenario } from "@/calculations/finance";
import { useForm } from "@/lib/hooks";
import {
  BANKS,
  CERTIFICATES,
  CITIES,
  GENDERS,
  GOALS,
  MARITAL,
  OCCUPATIONS,
  PROPERTY_TYPES,
  PURPOSES,
  intInput,
  labelOf,
  moneyInput,
  percentBps,
  percentRatio,
  rupiah,
  tenorLabel,
  toBps,
  toInt,
  toMoney,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckboxField,
  DateField,
  ErrorSummary,
  FormGrid,
  MoneyField,
  NumberField,
  RadioCards,
  RateField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/shared/fields";
import {
  ConfirmDialog,
  UnsavedChangesGuard,
} from "@/components/shared/dialogs";
import { UploadRow } from "@/components/shared/UploadRow";
import {
  Chip,
  Disclaimer,
  ErrorPanel,
  IconBox,
  Notice,
  Panel,
  PageSkeleton,
  ProgressBar,
  Spinner,
  SummaryRows,
} from "@/components/shared/ui";
import {
  toEmployment,
  toPersonal,
  validateEmployment,
  validatePersonal,
} from "@/domains/applications/validation";
import { takeoverScreenOf } from "@/domains/applications/meta";
import {
  HEALTH_SENTENCE,
  HealthRing,
} from "@/domains/home/dashboardWidgets";
import { applicationHealth, dtiTone, goalConditions } from "./insights";
import { Aside, OptimizeHeader, modeName, useOptimize } from "./shared";
import { TakeoverMilestone } from "./TakeoverMilestone";
import {
  oldLoanFormValues,
  outstandingEstimate,
  takeoverGaps,
  validateGoal,
  validateOldLoan,
  validateTakeoverProperty,
} from "./validation";
import {
  RATE_AUTO_HINT,
  impliedRate,
  withImpliedRate,
} from "@/domains/mortgages/validation";

const TENOR_OPTIONS = [5, 10, 15, 20, 25].map((y) => ({
  value: String(y * 12),
  label: `${y} tahun`,
}));
const RATE_TYPES = [
  { value: "fixed", label: "Fixed" },
  { value: "floating", label: "Floating" },
];
const KNOWS = [
  { value: "yes", label: "Ya" },
  { value: "no", label: "Tidak" },
];
// Screen names under the page title; the "Bagian X dari 3" label lives in the progress card.
const SUBTITLES = {
  1: "Data pribadi",
  2: "KPR lama",
  4: "Properti",
  5: "Tujuan",
  6: "Dokumen",
  7: "Review",
};

export function OptimizeStepPage({ employment = false }) {
  const { step } = useParams();
  const n = employment ? 1 : Number(step);
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const opt = useOptimize();
  const { snap, error, reload, setApp } = opt;
  if (!(n >= 1 && n <= 7)) return <Navigate to="/optimize/intro" replace />;
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />;
  // Nothing is stored until Data pribadi is saved: a new Take Over fills an unsaved draft (no id) that useStepSave creates.
  const profile = snap.profile ?? {};
  const app =
    opt.app ??
    (!opt.otherApp && n === 1 && !employment
      ? {
          status: "draft",
          currentStep: 1,
          optimizationMode: params.get("mode") === "topup" ? "topup" : "takeover",
          selection: null,
          data: { personal: { ...profile, fullName: profile.fullName ?? snap.user?.name } },
        }
      : null);
  if (!app) return <Navigate to="/optimize/intro" replace />;
  if (app.status !== "draft")
    return <Navigate to="/my-kpr/application" replace />;
  if (n >= 6 && !app.selection)
    return <Navigate to="/optimize/baseline" replace />;
  // A draft from a monitored KPR skips the data steps: every way into Tujuan/Dokumen/Review asks the missing ones first.
  const gaps = takeoverGaps(app.data, {
    today: snap.clock,
    mode: app.optimizationMode,
  });
  if (n >= 5 && gaps.length)
    return <Navigate to={gaps[0]} state={{ from: "gaps" }} replace />;
  if (n > app.currentStep)
    return (
      <Navigate
        to={
          app.currentStep >= 6 && !app.selection
            ? "/optimize/baseline"
            : `/optimize/${app.currentStep}`
        }
        replace
      />
    );
  if (
    employment &&
    Object.keys(
      validatePersonal(app.data.personal ?? {}, { today: snap.clock }),
    ).length
  )
    return <Navigate to="/optimize/1" replace />;

  const fromReview = location.state?.from === "review";
  const fromGaps = location.state?.from === "gaps";
  // Step 3 has no form: it is the phase 1 summary of the old loan.
  const milestone = n === 3;
  // `gaps` is from before this save, so it still lists the page just saved. Done: Dokumen once a bank is picked, else Tujuan.
  const gap = gaps.find((p) => p !== location.pathname);
  const next = (to, opts) =>
    fromGaps
      ? navigate(
          gap ?? (app.selection ? "/optimize/6" : "/optimize/5"),
          gap ? { state: { from: "gaps" } } : {},
        )
      : navigate(fromReview ? "/optimize/7" : to, opts);
  const props = { app, clock: snap.clock, config: snap.config, setApp, next, navigate, fromReview };
  const PN = modeName(app.optimizationMode);
  const back = {
    1: employment ? "/optimize/1" : "/optimize/intro",
    2: "/optimize/1/pekerjaan",
    3: "/optimize/2",
    4: "/optimize/3",
    5: "/optimize/4",
    6: "/optimize/programs",
    7: "/optimize/6",
  }[n];
  // Progress screens (takeoverProgress): 1 Data pribadi, 2 Pekerjaan, step n → n + 1 up to Tujuan, then Dokumen 8, Review 9.
  const screen = n === 1 ? (employment ? 2 : 1) : n <= 5 ? n + 1 : n + 2;
  const subtitle =
    n === 1 && employment ? "Pekerjaan & penghasilan" : SUBTITLES[n];

  return (
    <>
      <OptimizeHeader
        screen={screen}
        reached={takeoverScreenOf(app)}
        title={milestone ? "Tahap 1 selesai" : `Pengajuan ${PN}`}
        subtitle={milestone ? `${PN} · gambaran KPR lama kamu` : subtitle}
        back={fromReview ? "/optimize/7" : back}
      />
      {fromGaps && (
        <Notice tone="info" title="Lengkapi data pengajuan">
          Data ini belum ada di KPR yang kamu pantau dan diperlukan sebelum{" "}
          {app.selection ? "unggah dokumen" : "melihat pilihan bank"}.
        </Notice>
      )}
      {n === 1 &&
        (employment ? (
          <EmploymentStep {...props} />
        ) : (
          <PersonalStep {...props} />
        ))}
      {n === 2 && <OldLoanStep {...props} />}
      {milestone && (
        <TakeoverMilestone
          app={app}
          clock={snap.clock}
          onBack={() => navigate(back)}
          // Leaving the summary is what opens Properti; drafts saved here before it lost its form need it too.
          onNext={async () => {
            if (app.currentStep < 4)
              setApp(
                await api.applications.saveStep(app.id, { step: 3, values: {} }),
              );
            navigate("/optimize/4");
          }}
        />
      )}
      {n === 4 && <PropertyStep {...props} />}
      {n === 5 && <GoalStep {...props} />}
      {n === 6 && <TakeoverDocsStep {...props} />}
      {n === 7 && <TakeoverReview {...props} />}
    </>
  );
}

function FormLayout({ children, aside, onSubmit, cta, saving, onDemo }) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="flex min-w-0 flex-col gap-5">
        {children}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {import.meta.env.DEV && onDemo ? (
            <button
              type="button"
              onClick={onDemo}
              className="text-[13px] font-bold text-primary underline"
            >
              Isi contoh data
            </button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving && <Spinner />}
            {saving ? "Menyimpan…" : cta}
          </Button>
        </div>
      </div>
      {aside}
    </form>
  );
}

function Group({ icon, title, desc, children }) {
  return (
    <Panel as="fieldset" className="gap-5 sm:p-7">
      <legend className="contents">
        <span className="flex items-start gap-3">
          <IconBox icon={icon} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-lg font-extrabold">{title}</span>
            {desc && (
              <span className="text-[13px] leading-5 font-normal text-ink-3">
                {desc}
              </span>
            )}
          </span>
        </span>
      </legend>
      {children}
    </Panel>
  );
}

function useStepSave(app, step, setApp) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (values) => {
    setSaving(true);
    setError("");
    try {
      const id =
        app.id ??
        (await api.applications.create({ productType: "takeover", mode: app.optimizationMode })).id;
      const saved = await api.applications.saveStep(id, { step, values });
      setApp(saved);
      toast("Tersimpan.");
      return saved;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, save };
}

const SAFE_ASIDE = (
  <Aside
    icon={LockIcon}
    title="Data kamu aman"
    note="Data tidak dikirim ke bank sebelum kamu memilih satu program, memberi persetujuan, dan menekan Submit."
  />
);

// ---------- Step 1a ----------
function PersonalStep({ app, clock, setApp, next, fromReview }) {
  const p = app.data.personal ?? {};
  const validate = useCallback(
    (v) => validatePersonal(v, { today: clock }),
    [clock],
  );
  const form = useForm(
    {
      fullName: p.fullName ?? "",
      nik: p.nik ?? "",
      birthPlace: p.birthPlace ?? "",
      birthDate: p.birthDate ?? "",
      gender: p.gender ?? "",
      maritalStatus: p.maritalStatus ?? "",
      address: p.address ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
    },
    validate,
  );
  // Saved as sub-step 0 so the draft stays on step 1 until employment is saved too.
  const { saving, error, save } = useStepSave(app, 0, setApp);
  const onSubmit = form.submit(async (x) => {
    if (await save({ personal: toPersonal(x) })) {
      form.markClean();
      next("/optimize/1/pekerjaan");
    }
  });
  const demo = () =>
    form.setValues({
      fullName: "Firdi Audi",
      nik: "3174012345678901",
      birthPlace: "Bekasi",
      birthDate: "1994-08-12",
      gender: "male",
      maritalStatus: "single",
      address: "Jl. Melati No. 12, Bekasi Selatan",
      phone: "081234567890",
      email: "firdi.audi@email.com",
    });
  return (
    <FormLayout
      onSubmit={onSubmit}
      saving={saving}
      cta={fromReview ? "Simpan & kembali ke Review" : "Simpan & Lanjutkan"}
      onDemo={demo}
      aside={SAFE_ASIDE}
    >
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary
        show={form.showSummary}
        count={Object.keys(form.errors).length}
      />

      <Group
        icon={UserRoundIcon}
        title="Data pribadi"
        desc="Sesuai KTP. Disimpan di profil agar tidak perlu diisi ulang."
      >
        <FormGrid>
          <TextField label="Nama sesuai KTP" span {...form.bind("fullName")} />
          <TextField
            label="NIK"
            placeholder="16 digit angka"
            inputMode="numeric"
            maxLength={16}
            {...form.bind("nik")}
            onChange={(x) => form.set("nik", x.replace(/\D/g, "").slice(0, 16))}
          />
          <TextField
            label="Tempat lahir"
            placeholder="Bekasi"
            {...form.bind("birthPlace")}
          />
          <DateField
            label="Tanggal lahir"
            max={clock}
            {...form.bind("birthDate")}
          />
          <RadioCards
            label="Jenis kelamin"
            options={GENDERS}
            {...form.bind("gender")}
          />
          <TextAreaField
            label="Alamat KTP"
            span
            placeholder="Jl. Melati No. 12, Bekasi"
            {...form.bind("address")}
          />
          <SelectField
            label="Status perkawinan"
            options={MARITAL}
            {...form.bind("maritalStatus")}
          />
          <TextField
            label="Nomor ponsel"
            inputMode="tel"
            {...form.bind("phone")}
          />
          <TextField label="Email" type="email" span {...form.bind("email")} />
        </FormGrid>
      </Group>
      {error && (
        <Notice tone="bad" role="alert">
          {error}
        </Notice>
      )}
    </FormLayout>
  );
}

// ---------- Step 1b ----------
function EmploymentStep({ app, setApp, next, fromReview }) {
  const e = app.data.employment ?? {};
  // Debts live in `finance` for Take Over; a new draft's employment carries the profile's as a starting point.
  const f = app.data.finance ?? {};
  const form = useForm(
    {
      occupation: e.occupation ?? "",
      companyName: e.companyName ?? "",
      jobTitle: e.jobTitle ?? "",
      workYears: intInput(e.workYears),
      workMonths: intInput(e.workMonths),
      monthlyIncome: moneyInput(e.monthlyIncome),
      jointIncome: e.jointIncome ?? false,
      partnerIncome: moneyInput(e.partnerIncome),
      vehicleDebt: moneyInput(f.vehicleDebt ?? e.vehicleDebt),
      cardDebt: moneyInput(f.cardDebt ?? e.cardDebt),
      otherDebt: moneyInput(f.otherDebt ?? e.otherDebt),
    },
    validateEmployment,
  );
  const { saving, error, save } = useStepSave(app, 1, setApp);
  const v = form.values;
  const onSubmit = form.submit(async (x) => {
    const { vehicleDebt, cardDebt, otherDebt, ...employment } =
      toEmployment(x);
    if (
      await save({ employment, finance: { vehicleDebt, cardDebt, otherDebt } })
    ) {
      form.markClean();
      next("/optimize/2");
    }
  });
  const demo = () =>
    form.setValues({
      ...v,
      occupation: "private_employee",
      companyName: "PT Nusantara Digital",
      jobTitle: "Software Engineer",
      workYears: "4",
      workMonths: "6",
      monthlyIncome: "15000000",
      vehicleDebt: "1000000",
      cardDebt: "500000",
      otherDebt: "0",
    });
  return (
    <FormLayout
      onSubmit={onSubmit}
      saving={saving}
      cta={fromReview ? "Simpan & kembali ke Review" : "Simpan & Lanjutkan"}
      onDemo={demo}
      aside={SAFE_ASIDE}
    >
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary
        show={form.showSummary}
        count={Object.keys(form.errors).length}
      />
      <Group icon={BriefcaseIcon} title="Pekerjaan & penghasilan">
        <FormGrid>
          <SelectField
            label="Jenis pekerjaan"
            options={OCCUPATIONS}
            other="Tulis jenis pekerjaan"
            span
            {...form.bind("occupation")}
          />
          <TextField
            label="Nama perusahaan / usaha"
            {...form.bind("companyName")}
          />
          <TextField
            label="Jabatan / bidang usaha"
            {...form.bind("jobTitle")}
          />
          <NumberField
            label="Lama bekerja"
            suffix="tahun"
            {...form.bind("workYears")}
          />
          <NumberField
            label="Tambahan bulan"
            suffix="bulan"
            {...form.bind("workMonths")}
          />
          <MoneyField
            label="Penghasilan bulanan (gross)"
            span
            {...form.bind("monthlyIncome")}
          />
          <CheckboxField
            label="Gabungkan pendapatan pasangan"
            span
            checked={v.jointIncome}
            onChange={(x) =>
              form.setValues({
                ...v,
                jointIncome: x,
                partnerIncome: x ? v.partnerIncome : "",
              })
            }
          />
          {v.jointIncome && (
            <MoneyField
              label="Penghasilan pasangan"
              span
              {...form.bind("partnerIncome")}
            />
          )}
        </FormGrid>
      </Group>
      <Group
        icon={CreditCardIcon}
        title="Kewajiban lain per bulan"
        desc="Isi 0 jika tidak ada."
      >
        <FormGrid>
          <MoneyField
            label="Cicilan kendaraan"
            placeholder="0"
            {...form.bind("vehicleDebt")}
          />
          <MoneyField
            label="Kartu kredit / paylater"
            placeholder="0"
            {...form.bind("cardDebt")}
          />
          <MoneyField
            label="Pinjaman lain"
            placeholder="0"
            {...form.bind("otherDebt")}
          />
        </FormGrid>
      </Group>
      {error && (
        <Notice tone="bad" role="alert">
          {error}
        </Notice>
      )}
    </FormLayout>
  );
}

// ---------- Step 2 ----------
function OldLoanStep({ app, clock, setApp, next }) {
  const validate = useCallback(
    (v) => validateOldLoan(v, { today: clock }),
    [clock],
  );
  const form = useForm(oldLoanFormValues(app.data.oldLoan), validate);
  const { saving, error, save } = useStepSave(app, 2, setApp);
  const v = form.values;
  const fixed = v.rateType === "fixed";
  // Pinjaman, cicilan, tenor and jenis bunga keep an auto-filled bunga in step; it stays editable.
  const bindRateSource = (key) => ({
    ...form.bind(key),
    onChange: (x) =>
      form.setValues((p) =>
        withImpliedRate(p, { ...p, [key]: x }, "rate", "rateType"),
      ),
  });
  const rateIsAuto = v.rate !== "" && v.rate === impliedRate(v, v.rateType);
  const estimate =
    v.knowsOutstanding === "no" ? outstandingEstimate(v, clock) : null;
  const onSubmit = form.submit(async (x) => {
    const official = x.knowsOutstanding === "yes";
    // Validation guarantees the estimate exists when sisa pokok is not known.
    const est = official ? null : outstandingEstimate(x, clock);
    const isFixed = x.rateType === "fixed";
    const saved = await save({
      oldLoan: {
        bankName: x.bankName,
        productName: x.productName.trim() || null,
        originalPrincipal: toMoney(x.originalPrincipal),
        currentPayment: toMoney(x.currentPayment),
        originalTenorMonths: toInt(x.originalTenorMonths),
        startDate: x.startDate,
        dueDay: toInt(x.dueDay),
        rateBps: toBps(x.rate),
        rateType: x.rateType,
        fixedUntil: isFixed ? x.fixedUntil : null,
        floatingRateBps: isFixed ? toBps(x.floatingRate) : null,
        outstanding: official ? toMoney(x.outstanding) : est.outstanding,
        remainingMonths: official ? toInt(x.remainingMonths) : est.remaining,
        penaltyBps: String(x.penalty).trim() ? toBps(x.penalty) : null,
        source: official ? "official" : "estimate",
      },
    });
    if (saved) {
      form.markClean();
      next("/optimize/3");
    }
  });
  const demo = () =>
    form.setValues({
      bankName: "Bank ABC",
      productName: "KPR Fixed 5 Tahun",
      originalPrincipal: "500000000",
      currentPayment: "5000000",
      originalTenorMonths: "240",
      startDate: "2021-08-12",
      dueDay: "12",
      rate: "10,50",
      rateType: "floating",
      fixedUntil: "",
      floatingRate: "",
      knowsOutstanding: "yes",
      outstanding: "421500000",
      remainingMonths: "181",
      penalty: "",
    });
  return (
    <FormLayout
      onSubmit={onSubmit}
      saving={saving}
      cta="Simpan & Lanjutkan"
      onDemo={demo}
      aside={
        <Aside
          icon={InfoIcon}
          title="Kenapa kami tanya ini?"
          note="Kondisi KPR lama jadi pembanding sebelum melihat bank baru. Bunga dan tanggal fixed berakhir menentukan cicilan kalau kamu tetap di bank lama."
        />
      }
    >
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary
        show={form.showSummary}
        count={Object.keys(form.errors).length}
      />
      <Group
        icon={LandmarkIcon}
        title="KPR kamu saat ini"
        desc="Lihat di aplikasi bank lama, surat akad, atau rekening koran."
      >
        <FormGrid>
          <SelectField
            label="Bank asal"
            options={BANKS}
            {...form.bind("bankName")}
          />
          <TextField
            label="Nama produk"
            optional
            placeholder="KPR Fixed 5 Tahun"
            {...form.bind("productName")}
          />
          <MoneyField
            label="Pinjaman KPR awal"
            {...bindRateSource("originalPrincipal")}
          />
          <NumberField
            label="Tenor awal"
            suffix="bulan"
            placeholder="240"
            {...bindRateSource("originalTenorMonths")}
          />
          <DateField
            label="Tanggal akad"
            max={clock}
            {...form.bind("startDate")}
          />
          <NumberField
            label="Jatuh tempo setiap tanggal"
            placeholder="12"
            {...form.bind("dueDay")}
          />
        </FormGrid>
      </Group>
      <Group
        icon={PercentIcon}
        title="Cicilan & bunga"
        desc="Lihat di surat akad atau aplikasi bank."
      >
        <FormGrid>
          <MoneyField
            label="Cicilan bulanan saat ini"
            {...bindRateSource("currentPayment")}
          />
          <RateField
            label="Bunga saat ini"
            hint={rateIsAuto ? RATE_AUTO_HINT : ""}
            {...form.bind("rate")}
          />
          <RadioCards
            label="Jenis bunga"
            options={RATE_TYPES}
            variant="pill"
            span
            {...bindRateSource("rateType")}
          />
          {fixed && (
            <>
              <DateField
                label="Fixed berakhir"
                hint="Kalau hanya tahu bulannya, pilih tanggal 1."
                {...form.bind("fixedUntil")}
              />
              <RateField
                label="Estimasi floating setelahnya"
                optional
                placeholder="10,50"
                hint="Belum tahu? Kosongkan, tapi cicilan setelah fixed belum ikut dihitung."
                {...form.bind("floatingRate")}
              />
            </>
          )}
        </FormGrid>
      </Group>
      <Group icon={WalletIcon} title="Sisa pinjaman">
        <FormGrid>
          <RadioCards
            label="Kamu tahu sisa pokok terbaru dari bank?"
            hint="Lihat di aplikasi bank, surat keterangan sisa pinjaman, atau rekening koran."
            options={KNOWS}
            variant="pill"
            span
            {...form.bind("knowsOutstanding")}
          />
          {v.knowsOutstanding === "yes" && (
            <>
              <MoneyField
                label="Sisa pokok saat ini"
                {...form.bind("outstanding")}
              />
              <NumberField
                label="Sisa tenor"
                suffix="bulan"
                {...form.bind("remainingMonths")}
              />
            </>
          )}
          {v.knowsOutstanding === "no" &&
            (estimate ? (
              <Notice
                role="status"
                icon={CalculatorIcon}
                className="sm:col-span-2"
              >
                Perkiraan sisa pokok ± {rupiah(estimate.outstanding)}, sisa
                tenor {estimate.remaining} bulan (
                {tenorLabel(estimate.remaining)}). Dihitung dari cicilan dan
                bunga, bukan saldo resmi bank.
              </Notice>
            ) : (
              <p className="text-[13px] text-muted-foreground sm:col-span-2">
                Isi cicilan, bunga, tenor awal, dan tanggal akad untuk melihat
                perkiraan.
              </p>
            ))}
          <RateField
            label="Penalti pelunasan dipercepat"
            optional
            suffix="%"
            placeholder="2,00"
            hint="Kosongkan jika belum tahu. Kami pakai perkiraan kebijakan bank (2%) dan menandainya estimasi."
            span
            {...form.bind("penalty")}
          />
        </FormGrid>
      </Group>
      {error && (
        <Notice tone="bad" role="alert">
          {error}
        </Notice>
      )}
    </FormLayout>
  );
}

// ---------- Step 5 ----------
function GoalStep({ app, clock, setApp, navigate, fromReview }) {
  const g = app.data.goal ?? {};
  const form = useForm(
    {
      mode: g.mode ?? app.optimizationMode ?? "",
      goal: g.goal ?? "",
      tenorMonths: g.tenorMonths ? String(g.tenorMonths) : "",
      maxPayment: moneyInput(g.maxPayment),
      requestedTopup: moneyInput(g.requestedTopup || null),
      purpose: g.purpose ?? "",
      purposeOther: g.purposeOther ?? "",
    },
    validateGoal,
  );
  const [confirmSwitch, setConfirmSwitch] = useState(null);
  const { saving, error, save } = useStepSave(app, 5, setApp);
  const [simError, setSimError] = useState("");
  const v = form.values;
  const setMode = (mode) => {
    if (
      v.mode === "topup" &&
      mode === "takeover" &&
      (v.requestedTopup || v.purpose)
    )
      return setConfirmSwitch(mode);
    form.setValues({
      ...v,
      mode,
      tenorMonths: v.tenorMonths || (mode === "topup" ? "240" : "180"),
    });
  };
  const onSubmit = form.submit(async (x) => {
    setSimError("");
    const saved = await save({
      goal: {
        mode: x.mode,
        goal: x.mode === "takeover" ? x.goal : null,
        tenorMonths: Number(x.tenorMonths),
        maxPayment: toMoney(x.maxPayment),
        requestedTopup: x.mode === "topup" ? toMoney(x.requestedTopup) : 0,
        purpose: x.mode === "topup" ? x.purpose : null,
        purposeOther:
          x.mode === "topup" && x.purpose === "other"
            ? x.purposeOther.trim()
            : null,
      },
    });
    if (!saved) return;
    form.markClean();
    // Last data step: the goal is the simulation input, so every save re-runs it.
    try {
      await api.simulations.run({
        source: { type: "application", id: app.id },
        input: saved.data.goal,
      });
      navigate(
        fromReview && saved.selection ? "/optimize/7" : "/optimize/baseline",
      );
    } catch (err) {
      setSimError(err.message);
    }
  });
  const needsValue =
    v.mode === "topup" && !(app.data.property?.estimatedValue > 0);
  const c = goalConditions(app.data, clock);
  const r = c.rate;
  const options = [
    {
      mode: "takeover",
      title: "Tanpa dana tambahan",
      rows: [
        { k: "Plafon baru ≈ sisa pokok", v: rupiah(c.outstanding) },
        { k: "Biaya keluar bank lama (est.)", v: rupiah(c.exitCosts) },
        {
          k: "Rasio cicilan saat ini",
          v: percentRatio(c.dtiRatio),
          tone: dtiTone(c.dtiRatio),
        },
      ],
      tip:
        r.mode === "floating"
          ? "Bunga kamu sudah floating: pindah ke fixed baru bisa menurunkan cicilan."
          : r.mode === "warning"
            ? `Masa fixed berakhir ${r.daysUntilFixedEnd} hari lagi: saat yang tepat membandingkan program.`
            : "Biaya bank baru (provisi, notaris, appraisal) dihitung per program.",
    },
    {
      mode: "topup",
      title: "+ Dana tambahan",
      rows: [
        {
          k: "Batas pinjaman (LTV 70%)",
          v:
            c.maxLoanByCollateral == null
              ? "Isi nilai properti"
              : rupiah(c.maxLoanByCollateral),
        },
        {
          k: "Top-up kotor maksimum",
          v: rupiah(c.maxGrossTopup),
          tone:
            c.maxGrossTopup == null
              ? undefined
              : c.maxGrossTopup > 0
                ? "ok"
                : "bad",
        },
        {
          k: "Cicilan aman maks (35%)",
          v: c.safePayment == null ? rupiah(null) : `${rupiah(c.safePayment)}/bln`,
        },
        {
          k: "Ruang cicilan tambahan",
          v:
            c.paymentRoom == null
              ? rupiah(null)
              : c.paymentRoom > 0
                ? `${rupiah(c.paymentRoom)}/bln`
                : "Tidak ada",
          tone:
            c.paymentRoom == null ? undefined : c.paymentRoom > 0 ? "ok" : "bad",
        },
      ],
      warn: c.paymentRoom != null && c.paymentRoom <= 0,
      tip:
        c.paymentRoom != null && c.paymentRoom <= 0
          ? "Cicilan sekarang sudah di atas batas aman 35%, jadi Top-up berisiko ditolak."
          : "Biaya dipotong dari pencairan. Nilai rumah final mengikuti appraisal bank.",
    },
  ];
  return (
    <FormLayout
      onSubmit={onSubmit}
      saving={saving}
      cta={fromReview ? "Simpan & kembali ke Review" : "Lihat Kondisi KPR"}
      aside={
        <Aside
          icon={ListOrderedIcon}
          title="Sampai pilih program bank"
          note="Setelah ini: lihat kondisi KPR → bandingkan program bank (diurutkan sesuai tujuan) → pilih 1 program → unggah dokumen → review & submit. Data belum dikirim ke bank sebelum kamu submit."
        />
      }
    >
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary
        show={form.showSummary}
        count={Object.keys(form.errors).length}
      />
      <Group
        icon={TargetIcon}
        title="Apa tujuan kamu?"
        desc="Menentukan jalur perhitungan. Data lain tetap sama."
      >
        <RadioCards
          label="Tujuan pengajuan"
          layout="column"
          options={[
            {
              value: "takeover",
              label: "Pindah KPR tanpa dana tambahan",
              description: "Cari bunga, cicilan, atau tenor baru.",
            },
            {
              value: "topup",
              label: "Pindah KPR + dana tambahan",
              description: "Lunasi KPR lama dan terima Top-up.",
            },
          ]}
          {...form.bind("mode")}
          onChange={setMode}
        />
        <div className="@container flex flex-col gap-2.5">
          <h3 className="text-[13px] font-extrabold text-ink-3">
            Kondisi keuangan kamu per pilihan
          </h3>
          <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
            {options.map((o) => (
              <section
                key={o.mode}
                aria-label={`Kondisi keuangan: ${o.title}`}
                className={cn(
                  "flex flex-col gap-2.5 rounded-2xl border bg-card px-4 py-3.5",
                  v.mode === o.mode ? "border-primary" : "border-border",
                )}
              >
                <span className="text-sm font-extrabold">{o.title}</span>
                <SummaryRows size="sm" rows={o.rows} />
                <Notice tone={o.warn ? "warn" : "muted"} className="mt-auto">
                  {o.tip}
                </Notice>
              </section>
            ))}
          </div>
        </div>
      </Group>
      {v.mode === "takeover" && (
        <Group
          icon={ListOrderedIcon}
          title="Prioritas hasil"
          desc="Dipakai untuk mengurutkan program, bukan jaminan rekomendasi."
        >
          <FormGrid>
            <RadioCards
              label="Tujuan utama"
              layout="column"
              span
              options={GOALS}
              {...form.bind("goal")}
              onChange={(x) =>
                form.setValues({
                  ...v,
                  goal: x,
                  tenorMonths:
                    x === "shorter_tenor" && !v.tenorMonths
                      ? "120"
                      : v.tenorMonths,
                })
              }
            />
            <SelectField
              label="Tenor baru yang diinginkan"
              options={TENOR_OPTIONS}
              {...form.bind("tenorMonths")}
            />
            <MoneyField
              label="Batas cicilan nyaman"
              optional
              {...form.bind("maxPayment")}
            />
          </FormGrid>
        </Group>
      )}
      {v.mode === "topup" && (
        <Group
          icon={HandCoinsIcon}
          title="Kebutuhan dana"
          desc="Kebijakan tujuan dana berbeda di tiap bank."
        >
          <FormGrid>
            <MoneyField
              label="Dana tambahan yang dibutuhkan"
              span
              {...form.bind("requestedTopup")}
            />
            <SelectField
              label="Tujuan penggunaan"
              options={PURPOSES}
              {...form.bind("purpose")}
            />
            <SelectField
              label="Tenor baru"
              options={TENOR_OPTIONS}
              {...form.bind("tenorMonths")}
            />
            {v.purpose === "other" && (
              <TextField
                label="Jelaskan kebutuhan"
                span
                {...form.bind("purposeOther")}
              />
            )}
            <MoneyField
              label="Cicilan maksimal yang nyaman"
              optional
              span
              {...form.bind("maxPayment")}
            />
          </FormGrid>
          {needsValue && (
            <Notice
              tone="warn"
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/optimize/4")}
                >
                  Isi nilai properti
                </Button>
              }
            >
              Estimasi nilai properti belum diisi, jadi dana bersih Top-up belum
              dapat dihitung.
            </Notice>
          )}
        </Group>
      )}
      {(error || simError) && (
        <Notice
          tone="bad"
          role="alert"
          title={simError ? "Simulasi tidak dapat dihitung" : undefined}
        >
          {error || simError}
        </Notice>
      )}
      <ConfirmDialog
        open={!!confirmSwitch}
        onOpenChange={(o) => !o && setConfirmSwitch(null)}
        destructive={false}
        title="Ganti ke Take Over tanpa dana tambahan?"
        body="Jumlah dana tambahan dan tujuan penggunaannya akan dihapus."
        confirmLabel="Ya, Ganti"
        onConfirm={async () =>
          form.setValues({
            ...v,
            mode: confirmSwitch,
            requestedTopup: "",
            purpose: "",
            purposeOther: "",
            tenorMonths: v.tenorMonths || "180",
          })
        }
      />
    </FormLayout>
  );
}

// KPR Health from the data entered so far; LTV follows the property value as it is typed.
function HealthAside({ health: h, note, sticky }) {
  const tone = (key) => h.components.find((x) => x.key === key).tone;
  const weakest = h.components
    .filter((x) => x.score !== null)
    .sort((a, b) => a.score - b.score)[0];
  const r = h.rate;
  return (
    <Aside
      icon={HeartPulseIcon}
      title="Kesehatan KPR kamu"
      note={note}
      sticky={sticky}
      rows={[
        { k: "Beban cicilan", v: percentRatio(h.dtiRatio), tone: tone("dti") },
        {
          k: "LTV (sisa pokok ÷ nilai)",
          v: h.ltvRatio == null ? "Isi estimasi nilai" : percentRatio(h.ltvRatio),
          tone: tone("ltv"),
        },
        {
          k: "Risiko bunga",
          v:
            r.mode == null
              ? "Belum diketahui"
              : r.mode === "floating"
                ? "Sudah floating"
                : r.daysUntilFixedEnd != null
                  ? `Fixed ${r.daysUntilFixedEnd} hari lagi`
                  : "Fixed",
          tone: tone("rate"),
        },
        { k: "Pokok lunas", v: percentRatio(h.paidRatio, 0), tone: tone("progress") },
      ]}
    >
      <div className="flex items-center gap-4">
        <HealthRing health={h} size={80} />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <Chip tone={h.tone}>
            {h.label}
            {h.partial ? " · parsial" : ""}
          </Chip>
          <p className="text-[13px] leading-5 font-semibold text-ink-2">
            {h.tone === "ok"
              ? "Kondisi KPR kamu sehat."
              : weakest?.key === "rate" && r.mode === "floating"
                ? "Bunga kamu sudah floating."
                : HEALTH_SENTENCE[weakest?.key]}
          </p>
        </div>
      </div>
    </Aside>
  );
}

// ---------- Step 4 ----------
function PropertyStep({ app, clock, config, setApp, next }) {
  const p = app.data.property ?? {};
  const mode = app.optimizationMode;
  const validate = useCallback(
    (v) => validateTakeoverProperty(v, { mode }),
    [mode],
  );
  const form = useForm(
    {
      propertyType: p.propertyType ?? "",
      city: p.city ?? "",
      address: p.address ?? "",
      landArea: intInput(p.landArea),
      buildingArea: intInput(p.buildingArea),
      certificateType: p.certificateType ?? "",
      certificateOwner: p.certificateOwner ?? app.data.personal?.fullName ?? "",
      estimatedValue: moneyInput(p.estimatedValue),
      disputed: p.disputed == null ? "" : p.disputed ? "yes" : "no",
    },
    validate,
  );
  const { saving, error, save } = useStepSave(app, 4, setApp);
  const v = form.values;
  const out = app.data.oldLoan?.outstanding;
  const value = toMoney(v.estimatedValue);
  // Conservative 70% LTV reference (per-bank limits are applied later in the program list).
  const topupRef =
    mode === "topup" && value > 0 && out
      ? calculateTopupScenario({
          propertyValue: value,
          maxLtvBps: 7000,
          oldOutstanding: out,
          newLoanAmount: Math.max(out, Math.floor(value * 0.7)),
          requestedTopup: app.data.goal?.requestedTopup ?? 0,
        })
      : null;
  const onSubmit = form.submit(async (x) => {
    const saved = await save({
      property: {
        propertyType: x.propertyType,
        city: x.city,
        address: x.address.trim(),
        landArea: toInt(x.landArea),
        buildingArea: toInt(x.buildingArea),
        certificateType: x.certificateType,
        certificateOwner: x.certificateOwner.trim(),
        estimatedValue: toMoney(x.estimatedValue),
        disputed: x.disputed === "yes",
      },
    });
    if (saved) {
      form.markClean();
      next("/optimize/5");
    }
  });
  const demo = () =>
    form.setValues({
      propertyType: "landed_house",
      city: "Kota Bekasi",
      address: "Griya Asri Blok C2 No. 8",
      landArea: "72",
      buildingArea: "45",
      certificateType: "shm",
      certificateOwner: app.data.personal?.fullName || "Firdi Audi",
      estimatedValue: "750000000",
      disputed: "no",
    });
  const health = (
    <HealthAside
      health={applicationHealth(app.data, clock, value, config.health)}
      sticky={mode !== "topup"}
      note={`${mode === "topup" ? "" : "Take Over umumnya butuh LTV maksimal 70–80%. "}Skor ini bukan skor kredit dan tidak menentukan persetujuan bank.`}
    />
  );
  const aside =
    mode === "topup" ? (
      // One sticky column: two individually sticky asides would slide over each other.
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <Aside
          icon={CalculatorIcon}
          sticky={false}
          tone="warn"
          title="Estimasi batas Top-up"
          rows={
            topupRef
              ? [
                  { k: "Estimasi nilai properti", v: rupiah(value) },
                  { k: "LTV konservatif", v: "70%" },
                  {
                    k: "Plafon maksimum",
                    v: rupiah(topupRef.maxLoanByCollateral),
                  },
                  { k: "Sisa pokok lama", v: `−${rupiah(out)}` },
                  {
                    k: "Top-up kotor maksimum",
                    v: rupiah(topupRef.maxGrossTopup),
                    tone: "ok",
                  },
                  // Filled at step 5; only known here when editing afterwards.
                  app.data.goal?.requestedTopup > 0 && {
                    k: "Kebutuhan kamu",
                    v: rupiah(app.data.goal.requestedTopup),
                  },
                ]
              : []
          }
          note={
            topupRef
              ? "Belum termasuk biaya. Masih harus lolos DTI, usia, tenor, pekerjaan, riwayat kredit, legalitas, dan appraisal resmi."
              : "Isi estimasi nilai properti untuk melihat batas Top-up."
          }
        />
        {health}
      </div>
    ) : (
      health
    );
  return (
    <FormLayout
      onSubmit={onSubmit}
      saving={saving}
      cta="Simpan & Lanjutkan"
      onDemo={demo}
      aside={aside}
    >
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary
        show={form.showSummary}
        count={Object.keys(form.errors).length}
      />
      <Group
        icon={HouseIcon}
        title="Properti yang dijaminkan"
        desc="Properti yang sedang menjadi jaminan KPR lama."
      >
        <FormGrid>
          <SelectField
            label="Jenis properti"
            options={PROPERTY_TYPES}
            {...form.bind("propertyType")}
          />
          <SelectField
            label="Kota / Kabupaten"
            options={CITIES}
            {...form.bind("city")}
          />
          <TextField
            label="Alamat"
            span
            placeholder="Griya Asri Blok C2 No. 8"
            {...form.bind("address")}
          />
          <NumberField
            label="Luas tanah"
            suffix="m²"
            optional={v.propertyType === "apartment"}
            {...form.bind("landArea")}
          />
          <NumberField
            label="Luas bangunan"
            suffix="m²"
            {...form.bind("buildingArea")}
          />
          <SelectField
            label="Status sertifikat"
            options={CERTIFICATES}
            {...form.bind("certificateType")}
          />
          <TextField
            label="Nama pemilik sertifikat"
            {...form.bind("certificateOwner")}
          />
          <MoneyField
            label="Estimasi nilai saat ini"
            optional={mode !== "topup"}
            span
            hint="Nilai ini bukan appraisal resmi. Bank akan menilai ulang."
            {...form.bind("estimatedValue")}
          />
          <RadioCards
            label="Sedang bersengketa?"
            variant="pill"
            span
            options={[
              { value: "no", label: "Tidak" },
              { value: "yes", label: "Ya" },
            ]}
            {...form.bind("disputed")}
          />
        </FormGrid>
        {v.disputed === "yes" && (
          <Notice tone="warn">
            Simulasi tetap bisa dilanjutkan, tetapi kelayakan perlu pemeriksaan
            manual oleh bank.
          </Notice>
        )}
        {mode !== "topup" && !value && (
          <Notice tone="muted">
            Tanpa nilai properti, program akan ditandai “perlu ditinjau” karena
            LTV belum dapat dicek.
          </Notice>
        )}
      </Group>
      {error && (
        <Notice tone="bad" role="alert">
          {error}
        </Notice>
      )}
    </FormLayout>
  );
}

// ---------- Step 6 ----------
const GROUPS = [
  ["identity", "IDENTITAS & PENGHASILAN", IdCardIcon],
  ["old_loan", "KPR LAMA", LandmarkIcon],
  ["property", "PROPERTI", HouseIcon],
  ["topup", "DANA TAMBAHAN", HandCoinsIcon],
];

function TakeoverDocsStep({ app, config, setApp, next, fromReview }) {
  const [demo, setDemo] = useState(false);
  const [saving, setSaving] = useState(false);
  const required = app.requiredDocuments.filter((d) => d.required);
  const done = required.filter((d) =>
    ["uploaded", "verified"].includes(app.documents[d.type]?.status),
  ).length;
  const complete = done === required.length;
  const upload = (type) => async (file, onProgress) =>
    setApp(
      await api.applications.uploadDocument(
        app.id,
        { documentType: type, file },
        { onProgress },
      ),
    );
  const uploadAll = async () => {
    setDemo(true);
    try {
      let latest = app;
      for (const d of required) {
        if (["uploaded", "verified"].includes(latest.documents[d.type]?.status))
          continue;
        latest = await api.applications.uploadDocument(app.id, {
          documentType: d.type,
          file: {
            name: `${d.type.replaceAll("_", "-")}.pdf`,
            size: 380_000,
            type: "application/pdf",
          },
        });
      }
      setApp(latest);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDemo(false);
    }
  };
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        {GROUPS.map(([key, title, Icon]) => {
          const docs = app.requiredDocuments.filter((d) => d.group === key);
          if (!docs.length) return null;
          return (
            <Panel key={key} className="gap-3 sm:p-7">
              <span className="flex items-center gap-2.5 text-[13px] font-extrabold tracking-[0.4px] text-ink-3">
                <Icon className="size-[18px] text-primary" aria-hidden />
                {title}
              </span>
              {docs.map((d) => (
                <UploadRow
                  key={d.type}
                  doc={d}
                  state={app.documents[d.type]}
                  onUpload={upload(d.type)}
                  compact
                  rules={config.upload}
                />
              ))}
            </Panel>
          );
        })}
      </div>
      <aside className="flex flex-col gap-3.5 rounded-card bg-card p-6 shadow-card lg:sticky lg:top-6">
        <span className="text-[13px] font-extrabold text-ink-3">
          Dokumen wajib
        </span>
        <span className="text-[30px] font-extrabold" role="status">
          {done}{" "}
          <span className="text-base text-muted-foreground">
            dari {required.length}
          </span>
        </span>
        <ProgressBar
          value={(done / Math.max(1, required.length)) * 100}
          label="Dokumen wajib terunggah"
          barClassName="bg-success-strong"
        />
        <p className="text-[13px] leading-5 text-ink-3">
          Dokumen KPR lama dan properti diperlukan untuk Take Over, berbeda dari
          KPR baru. {uploadHint(config.upload)}. Setiap file tersimpan otomatis.
        </p>
        {import.meta.env.DEV && !complete && (
          <button
            type="button"
            onClick={uploadAll}
            disabled={demo}
            className="w-fit text-[13px] font-bold text-primary underline"
          >
            {demo ? "Mengunggah…" : "Unggah semua (demo)"}
          </button>
        )}
        <Button
          onClick={async () => {
            if (!complete || saving) return;
            setSaving(true);
            try {
              setApp(
                await api.applications.saveStep(app.id, {
                  step: 6,
                  values: {},
                }),
              );
              next("/optimize/7");
            } catch (e) {
              toast.error(e.message);
              setSaving(false);
            }
          }}
          aria-disabled={!complete}
          aria-busy={saving}
          className={cn(!complete && "bg-border text-ink-3 hover:bg-border")}
        >
          {saving && <Spinner />}
          {fromReview ? "Simpan & kembali ke Review" : "Simpan & Lanjutkan"}
        </Button>
        {!complete && (
          <span className="text-xs text-muted-foreground">
            Unggah semua dokumen wajib untuk lanjut.
          </span>
        )}
      </aside>
    </div>
  );
}

// ---------- Step 7 ----------
function TakeoverReview({ app, navigate }) {
  const [cons, setCons] = useState({ dataAccuracy: false, sendToBank: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const {
    personal: p = {},
    employment: e = {},
    oldLoan: o = {},
    goal: g = {},
    property: pr = {},
    finance: f = {},
  } = app.data;
  const s = app.selection;
  const required = app.requiredDocuments.filter((d) => d.required);
  const done = required.filter((d) =>
    ["uploaded", "verified"].includes(app.documents[d.type]?.status),
  ).length;
  const docOk = done === required.length;
  const canSubmit = docOk && !!s && cons.dataAccuracy && cons.sendToBank;
  const edit = (to) => () => navigate(to, { state: { from: "review" } });
  const secs = [
    {
      title: "Data Pribadi",
      lines: [p.fullName, `${p.phone} · ${p.email}`],
      edit: edit("/optimize/1"),
    },
    {
      title: "Pekerjaan & Penghasilan",
      lines: [
        `${labelOf(OCCUPATIONS, e.occupation)} · ${e.companyName}`,
        `Penghasilan ${rupiah(e.monthlyIncome)} · Kewajiban lain ${rupiah((f.vehicleDebt ?? 0) + (f.cardDebt ?? 0) + (f.otherDebt ?? 0))}/bln`,
      ],
      edit: edit("/optimize/1/pekerjaan"),
    },
    {
      title: "KPR Lama",
      lines: [
        `${o.bankName} · Sisa ${rupiah(o.outstanding)}${o.source === "estimate" ? " (estimasi)" : ""}`,
        `Cicilan ${rupiah(o.currentPayment)} · ${percentBps(o.rateBps)}`,
      ],
      edit: edit("/optimize/2"),
    },
    {
      title: "Properti",
      lines: [
        `${labelOf(PROPERTY_TYPES, pr.propertyType)} · ${labelOf(CERTIFICATES, pr.certificateType)} · ${pr.city ?? ""}`,
        pr.estimatedValue
          ? `Estimasi nilai ${rupiah(pr.estimatedValue)}`
          : "Nilai properti belum diisi",
      ],
      edit: edit("/optimize/4"),
    },
    {
      title: "Tujuan",
      lines:
        g.mode === "topup"
          ? [
              "Pindah KPR + dana tambahan",
              `Top-up ${rupiah(g.requestedTopup)} · ${labelOf(PURPOSES, g.purpose)}`,
            ]
          : ["Pindah KPR tanpa dana tambahan", labelOf(GOALS, g.goal)],
      edit: edit("/optimize/5"),
    },
    {
      title: "Program Baru",
      lines: s
        ? [
            `${s.bankName} · ${s.productName} ${percentBps(s.fixedRateBps)}`,
            `Cicilan estimasi ${rupiah(s.estimatedPayment)} · ${tenorLabel(s.tenorMonths)}`,
            g.mode === "topup"
              ? `Plafon ${rupiah(s.loanAmount)} · Dana bersih ${rupiah(s.netTopup)}`
              : `Biaya estimasi ${rupiah(s.feesTotal)} · Break-even ${s.breakEvenMonth ? `${s.breakEvenMonth} bulan` : "tidak ada"}`,
          ]
        : ["Belum dipilih"],
      edit: () => navigate("/optimize/programs"),
      warn: s ? "" : "Pilih satu program.",
    },
    {
      title: "Dokumen",
      lines: [`${done} dari ${required.length} wajib lengkap`],
      edit: edit("/optimize/6"),
      warn: docOk ? "" : "Lengkapi dokumen wajib sebelum submit.",
    },
  ];
  const submit = async () => {
    if (!canSubmit || pending) return;
    setPending(true);
    setError(null);
    try {
      await api.applications.submit(app.id, { consents: cons });
      navigate("/", { replace: true, state: { success: { appId: app.id } } });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  };
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        {secs.map((x) => (
          <section
            key={x.title}
            className={cn(
              "flex items-start justify-between gap-4 rounded-3xl border bg-card px-6 py-5 shadow-card",
              x.warn ? "border-[#f2d27a]" : "border-card",
            )}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="text-[13px] font-extrabold text-ink-3">
                {x.title}
              </h2>
              {x.lines.map((l) => (
                <span key={l} className="text-sm leading-[21px] font-semibold">
                  {l}
                </span>
              ))}
              {x.warn && (
                <span className="text-xs font-bold text-warning-text">
                  {x.warn}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={x.edit}
              className="min-h-11 shrink-0 text-[13px] font-bold text-primary"
            >
              Edit
            </button>
          </section>
        ))}
      </div>
      <aside className="flex flex-col gap-4 rounded-card bg-card p-6 shadow-card lg:sticky lg:top-6">
        <h2 className="text-base font-extrabold">Persetujuan</h2>
        <CheckboxField
          label="Data yang saya berikan benar dan dapat dipertanggungjawabkan."
          checked={cons.dataAccuracy}
          onChange={(x) => setCons((c) => ({ ...c, dataAccuracy: x }))}
        />
        <CheckboxField
          label={`Saya setuju data dikirim ke ${s?.bankName ?? "bank terpilih"} untuk pengajuan ini.`}
          checked={cons.sendToBank}
          onChange={(x) => setCons((c) => ({ ...c, sendToBank: x }))}
        />
        {!canSubmit && (
          <p className="rounded-xl bg-muted px-3.5 py-3 text-xs leading-[18px] font-semibold text-ink-3">
            Lengkapi{" "}
            {[
              !docOk && "dokumen wajib",
              !s && "pilihan program",
              !(cons.dataAccuracy && cons.sendToBank) && "kedua persetujuan",
            ]
              .filter(Boolean)
              .join(", ")}{" "}
            untuk submit.
          </p>
        )}
        {error && (
          <Notice tone="bad" role="alert">
            {error.message}
          </Notice>
        )}
        <Button
          onClick={submit}
          aria-disabled={!canSubmit || pending}
          aria-busy={pending}
          className={cn(!canSubmit && "bg-border text-ink-3 hover:bg-border")}
        >
          {pending && <Spinner />}
          {pending ? "Mengirim…" : "Submit Pengajuan"}
        </Button>
        <Disclaimer className="flex items-start gap-2">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Pengajuan ini hanya dikirim ke satu bank/program. Setelah submit, data
          pengajuan terkunci dan hanya bisa dilihat.
        </Disclaimer>
      </aside>
    </div>
  );
}
