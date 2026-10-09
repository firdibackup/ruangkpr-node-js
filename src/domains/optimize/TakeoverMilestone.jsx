import { useState } from 'react'
import { toast } from 'sonner'
import { daysLabel, monthYear, percentRatio, rupiahApprox } from '@/lib/format'
import { InsightGrid, MilestonePanel } from '@/components/shared/milestone'
import { Chip, Notice } from '@/components/shared/ui'
import { applicationHealth, dtiTone, goalConditions } from './insights'

// Short value + caption: the 30px tile fits one word; the detail goes underneath.
function rateInsight(r) {
  if (r.mode == null) return { v: 'Belum diketahui', sub: 'jenis bunga belum diisi' }
  if (r.mode === 'floating') return { v: 'Floating', sub: 'bunga bisa naik mengikuti bank' }
  return { v: 'Fixed', sub: r.daysUntilFixedEnd != null ? `berakhir ${daysLabel(r.daysUntilFixedEnd)}` : 'masa fixed masih berjalan' }
}

// DTI conclusion: how heavy today's installments (old KPR + other debts) are against income.
function dtiConclusion(c) {
  const tone = dtiTone(c.dtiRatio)
  if (tone === 'ok') return [tone, `Masih di bawah batas aman bank (35%).${c.paymentRoom > 0 ? ` Ruang cicilan tambahan ± ${rupiahApprox(c.paymentRoom)}/bln.` : ''}`]
  if (tone === 'warn') return [tone, 'Di atas batas aman 35%. Sebagian bank masih menerima hingga 45%, jadi utamakan program yang menurunkan cicilan.']
  return [tone, 'Di atas batas kebanyakan bank. Cicilan lebih ringan atau tenor lebih panjang bisa membantu.']
}

// Closes phase 1 (profile + old loan): what staying with the old bank looks like. Pure client-side math; only "Lanjut" saves.
export function TakeoverMilestone({ app, clock, onBack, onNext }) {
  const [pending, setPending] = useState(false)
  const c = goalConditions(app.data, clock)
  const { paidRatio } = applicationHealth(app.data, clock, null)
  const [tone, text] = c.dtiRatio == null ? [] : dtiConclusion(c)
  const next = async () => {
    setPending(true)
    try {
      await onNext()
    } catch (e) {
      toast.error(e.message)
      setPending(false)
    }
  }
  return (
    <MilestonePanel
      title="Gambaran KPR lama kamu"
      sub="Dihitung dari data KPR lama dan penghasilan yang kamu isi."
      disclaimer="Estimasi dari data KPR lama yang kamu isi, bukan angka resmi bank."
      onBack={onBack}
      onNext={next}
      pending={pending}
      nextLabel="Lanjut ke Tahap 2"
    >
      {c.payoffDate && <Chip tone="info">Perkiraan lunas {monthYear(c.payoffDate)}</Chip>}
      <InsightGrid
        items={[
          c.totalInterest != null && { k: 'Sisa bunga jika tetap', v: rupiahApprox(c.totalInterest), sub: 'kalau tidak pindah bank' },
          { k: 'Pokok sudah lunas', v: percentRatio(paidRatio, 0), sub: 'dari pinjaman awal' },
          { k: 'Status bunga', ...rateInsight(c.rate) },
        ].filter(Boolean)}
      />
      {text && (
        <Notice tone={tone} title={`Rasio cicilan (DTI) ${percentRatio(c.dtiRatio)}`}>
          {text}
        </Notice>
      )}
    </MilestonePanel>
  )
}
