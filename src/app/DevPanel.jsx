// Development-only demo controls (doc 04 §22.4, doc 05 §8.2). Never rendered in production builds.
import { useState } from 'react'
import { FlaskConicalIcon, XIcon } from 'lucide-react'
import { mockControls } from '@/data/mockApi'

// Lets local scripts (screenshots/E2E) switch scenarios. Stripped from production builds.
if (import.meta.env.DEV) window.__ruangkpr = mockControls

const FAILABLE = [
  ['applications.saveStep', 'Simpan step'],
  ['applications.uploadDocument', 'Upload dokumen'],
  ['applications.submit', 'Submit pengajuan'],
  ['bankProducts.compare', 'Daftar program bank'],
  ['dashboard.getSnapshot', 'Muat dashboard'],
  ['mortgages.activate', 'Aktivasi pemantauan'],
  ['admin.overview.get', 'Ringkasan admin'],
  ['admin.reports.get', 'Laporan admin'],
]

export function DevPanel() {
  const [open, setOpen] = useState(false)
  const [scenario, setScenario] = useState(() => mockControls.currentScenario())
  const [armed, setArmed] = useState('')

  const apply = () => {
    mockControls.reset(scenario)
    window.location.assign(scenario === 'guest' ? '/register' : '/')
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-[76px] left-3 z-[60] flex h-10 items-center gap-2 rounded-full bg-[#0b1b33] px-4 text-xs font-bold text-white shadow-[0_10px_30px_#0b1b3340] lg:bottom-4 lg:left-4">
        <FlaskConicalIcon className="size-4" aria-hidden />
        Demo
      </button>
    )
  }
  return (
    <div role="dialog" aria-label="Kontrol demo" className="fixed bottom-[76px] left-3 z-[60] flex w-[min(340px,calc(100vw-24px))] flex-col gap-3 rounded-2xl bg-[#0b1b33] p-4 text-white shadow-[0_10px_30px_#0b1b3340] lg:bottom-4 lg:left-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold tracking-[0.5px] text-[#aeb9cc]">MODE DEMO · DATA MOCK</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Tutup kontrol demo" className="flex size-9 items-center justify-center rounded-full hover:bg-white/10">
          <XIcon className="size-4" />
        </button>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#aeb9cc]">
        Skenario
        <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="h-10 rounded-full border-none bg-[#1c2d4a] px-3 text-[13px] font-semibold text-white">
          {mockControls.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={apply} className="h-10 rounded-full bg-white text-[13px] font-bold text-[#0b1b33]">
        Reset data demo ke skenario ini
      </button>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#aeb9cc]">
        Gagalkan request berikutnya
        <select
          value={armed}
          onChange={(e) => {
            setArmed(e.target.value)
            if (e.target.value) mockControls.failNext(e.target.value)
          }}
          className="h-10 rounded-full border-none bg-[#1c2d4a] px-3 text-[13px] font-semibold text-white"
        >
          <option value="">Tidak ada</option>
          {FAILABLE.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] leading-4 text-[#aeb9cc]">Tanggal mock: 28 Sep 2026 · OTP 148260. Kontrol ini tidak ada di build produksi.</p>
    </div>
  )
}
