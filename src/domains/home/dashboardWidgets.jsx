import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ClockIcon,
  HouseIcon,
  RefreshCwIcon,
  WalletIcon,
} from "lucide-react";
import { PiLockSimpleFill, PiSparkleFill } from "react-icons/pi";
import { api } from "@/data/api";
import { useResource } from "@/lib/hooks";
import {
  CITIES,
  dateLong,
  dateShort,
  daysLabel,
  labelOf,
  monthName,
  monthYear,
  percentBps,
  rupiah,
  rupiahShort,
  tenorLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Chip,
  Disclaimer,
  EmptyState,
  IconBox,
  InfoTip,
  Notice,
  Panel,
  ProgressBar,
  Skeleton,
  Spinner,
  SummaryRows,
} from "@/components/shared/ui";
import { progressGap, rateTypeLabel } from "@/domains/mortgages/setupMeta";

// Bodies of the Home board widgets. Each root fills its cell and adapts through container queries:
// width via @md:/@2xl:, height via [@container(min-height|max-height:…)]. Only a sized grid cell answers
// height queries, so the one-column list always shows the default content. Key figures are sized in em:
// the board zooms a grid cell's font-size as the cell grows (see contentZoom), so they grow with it.

export const HEALTH_SENTENCE = {
  dti: "Rasio cicilan kamu agak tinggi.",
  ltv: "Porsi pinjaman terhadap nilai rumah masih tinggi.",
  rate: "Masa fixed segera berakhir.",
  progress: "Pokok yang sudah lunas masih sedikit.",
};
// What KPR Health is, behind its ⓘ on Home and on the Health page.
export const HEALTH_ABOUT =
  "KPR Health menilai kondisi KPR kamu dari 0–100: aman, perlu diperhatikan, atau berisiko. Skornya rata-rata dari 4 komponen: beban cicilan, nilai properti, risiko bunga, dan progres pinjaman. Bukan skor kredit bank, bukan keputusan persetujuan KPR, dan bukan hasil AI: dihitung dengan rumus tetap dari data yang kamu isi.";
const HEALTH_MISSING = {
  dti: "penghasilan",
  ltv: "estimasi nilai properti",
  rate: "jenis bunga",
  progress: "data pokok pinjaman",
};
// Names the data a partial score still waits for, never a generic "some components".
export const healthMissing = (health) =>
  new Intl.ListFormat("id").format(
    health.components
      .filter((c) => c.score === null)
      .map((c) => HEALTH_MISSING[c.key]),
  );
const TONE_COLOR = { ok: "#1B8A5A", warn: "#E0A100", bad: "#DC1C2E" };

export function HealthRing({ health, size = 112 }) {
  const color = TONE_COLOR[health.tone];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full [container-type:size]"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} 0 ${health.score}%, #EEF1F6 ${health.score}% 100%)`,
      }}
      role="img"
      aria-label={`KPR Health ${health.score} dari 100${health.partial ? ", skor parsial" : ""}`}
    >
      <div className="flex size-[78%] flex-col items-center justify-center rounded-full bg-card">
        <span className="text-[length:max(30px,26.8cqmin)] leading-none font-extrabold">
          {health.score}
        </span>
        <span className="text-[length:max(12px,10.7cqmin)] font-semibold text-muted-foreground">
          /100
        </span>
      </div>
    </div>
  );
}

// Stacked and short, Peluang drops its icon and intro so both tiles still fit.
const STACKED_SHORT_HIDDEN = "@max-2xl:[@container(max-height:32rem)]:hidden";

// The shortest cells (Health at its minimum) keep only the title and the button.
const SHORT_HIDDEN = "[@container(max-height:14rem)]:hidden";

// A locked widget renders its real card with example data, blurred whole under frosted glass with a lock
// prompt. The example is inert and hidden from assistive tech, so it never reads as the user's own numbers.
export function LockedPreview({ preview, title, children, action }) {
  return (
    <div className="grid rounded-card shadow-card *:[grid-area:1/1]">
      <div inert aria-hidden>
        {preview}
      </div>
      <EmptyState
        media={
          <IconBox
            icon={PiLockSimpleFill}
            tone="solid"
            className={SHORT_HIDDEN}
          />
        }
        title={title}
        action={action}
        className="justify-center bg-card/60 p-5 backdrop-blur-[1px] sm:p-6"
      >
        <span className={SHORT_HIDDEN}>{children}</span>
      </EmptyState>
    </div>
  );
}

function OpportunityWidget({
  m,
  d,
  onAskIncome,
  onAskProperty,
  onOpenPrograms,
  opening,
}) {
  const navigate = useNavigate();
  const { data: explore, loading } = useResource(
    () => api.explore.get(),
    [m.id, m.version],
  );
  // Health unlocks with penghasilan; Peluang also needs the property value.
  const healthLocked = !(d.income > 0);
  const locked = healthLocked || d.partialProperty;
  const missing = [
    healthLocked && "penghasilan",
    d.partialProperty && "nilai properti",
  ]
    .filter(Boolean)
    .join(" dan ");
  const opp = explore?.opportunity;
  const card = (
    <section
      className="grid h-full grid-cols-1 content-start gap-4 rounded-card border border-[#cfdcf3] bg-[#f3f7fe] p-6 shadow-card @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] @2xl:gap-x-7"
      aria-labelledby="opp-title"
    >
      <div className="flex flex-col gap-4">
        <IconBox
          icon={PiSparkleFill}
          size="lg"
          tone="solid"
          className={STACKED_SHORT_HIDDEN}
        />
        <div className="flex flex-col gap-1.5">
          <h2
            id="opp-title"
            className="text-[1.25em] leading-[1.35] font-extrabold text-pretty"
          >
            {!locked && opp?.cheaperProgramCount
              ? "Ada ruang untuk cicilan lebih ringan."
              : "Pantau peluang untuk KPR kamu."}
          </h2>
          <p
            className={cn(
              "text-sm leading-[21px] text-ink-3",
              STACKED_SHORT_HIDDEN,
            )}
          >
            Potensi dari KPR kamu saat ini. Lihat biaya pindah dan break-even,
            bukan hanya bunga promo.
          </p>
        </div>
      </div>
      {locked ? (
        // Example figures for the blurred preview, never the user's own.
        <div className="flex flex-col gap-2 @2xl:row-span-2">
          <OpportunityTile
            label="POTENSI TAKE OVER"
            hasOpportunity
            value="−Rp1,2 jt"
            unit="/ bulan"
            note="Dibanding cicilan sekarang · break-even 14 bulan"
          />
          <OpportunityTile
            label="POTENSI REFINANCING"
            hasOpportunity
            value="Rp162,4 jt"
            unit="dana kotor maksimum"
            note="Nilai properti est. Rp850 jt × LTV 80% (sisa pokok Rp517,6 jt)"
          />
        </div>
      ) : loading && !explore ? (
        <div className="flex flex-col gap-2 @2xl:row-span-2" aria-busy="true">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 @2xl:row-span-2">
          <OpportunityTile
            onClick={() => onOpenPrograms("takeover")}
            pending={opening === "takeover"}
            disabled={!!opening}
            label="POTENSI TAKE OVER"
            hasOpportunity={!!opp?.cheaperProgramCount}
            value={
              opp?.cheaperProgramCount
                ? `−${rupiahShort(opp.bestMonthlySaving)}`
                : "Belum ada"
            }
            unit={opp?.cheaperProgramCount ? "/ bulan" : ""}
            tone={opp?.cheaperProgramCount ? "ok" : "mute"}
            note={
              opp?.cheaperProgramCount
                ? `${opp.comparedTo === "floating_estimate" ? "Dibanding estimasi cicilan floating" : "Dibanding cicilan sekarang"} · ${opp.bestBankName} ${percentBps(opp.bestFixedRateBps)} fixed ${opp.bestFixedMonths / 12} th${opp.bestBreakEvenMonth ? ` · break-even ${opp.bestBreakEvenMonth} bulan` : ""}`
                : "Belum ada program yang lebih hemat setelah biaya pindah, berdasarkan katalog terbaru."
            }
          />
          <OpportunityTile
            onClick={() =>
              opp?.maxGrossTopup != null
                ? onOpenPrograms("topup")
                : navigate("/my-kpr/property?edit=1")
            }
            pending={opening === "topup"}
            disabled={!!opening}
            label="POTENSI REFINANCING"
            hasOpportunity={opp?.maxGrossTopup != null}
            value={
              opp?.maxGrossTopup != null
                ? rupiahShort(opp.maxGrossTopup)
                : "Belum dapat dihitung"
            }
            unit={opp?.maxGrossTopup != null ? "dana kotor maksimum" : ""}
            tone={opp?.maxGrossTopup != null ? "default" : "warn"}
            note={
              opp?.maxGrossTopup != null
                ? `Nilai properti est. ${rupiahShort(m.property.estimatedValue)} × LTV ${opp.maxLtvBps / 100}% (sisa pokok ${rupiahShort(m.outstandingPrincipal)})`
                : "Lengkapi nilai properti untuk melihat potensi dana cair."
            }
          />
        </div>
      )}
      <div className="flex flex-col gap-3 @2xl:self-end">
        <Button
          className="w-full @md:w-fit"
          onClick={() => navigate("/explore")}
        >
          Eksplorasi Pilihan
          <ArrowRightIcon aria-hidden />
        </Button>
      </div>
    </section>
  );
  if (!locked) return card;
  return (
    <LockedPreview
      preview={card}
      title="Buka peluang KPR kamu"
      action={
        <Button size="sm" onClick={healthLocked ? onAskIncome : onAskProperty}>
          {healthLocked ? "Isi Penghasilan" : "Isi Nilai Properti"}
        </Button>
      }
    >
      Lengkapi {missing} untuk melihat potensi hemat cicilan dan dana cair.
    </LockedPreview>
  );
}

// Opens the bank list straight away (see MonitoringDashboard openPrograms).
function OpportunityTile({
  onClick,
  pending,
  disabled,
  label,
  value,
  unit,
  note,
  tone,
  hasOpportunity,
}) {
  // A real opportunity gets the green spotlight; an empty one stays muted so the two read differently at a glance.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={pending}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border px-4 py-3.5 text-left transition duration-200 disabled:opacity-70",
        hasOpportunity
          ? "opp-gradient border-white/30 text-white shadow-opp hover:-translate-y-0.5 hover:shadow-opp-hover active:-translate-y-0.5 active:shadow-opp-hover"
          : "border-opp-mute-border bg-opp-mute hover:shadow-card",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span
          className={cn(
            "text-xs font-extrabold tracking-[0.4px]",
            hasOpportunity ? "text-white/90" : "text-primary",
          )}
        >
          {label}
        </span>
        {pending ? (
          <Spinner className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" aria-hidden />
        )}
      </span>
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span
          className={cn(
            "text-[1.375em] font-extrabold tracking-[-0.3px]",
            !hasOpportunity && tone === "warn" && "text-warning-text",
            !hasOpportunity && tone === "mute" && "text-ink-3",
          )}
        >
          {value}
        </span>
        {unit && (
          <span
            className={cn(
              "text-[13px]",
              hasOpportunity ? "text-white/85" : "text-ink-3",
            )}
          >
            {unit}
          </span>
        )}
      </span>
      <span
        className={cn(
          "text-[13px] leading-[19px]",
          hasOpportunity ? "text-white/85" : "text-ink-3",
        )}
      >
        {note}
      </span>
    </button>
  );
}

// Example score for the blurred preview, never the user's own.
const SAMPLE_HEALTH = {
  score: 68,
  tone: "warn",
  label: "Perlu perhatian",
  components: [{ key: "progress", score: 40 }],
};

function HealthWidget({ d, onAskIncome }) {
  const locked = !(d.income > 0);
  const health = locked ? SAMPLE_HEALTH : d.health;
  const weakest = [...health.components]
    .filter((c) => c.score !== null)
    .sort((a, b) => a.score - b.score)[0];
  const card = (
    <Panel className="h-full flex-row items-center gap-6">
      <HealthRing
        health={health}
        size={d.mode === "normal" ? "7em" : "5.75em"}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-ink-3">
          KPR Health
          <InfoTip label="Tentang KPR Health">{HEALTH_ABOUT}</InfoTip>
        </span>
        <Chip tone={health.tone}>{health.label}</Chip>
        <p className="text-sm leading-[21px] text-ink-2 [@container(max-height:14rem)]:hidden">
          {health.tone === "ok"
            ? "Kondisi KPR kamu sehat."
            : HEALTH_SENTENCE[weakest?.key]}
        </p>
        {health.partial && (
          <p className="text-xs text-warning-text">
            Skor sementara — lengkapi {healthMissing(health)}.
          </p>
        )}
        <Link
          to="/my-kpr/health"
          className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary"
        >
          Lihat penyebab
          <ArrowRightIcon className="size-[15px]" aria-hidden />
        </Link>
      </div>
    </Panel>
  );
  if (!locked) return card;
  return (
    <LockedPreview
      preview={card}
      title="Buka KPR Health"
      action={
        <Button size="sm" onClick={onAskIncome}>
          Isi Penghasilan
        </Button>
      }
    >
      Isi penghasilan untuk melihat skor kesehatan KPR kamu.
    </LockedPreview>
  );
}

function NextPaymentWidget({ m, d, onMarkPaid }) {
  const pay = d.paymentAlert;
  return (
    <Panel
      className={cn(
        "gap-2.5",
        pay &&
          (pay.tone === "bad"
            ? "border-2 border-brand-red"
            : "border-2 border-warning-accent"),
      )}
    >
      <span className="text-[13px] font-extrabold text-ink-3">
        Pembayaran Berikutnya
      </span>
      <span className="text-[1.75em] font-extrabold tracking-[-0.4px] tabular">
        {rupiah(m.currentPayment)}
      </span>
      <span
        className={cn(
          "flex items-center gap-2 text-sm",
          pay?.tone === "bad" ? "font-bold text-danger" : "text-ink-3",
        )}
      >
        <CalendarClockIcon className="size-4" aria-hidden />
        {dateLong(pay?.due ?? d.nextDue)} ·{" "}
        {pay?.days < 0
          ? `terlambat ${-pay.days} hari`
          : daysLabel(pay?.days ?? d.daysToNextDue)}
      </span>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1">
        {pay && (
          <Button size="md" onClick={onMarkPaid}>
            <CircleCheckIcon aria-hidden />
            Tandai Sudah Dibayar
          </Button>
        )}
        <Link
          to="/my-kpr/payment"
          className="flex min-h-11 w-fit items-center text-sm font-bold text-primary"
        >
          Lihat detail
        </Link>
      </div>
    </Panel>
  );
}

// Three rows by default; taller cells reveal more of the schedule.
const EXTRA_ROWS = [
  "hidden [@container(min-height:26rem)]:table-row",
  "hidden [@container(min-height:29rem)]:table-row",
  "hidden [@container(min-height:32rem)]:table-row",
];

function AmortizationWidget({ d }) {
  const upcoming =
    d.schedule?.rows
      .filter((r) => r.dueDate >= d.nextDue)
      .slice(0, 3 + EXTRA_ROWS.length) ?? [];
  return (
    <Panel className="gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold">Jadwal Amortisasi</h2>
        {d.schedule && (
          <p className="text-[13px] text-muted-foreground">
            Sisa {d.schedule.rows.length} cicilan · perkiraan lunas{" "}
            {monthYear(d.estimatedEndDate)}
          </p>
        )}
      </div>
      {d.schedule ? (
        <table className="w-full text-[13px] tabular">
          <caption className="sr-only">
            Cicilan berikutnya. Tanda * = bunga estimasi.
          </caption>
          <thead className="text-xs font-extrabold text-ink-3">
            <tr>
              <th scope="col" className="py-2 pr-2 text-left">
                Jatuh tempo
              </th>
              <th scope="col" className="px-2 py-2 text-right">
                Pokok
              </th>
              <th scope="col" className="py-2 pl-2 text-right @sm:px-2">
                Bunga
              </th>
              <th scope="col" className="py-2 pl-2 text-right @max-sm:hidden">
                Sisa pokok
              </th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((r, i) => (
              <tr
                key={r.month}
                className={cn("border-t border-line", EXTRA_ROWS[i - 3])}
              >
                <th scope="row" className="py-2.5 pr-2 text-left font-bold">
                  {monthYear(r.dueDate)}
                  {r.estimatedRate && "*"}
                </th>
                <td className="px-2 py-2.5 text-right">
                  {rupiah(r.principal)}
                </td>
                <td className="py-2.5 pl-2 text-right @sm:px-2">
                  {rupiah(r.interest)}
                </td>
                <td className="py-2.5 pl-2 text-right @max-sm:hidden">
                  {rupiahShort(r.closingBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Notice tone="muted">
          Jadwal belum dapat dihitung:{" "}
          {d.scheduleMissing.join(", ") || "data belum lengkap"}.
        </Notice>
      )}
      {upcoming.some((r) => r.estimatedRate) && (
        <Disclaimer>Tanda * = bunga estimasi floating.</Disclaimer>
      )}
      <Link
        to="/my-kpr/amortization"
        className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary"
      >
        Lihat jadwal amortisasi
        <ArrowRightIcon className="size-[15px]" aria-hidden />
      </Link>
    </Panel>
  );
}

function RateChip({ m, floating }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-extrabold",
        floating ? "bg-warning-bg text-warning" : "bg-secondary text-primary",
      )}
    >
      {floating ? "Floating" : rateTypeLabel(m.currentRateType)}
    </span>
  );
}

function MyKprWidget({ m, d }) {
  const navigate = useNavigate();
  const floating = d.mode === "floating";
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">KPR Saya</h2>
        <Chip tone="ok">Aktif</Chip>
      </div>
      {/* Shorter cells keep the balance and drop the bank row, then the detail rows. */}
      <div className="flex items-center gap-3.5 [@container(max-height:24rem)]:hidden">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-base font-extrabold tracking-[-0.3px] text-primary italic"
          aria-hidden
        >
          {m.bankName.replace(/^Bank\s+/i, "").slice(0, 4)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-extrabold">
            {m.productName || "KPR Rumah Tinggal"}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {m.bankName} · {m.scheme === "sharia" ? "Syariah" : "Konvensional"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 rounded-2xl bg-muted p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] text-ink-3">
              Sisa pokok{m.outstandingEstimated && " (estimasi)"}
            </span>
            <span className="text-[1.5em] leading-[1.333] font-extrabold tracking-[-0.3px] tabular">
              {rupiah(m.outstandingPrincipal)}
            </span>
          </div>
          {m.originalPrincipal > 0 && (
            <span className="text-[13px] text-muted-foreground">
              dari {rupiah(m.originalPrincipal)}
            </span>
          )}
        </div>
        {d.paidRatio == null ? (
          <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
            Progres pelunasan belum diketahui.
            <Link
              to={progressGap(m, "home").to}
              className="flex min-h-11 items-center font-bold text-primary underline"
            >
              {progressGap(m, "home").label}
            </Link>
          </span>
        ) : (
          <>
            <ProgressBar value={d.paidRatio * 100} label="Pokok lunas" />
            <span className="text-[13px] font-bold text-primary">
              {Math.round(d.paidRatio * 100)}% pokok lunas
            </span>
          </>
        )}
      </div>
      <SummaryRows
        className="[@container(max-height:34rem)]:hidden"
        rows={[
          {
            k: "Bunga saat ini",
            v: (
              <span className="flex items-center gap-2">
                {percentBps(m.currentRateBps)}
                <RateChip m={m} floating={floating} />
              </span>
            ),
          },
          {
            k: "Masa fixed berakhir",
            v: floating
              ? "Sudah berakhir"
              : m.currentRateType === "fixed"
                ? dateShort(m.fixedUntil)
                : "Belum diketahui",
          },
          {
            k: "Sisa tenor",
            v: m.remainingTenorMonths
              ? `${tenorLabel(m.remainingTenorMonths)} lagi`
              : "Belum diisi",
          },
          {
            k: "Lokasi properti",
            v: m.property?.city
              ? labelOf(CITIES, m.property.city)
              : "Belum diisi",
          },
        ]}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => navigate("/my-kpr/overview")}
      >
        Lihat perjalanan KPR
      </Button>
    </Panel>
  );
}

function AgendaWidget({ d }) {
  const agenda = [
    {
      icon: WalletIcon,
      tone: "primary",
      t: `Siapkan cicilan ${monthName(d.nextDue)}`,
      s: `${dateShort(d.nextDue)} · Reminder aktif`,
      to: "/my-kpr/payment",
    },
    d.mode === "floating"
      ? {
          icon: RefreshCwIcon,
          tone: "warn",
          t: "Cek opsi repricing atau Take Over",
          s: "Bunga floating aktif · bandingkan opsi",
          to: "/explore",
        }
      : d.daysUntilFixedEnd != null && {
          icon: ClockIcon,
          tone: "warn",
          t: "Evaluasi sebelum floating",
          s: `${d.daysUntilFixedEnd} hari menuju akhir fixed`,
          to: "/my-kpr/rate",
        },
    d.partialProperty && {
      icon: HouseIcon,
      tone: "warn",
      t: "Lengkapi nilai properti",
      s: "Untuk hitung equity dan refinancing",
      to: "/my-kpr/property",
    },
  ].filter(Boolean);
  return (
    <Panel className="gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Agenda terdekat</h2>
        <CalendarIcon className="size-5" aria-hidden />
      </div>
      <ul className="flex flex-col gap-0.5">
        {agenda.map((a) => (
          <li key={a.t}>
            <Link
              to={a.to}
              className="-mx-2 flex min-h-14 items-center gap-3.5 rounded-xl p-2 hover:bg-muted"
            >
              <IconBox icon={a.icon} tone={a.tone} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-extrabold">{a.t}</span>
                <span className="text-[13px] text-muted-foreground">{a.s}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// Small tile: the whole card links to the detail page; taller cells show one extra line.
export function StatWidget({ to, label, value, children }) {
  return (
    <Panel
      as={Link}
      to={to}
      className="gap-1.5 border border-transparent transition-colors hover:border-primary/30"
    >
      <span className="flex items-center justify-between gap-2 text-[13px] font-extrabold text-ink-3">
        {label}
        <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
      </span>
      <span className="text-[1.5em] leading-[1.333] font-extrabold tracking-[-0.3px] tabular @xs:text-[1.75em]">
        {value}
      </span>
      {children}
    </Panel>
  );
}

const TALL_ONLY = "hidden text-[13px] [@container(min-height:15rem)]:block";

function OutstandingWidget({ m }) {
  return (
    <StatWidget
      to="/my-kpr/overview"
      label={`Sisa Pokok${m.outstandingEstimated ? " (estimasi)" : ""}`}
      value={rupiah(m.outstandingPrincipal)}
    >
      {m.originalPrincipal > 0 && (
        <>
          <span className="text-[13px] text-muted-foreground">
            dari {rupiah(m.originalPrincipal)}
          </span>
          <span className={cn(TALL_ONLY, "font-bold text-primary")}>
            {rupiah(m.originalPrincipal - m.outstandingPrincipal)} sudah lunas
          </span>
        </>
      )}
    </StatWidget>
  );
}

function RateWidget({ m, d }) {
  const floating = d.mode === "floating";
  return (
    <StatWidget
      to="/my-kpr/rate"
      label="Bunga & Masa Fixed"
      value={
        <span className="flex flex-wrap items-center gap-2">
          {percentBps(m.currentRateBps)}
          <RateChip m={m} floating={floating} />
        </span>
      }
    >
      <span className="text-[13px] text-muted-foreground">
        {floating
          ? "Masa fixed sudah berakhir"
          : m.currentRateType === "fixed"
            ? `Fixed sampai ${dateShort(m.fixedUntil)}`
            : "Masa fixed belum diketahui"}
      </span>
      {!floating && m.estimatedFloatingRateBps != null && (
        <span className={cn(TALL_ONLY, "text-ink-3")}>
          Estimasi floating {percentBps(m.estimatedFloatingRateBps)}
        </span>
      )}
    </StatWidget>
  );
}

function ProgressWidget({ m, d }) {
  if (d.paidRatio == null) {
    const gap = progressGap(m, "home");
    return (
      <StatWidget to={gap.to} label="Progres Pelunasan" value="Belum diketahui">
        <span className="text-[13px] font-bold text-primary">{gap.label}</span>
      </StatWidget>
    );
  }
  return (
    <StatWidget
      to="/my-kpr/overview"
      label="Progres Pelunasan"
      value={`${Math.round(d.paidRatio * 100)}%`}
    >
      <ProgressBar value={d.paidRatio * 100} label="Pokok lunas" />
      <span className="text-[13px] text-muted-foreground">
        pokok sudah lunas
      </span>
    </StatWidget>
  );
}

export const WIDGET_VIEWS = {
  opportunity: OpportunityWidget,
  health: HealthWidget,
  nextPayment: NextPaymentWidget,
  amortization: AmortizationWidget,
  myKpr: MyKprWidget,
  agenda: AgendaWidget,
  outstanding: OutstandingWidget,
  rate: RateWidget,
  progress: ProgressWidget,
};
