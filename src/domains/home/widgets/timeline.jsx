import { Link } from "react-router-dom";
import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { addDays } from "@/calculations/dates";
import { dateShort, monthName, monthYear, percentBps } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, ProgressBar } from "@/components/shared/ui";
import { Timeline } from "@/components/shared/progress";
import {
  fixedMilestones,
  journeySteps,
  paymentCalendar,
  tenorProgress,
} from "./widgetData";

// Timeline and pipeline widgets: where the KPR stands on its own timeline.

export function JourneyWidget({ m, d, clock }) {
  const progress = tenorProgress(m, clock);
  return (
    <Panel className="gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-extrabold">Perjalanan KPR</h2>
        {progress && (
          <span className="text-[13px] font-bold text-primary">
            Tahun ke-{progress.year} dari {progress.years}
          </span>
        )}
      </div>
      {progress && (
        <ProgressBar value={progress.ratio * 100} label="Tenor berjalan" />
      )}
      <Timeline label="Perjalanan KPR" steps={journeySteps(m, d)} />
    </Panel>
  );
}

export function FixedCountdownWidget({ m, d }) {
  if (d.mode === "floating") {
    return (
      <Panel className="gap-2">
        <span className="text-[13px] font-extrabold text-ink-3">
          Hitung Mundur Fixed
        </span>
        <span className="text-[1.5em] leading-tight font-extrabold">
          Sudah floating
        </span>
        <span className="text-[13px] text-muted-foreground">
          Sejak {dateShort(addDays(m.fixedUntil, 1))} · bunga{" "}
          {percentBps(m.currentRateBps)}
        </span>
        <Link
          to="/explore"
          className="mt-auto flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary"
        >
          Bandingkan opsi
          <ArrowRightIcon className="size-[15px]" aria-hidden />
        </Link>
      </Panel>
    );
  }
  const milestones = fixedMilestones(m, d);
  const next = milestones.find((x) => !x.passed);
  return (
    <Panel className="gap-3">
      <span className="text-[13px] font-extrabold text-ink-3">
        Hitung Mundur Fixed
      </span>
      <div className="flex flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="text-[2.25em] leading-none font-extrabold tabular">
            {d.daysUntilFixedEnd}
          </span>
          <span className="text-sm font-bold text-ink-3">hari lagi</span>
        </span>
        <span className="text-[13px] text-muted-foreground">
          Fixed berakhir {dateShort(m.fixedUntil)}
        </span>
      </div>
      <ol aria-label="Tahapan peringatan masa fixed" className="flex">
        {milestones.map((x, i) => (
          <li
            key={x.days}
            className="relative flex flex-1 flex-col items-center gap-1.5"
          >
            {i > 0 && (
              <span
                className={cn(
                  "absolute top-[7px] right-1/2 left-[-50%] h-0.5",
                  x.passed ? "bg-warning-accent" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative size-4 rounded-full border-2",
                x.passed
                  ? "border-warning-accent bg-warning-accent"
                  : x === next
                    ? "border-primary bg-card ring-2 ring-primary/25"
                    : "border-[#c9d2e0] bg-card",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "text-xs",
                x === next ? "font-extrabold text-primary" : "text-ink-3",
              )}
            >
              H-{x.days}
            </span>
            <span className="sr-only">
              {x.passed ? "sudah lewat" : x === next ? "berikutnya" : "belum"}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const DUE_STATE = {
  paid: {
    label: "Lunas",
    className: "bg-success-strong text-white",
    icon: CheckIcon,
  },
  unpaid: {
    label: "Belum dicatat",
    className: "border border-danger-border bg-danger-bg text-danger",
    icon: XIcon,
  },
  untracked: { label: "Belum dipantau", className: "bg-muted" },
  upcoming: {
    label: "Akan datang",
    className: "border-2 border-border bg-card",
  },
};

export function PaymentHistoryWidget({ m, d, clock }) {
  const months = paymentCalendar(m, d, clock);
  const paid = months.filter((x) => x.state === "paid").length;
  return (
    <Panel className="gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Riwayat Pembayaran</h2>
        <Link
          to="/my-kpr/payment"
          className="flex min-h-11 items-center text-[13px] font-bold text-primary"
        >
          Lihat semua
        </Link>
      </div>
      <ol
        aria-label="Status cicilan per bulan"
        className="grid grid-cols-6 gap-1.5"
      >
        {months.map((x) => {
          const s = DUE_STATE[x.state];
          const isNext = x.due === d.nextDue;
          return (
            <li key={x.due} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-[2.25em] items-center justify-center rounded-full",
                  s.className,
                  isNext && "ring-2 ring-primary ring-offset-2",
                )}
                aria-hidden
              >
                {s.icon && <s.icon className="size-[1em]" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  "text-xs",
                  isNext ? "font-extrabold text-primary" : "text-ink-3",
                )}
                aria-hidden
              >
                {monthName(x.due).slice(0, 3)}
              </span>
              <span className="sr-only">
                {monthYear(x.due)}: {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] leading-5 text-muted-foreground">
        {paid} pembayaran tercatat. Dicatat manual, bukan konfirmasi bank.
      </p>
    </Panel>
  );
}
