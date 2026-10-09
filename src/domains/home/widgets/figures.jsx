import { Link } from "react-router-dom";
import { percentRatio, rupiahShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chip, Panel } from "@/components/shared/ui";
import { dtiTone } from "@/domains/optimize/insights";
import { StatWidget } from "../dashboardWidgets";
import { remainingInterest } from "./widgetData";

// Key-figure widgets. Each is only rendered once widgetLock says its data exists.
const TALL_ONLY = "hidden text-[13px] [@container(min-height:15rem)]:block";

export function InterestLeftWidget({ d }) {
  const { interest, share, perMonth } = remainingInterest(d);
  return (
    <StatWidget
      to="/my-kpr/amortization"
      label="Total Bunga Tersisa"
      value={rupiahShort(interest)}
    >
      <span className="text-[13px] text-muted-foreground">
        {percentRatio(share, 0)} dari sisa cicilan kamu
      </span>
      <span className={cn(TALL_ONLY, "text-ink-3")}>
        Rata-rata {rupiahShort(perMonth)} bunga per bulan
      </span>
    </StatWidget>
  );
}

export function EquityWidget({ m, d }) {
  const { equity, ltvRatio } = d.property;
  const value = m.property.estimatedValue;
  const share = Math.min(Math.max(equity / value, 0), 1);
  return (
    <StatWidget
      to="/my-kpr/property"
      label="Equity Rumah"
      value={rupiahShort(equity)}
    >
      <span
        role="img"
        aria-label={`Equity ${percentRatio(share, 0)} dari estimasi nilai rumah`}
        className="flex h-2.5 overflow-hidden rounded-full bg-[var(--chart-interest)]"
      >
        <span
          className="bg-success-strong"
          style={{ width: `${share * 100}%` }}
        />
      </span>
      <span className="text-[13px] text-muted-foreground">
        {equity < 0
          ? "Sisa pokok melebihi estimasi nilai rumah"
          : `${percentRatio(share, 0)} rumah sudah milik kamu`}
      </span>
      <span className={cn(TALL_ONLY, "text-ink-3")}>
        Estimasi nilai {rupiahShort(value)} · LTV {percentRatio(ltvRatio, 0)}
      </span>
    </StatWidget>
  );
}

// Half-ring gauge drawn like HealthRing (conic-gradient): the top half of a circle, scaled to 60% DTI.
const DTI_ZONE = {
  ok: ["Sehat", "var(--chart-ok)"],
  warn: ["Waspada", "var(--chart-warn)"],
  bad: ["Tinggi", "var(--chart-bad)"],
};
const GAUGE_MAX = 0.6;

export function DtiWidget({ d }) {
  const { dtiRatio, totalMonthlyDebt } = d.dti;
  const tone = dtiTone(dtiRatio);
  const [zone, color] = DTI_ZONE[tone];
  const fill = (Math.min(dtiRatio / GAUGE_MAX, 1) * 50).toFixed(2);
  return (
    <Panel
      as={Link}
      to="/my-kpr/health"
      className="gap-2 border border-transparent transition-colors hover:border-primary/30"
    >
      <span className="flex items-center justify-between gap-2 text-[13px] font-extrabold text-ink-3">
        Rasio Cicilan
        <Chip tone={tone}>{zone}</Chip>
      </span>
      <span
        role="img"
        aria-label={`Rasio cicilan ${percentRatio(dtiRatio, 0)}, ${zone.toLowerCase()}`}
        className="relative mx-auto aspect-[2/1] w-full max-w-[11em] overflow-hidden"
      >
        <span
          className="absolute inset-x-0 top-0 aspect-square rounded-full"
          style={{
            background: `conic-gradient(from 270deg, ${color} 0 ${fill}%, var(--chart-track) ${fill}% 50%, transparent 50%)`,
          }}
        />
        <span className="absolute inset-x-[14%] top-[28%] aspect-square rounded-full bg-card" />
        <span className="absolute inset-x-0 bottom-0 text-center text-[1.75em] leading-none font-extrabold tabular">
          {percentRatio(dtiRatio, 0)}
        </span>
      </span>
      <span className="text-center text-[13px] text-muted-foreground">
        Cicilan + utang {rupiahShort(totalMonthlyDebt)} dari penghasilan{" "}
        {rupiahShort(d.income)}
      </span>
    </Panel>
  );
}
