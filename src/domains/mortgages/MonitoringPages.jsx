import { Navigate, useNavigate } from "react-router-dom";
import { CheckIcon, FileXIcon, ShieldCheckIcon } from "lucide-react";
import { api } from "@/data/api";
import { useResource } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/AppShell";
import { ErrorPanel, PageSkeleton } from "@/components/shared/ui";
import { setupStepOf } from "./setupMeta";

export function MonitoringIntro() {
  const navigate = useNavigate();
  const {
    data: snap,
    error,
    reload,
  } = useResource(() => api.dashboard.getSnapshot());
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />;
  const active = snap.mortgages.find((m) => m.status === "active");
  if (active) return <Navigate to="/my-kpr/overview" replace />;
  const draft = snap.mortgages.find((m) => m.status === "draft");
  // The draft is created by the first save in the wizard, so backing out of step 1 leaves nothing behind.
  const start = () => navigate(`/monitoring/setup/${draft ? setupStepOf(draft) : 1}`);

  return (
    <>
      <PageHeader
        title="Pantau KPR"
        subtitle="Untuk KPR yang sudah berjalan"
        back="/"
      />
      <section className="grid grid-cols-1 gap-7 rounded-card bg-card p-6 shadow-card md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:p-9">
        <div className="flex flex-col gap-5">
          <h2 className="text-[28px] font-extrabold tracking-[-0.4px]">
            Pantau KPR kamu
          </h2>
          <p className="text-[15px] text-ink-3">Tambahkan data KPR untuk:</p>
          <ul className="flex flex-col gap-3">
            {[
              "Mendapat reminder pembayaran",
              "Diingatkan sebelum bunga floating",
              "Melihat progres dan sisa KPR",
              "Melihat jadwal amortisasi",
              "Menjalankan simulasi produk lain",
            ].map((t) => (
              <li
                key={t}
                className="flex items-center gap-3 text-[15px] font-semibold"
              >
                <span
                  className="flex size-[26px] items-center justify-center rounded-full bg-success-bg text-success"
                  aria-hidden
                >
                  <CheckIcon className="size-[15px]" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-5 text-ink-3">
            2 langkah: data KPR lalu reminder. Penghasilan dan data properti
            bisa dilengkapi nanti.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button onClick={start}>
              {draft ? "Lanjutkan Pengaturan" : "Mulai Tambahkan KPR"}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Kembali
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3.5 self-start rounded-3xl bg-muted p-6">
          {[
            [
              ShieldCheckIcon,
              "Data yang kamu masukkan tidak akan dikirim ke bank sampai kamu memilih “Ajukan Sekarang”.",
            ],
            [FileXIcon, "Tidak perlu upload dokumen"],
          ].map(([Icon, text]) => (
            <div key={text} className="flex items-start gap-3">
              <Icon
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <span className="text-sm leading-[21px] text-ink-2">{text}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
