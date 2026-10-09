import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckIcon, ClockIcon, CloudCheckIcon, HandCoinsIcon, RepeatIcon, ShieldCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HouseIllustration } from '@/components/shared/HouseIllustration'
import { Chip, ErrorPanel, Notice, PageSkeleton } from '@/components/shared/ui'
import { productName, resumePath } from '@/domains/applications/meta'
import { OptimizeHeader, useOptimize } from './shared'

export function OptimizeIntro() {
  const [params] = useSearchParams()
  const mode = params.get('mode') === 'topup' ? 'topup' : 'takeover'
  const navigate = useNavigate()
  const { snap, app, otherApp, error, reload } = useOptimize()
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const activeMortgage = snap.mortgages.find((m) => m.status === 'active')
  // The draft is created by saving Data pribadi, so backing out of it leaves nothing behind.
  const start = () => navigate(`/optimize/1?mode=${mode}`)

  return (
    <>
      <OptimizeHeader title="Take Over & Top-up" subtitle="Pindah KPR ke bank lain, dengan atau tanpa dana tambahan." back="/" />
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col gap-6 rounded-card bg-card p-6 shadow-card sm:p-8">
          <Chip tone="info" icon={RepeatIcon}>
            {mode === 'topup' ? 'Refinancing + Top-up' : 'Take Over KPR'}
          </Chip>
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[28px] leading-9 font-extrabold tracking-[-0.5px] text-pretty">Pindahkan KPR ke bank yang lebih sesuai</h2>
            <p className="max-w-[560px] text-[15px] leading-6 text-ink-3">Bandingkan KPR sekarang dengan program bank baru memakai biaya total dan break-even, bukan hanya bunga promo. Kamu juga bisa menambah dana (Top-up) dari nilai rumah — estimasi, tetap tergantung appraisal dan kelayakan.</p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[13px] font-extrabold text-ink-3">Yang perlu disiapkan</span>
            {['Data KPR saat ini', 'Data properti', 'Data penghasilan dan cicilan lain', 'Dokumen KPR lama'].map((t) => (
              <span key={t} className="flex items-center gap-2.5 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full bg-success-bg text-success" aria-hidden>
                  <CheckIcon className="size-3.5" strokeWidth={3} />
                </span>
                {t}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              [RepeatIcon, 'Tanpa dana tambahan', 'Cari bunga, cicilan, atau tenor baru.'],
              [HandCoinsIcon, 'Dengan Top-up', 'Lunasi KPR lama dan terima dana tambahan.'],
            ].map(([Icon, t, dsc]) => (
              <div key={t} className="flex flex-col gap-2 rounded-2xl bg-muted px-[18px] py-4">
                <span className="flex items-center gap-2 text-sm font-extrabold text-primary">
                  <Icon className="size-4" aria-hidden />
                  {t}
                </span>
                <span className="text-[13px] leading-5 text-ink-3">{dsc}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-[18px] text-[13px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <ClockIcon className="size-[15px]" aria-hidden />
              Estimasi pengisian 10–15 menit
            </span>
            <span className="flex items-center gap-1.5">
              <CloudCheckIcon className="size-[15px]" aria-hidden />
              Data dapat dilanjutkan nanti
            </span>
          </div>
          {otherApp ? (
            <Notice tone="warn" title="Masih ada pengajuan lain" action={<Link className="text-[13px] font-bold text-primary underline" to={otherApp.status === 'draft' ? resumePath(otherApp) : '/my-kpr/application'}>Buka {productName(otherApp)}</Link>}>
              MVP mendukung satu pengajuan aktif. Selesaikan atau hapus pengajuan {productName(otherApp)} dulu.
            </Notice>
          ) : app ? (
            app.status === 'draft' ? (
              <Button className="w-fit" onClick={() => navigate(resumePath(app))}>
                Lanjutkan pengajuan {productName(app)}
              </Button>
            ) : (
              <Navigate to="/my-kpr/application" replace />
            )
          ) : activeMortgage ? (
            <Notice tone="info" title="KPR kamu sudah dipantau" action={<Button size="xs" onClick={() => navigate(`/optimize/start?mode=${mode}`)}>Simulasi dari KPR aktif</Button>}>
              Kami bisa langsung memakai data {activeMortgage.bankName} tanpa mengisi ulang data KPR lama.
            </Notice>
          ) : (
            <Button className="w-fit" onClick={start}>
              Mulai
            </Button>
          )}
        </section>
        <div className="relative hidden min-h-[360px] overflow-hidden rounded-card shadow-card lg:block">
          <HouseIllustration className="absolute inset-0 size-full" />
          <div className="absolute inset-x-4 bottom-4 flex items-start gap-2.5 rounded-xl bg-white/95 px-4 py-3.5 text-primary">
            <ShieldCheckIcon className="size-5 shrink-0" aria-hidden />
            <span className="text-[13px] leading-5 font-semibold text-ink-2">Data tidak dikirim ke bank sebelum kamu memilih satu program, memberi persetujuan, dan menekan Submit.</span>
          </div>
        </div>
      </div>
    </>
  )
}
