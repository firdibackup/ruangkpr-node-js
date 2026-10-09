import { CloudOffIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { rupiahApprox, rupiahShort, tenorLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { InsightGrid, MilestonePanel } from '@/components/shared/milestone'
import { Chip, Notice, Spinner } from '@/components/shared/ui'

const COPY = {
  1: { title: 'Gambaran kemampuan KPR kamu', sub: 'Dihitung dari penghasilan, cicilan lain, usia, dan pekerjaan yang kamu isi.' },
  2: { title: 'Program bank yang cocok dengan rencanamu', sub: 'Dihitung dari harga rumah, uang muka, jumlah pinjaman, dan tenor yang kamu isi.' },
}

// Closes phase 1 (after screen 2) or phase 2 (after screen 4) with numbers from the bank catalog.
export function PrimaryMilestone({ milestone, app, go }) {
  const { data, error, reload } = useResource(
    () => (milestone === 1 ? api.bankProducts.affordability({ applicationId: app.id }) : api.bankProducts.compare({ applicationId: app.id })),
    [app.id, milestone],
  )
  const next = milestone * 2 + 1
  const { title, sub } = COPY[milestone]

  return (
    <MilestonePanel
      title={title}
      sub={sub}
      disclaimer="Estimasi berdasarkan program bank yang tersedia, bukan keputusan bank."
      onBack={() => go(`/apply/primary/${next - 1}`)}
      // replace: browser back from the next form returns to screen 2 / 4, not to this milestone.
      onNext={() => go(`/apply/primary/${next}`, { replace: true })}
      nextLabel={`Lanjut ke Tahap ${milestone + 1}`}
    >
      {data ? (
        milestone === 1 ? (
          <AffordabilityInsights data={data} />
        ) : (
          <MatchInsights data={data} onEditLoan={() => go('/apply/primary/4')} />
        )
      ) : error ? (
        <Notice
          tone="muted"
          icon={CloudOffIcon}
          role="alert"
          title="Hasil hitungan belum bisa dimuat"
          action={
            <Button variant="neutral" size="sm" onClick={reload}>
              Coba lagi
            </Button>
          }
        >
          {error.code === 'CALCULATION_INPUT_INCOMPLETE' ? error.message : 'Periksa koneksi, lalu coba lagi. Kamu tetap bisa lanjut mengisi.'}
        </Notice>
      ) : (
        <div role="status" className="flex min-h-[132px] items-center justify-center gap-2 rounded-2xl bg-muted text-[13px] font-semibold text-ink-3">
          <Spinner className="text-primary" />
          Menghitung dari data kamu…
        </div>
      )}
    </MilestonePanel>
  )
}

function AffordabilityInsights({ data: { capacity, openCount, best } }) {
  const room = capacity.remainingCapacity > 0
  return (
    <>
      {room && openCount > 0 && <Chip tone="ok">{openCount} program bank terbuka untuk profilmu</Chip>}
      <InsightGrid
        items={[
          { k: 'Cicilan aman', v: `${rupiahShort(Math.max(0, capacity.remainingCapacity))}/bln`, sub: `${capacity.ratioBps / 100}% penghasilan − cicilan lain` },
          best && { k: 'Plafon KPR hingga', v: rupiahApprox(best.principal), sub: `tenor ${tenorLabel(best.tenorMonths)}` },
          best && { k: 'Harga rumah hingga', v: rupiahApprox(best.priceMax), sub: `DP min ${100 - best.maxLtvBps / 100}%` },
        ].filter(Boolean)}
      />
      {!room && <Notice tone="warn">Cicilan lain sudah memakai seluruh batas aman {capacity.ratioBps / 100}%. Coba lunasi sebagian cicilan lain atau gabungkan penghasilan pasangan.</Notice>}
      {!openCount && <Notice tone="warn">Belum ada program yang terbuka untuk profil ini.</Notice>}
    </>
  )
}

function MatchInsights({ data: { items, excluded, capacity }, onEditLoan }) {
  if (!items.length) {
    const reasons = [...new Set(excluded.flatMap((x) => x.reasons))].slice(0, 2)
    return (
      <Notice
        tone="warn"
        title="Belum ada program yang cocok"
        action={
          <Button variant="outline" size="sm" onClick={onEditLoan}>
            Ubah data pinjaman
          </Button>
        }
      >
        {reasons.length ? `${reasons.join('. ')}.` : 'Coba ubah uang muka, jumlah pinjaman, atau tenor.'}
      </Notice>
    )
  }
  const cheapest = items.reduce((a, b) => (b.payment < a.payment ? b : a))
  const safe = cheapest.dtiRatio <= capacity.ratioBps / 10_000
  return (
    <InsightGrid
      items={[
        { k: 'Program cocok', v: `${items.length} program`, sub: 'sesuai harga, DP & tenor kamu' },
        { k: 'Cicilan mulai', v: `${rupiahShort(cheapest.payment)}/bln`, sub: `${cheapest.bank.name} · fixed ${tenorLabel(cheapest.fixedMonths)}` },
        {
          k: 'Rasio cicilan',
          v: `${Math.round(cheapest.dtiRatio * 100)}%`,
          sub: (
            <>
              dari penghasilan
              <Chip tone={safe ? 'ok' : 'warn'}>{safe ? 'Aman' : 'Di atas batas aman'}</Chip>
            </>
          ),
        },
      ]}
    />
  )
}
