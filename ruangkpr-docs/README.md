# RuangKPR — Frontend Build Documentation Pack

Dokumen ini adalah entry point tunggal untuk Claude Code. **Baca berurutan dan jangan mulai coding sebelum seluruh file dibaca.**

## Stack dikunci
- Vite + React
- JavaScript (bukan TypeScript)
- shadcn/ui
- Frontend-only, mock-first
- Visual source: artifact Claude Design approved

## Urutan dokumen
1. `01-MASTER-PRD.md` — tujuan, scope, business rules, risks, DoD produk
2. `02-FRONTEND-FUNCTIONAL-SPEC.md` — route, layar, field, validation, state, CTA, acceptance per screen
3. `03-FINANCIAL-CALCULATION-SPEC.md` — rumus, pure function contracts, rounding, fixtures, test matrix
4. `04-MOCK-API-JSON-CONTRACT.md` — endpoint/template JSON, errors, state transitions, fixtures
5. `05-FRONTEND-ARCHITECTURE-DELIVERY.md` — struktur Vite, shadcn mapping, implementation phases, tests, Claude Code workflow
6. `06-CLAUDE-CODE-MASTER-PROMPT.md` — perintah eksekusi akhir (dibuat setelah validasi silang dokumen 1–5)

## Sumber visual dan flow
- Approved artifact: `/home/ubuntu/.hermes/cache/documents/doc_0f1e506bedd8_RuangKPR Pengajuan Baru (Standalone).html`
- Design KPR Baru revision: `/home/ubuntu/claude-design-revisi-kpr-baru.md`
- Monitoring/reminder design: `/home/ubuntu/claude-design-flow-pantau-kpr-reminder.md`
- Take Over+Top-up design: `/home/ubuntu/Instruksi-Claude-Design-Take-Over-dan-Top-Up.md`

## Conflict precedence
Jika ada konflik:
1. Keputusan user paling baru
2. Dokumen numbered pack ini (angka lebih spesifik menang: calculation/API untuk detail teknis)
3. Approved visual artifact untuk style
4. Dokumen design flow sebagai referensi layar

## Scope implementasi pertama
- Auth mock + shell
- KPR Primary (rumah baru/bekas) end-to-end
- Existing KPR setup + reminder + monitoring + My KPR + amortisasi
- Take Over + Top-up terpadu
- Explore/Activity/Profile supporting flows

Tidak termasuk backend nyata, provider OTP/storage/email, AI, eKYC/OCR, multi-bank submit, KPR Secondary terpisah.
