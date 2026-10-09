import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  LandmarkIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { api } from "@/data/api";
import { addDays } from "@/calculations/dates";
import {
  daysLabel,
  percentBps,
  rupiah,
  signedRupiah,
  dateShort,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/dialogs";
import { MarkPaidDialog, PropertyDialog } from "@/domains/mortgages/MyKprTabs";
import { FIXED_MILESTONES } from "@/domains/mortgages/derive";
import {
  defaultTakeoverGoal,
  mortgageTakeoverGaps,
} from "@/domains/optimize/validation";
import { IncomeDialog } from "@/domains/profile/ProfilePages";
import {
  Chip,
  Disclaimer,
  EstimateTag,
  HeroCard,
  Notice,
  Spinner,
  SummaryRows,
} from "@/components/shared/ui";
import { WidgetBoard } from "./WidgetBoard";

export function MonitoringDashboard({
  mortgage: m,
  derived: d,
  snap,
  clock,
  layout,
  arranging,
  onArrangingChange,
  onChanged,
}) {
  const navigate = useNavigate();
  const [confirmStay, setConfirmStay] = useState(false);
  const [opening, setOpening] = useState(null); // mode whose program list is loading
  const [marking, setMarking] = useState(false);
  const [askIncome, setAskIncome] = useState(false);
  const [askProperty, setAskProperty] = useState(false);
  const fi = d.floatingImpact;
  const pay = d.paymentAlert;
  // "Tetap di bank" hides the warning until the next milestone.
  const nextAt = FIXED_MILESTONES.find((h) => h < d.milestone);

  // Straight to the bank list (Take Over or Refinancing) with the default goal; missing data or a failed simulation
  // lands on the start page, which says what to complete.
  const openPrograms = async (mode) => {
    const start = `/optimize/start?mode=${mode}`;
    if (mortgageTakeoverGaps(m, snap, mode).length) return navigate(start);
    setOpening(mode);
    try {
      await api.simulations.run({
        source: { type: "mortgage", id: m.id },
        input: defaultTakeoverGoal(m, mode),
      });
      navigate("/optimize/programs");
    } catch {
      navigate(start);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {d.mode === "warning" && m.rateWarningDismissedMilestone !== d.milestone && (
        <section
          className="grid grid-cols-1 gap-7 rounded-card border-2 border-warning-accent bg-card p-6 shadow-card md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:p-7"
          aria-labelledby="warn-title"
        >
          <div className="flex min-w-0 flex-col gap-4">
            <Chip tone="warn" icon={TriangleAlertIcon}>
              Peringatan bunga · H-{d.milestone}
            </Chip>
            <h2
              id="warn-title"
              className="text-2xl leading-8 font-extrabold text-pretty sm:text-[26px]"
            >
              Fixed rate berakhir {daysLabel(d.daysUntilFixedEnd)}
            </h2>
            {fi ? (
              <SummaryRows
                rows={[
                  { k: "Bunga saat ini", v: percentBps(m.currentRateBps) },
                  {
                    k: "Estimasi floating",
                    v: percentBps(m.estimatedFloatingRateBps),
                    tone: "warn",
                    tag: <EstimateTag />,
                  },
                  { k: "Cicilan sekarang", v: rupiah(fi.currentPayment) },
                  {
                    k: `Estimasi mulai ${dateShort(fi.resetDate)}`,
                    v: rupiah(fi.estimatedNextPayment),
                    tone: "warn",
                    tag: <EstimateTag />,
                  },
                  {
                    k: "Potensi perubahan",
                    v: `${signedRupiah(fi.monthlyDelta)}/bln`,
                    tone: fi.monthlyDelta > 0 ? "bad" : "ok",
                  },
                ]}
              />
            ) : (
              <Notice
                tone="warn"
                title="Estimasi floating belum diisi"
                action={
                  <Link
                    to="/monitoring/setup/1?edit=home"
                    className="text-[13px] font-bold text-primary underline"
                  >
                    Lengkapi Data Bunga
                  </Link>
                }
              >
                Isi estimasi bunga floating agar kami bisa menghitung dampak ke
                cicilan kamu.
              </Notice>
            )}
            <Button className="w-fit" onClick={() => navigate("/my-kpr/rate")}>
              Lihat Pilihan
              <ArrowRightIcon aria-hidden />
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-[18px] bg-muted p-[22px]">
            <span className="text-[13px] font-extrabold text-ink-3">Opsi</span>
            {[
              {
                label: "Tetap di bank sekarang",
                icon: LandmarkIcon,
                go: () => setConfirmStay(true),
              },
              {
                label: "Bandingkan Take Over",
                icon: ArrowLeftRightIcon,
                go: () => openPrograms("takeover"),
                pending: opening === "takeover",
              },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={o.go}
                disabled={!!opening}
                aria-busy={o.pending}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm font-bold hover:border-primary disabled:opacity-60"
              >
                <o.icon className="size-[18px]" aria-hidden />
                <span className="flex-1">{o.label}</span>
                {o.pending ? (
                  <Spinner className="size-4" />
                ) : (
                  <ChevronRightIcon className="size-4" aria-hidden />
                )}
              </button>
            ))}
            <Disclaimer>
              Bunga floating adalah estimasi dan dapat berubah mengikuti
              kebijakan bank.
            </Disclaimer>
          </div>
        </section>
      )}

      {d.mode === null && (
        <Notice
          tone="warn"
          title="Jenis bunga belum diketahui"
          action={
            <Link
              to="/monitoring/setup/1?edit=home"
              className="text-[13px] font-bold text-primary underline"
            >
              Isi jenis bunga
            </Link>
          }
        >
          Cek di aplikasi bank supaya kami bisa mengingatkan sebelum floating.
        </Notice>
      )}

      {/* Rate alerts stay pinned above the widgets the user arranges. */}
      {d.mode === "floating" && (
        <HeroCard className="grid grid-cols-1 items-center gap-7 md:grid-cols-2">
          <div className="flex flex-col gap-3.5">
            <Chip tone="glass">Bunga floating aktif</Chip>
            <h2 className="text-2xl leading-8 font-extrabold sm:text-[26px]">
              KPR kamu sekarang menggunakan bunga floating
            </h2>
            <Button
              variant="inverse"
              className="w-fit"
              onClick={() => navigate("/explore")}
            >
              Bandingkan Pilihan
            </Button>
          </div>
          <dl className="flex flex-col rounded-[18px] bg-white/12 px-5 py-2">
            {[
              ["Bunga saat ini", percentBps(m.currentRateBps)],
              ["Cicilan saat ini", rupiah(m.currentPayment)],
              ...(m.previousFixedPayment
                ? [
                    [
                      "Perubahan dari fixed",
                      `${signedRupiah(m.currentPayment - m.previousFixedPayment)}/bln`,
                    ],
                  ]
                : []),
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-4 border-b border-white/15 py-3 text-sm last:border-b-0"
              >
                <dt className="text-white/80">{k}</dt>
                <dd className="font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
        </HeroCard>
      )}

      <WidgetBoard
        layout={layout}
        editing={arranging}
        onEditingChange={onArrangingChange}
        onSaved={onChanged}
        widgetProps={{
          m,
          d,
          clock,
          onAskIncome: () => setAskIncome(true),
          onAskProperty: () => setAskProperty(true),
          onOpenPrograms: openPrograms,
          opening,
          onMarkPaid: () => setMarking(true),
        }}
      />

      {askIncome && (
        <IncomeDialog
          finance={m.finance}
          onClose={() => setAskIncome(false)}
          onSaved={() => {
            setAskIncome(false);
            onChanged();
          }}
        />
      )}

      {askProperty && (
        <PropertyDialog
          m={m}
          clock={clock}
          onClose={() => setAskProperty(false)}
          onSaved={() => {
            setAskProperty(false);
            onChanged();
          }}
        />
      )}

      {marking && (
        <MarkPaidDialog
          onOpenChange={() => setMarking(false)}
          m={m}
          dueOptions={d.payableDues}
          initialDue={pay?.due ?? d.nextDue}
          clock={clock}
          onDone={onChanged}
          uploadRules={snap.config.upload}
        />
      )}

      <ConfirmDialog
        open={confirmStay}
        onOpenChange={setConfirmStay}
        destructive={false}
        title="Tetap di bank sekarang?"
        body={`Peringatan ini disembunyikan dari Home. ${
          nextAt
            ? `Kami tampilkan lagi saat fixed rate tinggal ${nextAt} hari (${dateShort(addDays(m.fixedUntil, -nextAt))}).`
            : "Peringatan tidak muncul lagi sebelum fixed rate berakhir."
        } Reminder pembayaran tetap berjalan.`}
        confirmLabel="Ya, Sembunyikan"
        onConfirm={async () => {
          await api.mortgages.dismissRateWarning(m.id);
          onChanged();
        }}
      />
    </div>
  );
}
