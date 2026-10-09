import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRightIcon,
  BookOpenIcon,
  LightbulbIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { api } from "@/data/api";
import { useResource } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/AppShell";
import { FormDialog } from "@/components/shared/dialogs";
import {
  Disclaimer,
  EmptyState,
  ErrorPanel,
  LoadingCards,
  PageSkeleton,
} from "@/components/shared/ui";
import { ArticleCard } from "@/domains/home/HomePage";

export function ExplorePage() {
  const { data, error, loading, reload } = useResource(() => api.explore.get());
  const snap = useResource(() => api.dashboard.getSnapshot());
  const hasDraft = snap.data?.mortgages.some((m) => m.status === "draft");
  return (
    <>
      <PageHeader
        title="Explore"
        subtitle={
          data?.hasActiveMortgage
            ? "Cari pilihan untuk KPR kamu"
            : "Pelajari dulu sebelum memutuskan."
        }
      />
      {!data && loading && <LoadingCards count={3} />}
      {!data && error && <ErrorPanel onRetry={reload} />}
      {data && !data.hasActiveMortgage && (
        <>
          <section className="flex flex-col gap-3.5">
            <h2 className="flex items-center gap-2.5 text-lg font-extrabold">
              <BookOpenIcon className="size-5 text-primary" aria-hidden />
              Edukasi
            </h2>
            {data.education.length ? (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.education.map((a) => (
                  <li key={a.slug} className="flex">
                    <ArticleCard article={a} cta="Baca artikel" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada artikel.
              </p>
            )}
          </section>
          <div className="flex items-start gap-3.5 rounded-3xl bg-secondary px-[22px] py-5">
            <LightbulbIcon
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden
            />
            <p className="text-sm leading-[22px] font-semibold">
              {data.message}
            </p>
          </div>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card px-6 py-[22px]">
            <div className="flex min-w-[240px] flex-1 flex-col gap-1">
              <h2 className="text-[15px] font-extrabold">
                Sudah punya KPR yang berjalan?
              </h2>
              <p className="text-[13px] leading-[19px] text-muted-foreground">
                Tambahkan KPR untuk melihat opsi Take Over, Refinancing +
                Top-up, dan Multiguna.
              </p>
            </div>
            <Button asChild size="sm">
              <Link to={hasDraft ? "/my-kpr" : "/monitoring/intro"}>
                {hasDraft ? "Lanjutkan Pengaturan" : "Pantau KPR Saya"}
              </Link>
            </Button>
          </section>
        </>
      )}
      {data?.hasActiveMortgage && <ActiveExplore data={data} />}
    </>
  );
}

function ActiveExplore({ data }) {
  const navigate = useNavigate();
  const [multiguna, setMultiguna] = useState(false);
  const s = data.signals;
  const o = data.opportunity;
  const badges = [
    s?.floating && `Fixed berakhir ${s.daysUntilFixedEnd} hari lagi`,
    s?.opportunity && `${o.cheaperProgramCount} program lebih murah ditemukan`,
  ].filter(Boolean);
  const products = [
    {
      key: "takeover",
      name: "Take Over",
      desc: "Bandingkan pindah KPR ke bank lain: cicilan, biaya pindah, dan break-even.",
      img: 1,
      go: () => navigate("/optimize/start?mode=takeover"),
      badge: badges.join(" · "),
      warn: s?.floating,
    },
    {
      key: "topup",
      name: "Refinancing + Top-up",
      desc: "Pindah KPR sekaligus simulasikan dana tambahan dari nilai rumah.",
      img: 2,
      go: () => navigate("/optimize/start?mode=topup"),
    },
    {
      key: "multiguna",
      name: "Multiguna",
      desc: "Pinjaman baru dengan agunan rumah.",
      img: 3,
      go: () => setMultiguna(true),
    },
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3.5">
        {products.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={p.go}
            className={cn(
              "group relative isolate flex min-h-[272px] items-end overflow-hidden rounded-3xl bg-foreground p-6 text-left text-white shadow-card transition-colors hover:border-primary sm:min-h-[188px] sm:items-center",
              p.warn
                ? "border-2 border-warning-accent"
                : "border border-transparent",
            )}
          >
            <img
              src={`/service/${p.img}.webp`}
              alt=""
              width={2400}
              height={1792}
              decoding="async"
              className={cn(
                "absolute inset-0 -z-10 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none",
                p.pos,
              )}
            />
            {/* Navy overlay only behind the copy (bottom on mobile, left from sm); the rest of the photo stays clear. Photo 2 is mirrored from sm so its subject clears the copy. */}
            <span
              aria-hidden
              className="absolute inset-0 -z-10 bg-linear-to-t from-foreground/90 via-foreground/60 via-55% to-foreground/0 sm:bg-linear-to-r sm:from-foreground/80 sm:via-foreground/50 sm:via-40% sm:to-75%"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1 text-shadow-md sm:max-w-[44%]">
              <span className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold">
                {p.name}
                {p.warn && (
                  <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-[11px] font-extrabold text-warning">
                    Prioritas
                  </span>
                )}
              </span>
              <span className="text-sm leading-5 text-white/85">{p.desc}</span>
              {p.badge && (
                <span
                  className={cn(
                    "mt-0.5 flex w-fit items-start gap-1.5 rounded-xl px-2.5 py-1 text-[12px] leading-4 font-bold",
                    p.warn
                      ? "bg-warning-bg text-warning"
                      : "bg-success-bg text-success",
                  )}
                >
                  {p.warn && (
                    <TriangleAlertIcon
                      className="size-3.5 shrink-0"
                      aria-hidden
                    />
                  )}
                  {p.badge}
                </span>
              )}
              <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold">
                Mulai
                <ArrowRightIcon
                  className="size-[15px] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </span>
            </span>
          </button>
        ))}
        {!o?.available && (
          <p className="text-xs text-muted-foreground">
            Peluang belum dapat diperbarui. Kamu tetap bisa menjalankan simulasi
            manual.
          </p>
        )}
        <Disclaimer>
          Simulasi tidak membuat pengajuan dan tidak mengirim data ke bank
          sampai kamu memilih “Ajukan”.
        </Disclaimer>
      </div>
      <section className="flex flex-col gap-1.5 rounded-3xl border border-border bg-card p-6">
        <h2 className="mb-1.5 text-[17px] font-extrabold">Pelajari</h2>
        {data.education.map((a) => (
          <Link
            key={a.slug}
            to={`/education/${a.slug}`}
            className="flex min-h-[52px] items-center gap-3 border-b border-line px-1 text-sm font-bold last:border-b-0 hover:text-primary"
          >
            <BookOpenIcon className="size-[17px] text-primary" aria-hidden />
            <span className="flex-1">{a.title}</span>
          </Link>
        ))}
      </section>
      <FormDialog
        open={multiguna}
        onOpenChange={setMultiguna}
        title="Multiguna"
        description="Flow Multiguna belum tersedia pada versi ini."
      >
        <p className="text-sm leading-[21px] text-ink-3">
          Simulasi Multiguna akan memakai mesin kalkulasi yang sama setelah
          kebijakan mitra bank tervalidasi. Untuk dana tambahan saat ini, coba
          Refinancing + Top-up.
        </p>
        <Button variant="neutral" size="md" onClick={() => setMultiguna(false)}>
          Mengerti
        </Button>
      </FormDialog>
    </div>
  );
}

export function EducationPage() {
  const { slug } = useParams();
  const { data, error, reload } = useResource(
    () => api.explore.article(slug),
    [slug],
  );
  if (error?.code === "RESOURCE_NOT_FOUND") {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Artikel tidak ditemukan"
        action={
          <Button asChild size="md">
            <Link to="/explore">Kembali ke Explore</Link>
          </Button>
        }
      />
    );
  }
  if (error) return <ErrorPanel onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  return (
    <>
      <PageHeader
        title={data.title}
        subtitle={`${data.tag} · ${data.minutes} menit baca`}
        back="/explore"
      />
      <article className="flex max-w-[720px] flex-col gap-4 rounded-card bg-card p-6 text-[15px] leading-[26px] text-ink-2 shadow-card sm:p-8">
        {data.body.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        <Disclaimer>
          Konten edukasi umum, bukan saran keuangan personal.
        </Disclaimer>
      </article>
    </>
  );
}
