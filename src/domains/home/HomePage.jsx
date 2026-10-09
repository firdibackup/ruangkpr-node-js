import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  BanknoteIcon,
  CircleXIcon,
  ClockIcon,
  CloudCheckIcon,
  FilePenLineIcon,
  GitCompareIcon,
  LandmarkIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PercentIcon,
  ReceiptIcon,
  RepeatIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react";
import { api } from "@/data/api";
import { useResource } from "@/lib/hooks";
import { dateShort, firstName, rupiah, tenorLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/AppShell";
import { PageTour } from "@/components/shared/PageTour";
import {
  ConfirmDialog,
  FormDialog,
  SuccessDialog,
} from "@/components/shared/dialogs";
import { StatusStepper } from "@/components/shared/progress";
import {
  Chip,
  ErrorPanel,
  HeroCard,
  IconBox,
  Panel,
  PanelTitle,
  PageSkeleton,
  ProgressBar,
  SummaryRows,
} from "@/components/shared/ui";
import { RejectedActions } from "@/domains/applications/RejectedActions";
import {
  draftProgress,
  keptDataNote,
  productName,
  resumePath,
  trackerSteps,
} from "@/domains/applications/meta";
import { deriveMortgage } from "@/domains/mortgages/derive";
import {
  SETUP_PERCENT,
  SETUP_STEPS,
  setupStepOf,
} from "@/domains/mortgages/setupMeta";
import { MonitoringDashboard } from "./MonitoringDashboard";
import { selectHomeState } from "./selectHomeState";

const greeting = () => {
  const h = new Date().getHours();
  return h < 11
    ? "Selamat pagi"
    : h < 15
      ? "Selamat siang"
      : h < 18
        ? "Selamat sore"
        : "Selamat malam";
};

const SUBTITLE = {
  fresh: "Pantau KPR yang sudah berjalan, atau ajukan KPR baru.",
  application_draft: "Pengajuan kamu tersimpan. Lanjutkan kapan saja.",
  application_in_process: "Ini kabar pengajuan KPR kamu hari ini.",
  application_rejected: "Ada kabar dari bank soal pengajuan kamu.",
  mortgage_setup_draft: "Pengaturan KPR kamu tersimpan sebagai draft.",
};

const ARTICLE_ICONS = {
  percent: PercentIcon,
  wallet: WalletIcon,
  receipt: ReceiptIcon,
  repeat: RepeatIcon,
  "hand-coins": BanknoteIcon,
};

export function HomePage() {
  const { state: navState } = useLocation();
  const navigate = useNavigate();
  const {
    data: snap,
    error,
    loading,
    reload,
  } = useResource(() => api.dashboard.getSnapshot());
  const [arranging, setArranging] = useState(false);
  const name = firstName(snap?.user?.name);

  if (!snap) {
    return (
      <>
        <PageHeader title={`${greeting()}${name ? `, ${name}` : ""} 👋`} />
        {error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />}
      </>
    );
  }

  const home = selectHomeState(snap, snap.clock);
  const app = home.application;
  const active = home.activeMortgage;
  const derived = active
    ? deriveMortgage(active, snap.clock, snap.config.health)
    : null;
  const subtitle = SUBTITLE[home.state] ?? "Ini kondisi KPR kamu hari ini.";
  const board = active && !app;
  const emptyBoard = snap.dashboardLayout?.length === 0;
  const tour =
    home.state === "fresh"
      ? "home-fresh"
      : board
        ? arranging
          ? "home-arrange"
          : "home-dashboard"
        : null;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${name} 👋`}
        subtitle={subtitle}
        actions={
          <>
            {tour && (
              // Never over the wizard's success dialog, or the widget gallery an empty board opens.
              <PageTour
                id={tour}
                seen={snap.toursSeen}
                ready={!navState?.success && !emptyBoard}
              />
            )}
            {board && !arranging && !emptyBoard && (
              <Button
                variant="neutral"
                size="sm"
                data-tour="arrange-dashboard"
                onClick={() => setArranging(true)}
              >
                <LayoutDashboardIcon aria-hidden />
                Atur Dashboard
              </Button>
            )}
          </>
        }
      />
      {error && (
        <ErrorPanel
          title="Data mungkin belum terbaru."
          message={error.message}
          onRetry={reload}
          className="py-6"
        />
      )}
      {loading && (
        <span className="sr-only" role="status">
          Memuat ulang…
        </span>
      )}

      {home.state === "application_rejected" && <RejectedHero app={app} />}
      {home.state === "application_in_process" && (
        <InProcessSection app={app} />
      )}
      {home.state === "application_draft" && (
        <DraftHero app={app} onDeleted={reload} />
      )}
      {home.state === "mortgage_setup_draft" && (
        <MortgageDraftHero mortgage={home.mortgage} onDeleted={reload} />
      )}
      {home.state === "fresh" && (
        <>
          <MonitoringEntry />
          <FreshProducts />
        </>
      )}

      {active && (app || home.state === "mortgage_setup_draft") ? (
        <ActiveMortgageMini
          mortgage={active}
          derived={derived}
          takeover={app?.productType === "takeover"}
        />
      ) : null}
      {active && !app && (
        <MonitoringDashboard
          mortgage={active}
          derived={derived}
          snap={snap}
          clock={snap.clock}
          layout={snap.dashboardLayout}
          arranging={arranging}
          onArrangingChange={setArranging}
          onChanged={reload}
        />
      )}

      {!active && home.state !== "application_in_process" && <HowItWorks />}
      {!active && <Insights />}

      {navState?.success && (
        <FlowSuccess
          success={navState.success}
          applications={snap.applications}
          onClose={() => navigate(".", { replace: true, state: null })}
        />
      )}
    </>
  );
}

// Shown once after a wizard finishes (wizards navigate to "/" with `state.success`).
function FlowSuccess({ success, applications, onClose }) {
  if (success.appId) {
    const app = applications.find((a) => a.id === success.appId);
    if (!app) return null;
    return (
      <SuccessDialog
        title="Pengajuan berhasil dikirim"
        body={
          <>
            {productName(app)} ke {app.selection.bankName}. Tahap berikutnya:{" "}
            <b>verifikasi dokumen</b>. Kami kabari lewat Activity dan email.
          </>
        }
        onClose={onClose}
      />
    );
  }
  return (
    <SuccessDialog
      title="Pemantauan KPR aktif"
      body={
        success.scheduled
          ? `Reminder pertama sudah dijadwalkan (${success.scheduled} pengingat terjadwal).`
          : "Data KPR kamu tersimpan. Atur reminder kapan saja di Profil."
      }
      onClose={onClose}
    >
      <p className="text-xs text-muted-foreground">
        Tidak ada pengajuan yang dibuat dan tidak ada data yang dikirim ke bank.
      </p>
    </SuccessDialog>
  );
}

function FreshProducts() {
  const navigate = useNavigate();
  const [multiguna, setMultiguna] = useState(false);
  const products = [
    {
      name: "Mulai Pengajuan KPR",
      desc: "Beli rumah baru atau rumah bekas.",
      icon: "kpr-primary",
      go: () => navigate("/apply/primary/1"),
    },
    {
      name: "Take Over",
      desc: "Pindahkan KPR kamu ke bank lain.",
      icon: "take-over",
      go: () => navigate("/optimize/intro"),
    },
    {
      name: "Refinancing",
      desc: "Pindahkan KPR sekaligus ajukan dana tambahan.",
      icon: "refinancing",
      go: () => navigate("/optimize/intro?mode=topup"),
    },
    // {
    //   name: "Multiguna",
    //   desc: "Dana tunai dengan jaminan rumah.",
    //   icon: "multiguna",
    //   go: () => setMultiguna(true),
    // },
  ];
  return (
    <HeroCard scenery="top" className="gap-[22px]">
      <div className="flex max-w-[620px] flex-col gap-2.5">
        <Chip tone="glass" icon={SparklesIcon}>
          Mulai pengajuan
        </Chip>
        <h2 className="text-2xl leading-[34px] font-extrabold text-pretty sm:text-[26px]">
          Pilih produk KPR yang sesuai kebutuhanmu.
        </h2>
      </div>
      <ul
        data-tour="products"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Produk KPR"
      >
        {products.map((p) => (
          <li key={p.name} className="flex">
            <button
              type="button"
              onClick={p.go}
              className="group flex flex-1 items-center gap-3.5 rounded-[18px] bg-card px-4 py-3.5 text-left text-foreground transition-colors hover:bg-[#f7faff] sm:flex-col sm:items-start sm:gap-2 sm:p-[18px]"
            >
              {/* Illustrations carry ~10% transparent padding; the negative margins align the drawing, not the box, with the text. */}
              <img
                src={`/icon-service/256/${p.icon}.webp`}
                alt=""
                width={256}
                height={256}
                decoding="async"
                className="-mx-1 size-16 shrink-0 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-[1.04] motion-reduce:transition-none sm:-mt-1.5 sm:-ml-2 sm:size-[88px]"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-extrabold">{p.name}</span>
                <span className="text-[13px] leading-[19px] text-muted-foreground">
                  {p.desc}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-primary sm:mt-auto">
                <span className="sr-only sm:not-sr-only">Mulai</span>
                <ArrowRightIcon className="size-[15px]" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <FormDialog
        open={multiguna}
        onOpenChange={setMultiguna}
        title="Multiguna"
        description="Flow Multiguna belum tersedia pada versi ini."
      >
        <p className="text-sm leading-[21px] text-ink-3">
          Multiguna memakai rumah sebagai agunan untuk dana tunai. Simulasi dan
          pengajuannya akan tersedia setelah kebijakan mitra bank tervalidasi.
        </p>
        <Button variant="neutral" size="md" onClick={() => setMultiguna(false)}>
          Mengerti
        </Button>
      </FormDialog>
    </HeroCard>
  );
}

function MonitoringEntry() {
  return (
    // Sits above the product hero so existing-KPR owners see their path first; compact on mobile so the hero stays near the fold.
    // Brand red deepening to burgundy with a soft top-right sheen: a highlight, not an error panel (those use danger-bg).
    // Brightest stop stays at brand red so white body text keeps ≥4.5:1 everywhere.
    <section
      data-tour="monitoring-entry"
      className="flex flex-wrap items-center gap-x-4 gap-y-4 rounded-card bg-[radial-gradient(60%_140%_at_88%_-25%,#ffffff26,transparent_70%),linear-gradient(120deg,#dc1c2e_0%,#b3141f_48%,#7a0d1c_100%)] p-5 text-white shadow-[0_14px_36px_-14px_#7a0d1c99] ring-1 ring-white/10 ring-inset sm:gap-x-5 sm:px-7 sm:py-6"
    >
      {/* Illustration carries ~18% transparent padding; the negative margin keeps the visible tile at the old icon footprint. */}
      <img
        src="/card-kpr.webp"
        alt=""
        width={800}
        height={800}
        decoding="async"
        className="-m-2 size-20 shrink-0 sm:-m-3 sm:size-32"
      />
      <div className="flex min-w-0 flex-1 basis-[180px] flex-col gap-1.5">
        <h2 className="text-lg leading-6 font-extrabold">
          Sudah punya KPR yang berjalan?
        </h2>
        {/* Full white: translucent white drops under 4.5:1 on brand red. */}
        <p className="max-w-[62ch] text-sm leading-[21px]">
          Pantau cicilan, dapatkan reminder sebelum bunga floating, dan lihat
          kondisi KPR kamu dalam satu tempat.
        </p>
      </div>
      <Button
        asChild
        variant="inverse"
        size="md"
        className="w-full text-brand-red hover:bg-danger-bg focus-visible:ring-white/70 sm:w-auto"
      >
        <Link to="/monitoring/intro">
          Pantau KPR Saya
          <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Pilih Produk",
      desc: "Tentukan jenis KPR yang sesuai kebutuhanmu.",
      icon: LayersIcon,
    },
    {
      n: "02",
      title: "Isi Data",
      desc: "Isi data dan unggah dokumen langsung dari HP.",
      icon: FilePenLineIcon,
    },
    {
      n: "03",
      title: "Bandingkan Program",
      desc: "Lihat cicilan, biaya, dan kecocokan tiap bank.",
      icon: GitCompareIcon,
    },
    {
      n: "04",
      title: "Ajukan Online",
      desc: "Kirim ke satu bank pilihanmu, lalu pantau statusnya.",
      icon: SendIcon,
    },
  ];
  return (
    <Panel data-tour="how-it-works">
      <PanelTitle sub="Empat langkah dari pilih produk sampai pengajuan ke bank.">
        Cara kerja
      </PanelTitle>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex items-start gap-3.5 rounded-[18px] bg-muted px-4 py-3.5 sm:flex-col sm:gap-3 sm:p-[18px]"
          >
            <div className="flex items-center justify-between sm:self-stretch">
              <IconBox icon={s.icon} tone="white" />
              <span
                className="hidden text-xs font-extrabold tracking-[0.5px] text-muted-foreground sm:inline"
                aria-hidden
              >
                {s.n}
              </span>
            </div>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[15px] font-extrabold">{s.title}</span>
              <span className="text-[13px] leading-[19px] text-muted-foreground">
                {s.desc}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function Insights({ title = "Insight untuk kamu", limit = 3 }) {
  const { data } = useResource(() => api.explore.get());
  const items = data?.education?.slice(0, limit) ?? [];
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <Link
          to="/explore"
          className="text-[13px] font-bold text-primary hover:underline"
        >
          Lihat semua
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((a) => (
          <li key={a.slug} className="flex">
            <ArticleCard article={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ArticleCard({ article: a, cta = "Baca" }) {
  const Icon = ARTICLE_ICONS[a.icon] ?? PercentIcon;
  return (
    <Link
      to={`/education/${a.slug}`}
      className="flex flex-1 flex-col items-start gap-3 rounded-card bg-card p-[22px] shadow-card transition-shadow hover:shadow-[0_10px_30px_#0b1b331f]"
    >
      <span className="flex items-center gap-2.5">
        <IconBox icon={Icon} size="sm" />
        <span className="text-[11px] font-extrabold tracking-[0.5px] text-brand-red uppercase">
          {a.tag}
        </span>
      </span>
      <span className="text-base font-extrabold">{a.title}</span>
      <span className="text-[13px] leading-5 text-muted-foreground">
        {a.summary}
      </span>
      <span className="mt-auto flex items-center gap-1.5 text-[13px] font-bold text-primary">
        {cta}
        <ArrowRightIcon className="size-[15px]" aria-hidden />
      </span>
    </Link>
  );
}

// Draft progress on the blue hero: bar plus the same saved-percent readout as the wizard header.
function HeroProgress({ value, label, className }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <ProgressBar
        value={value}
        label={label}
        className="h-2.5 flex-1 bg-white/20"
        barClassName="bg-white"
      />
      <span
        className="tabular flex shrink-0 items-baseline leading-none font-extrabold tracking-[-0.03em]"
        aria-hidden
      >
        <span className="text-[26px]">{value}</span>
        <span className="text-sm">%</span>
      </span>
    </div>
  );
}

function DraftHero({ app, onDeleted }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  // Same phase, label and percent the wizard shows (Primary and Take Over).
  const progress = draftProgress(app);
  return (
    <HeroCard className="gap-[18px]">
      <Chip tone="glass" icon={FilePenLineIcon}>
        Draft tersimpan
      </Chip>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl leading-[34px] font-extrabold sm:text-[26px]">
          Lanjutkan pengajuan kamu
        </h2>
        <p className="text-[15px] text-white/80">
          {productName(app)} · Bagian {progress.phase} dari 3
        </p>
        <p className="text-[15px] font-bold">{progress.label}</p>
        <p className="flex items-center gap-1.5 text-[13px] text-white/80">
          <CloudCheckIcon className="size-4" aria-hidden />
          Terakhir disimpan {dateShort(app.updatedAt)}
        </p>
      </div>
      <HeroProgress
        value={progress.percent}
        label="Progres pengajuan"
        className="max-w-[620px]"
      />
      <div className="flex flex-wrap items-center gap-[18px]">
        <Button
          variant="inverse"
          size="sm"
          onClick={() => navigate(resumePath(app))}
        >
          Lanjutkan
          <ArrowRightIcon aria-hidden />
        </Button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="min-h-11 text-[13px] font-semibold text-white/85 underline"
        >
          Batal &amp; mulai produk lain
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Hapus draft pengajuan?"
        body={`Draft ${productName(app)} beserta dokumen yang sudah diunggah akan dihapus permanen.`}
        note={keptDataNote(app)}
        onConfirm={async () => {
          await api.applications.cancel(app.id);
          toast("Draft dihapus.");
          onDeleted();
        }}
      />
    </HeroCard>
  );
}

function MortgageDraftHero({ mortgage, onDeleted }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const step = setupStepOf(mortgage);
  return (
    <HeroCard className="grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 flex-col gap-3.5">
        <Chip tone="glass" icon={CloudCheckIcon}>
          Terakhir disimpan:{" "}
          {dateShort(mortgage.updatedAt ?? mortgage.createdAt)}
        </Chip>
        <h2 className="text-2xl leading-[34px] font-extrabold sm:text-[26px]">
          Lanjutkan pengaturan KPR kamu
        </h2>
        <p className="text-[15px] font-semibold text-white/90">
          Bagian {step} dari {SETUP_STEPS.length} · {SETUP_STEPS[step - 1]}
        </p>
        <HeroProgress
          value={SETUP_PERCENT[step - 1]}
          label="Progres pengaturan KPR"
          className="max-w-[580px]"
        />
      </div>
      <div className="flex flex-col items-stretch gap-2.5">
        <Button
          variant="inverse"
          onClick={() => navigate(`/monitoring/setup/${step}`)}
        >
          Lanjutkan Pengaturan
        </Button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="min-h-11 text-[13px] font-bold text-white underline"
        >
          Hapus data
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Hapus data pengaturan KPR?"
        body="Data KPR yang sudah kamu isi akan dihapus permanen. Profil dan pengajuan lain tidak terpengaruh."
        confirmLabel="Hapus data"
        onConfirm={async () => {
          await api.mortgages.deleteDraft(mortgage.id);
          toast("Data pengaturan KPR dihapus.");
          onDeleted();
        }}
      />
    </HeroCard>
  );
}

function RejectedHero({ app }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border-t-4 border-brand-red bg-card p-6 shadow-card sm:p-7">
      <Chip tone="bad" icon={CircleXIcon}>
        Pengajuan Ditolak
      </Chip>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl leading-8 font-extrabold">
          {app.selection?.bankName} · {productName(app)}
        </h2>
        <p className="text-[15px] leading-[23px] text-ink-3">
          {app.rejection?.displayReason} Kamu masih bisa ajukan ke bank lain
          atau perbaiki data lalu ajukan ulang.
        </p>
      </div>
      <RejectedActions app={app} />
      <Link
        to="/my-kpr/application"
        className="w-fit text-[13px] font-bold text-primary hover:underline"
      >
        Lihat detail pengajuan
      </Link>
    </section>
  );
}

function InProcessSection({ app }) {
  const pending = app.pendingActions ?? [];
  const s = app.selection;
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <HeroCard className="gap-3.5">
          <Chip tone="glass" icon={ClockIcon}>
            Status:{" "}
            {trackerSteps(app).find((x) => x.state === "current")?.label ??
              "Diproses"}
          </Chip>
          <h2 className="text-2xl leading-[34px] font-extrabold text-pretty sm:text-[26px]">
            Pengajuan kamu sedang diproses bank.
          </h2>
          <p className="text-sm leading-[22px] text-white/80">
            {s?.bankName} · {productName(app)}
          </p>
          <Button asChild variant="inverse" size="sm" className="w-fit">
            <Link to="/my-kpr/application">
              Lihat detail
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </HeroCard>
        <Panel>
          <PanelTitle>Tahapan pengajuan</PanelTitle>
          <StatusStepper steps={trackerSteps(app)} />
        </Panel>
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        {pending.length > 0 && (
          <Panel className="border-t-4 border-warning-accent">
            <Chip tone="warn" icon={TriangleAlertIcon}>
              Perlu Tindakan
            </Chip>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-extrabold">
                Bank minta dokumen tambahan
              </h2>
              {pending.map((p) => (
                <p key={p.id} className="text-sm leading-[21px] text-ink-3">
                  {p.message}
                </p>
              ))}
            </div>
            <Button asChild size="sm" className="w-fit">
              <Link to="/my-kpr/application">
                Upload sekarang
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </Panel>
        )}
        <Panel>
          <PanelTitle>Ringkasan Pengajuan</PanelTitle>
          <SummaryRows
            size="sm"
            rows={[
              { k: "Bank", v: s?.bankName },
              { k: "Produk", v: productName(app) },
              { k: "Program", v: s?.productName },
              { k: "Plafon", v: rupiah(s?.loanAmount) },
              { k: "Tenor", v: tenorLabel(s?.tenorMonths) },
              {
                k: "Cicilan estimasi",
                v: `${rupiah(s?.estimatedPayment)}/bln`,
                strong: true,
              },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Read-only setelah submit. Ingin mengubah data? Hubungi CS.
          </p>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="justify-between"
          >
            <Link to="/my-kpr/application">
              Lihat detail pengajuan
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </Panel>
      </div>
    </div>
  );
}

function ActiveMortgageMini({ mortgage: m, derived, takeover }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>KPR yang kamu pantau</PanelTitle>
        <Chip tone="ok">Aktif</Chip>
      </div>
      <div className="flex items-center gap-3.5">
        <IconBox icon={LandmarkIcon} size="lg" />
        <div className="flex flex-col">
          <span className="font-extrabold">
            {m.productName || "KPR Rumah Tinggal"}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {m.bankName}
          </span>
        </div>
      </div>
      <SummaryRows
        size="sm"
        rows={[
          { k: "Sisa pokok", v: rupiah(m.outstandingPrincipal) },
          {
            k: "Pembayaran berikutnya",
            v: `${rupiah(m.currentPayment)} · ${dateShort(derived.nextDue)}`,
          },
        ]}
      />
      {takeover && (
        <p className="text-[13px] font-semibold text-warning-text">
          Tetap bayar cicilan bank lama sampai konfirmasi pelunasan resmi
          diterima.
        </p>
      )}
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/my-kpr/overview">Lihat KPR Saya</Link>
      </Button>
    </Panel>
  );
}
