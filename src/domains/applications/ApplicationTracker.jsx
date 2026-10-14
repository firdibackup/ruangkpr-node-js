import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BadgeCheckIcon,
  Building2Icon,
  CalendarCheckIcon,
  CircleCheckIcon,
  CircleIcon,
  CircleXIcon,
  ClockIcon,
  FileSearchIcon,
  HeadsetIcon,
  HistoryIcon,
  LockIcon,
  RulerIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { api, isMock } from "@/data/api";
import { mockControls } from "@/data/mockApi";
import { DOC_LABELS } from "@/data/documentRules";
import { useResource } from "@/lib/hooks";
import { dateLong, dateShort, percentBps, rupiah, tenorLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/AppShell";
import { ConfirmDialog, FormDialog } from "@/components/shared/dialogs";
import { StatusStepper, Timeline } from "@/components/shared/progress";
import { UploadRow } from "@/components/shared/UploadRow";
import {
  Chip,
  ErrorPanel,
  IconBox,
  Panel,
  PanelTitle,
  PageSkeleton,
  SummaryRows,
} from "@/components/shared/ui";
import { activeApplication } from "@/domains/home/selectHomeState";
import { deriveMortgage } from "@/domains/mortgages/derive";
import { RejectedActions } from "./RejectedActions";
import {
  STATUS_LABEL,
  keptDataNote,
  productName,
  resumePath,
  stepsOf,
  trackerSteps,
} from "./meta";
import { KprSwitch } from "./KprSwitch";

const CANCELLABLE = [
  "submitted",
  "docs_verification",
  "additional_docs_requested",
  "bank_processing",
  "appraisal",
];

// The team's note for the current stage (spec 2026-10-13 §4.2). Appraisal always shows: the agreed schedule, or that
// the team will confirm it on WhatsApp.
export function StageNoteCard({ app }) {
  const note = app.stageNotes?.[app.status];
  const appraisal = app.status === "appraisal";
  if (!note && !appraisal) return null;
  const s = note?.schedule;
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>Info dari tim RuangKPR</PanelTitle>
        {appraisal && !s ? (
          <Chip tone="warn" icon={ClockIcon}>
            Menunggu konfirmasi
          </Chip>
        ) : (
          <Chip tone="info">{STATUS_LABEL[app.status]}</Chip>
        )}
      </div>
      {appraisal && !s && (
        <p className="text-sm leading-[22px] text-ink-2">
          Jadwal appraisal akan dikonfirmasi tim lewat WhatsApp.
        </p>
      )}
      {s && (
        <SummaryRows
          size="sm"
          rows={[
            { k: "Tanggal", v: dateLong(s.date) },
            { k: "Jam", v: s.time },
            { k: "Lokasi", v: s.location },
          ]}
        />
      )}
      {note?.message && (
        <p className="text-sm leading-[22px] text-ink-2">{note.message}</p>
      )}
      {note && (
        <span className="text-xs text-muted-foreground">
          Diperbarui {dateShort(note.updatedAt)}
        </span>
      )}
    </Panel>
  );
}

// Each document the team asked again, with its reason.
export function PendingDocs({ app }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {(app.pendingActions ?? []).map((p) => (
        <li key={p.id} className="text-sm leading-[21px] text-ink-2">
          <span className="font-bold">{DOC_LABELS[p.documentType] ?? p.documentType}</span> — {p.message}
        </li>
      ))}
    </ul>
  );
}

export function ApplicationTracker() {
  const {
    data: snap,
    error,
    reload,
    setData,
  } = useResource(() => api.dashboard.getSnapshot());
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />;
  const app =
    activeApplication(snap.applications) ??
    snap.applications.find((a) => a.status === "disbursed");
  if (!app) return <Navigate to="/my-kpr" replace />;
  const activeMortgage = snap.mortgages.find((m) => m.status === "active");
  const setApp = (next) =>
    setData((s) => ({
      ...s,
      applications: s.applications.map((a) => (a.id === next.id ? next : a)),
    }));

  return (
    <>
      <PageHeader
        title="My KPR"
        subtitle={
          app.status === "draft"
            ? "Pengajuan kamu masih draft."
            : app.status === "rejected"
              ? "Keputusan bank sudah keluar."
              : `Status pengajuan ${productName(app)} kamu`
        }
      />
      {activeMortgage && <KprSwitch current="application" />}
      {app.status === "draft" ? (
        <DraftChecklist app={app} onDeleted={reload} />
      ) : (
        <Tracker app={app} snap={snap} onChange={setApp} reload={reload} />
      )}
    </>
  );
}

function DraftChecklist({ app, onDeleted }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const steps = stepsOf(app);
  return (
    <Panel className="max-w-[720px] gap-5 sm:p-7">
      <div className="flex flex-col gap-1.5">
        <Chip tone="mute">Draft</Chip>
        <h2 className="text-[22px] font-extrabold">
          Pengajuan Draft — {productName(app)}
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Terakhir diedit: {dateShort(app.updatedAt)}
        </p>
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map((label, i) => {
          const n = i + 1;
          const state =
            n < app.currentStep
              ? "done"
              : n === app.currentStep
                ? "current"
                : "todo";
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-3",
                state === "current" && "bg-secondary",
              )}
            >
              {state === "done" ? (
                <CircleCheckIcon className="size-5 text-success" aria-hidden />
              ) : (
                <CircleIcon
                  className={cn(
                    "size-5",
                    state === "current"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "flex-1 text-sm",
                  state === "current" ? "font-extrabold" : "font-semibold",
                  state === "todo" && "text-muted-foreground",
                )}
              >
                {label}
              </span>
              <span
                className={cn(
                  "text-xs font-bold",
                  state === "done"
                    ? "text-success"
                    : state === "current"
                      ? "text-primary"
                      : "text-muted-foreground",
                )}
              >
                {state === "done"
                  ? "Selesai"
                  : state === "current"
                    ? "Posisi kamu sekarang"
                    : "Belum"}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Button size="md" onClick={() => navigate(resumePath(app))}>
          Lanjutkan Pengajuan
        </Button>
        <Button
          size="md"
          variant="neutral"
          className="text-danger"
          onClick={() => setConfirm(true)}
        >
          Hapus Draft
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Hapus draft pengajuan?"
        body="Draft dan dokumen yang diunggah akan dihapus permanen."
        note={keptDataNote(app)}
        onConfirm={async () => {
          await api.applications.cancel(app.id);
          toast("Draft dihapus.");
          navigate("/", { replace: true });
          onDeleted();
        }}
      />
    </Panel>
  );
}

function heroFor(app, snap) {
  const bn = app.selection?.bankName ?? "Bank";
  const ob = app.data.oldLoan?.bankName ?? "bank lama";
  const old = app.mortgageId
    ? snap.mortgages.find((m) => m.id === app.mortgageId)
    : null;
  const s = app.selection;
  const finalRows = [
    { k: "Plafon", v: rupiah(s.loanAmount) },
    {
      k: "Bunga",
      v: `${percentBps(s.fixedRateBps)} fixed ${s.fixedMonths / 12} th`,
    },
    { k: "Tenor", v: tenorLabel(s.tenorMonths) },
    { k: "Cicilan", v: `${rupiah(s.estimatedPayment)}/bln` },
    ...(app.optimizationMode === "topup" && s.netTopup != null
      ? [{ k: "Dana bersih dicairkan (estimasi)", v: rupiah(s.netTopup) }]
      : []),
  ];
  switch (app.status) {
    case "submitted":
      return {
        tone: "info",
        icon: ClockIcon,
        tag: "Diajukan",
        title: `Pengajuan terkirim ke ${bn}`,
        body: "Tim kami memeriksa kelengkapan dokumen sebelum diteruskan ke analisis bank.",
      };
    case "docs_verification":
    case "additional_docs_requested":
      return {
        tone: "info",
        icon: FileSearchIcon,
        tag: "Verifikasi Dokumen",
        title: "Dokumen sedang diverifikasi",
        body: "Jika ada dokumen yang perlu diperbarui, permintaannya muncul di halaman ini dan di Activity.",
      };
    case "bank_processing":
      return {
        tone: "info",
        icon: Building2Icon,
        tag: "Proses Bank",
        title: `${bn} sedang menganalisis pengajuan`,
        body: "Biasanya 3–5 hari kerja. Kami kabari lewat notifikasi jika ada yang perlu kamu lengkapi.",
      };
    case "appraisal":
      return {
        tone: "info",
        icon: RulerIcon,
        tag: "Appraisal",
        title: "Appraisal properti dijadwalkan",
        body: "Tim RuangKPR akan mengonfirmasi jadwal survei properti dengan kamu lewat WhatsApp. Nilai appraisal bisa berbeda dari estimasi kamu.",
      };
    case "approved":
      return {
        tone: "ok",
        icon: BadgeCheckIcon,
        tag: "Disetujui",
        title: "Pengajuan disetujui",
        body: `${bn} menyetujui pengajuan kamu. Angka final mengikuti offering letter.${app.productType === "takeover" ? " Berikutnya: pelunasan KPR lama, lalu akad KPR baru." : " Berikutnya: jadwal akad."}`,
        rows: finalRows,
      };
    case "old_mortgage_settlement":
      return {
        tone: "warn",
        icon: TriangleAlertIcon,
        tag: "Pelunasan KPR Lama",
        title: "Pelunasan KPR lama sedang berjalan",
        body: `${bn} sedang menyelesaikan pelunasan KPR kamu di ${ob}. Tetap bayar cicilan bank lama sampai konfirmasi pelunasan resmi diterima. Jangan hentikan pembayaran sendiri.`,
        rows: [
          { k: "Status dokumen jaminan", v: "Sedang dialihkan" },
          ...(old
            ? [
                {
                  k: `Cicilan berikutnya di ${ob}`,
                  v: `${dateShort(deriveMortgage(old, snap.clock).nextDue)} · ${rupiah(old.currentPayment)}`,
                },
              ]
            : []),
        ],
      };
    case "akad":
      return {
        tone: "info",
        icon: CalendarCheckIcon,
        tag: app.productType === "takeover" ? "Akad KPR Baru" : "Akad",
        title: "Menunggu jadwal akad",
        body:
          app.productType === "takeover"
            ? `KPR di ${ob} sudah lunas. Tanda tangani akad dengan ${bn} sesuai jadwal yang dikirim bank.`
            : `Tanda tangani akad dengan ${bn} sesuai jadwal yang dikirim bank dan notaris.`,
        rows: finalRows,
      };
    case "disbursed":
      return {
        tone: "ok",
        icon: CircleCheckIcon,
        tag: "Selesai",
        title: `${productName(app)} selesai`,
        body:
          app.productType === "takeover"
            ? `KPR di ${ob} sudah ditutup. KPR baru di ${bn} aktif. Pemantauan memakai data final akad, bukan estimasi simulasi.`
            : `KPR kamu di ${bn} sudah aktif. Reminder pembayaran otomatis dijadwalkan.`,
        rows: finalRows,
        cta: true,
      };
    default:
      return null;
  }
}

function Tracker({ app, snap, onChange, reload }) {
  const navigate = useNavigate();
  const [cancel, setCancel] = useState(false);
  const [cs, setCs] = useState(false);
  const s = app.selection;
  const rejected = app.status === "rejected";
  const hero = heroFor(app, snap);
  const pending = app.pendingActions ?? [];
  const upload = (type) => async (file, onProgress) => {
    const next = await api.applications.uploadDocument(
      app.id,
      { documentType: type, file },
      { onProgress },
    );
    onChange(next);
    toast("Dokumen terbaru terkirim ke tim RuangKPR.");
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        {hero && !rejected && (
          <section
            className={cn(
              "flex flex-col gap-3.5 rounded-card p-6 shadow-card sm:p-7",
              hero.tone === "warn"
                ? "border border-[#f2d27a] bg-[#fff6dd]"
                : "bg-card",
            )}
          >
            <div className="flex items-center gap-3">
              <IconBox
                icon={hero.icon}
                tone={hero.tone === "info" ? "primary" : hero.tone}
                size="lg"
              />
              <div className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    "text-xs font-extrabold",
                    hero.tone === "warn"
                      ? "text-warning"
                      : hero.tone === "ok"
                        ? "text-success"
                        : "text-primary",
                  )}
                >
                  {hero.tag}
                </span>
                <h2 className="text-xl font-extrabold">{hero.title}</h2>
              </div>
            </div>
            <p className="text-sm leading-[22px] text-ink-2">{hero.body}</p>
            {hero.rows && <SummaryRows size="sm" rows={hero.rows} />}
            {hero.cta && (
              <Button
                className="w-fit"
                size="md"
                onClick={() => navigate("/my-kpr/overview")}
              >
                Pantau KPR {app.productType === "takeover" ? "Baru" : "Saya"}
              </Button>
            )}
          </section>
        )}
        {!rejected && <StageNoteCard app={app} />}

        {pending.length > 0 && (
          <section className="flex flex-col gap-3 rounded-card border border-[#f2d27a] bg-[#fff6dd] p-6">
            <span className="flex items-center gap-2 text-[13px] font-extrabold text-warning">
              <TriangleAlertIcon className="size-4" aria-hidden />
              Permintaan tim RuangKPR · {dateShort(pending[0].requestedAt)}
            </span>
            <PendingDocs app={app} />
            <p className="text-sm text-ink-2">
              Upload ulang langsung di daftar dokumen di bawah.
            </p>
          </section>
        )}

        <Panel className="sm:p-7">
          <div className="flex flex-col gap-2">
            <Chip
              tone={
                rejected ? "bad" : app.status === "disbursed" ? "ok" : "info"
              }
              icon={rejected ? CircleXIcon : ClockIcon}
            >
              {rejected
                ? "Pengajuan Ditolak"
                : `Status: ${STATUS_LABEL[app.status]}`}
            </Chip>
            <h2 className="text-[22px] leading-[30px] font-extrabold">
              Pengajuan {productName(app)} — {s?.bankName}
            </h2>
          </div>
          {app.productType === "primary" ? (
            <StatusStepper steps={trackerSteps(app)} />
          ) : (
            <Timeline
              label="Status pengajuan"
              steps={trackerSteps(app).map((x) => ({
                label: x.label,
                date:
                  x.state === "current"
                    ? "Sekarang"
                    : x.state === "done" || x.state === "rejected"
                      ? x.date
                      : "",
                state: x.state === "rejected" ? "current" : x.state,
              }))}
            />
          )}
        </Panel>

        {rejected ? (
          <section className="flex flex-col gap-4 rounded-card border-t-4 border-brand-red bg-card p-6 shadow-card sm:p-7">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-muted-foreground">
                Alasan penolakan
              </span>
              <span className="text-lg leading-[26px] font-extrabold">
                {app.rejection?.displayReason}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-extrabold text-ink-3">
                Yang dapat dilakukan
              </span>
              {[
                "Pilih tenor lebih panjang",
                app.optimizationMode === "topup"
                  ? "Kurangi dana tambahan"
                  : "Kurangi jumlah pinjaman atau tambah uang muka",
                "Pilih program bank lain",
              ].map((t) => (
                <span key={t} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  {t}
                </span>
              ))}
              <span className="text-xs text-muted-foreground">
                Saran ini tidak menjamin persetujuan pada pengajuan berikutnya.
              </span>
            </div>
            <RejectedActions app={app} />
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <HistoryIcon className="size-3.5" aria-hidden />
              Pengajuan ke {s?.bankName} · ditolak{" "}
              {dateShort(app.rejection?.rejectedAt)} · tetap tersimpan di
              riwayat
            </span>
          </section>
        ) : (
          <Panel className="sm:p-7">
            <h2 className="text-lg font-extrabold">Dokumen</h2>
            <div className="flex flex-col gap-3">
              {app.requiredDocuments
                .filter((d) => d.required || app.documents[d.type])
                .map((d) => (
                  <UploadRow
                    key={d.type}
                    doc={d}
                    state={app.documents[d.type]}
                    readOnly={app.documents[d.type]?.status !== "needs_update"}
                    compact
                    onUpload={upload(d.type)}
                    rules={snap.config.upload}
                  />
                ))}
            </div>
          </Panel>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Panel>
          <div className="flex items-center justify-between gap-2.5">
            <h2 className="text-lg font-extrabold">Program dipilih</h2>
            <Chip tone="mute" icon={LockIcon}>
              Read-only
            </Chip>
          </div>
          <SummaryRows
            size="sm"
            rows={[
              app.productType === "takeover" && {
                k: "Bank lama",
                v: app.data.oldLoan?.bankName,
              },
              {
                k: app.productType === "takeover" ? "Bank baru" : "Bank",
                v: s?.bankName,
              },
              { k: "Produk", v: productName(app) },
              {
                k: "Program",
                v: `${s?.productName} · ${percentBps(s?.fixedRateBps)}`,
              },
              { k: "Plafon", v: rupiah(s?.loanAmount) },
              { k: "Tenor", v: tenorLabel(s?.tenorMonths) },
              {
                k: [
                  "approved",
                  "akad",
                  "disbursed",
                  "old_mortgage_settlement",
                ].includes(app.status)
                  ? "Cicilan final"
                  : "Cicilan estimasi",
                v: `${rupiah(s?.estimatedPayment)}/bln`,
                strong: true,
              },
              app.optimizationMode === "topup" &&
                s?.netTopup != null && {
                  k: "Dana bersih (estimasi)",
                  v: rupiah(s.netTopup),
                },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Data yang sudah dikirim tidak bisa diubah bebas. Ajukan perubahan
            lewat CS.
          </p>
        </Panel>
        <div className="flex flex-col gap-2.5">
          <Button variant="neutral" size="md" onClick={() => setCs(true)}>
            <HeadsetIcon aria-hidden />
            Hubungi CS
          </Button>
          {CANCELLABLE.includes(app.status) && (
            <Button
              variant="destructive-soft"
              size="md"
              onClick={() => setCancel(true)}
            >
              Batalkan Pengajuan
            </Button>
          )}
        </div>
        {import.meta.env.DEV &&
          isMock &&
          !["rejected", "disbursed"].includes(app.status) && (
            <DemoControls app={app} reload={reload} />
          )}
      </div>

      <ConfirmDialog
        open={cancel}
        onOpenChange={setCancel}
        title="Yakin batalkan pengajuan ini?"
        body={`Pengajuan akan ditarik dari ${s?.bankName}. Pengajuan dan dokumen terkait dihapus permanen (keputusan produk saat ini; kebijakan retensi final menunggu review kepatuhan).`}
        note={keptDataNote(app)}
        confirmLabel="Ya, Batalkan"
        onConfirm={async () => {
          await api.applications.cancel(app.id);
          toast("Pengajuan dibatalkan dan dihapus.");
          navigate("/", { replace: true });
        }}
      />
      <FormDialog
        open={cs}
        onOpenChange={setCs}
        title="Hubungi CS RuangKPR"
        description="Senin–Jumat, 08.00–17.00 WIB."
      >
        <p className="text-sm leading-[21px] text-ink-3">
          Email: <b>cs@ruangkpr.id</b>. Sertakan ID pengajuan <b>{app.id}</b>.
          Layanan chat langsung belum tersedia pada versi prototipe ini.
        </p>
        <Button variant="neutral" size="md" onClick={() => setCs(false)}>
          Tutup
        </Button>
      </FormDialog>
    </div>
  );
}

function DemoControls({ app, reload }) {
  const flow =
    app.productType === "takeover"
      ? [
          "submitted",
          "docs_verification",
          "bank_processing",
          "appraisal",
          "approved",
          "old_mortgage_settlement",
          "akad",
          "disbursed",
        ]
      : [
          "submitted",
          "docs_verification",
          "bank_processing",
          "appraisal",
          "approved",
          "akad",
          "disbursed",
        ];
  const at = flow.indexOf(
    app.status === "additional_docs_requested"
      ? "docs_verification"
      : app.status,
  );
  const act = (fn) => () => {
    fn(app.id);
    reload();
  };
  return (
    <div className="flex flex-col gap-2.5 rounded-3xl border border-dashed border-[#aeb9cc] p-[18px]">
      <span className="text-[11px] font-extrabold tracking-[0.5px] text-muted-foreground">
        MODE DEMO · SIMULASI RESPONS BANK
      </span>
      <div className="flex flex-wrap gap-2">
        {at < flow.length - 1 && (
          <button
            type="button"
            onClick={act(mockControls.advanceApplication)}
            className="h-10 rounded-full bg-foreground px-3.5 text-xs font-bold text-white"
          >
            Majukan ke: {STATUS_LABEL[flow[at + 1]]}
          </button>
        )}
        {/* Same status matrix as the admin (doc 04 §9.1): rejection from the bank stages, revisions while verifying. */}
        {["bank_processing", "appraisal"].includes(app.status) && (
          <button
            type="button"
            onClick={act(mockControls.rejectApplication)}
            className="h-10 rounded-full border border-foreground px-3.5 text-xs font-bold"
          >
            Simulasikan ditolak
          </button>
        )}
        {app.status === "docs_verification" && (
          <button
            type="button"
            onClick={act((id) =>
              mockControls.requestDocument(
                id,
                app.productType === "primary"
                  ? "income_proof"
                  : "bank_statement",
              ),
            )}
            className="h-10 rounded-full border border-foreground px-3.5 text-xs font-bold"
          >
            Minta dokumen tambahan
          </button>
        )}
      </div>
      <Link to="/activity" className="text-xs font-bold text-primary underline">
        Lihat event di Activity
      </Link>
    </div>
  );
}
