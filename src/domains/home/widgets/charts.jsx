import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Label,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDays } from "@/calculations/dates";
import {
  dateShort,
  monthYear,
  percentRatio,
  rupiah,
  rupiahShort,
  signedRupiah,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/shared/ui";
import {
  balanceProjection,
  nextPaymentSplit,
  yearlyBreakdown,
  yearStarts,
} from "./widgetData";

// Chart widgets (Recharts, loaded lazily). Only reachable when widgetLock says the schedule data exists.
// Charts fill the rest of a grid cell; in the one-column list a cell has no height, so they keep a fixed one.
// Tick text is sized in em so it follows the cell's content zoom.
const FILL = { width: "100%", height: "100%" };
const TICK = { fontSize: "0.75em", fill: "var(--muted-foreground)" };
const TOOLTIP = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  boxShadow: "0 6px 24px #0b1b3314",
  fontSize: 13,
};
const CHART_AREA =
  "h-44 min-h-0 [@container(min-height:0px)]:h-auto [@container(min-height:0px)]:flex-1";

function Heading({ title, sub, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {sub && <p className="text-[13px] text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Swatch({ color, label }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

export function BalanceProjectionWidget({ m, d }) {
  const gradient = `balance-${useId().replace(/[^\w-]/g, "")}`;
  const points = balanceProjection(d);
  const fixedYear =
    d.mode === "normal" || d.mode === "warning"
      ? m.fixedUntil?.slice(0, 4)
      : null;
  const payoff = monthYear(d.estimatedEndDate);
  return (
    <Panel className="gap-3">
      <Heading title="Proyeksi Sisa Pokok" sub={`Perkiraan lunas ${payoff}`}>
        <span className="text-[1.25em] font-extrabold tracking-[-0.3px] tabular">
          {rupiahShort(points[0].balance)}
        </span>
      </Heading>
      <div className={CHART_AREA}>
        <AreaChart
          responsive
          style={FILL}
          data={points}
          margin={{ top: 12, right: 6, bottom: 0, left: 6 }}
          desc={`Sisa pokok ${rupiah(points[0].balance)} hari ini, turun sampai lunas ${payoff}.`}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-principal)"
                stopOpacity={0.28}
              />
              <stop
                offset="100%"
                stopColor="var(--chart-principal)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            formatter={(v) => [rupiah(v), "Sisa pokok"]}
            contentStyle={TOOLTIP}
          />
          {fixedYear && (
            <ReferenceLine
              x={fixedYear}
              stroke="var(--chart-warn)"
              strokeDasharray="4 4"
              label={{
                value: "Akhir fixed",
                position: "insideBottomRight",
                fill: "var(--chart-warn-text)",
                fontSize: "0.7em",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--chart-principal)"
            strokeWidth={2}
            fill={`url(#${gradient})`}
          />
        </AreaChart>
      </div>
    </Panel>
  );
}

const AMORTIZATION_VIEWS = [
  { id: "payment", label: "Cicilan" },
  { id: "balance", label: "Sisa pokok" },
];

// Every remaining installment: pokok and bunga as overlapping areas (where they cross, pokok starts to
// outweigh bunga), or the balance down to zero.
export function AmortizationChartWidget({ d }) {
  const [view, setView] = useState("payment");
  const { rows } = d.schedule;
  const payment = view === "payment";
  const crossover = rows.find((r) => r.principal >= r.interest);
  const reset = rows.find((r) => r.periodChanged);
  const payoff = monthYear(d.estimatedEndDate);
  const sub = payment
    ? crossover === rows[0]
      ? "Porsi pokok sudah lebih besar dari bunga"
      : `Pokok melebihi bunga mulai ${monthYear(crossover.dueDate)}`
    : `Perkiraan lunas ${payoff}`;
  return (
    <Panel className="gap-3">
      <Heading title="Grafik Amortisasi" sub={sub} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div
          role="group"
          aria-label="Tampilan grafik"
          className="flex gap-1 rounded-full border border-border p-1"
        >
          {AMORTIZATION_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "h-11 rounded-full px-4 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                view === v.id
                  ? "bg-primary text-white"
                  : "text-ink-3 hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {payment && (
          <span className="flex gap-3">
            <Swatch color="var(--chart-principal)" label="Pokok" />
            <Swatch color="var(--chart-interest)" label="Bunga" />
          </span>
        )}
      </div>
      <div className={CHART_AREA}>
        <AreaChart
          responsive
          style={FILL}
          data={rows}
          margin={{ top: 12, right: 6, bottom: 0, left: 0 }}
          desc={
            payment
              ? `Pokok dan bunga tiap cicilan sampai lunas ${payoff}. ${sub}.`
              : `Sisa pokok turun dari ${rupiah(rows[0].openingBalance)} sampai lunas ${payoff}.`
          }
        >
          <XAxis
            dataKey="dueDate"
            ticks={yearStarts(rows)}
            tickFormatter={(iso) => iso.slice(0, 4)}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            width="auto"
            tickCount={4}
            tickFormatter={rupiahShort}
            tick={TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            labelFormatter={monthYear}
            formatter={(v, name) => [rupiah(v), name]}
            contentStyle={TOOLTIP}
          />
          {reset && (
            <ReferenceLine
              x={reset.dueDate}
              stroke="var(--chart-warn)"
              strokeDasharray="4 4"
              label={{
                value: "Akhir fixed",
                position: "insideTopLeft",
                fill: "var(--chart-warn-text)",
                fontSize: "0.7em",
              }}
            />
          )}
          {payment ? (
            <>
              <Area
                dataKey="interest"
                name="Bunga"
                stroke="none"
                fill="var(--chart-interest)"
                fillOpacity={1}
              />
              <Area
                dataKey="principal"
                name="Pokok"
                stroke="var(--chart-principal)"
                fill="var(--chart-principal)"
                fillOpacity={1}
              />
              {/* Bunga's edge stays visible once pokok overtakes it. */}
              <Area
                dataKey="interest"
                stroke="var(--chart-interest)"
                strokeWidth={2}
                fill="none"
                tooltipType="none"
                activeDot={false}
              />
            </>
          ) : (
            <Area
              dataKey="closingBalance"
              name="Sisa pokok"
              stroke="var(--chart-principal)"
              strokeWidth={2}
              fill="var(--chart-principal)"
              fillOpacity={0.15}
            />
          )}
        </AreaChart>
      </div>
    </Panel>
  );
}

export function FloatingImpactWidget({ m, d }) {
  const floating = d.mode === "floating";
  const fi = d.floatingImpact;
  if (!floating && !fi) {
    return (
      <Panel className="justify-center gap-1.5">
        <h2 className="text-lg font-extrabold">Dampak Floating</h2>
        <p className="text-sm leading-[21px] text-ink-3">
          Masa fixed berlaku sampai lunas, jadi cicilan kamu tidak berubah.
        </p>
      </Panel>
    );
  }
  const before = floating ? m.previousFixedPayment : fi.currentPayment;
  const after = floating ? m.currentPayment : fi.estimatedNextPayment;
  const delta = after - before;
  const bars = [
    {
      label: floating ? "Fixed terakhir" : "Sekarang",
      value: before,
      fill: "var(--chart-principal)",
    },
    {
      label: floating ? "Floating kini" : "Setelah fixed",
      value: after,
      fill: "var(--chart-warn)",
    },
  ];
  return (
    <Panel className="gap-3">
      <Heading
        title="Dampak Floating"
        sub={
          floating
            ? `Floating sejak ${dateShort(addDays(m.fixedUntil, 1))}`
            : `Estimasi mulai ${dateShort(fi.resetDate)}`
        }
      />
      <p
        className={cn(
          "text-[1.5em] leading-[1.25] font-extrabold tracking-[-0.3px] tabular",
          delta > 0 ? "text-danger" : "text-success",
        )}
      >
        {signedRupiah(delta)}
        <span className="text-[13px] font-semibold text-muted-foreground">
          {" "}
          per bulan
        </span>
      </p>
      <div className={CHART_AREA}>
        <BarChart
          responsive
          style={FILL}
          data={bars}
          layout="vertical"
          margin={{ top: 0, right: 76, bottom: 0, left: 0 }}
          desc={`${bars[0].label} ${rupiah(before)}, ${bars[1].label} ${rupiah(after)}.`}
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={92}
          />
          <Tooltip
            formatter={(v) => rupiah(v)}
            contentStyle={TOOLTIP}
            cursor={{ fill: "var(--chart-track)" }}
          />
          <Bar
            dataKey="value"
            name="Cicilan"
            radius={[0, 8, 8, 0]}
            maxBarSize={28}
          >
            {bars.map((b) => (
              <Cell key={b.label} fill={b.fill} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={rupiahShort}
              style={{
                fontSize: "0.75em",
                fontWeight: 700,
                fill: "var(--foreground)",
              }}
            />
          </Bar>
        </BarChart>
      </div>
    </Panel>
  );
}

export function PaymentSplitWidget({ d }) {
  const row = nextPaymentSplit(d);
  const parts = [
    { name: "Pokok", value: row.principal, fill: "var(--chart-principal)" },
    { name: "Bunga", value: row.interest, fill: "var(--chart-interest)" },
  ];
  return (
    <Panel className="gap-3">
      <Heading
        title="Komposisi Cicilan"
        sub={`Cicilan ${monthYear(row.dueDate)}`}
      />
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 @xs:flex-row">
        <div className="aspect-square h-36 max-w-full [@container(min-height:0px)]:h-full @xs:max-w-[55%]">
          <PieChart
            responsive
            style={FILL}
            desc={`Pokok ${rupiah(row.principal)} dan bunga ${rupiah(row.interest)} dari cicilan ${rupiah(row.payment)}.`}
          >
            <Pie
              data={parts}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="96%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {parts.map((p) => (
                <Cell key={p.name} fill={p.fill} />
              ))}
              <Label
                position="center"
                value={rupiahShort(row.payment)}
                style={{
                  fontSize: "0.8em",
                  fontWeight: 800,
                  fill: "var(--foreground)",
                }}
              />
            </Pie>
            <Tooltip formatter={(v) => rupiah(v)} contentStyle={TOOLTIP} />
          </PieChart>
        </div>
        <ul className="flex w-full flex-col gap-2.5">
          {parts.map((p) => (
            <li key={p.name} className="flex flex-col gap-0.5">
              <Swatch
                color={p.fill}
                label={`${p.name} · ${percentRatio(p.value / row.payment, 0)}`}
              />
              <span className="text-[1.0625em] font-extrabold tabular">
                {rupiah(p.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

export function YearlyBreakdownWidget({ d }) {
  const years = yearlyBreakdown(d);
  return (
    <Panel className="gap-3">
      <Heading title="Pokok vs Bunga per Tahun">
        <span className="flex shrink-0 gap-3 pt-1">
          <Swatch color="var(--chart-principal)" label="Pokok" />
          <Swatch color="var(--chart-interest)" label="Bunga" />
        </span>
      </Heading>
      <div className={CHART_AREA}>
        <BarChart
          responsive
          style={FILL}
          data={years}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          desc={`Pokok dan bunga per tahun, ${years[0].year} sampai ${years.at(-1).year}.`}
        >
          <XAxis
            dataKey="year"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip
            formatter={(v, name) => [rupiah(v), name]}
            contentStyle={TOOLTIP}
            cursor={{ fill: "var(--chart-track)" }}
          />
          <Bar
            dataKey="principal"
            name="Pokok"
            stackId="year"
            fill="var(--chart-principal)"
          />
          <Bar
            dataKey="interest"
            name="Bunga"
            stackId="year"
            fill="var(--chart-interest)"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </div>
      <Link
        to="/my-kpr/amortization"
        className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary"
      >
        Lihat jadwal lengkap
        <ArrowRightIcon className="size-[15px]" aria-hidden />
      </Link>
    </Panel>
  );
}
