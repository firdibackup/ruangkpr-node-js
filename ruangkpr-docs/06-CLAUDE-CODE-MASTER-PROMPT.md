# 06 — Master Prompt untuk Claude Code

Salin prompt ini ke Claude Code dari root repository RuangKPR.

---

## Prompt

Kamu akan membangun frontend RuangKPR yang lengkap berdasarkan documentation pack di folder `ruangkpr-docs/`.

### Stack yang dikunci

- Vite + React
- JavaScript, bukan TypeScript
- shadcn/ui
- Frontend-only dan mock-first
- Jangan membangun backend/database/provider nyata sekarang

### Wajib baca sebelum mengubah source

Baca seluruh file secara berurutan:

1. `ruangkpr-docs/README.md`
2. `ruangkpr-docs/01-MASTER-PRD.md`
3. `ruangkpr-docs/02-FRONTEND-FUNCTIONAL-SPEC.md`
4. `ruangkpr-docs/03-FINANCIAL-CALCULATION-SPEC.md`
5. `ruangkpr-docs/04-MOCK-API-JSON-CONTRACT.md`
6. `ruangkpr-docs/05-FRONTEND-ARCHITECTURE-DELIVERY.md`

Jangan mulai coding setelah hanya membaca PRD. Functional Spec menentukan perilaku layar, Calculation Spec menentukan angka, API Contract menentukan bentuk data, dan Architecture Plan menentukan struktur implementasi.

### Gate 0 — inspeksi repository

Sebelum membuat file:

1. Baca `package.json`, `vite.config.*`, `components.json`, konfigurasi CSS/Tailwind, entry React, router, dan seluruh `src/components/ui/`.
2. Cari helper, component, formatter, validation, mock, state, dan test setup yang sudah ada.
3. Catat dependency yang sudah terpasang. Reuse yang ada; jangan menambah package jika native React/JS atau dependency existing cukup.
4. Pastikan artifact/desain RuangKPR yang tersedia dipakai sebagai visual baseline. Jangan mengganti visual system approved.
5. Laporkan singkat temuan dan rencana file yang benar-benar perlu diubah. Setelah itu lanjut implementasi; jangan berhenti hanya pada rencana.

### Aturan arsitektur

- UI tidak boleh membaca `localStorage` atau fixture langsung.
- Semua data melalui satu service adapter dengan interface yang sama untuk `mockApi` dan `httpApi`.
- Jangan memanggil `fetch` langsung dari page/component.
- Semua rumus finansial berada di pure functions pada feature calculation, bukan di component React atau mock handlers.
- Komponen shadcn di `components/ui` direuse; domain component ditempatkan terpisah.
- Jangan membuat abstraction/factory/interface yang baru punya satu implementasi kecuali adapter mock→HTTP yang memang diperlukan.
- Gunakan integer Rupiah dan rate basis points sesuai Calculation/API spec.
- Persistensi mock mengikuti Architecture Plan dan harus resettable untuk demo/test.

### Scope wajib

1. Auth mock: register, OTP, session.
2. Shell responsif lima menu: Home, My KPR, Explore, Activity, Profile.
3. Home dinamis sesuai user/application/mortgage state.
4. KPR Primary rumah baru/bekas end-to-end:
   - draft/resume;
   - data diri/properti/pinjaman;
   - dokumen;
   - DTI dan compare bank;
   - review/consent/submit;
   - tracker, additional docs, rejected recovery, cancel.
5. Existing KPR:
   - setup enam langkah;
   - cabang cicilan berubah/tidak;
   - rate periods;
   - properti/keuangan/reminder;
   - activation dan resume.
6. Dashboard monitoring normal/fixed-warning/floating/partial.
7. My KPR: Overview, Payment, Rate, Property.
8. Amortisasi summary, annual chart, monthly/yearly schedule, filters, totals, partial/error states.
9. Take Over + Top-up terpadu:
   - `requested_topup=0` Take Over;
   - `requested_topup>0` Top-up;
   - cold entry dan existing-mortgage entry;
   - baseline, moving costs, break-even, net benefit, gross/net top-up, LTV;
   - dokumen, submit, tracker Old KPR Settlement, rejected/completed.
10. Explore, Activity, Profile supporting states.
11. Loading, empty, error, success, stale, and partial-data states.
12. Responsive behavior and accessibility requirements.

### Keputusan produk yang tidak boleh dilanggar

- Tidak ada KPR Secondary sebagai produk terpisah; Primary mencakup rumah baru dan bekas.
- Satu application hanya untuk satu bank/program.
- Monitoring KPR membuat `mortgage`, bukan `application`.
- Simulasi tidak membuat application sampai user memilih `Ajukan Sekarang`.
- Data finansial adalah estimasi, bukan approval/appraisal.
- Tidak ada AI, eKYC/OCR, sinkron bank, WhatsApp provider, atau multi-bank submission.
- Jangan menampilkan fitur seolah terintegrasi jika masih mock.
- Payment MVP bersifat user-recorded, bukan bank-confirmed.

### Urutan implementasi

Ikuti fase dan dependency pada `05-FRONTEND-ARCHITECTURE-DELIVERY.md`. Minimum sequence:

1. Foundation, tokens, shell, router, adapter boundary.
2. Pure calculation functions + tests.
3. Deterministic fixtures dan mock API + contract tests.
4. Auth/profile.
5. KPR Primary end-to-end.
6. Monitoring setup dan reminder.
7. Dashboard/My KPR/amortisasi.
8. Take Over + Top-up.
9. Explore/Activity/Profile.
10. Failure states, responsive, accessibility, E2E.

Jangan mengimplementasikan semua halaman sebagai satu file besar. Jangan juga membuat boilerplate layer yang belum dipakai.

### Verification wajib

Setelah setiap fase:

- Jalankan lint/test/build yang tersedia di repository.
- Tambahkan test minimum untuk setiap branch/loop/parser/perhitungan finansial.
- Gunakan fixtures dan toleransi di Calculation Spec.
- Verifikasi invariants amortisasi.
- Verifikasi JSON contract examples dan adapter parity.
- Jalankan E2E primary journey, monitoring journey, serta Take Over dan Top-up branches.
- Uji mobile dan desktop key screens.
- Perbaiki error sebelum lanjut.

### Definition of Done

Jangan menyatakan selesai berdasarkan jumlah page yang dibuat. Selesai hanya jika:

- Seluruh Must scope dari PRD terpetakan ke route dan acceptance criteria.
- Semua flow utama benar-benar clickable dan mempertahankan state.
- Kalkulasi lulus fixtures/invariants.
- Mock API dapat diganti `httpApi` tanpa mengubah component/page.
- Tidak ada component yang mengakses fixture/localStorage/fetch langsung.
- Build, test, dan lint lulus.
- Empty/loading/error/partial states ada.
- Responsive dan accessibility baseline terverifikasi.
- Output aktual dilaporkan, termasuk apa yang belum bisa diverifikasi.

### Format laporan akhir

Laporkan singkat:

1. File/fitur yang dibuat atau diubah.
2. Flow E2E yang benar-benar diuji.
3. Command dan hasil lint/test/build.
4. Calculation fixtures yang lulus.
5. Known limitations/mock boundaries.
6. Yang belum selesai atau blocker—jangan mengarang keberhasilan.
