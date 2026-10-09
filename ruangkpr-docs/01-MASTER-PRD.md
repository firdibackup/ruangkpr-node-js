# 01 — Master Product Requirements Document: RuangKPR

**Versi:** 2.0 — Frontend Delivery Baseline  
**Tanggal:** 28 September 2026  
**Status:** Draft implementasi frontend untuk Claude Code  
**Pemilik produk:** Firdi Audi  
**Target platform:** Web responsif, mobile-first  
**Target pengguna:** B2C — calon pemilik rumah, pemilik KPR aktif, dan pengguna yang ingin mengoptimalkan pinjaman berbasis properti

> Dokumen ini menjadi sumber utama kebutuhan produk RuangKPR. Keputusan desain visual tetap mengacu pada artifact Claude Design yang telah disetujui. Detail implementasi stack tidak dipaksakan sebelum repository/stack produksi ditentukan.

---

## Scope delivery saat ini (dikunci)

Dokumen paket ini digunakan untuk membangun **frontend-first** dengan:

- Vite + React
- JavaScript, bukan TypeScript
- shadcn/ui
- Mock API adapter + JSON fixtures
- Pure JavaScript Calculation Engine
- Tidak bergantung backend/database/provider nyata dahulu

Dokumen ini menjelaskan produk dan scope. Detail layar ada di `02-FRONTEND-FUNCTIONAL-SPEC.md`, rumus di `03-FINANCIAL-CALCULATION-SPEC.md`, contract data di `04-MOCK-API-JSON-CONTRACT.md`, dan cara implementasi di `05-FRONTEND-ARCHITECTURE-DELIVERY.md`. Claude Code wajib membaca kelima file sebelum mengubah source.


# 0. Riwayat Versi

| Tanggal | Versi | Perubahan |
|---|---:|---|
| 28 Sep 2026 | 1.0 | Master PRD pertama: KPR Primary, monitoring KPR aktif, reminder, amortisasi, Take Over, kerangka Refinancing+Top-up dan Multiguna |

---

# 1. Executive Summary

## 1.1 Ringkasan produk

RuangKPR adalah **Personal KPR Financial Assistant** yang membantu pengguna sejak ingin mengajukan KPR, selama pengajuan diproses, hingga setelah KPR aktif dan berjalan bertahun-tahun.

Produk tidak berhenti pada kalkulator atau pengajuan kredit. RuangKPR menjaga agar pengguna memahami:

1. Kondisi KPR hari ini
2. Jumlah dan jadwal pembayaran berikutnya
3. Kapan bunga fixed akan berubah menjadi floating
4. Dampak perubahan bunga terhadap cicilan
5. Kapan Take Over, Refinancing + Top-up, atau Multiguna layak disimulasikan
6. Apa biaya total dan break-even sebelum mengambil keputusan

Prinsip produk:

```text
Know → Warn → Act
```

- **Know:** memahami KPR, kemampuan bayar, sisa pinjaman, properti, dan jadwal pembayaran
- **Warn:** reminder pembayaran dan early warning fixed-to-floating
- **Act:** simulasi, perbandingan program, dan pengajuan ke satu bank/program

## 1.2 Masalah pengguna

### Sebelum memiliki KPR

- Pengguna tidak tahu cicilan yang aman berdasarkan penghasilan dan utang berjalan.
- Promo bunga fixed terlihat murah, tetapi dampak floating dan biaya lain tidak dipahami.
- Produk bank sulit dibandingkan secara setara.
- Proses dokumen dan status pengajuan tidak transparan.

### Setelah memiliki KPR

- Pengguna lupa tanggal jatuh tempo atau akhir masa fixed.
- Pengguna baru sadar cicilan naik setelah bunga floating berlaku.
- Informasi sisa pokok, tenor, equity, LTV, dan komposisi pokok/bunga tersebar.
- Take Over sering dinilai hanya dari bunga/cicilan baru tanpa penalti, provisi, appraisal, notaris, asuransi, dan break-even.
- Pengguna tidak tahu perbedaan dan kelayakan Take Over, Refinancing + Top-up, dan Multiguna.

## 1.3 Positioning

Bukan:

```text
“Kalkulator KPR yang lebih lengkap.”
```

Tetapi:

```text
“Dashboard yang menjaga KPR tetap terkontrol sepanjang masa kreditnya.”
```

## 1.4 Nilai pembeda

1. Dashboard KPR aktif yang ringkas dan mudah dipahami dalam 5–10 detik
2. Early warning fixed-to-floating H-90/60/30/14/7
3. Amortisasi berdasarkan struktur bunga fixed→fixed→floating
4. Simulasi keputusan berbasis biaya total dan break-even
5. Perjalanan berkelanjutan: pengajuan selesai → otomatis menjadi KPR aktif → monitoring
6. Simulasi dipisahkan dari pengajuan; data tidak dikirim ke bank tanpa tindakan eksplisit pengguna

## 1.5 Sasaran bisnis

- Mendapatkan pengguna melalui kalkulator, pengajuan KPR, dan monitoring KPR gratis
- Memahami kebutuhan finansial pengguna berdasarkan data yang diberikan secara sadar
- Mendeteksi peluang produk secara rule-based
- Mengonversi peluang menjadi lead/pengajuan ke mitra bank atau multifinance
- Mendapat komisi/provisi hanya jika kerja sama dan transaksi memungkinkan

## 1.6 Sasaran produk

- Membuat pengajuan KPR Primary dapat diselesaikan secara digital
- Menyediakan tracker pengajuan yang transparan
- Mengubah pengajuan yang telah akad menjadi KPR aktif tanpa input ulang
- Memungkinkan pemilik KPR menyiapkan monitoring dalam 5–8 menit
- Memberikan reminder yang tepat waktu
- Menampilkan dampak floating sebelum terjadi
- Menyediakan simulasi keputusan tanpa memaksa pengguna mengajukan

---

# 2. Pengguna dan Job-to-be-Done

## 2.1 Persona A — Calon pembeli rumah

**Kondisi:** belum punya KPR, ingin membeli rumah baru atau bekas.  
**JTBD:** “Bantu saya menemukan program yang sesuai kemampuan, memahami cicilan dan biaya, lalu mengajukan tanpa bingung.”  
**Pain points:** tidak paham DTI, fixed/floating, biaya awal, kelengkapan dokumen, dan proses bank.  
**Keberhasilan:** memilih satu program, submit data lengkap, dan memantau status.

## 2.2 Persona B — Pemilik KPR aktif yang hanya ingin reminder

**Kondisi:** KPR sudah berjalan; belum ingin pindah bank.  
**JTBD:** “Ingatkan saya tentang pembayaran dan masa fixed supaya tidak terlambat atau kaget saat cicilan berubah.”  
**Pain points:** data KPR tersimpan di dokumen terpisah; tidak ada early warning yang mudah dipahami.  
**Keberhasilan:** monitoring aktif, reminder terjadwal, dashboard menunjukkan kondisi KPR.

## 2.3 Persona C — Pemilik KPR yang mempertimbangkan Take Over

**JTBD:** “Bandingkan KPR sekarang dengan bank baru menggunakan biaya total dan break-even, bukan bunga promo saja.”  
**Keberhasilan:** mendapat simulasi transparan; dapat berhenti di simulasi atau lanjut mengajukan satu program.

## 2.4 Persona D — Pemilik properti yang membutuhkan dana tambahan

**JTBD:** “Bantu saya memahami apakah Refinancing + Top-up atau Multiguna cocok, berapa dana yang mungkin tersedia, dan berapa kewajibannya.”  
**Keberhasilan:** memahami skenario dan risiko sebelum membuat pengajuan.

## 2.5 Persona yang tidak masuk MVP

- Broker/agen KPR B2B
- Staf internal bank sebagai operator penuh
- Pengguna dengan banyak mortgage aktif sekaligus
- Pengguna yang membutuhkan sinkronisasi rekening bank otomatis

---

# 3. Prinsip Produk

1. **Show less, explain better, act faster.** Home hanya menampilkan hal yang perlu diketahui sekarang.
2. **Static shell, dynamic content, dynamic action.** Navigasi konsisten; isi berubah sesuai kondisi user.
3. **Progressive disclosure.** Home = glance; detail = understand; compare = decide.
4. **Estimate is not approval.** Semua hasil kalkulator diberi asumsi dan disclaimer.
5. **No silent data submission.** Data baru dikirim ke bank setelah consent dan klik Submit/Ajukan Sekarang.
6. **One application, one bank/program.** Tidak ada multi-bank submission pada MVP.
7. **Deterministic financial math.** Kalkulasi dilakukan engine; AI tidak membuat angka otoritatif.
8. **Reuse before new flow.** Engine kalkulasi, notification, upload, dan application tracker dipakai lintas produk.
9. **No false integration claims.** Pembayaran manual tidak boleh ditampilkan seolah sinkron bank.
10. **Security at trust boundaries is not optional.** Validasi, consent, access control, dan perlindungan dokumen tidak disederhanakan.

---

# 4. Information Architecture

## 4.1 Navigasi utama

Lima item selalu tersedia dan tidak pernah disabled:

```text
Home | My KPR | Explore | Activity | Profile
```

### Home

Konten dinamis menurut lifecycle:

- Fresh user
- Application draft
- Application in-process
- Application rejected
- Mortgage setup draft
- Mortgage active normal
- Mortgage active mendekati floating
- Mortgage active sudah floating
- Mortgage active partial-data

### My KPR

Konten dinamis:

- Belum ada pengajuan/KPR: empty state
- Application draft: resume checklist
- Application in-process: tracker
- Application rejected: alasan dan next action
- Mortgage active: Overview, Payment, Rate, Property

### Explore

- Tanpa mortgage aktif: edukasi saja
- Dengan mortgage aktif: Take Over, Refinancing + Top-up, Multiguna, edukasi

### Activity

- Status aplikasi
- Permintaan dokumen
- Reminder pembayaran
- Early warning fixed-to-floating
- Histori event produk

### Profile

- Data pribadi
- Kontak terverifikasi
- Dokumen bila relevan
- Pengaturan reminder
- Privasi dan consent
- Logout

## 4.2 Visual baseline

Artifact Claude Design yang sudah disetujui menjadi sumber visual:

- Plus Jakarta Sans
- Primary `#003DA5`
- Background `#F4F6FA`
- Header `RuangKPR Command Center`
- Desktop sidebar/mobile bottom-nav
- Existing card/button/form/status patterns

Desain lanjutan tidak boleh membuat shell dan visual language baru tanpa approval eksplisit.

---

# 5. State Model Utama

## 5.1 Account state

```text
unverified → verified
```

## 5.2 Application state

```text
draft
→ submitted
→ docs_verification
→ additional_docs_requested (opsional, kembali ke docs_verification)
→ bank_processing
→ appraisal
→ approved
→ akad
→ disbursed/completed
```

Terminal/failure:

```text
bank_processing/appraisal → rejected
pre-akad → cancelled (hard delete sesuai keputusan produk saat ini)
```

Catatan: hard delete untuk cancel adalah keputusan produk saat ini, tetapi retention/regulatory requirement harus divalidasi sebelum produksi.

## 5.3 Mortgage state

```text
draft → active → closed
```

`mortgage.draft` digunakan untuk setup monitoring yang belum selesai. Tidak membuat application.

## 5.4 Home render priority

Jika beberapa data ada, gunakan prioritas:

```text
1. Application rejected dan perlu tindakan
2. Application in-process
3. Application draft
4. Mortgage setup draft
5. Mortgage active + mendekati floating
6. Mortgage active + sudah floating
7. Mortgage active normal
8. Fresh
```

**Asumsi MVP:** satu application aktif atau satu setup draft pada satu waktu; satu mortgage aktif per user.

---

# 6. Scope MoSCoW

## 6.1 Must — MVP inti

### Foundation

- Registrasi nama + WhatsApp/email
- OTP verification
- Session/authentication
- Shell 5 navigasi responsif
- Profile dasar

### Pengajuan KPR Primary

- KPR Primary mencakup rumah baru dan bekas
- Secondary bukan produk terpisah
- Form data diri, properti, pinjaman, pekerjaan, income, utang
- Upload dokumen
- Kalkulasi DTI/kapasitas cicilan
- Bank product matching rule-based
- Compare dan simulasi realtime
- Review, consent, submit ke satu bank
- Application tracker
- Additional document request
- Draft/resume
- Rejected and retry/other-bank paths

### Monitoring existing KPR

- Setup 6 step
- Cicilan pernah berubah/tidak
- Input atau estimasi outstanding
- Fixed/floating/rate periods
- Data properti
- Data keuangan
- Reminder preferences
- Home monitoring
- KPR Health
- Payment reminder
- Early warning fixed-to-floating
- My KPR details
- Amortization summary/table

### Shared platform behavior

- In-app notification
- Email notification
- Loading/error/empty/partial states
- Responsive and accessibility baseline
- Audit log minimum untuk perubahan status dan consent berisiko

## 6.2 Should

- Take Over full flow
- Save simulation history
- Repricing request workflow
- Refinancing + Top-up full calculator
- Multiguna full calculator
- Human support/CS handoff
- PDF export amortisasi/perbandingan
- Configurable bank product catalog admin

## 6.3 Could

- WhatsApp notification via approved provider
- OCR dokumen
- eKYC selfie/liveness
- SLIK/credit bureau partner integration
- Property valuation partner
- Multiple mortgages per user
- Multiple parallel application drafts
- Bank API status synchronization
- AI explanation/insight after deterministic calculations

## 6.4 Won't — untuk MVP

- KPR Secondary sebagai produk terpisah
- Multi-bank submission dalam satu application
- Broker B2B portal
- AI menentukan kelayakan atau angka finansial
- Automatic payment deduction
- Klaim appraisal resmi dari estimasi user
- WhatsApp tanpa provider
- Menyimpan password/PIN/OTP perbankan

---

# 7. Feature Requirements — Authentication

## 7.1 Registration

### Input

- Nama lengkap
- Nomor WhatsApp atau email
- Consent Syarat & Ketentuan
- Consent Kebijakan Privasi

### Validation

- Nama minimal 3 karakter
- Format nomor/email valid
- Consent wajib
- Submit disabled sampai valid

### OTP

- 6 digit
- Expiry terukur/configurable
- Resend cooldown 60 detik
- Rate limit kirim dan verifikasi
- Error salah/kadaluarsa

### Acceptance criteria

- User terverifikasi dapat masuk Home
- User tidak dapat memakai fitur data sensitif tanpa verifikasi
- OTP tidak pernah disimpan/log plaintext
- Retry dan resend memiliki rate limit

---

# 8. Feature Requirements — Home Fresh

## 8.1 Produk yang ditampilkan

Tepat empat produk:

1. KPR Primary — rumah baru atau bekas
2. Take Over
3. Refinancing
4. Multiguna

Pada iterasi desain/implementasi awal, hanya KPR Primary wajib end-to-end. Produk lain boleh mengarah ke informational state hingga flownya siap.

## 8.2 Existing-KPR entry

```text
Sudah punya KPR yang berjalan?
Pantau cicilan, dapatkan reminder sebelum bunga floating,
dan lihat kondisi KPR kamu dalam satu tempat.
[Pantau KPR Saya]
```

Tidak langsung menawarkan simulasi sebelum data mortgage tersedia.

## 8.3 Supporting sections

- Cara kerja: Pilih Produk → Ajukan Online → Pantau Pengajuan → Dapatkan Persetujuan
- Insight edukasi: Fixed vs Floating, DP ideal, biaya tersembunyi

---

# 9. Feature Requirements — Pengajuan KPR Primary

## 9.1 User journey

```text
Register/OTP
→ Home
→ Pilih KPR Primary
→ Step 1/5 Pilih Produk
→ Step 2/5 Data Diri, Properti & Pinjaman
→ Step 3/5 Upload Dokumen
→ Step 4/5 Bandingkan Program Bank
→ Step 5/5 Review & Submit
→ Application Tracking
→ Approved/Akad/Completed atau Rejected
```

Registrasi dan OTP bukan bagian progress application.

## 9.2 Product selection

- Primary mencakup rumah baru dan rumah bekas
- Jenis pembelian:
  - Rumah baru dari developer
  - Rumah bekas dari pemilik
- Jangan membuat flow/engine Secondary terpisah

## 9.3 Data pribadi

- Nama sesuai KTP
- Tempat/tanggal lahir
- Jenis kelamin
- Alamat KTP
- Status perkawinan
- Jenis pekerjaan
- Joint income flag
- Data pasangan bila joint income diaktifkan

Data profil reusable disimpan pada profil user; application menyimpan referensi/snapshot yang diperlukan untuk pengajuan.

## 9.4 Data properti dan pinjaman

### Umum

- Jenis pembelian
- Alamat properti
- Harga properti
- DP
- Loan amount
- Tenor

### Rumah baru

- Nama developer
- Dokumen properti: SPR/PPJB dari developer

### Rumah bekas

- Nama penjual opsional
- Dokumen properti: AJB/sertifikat/dokumen penjual yang tersedia

### Business rules

```text
loan_amount <= property_price - dp
```

- Semua currency positif
- Tenor hanya opsi yang didukung bank/product engine
- DP percentage dihitung otomatis dari harga
- Loan amount auto-fill harga−DP, tetap editable dengan validasi

## 9.5 Pekerjaan dan kemampuan finansial

- Nama perusahaan/usaha
- Jabatan
- Lama bekerja/usaha
- Penghasilan bulanan gross
- Pendapatan pasangan jika joint
- Cicilan kendaraan
- Kartu kredit/paylater
- Pinjaman lain

## 9.6 Dokumen

### Minimum

- KTP
- NPWP
- Slip gaji/bukti income
- Dokumen properti
- Dokumen tambahan opsional

### File rules

- JPG/PNG/PDF
- Maksimum default 5MB/file; configurable
- Upload langsung tersimpan
- States: pending → uploading → uploaded → verified / needs_update / error
- Preview dan replace
- Malware/content-type validation di backend produksi

## 9.7 Kemampuan bayar

```text
cicilan_maksimal_aman = ratio_config × monthly_income
sisa_kapasitas = cicilan_maksimal_aman - existing_monthly_debt
```

Default prototype menggunakan `ratio_config=35%`, tetapi ratio final harus configurable menurut kebijakan produk/bank. Jangan hard-code sebagai kebenaran universal.

Program melebihi kapasitas tetap boleh terlihat dengan warning; jangan disembunyikan.

## 9.8 Bank matching

Rule-based, bukan AI. Input minimal:

- Income minimum
- Occupation
- Age/tenor eligibility
- Property type/purchase type
- Loan amount/LTV
- DTI policy
- Rate periods
- Fees

Recommendation label diberikan hanya jika:

1. Estimated eligibility lolos
2. Cicilan tidak melebihi kapasitas berdasarkan policy
3. Data produk masih valid/current
4. Program terbaik menurut sorting objective

## 9.9 Compare and simulation

Per program:

- Nama bank/product
- Fixed rate dan period
- Floating estimate jika tersedia
- Tenor
- Estimated installment
- Admin/provision/known fees
- Assumptions/data date

Detail simulation:

- Loan amount slider/input
- Tenor slider/input
- Installment realtime
- Total principal
- Total interest estimate
- Total payment
- Capacity comparison

## 9.10 Review and submit

Review sections:

- Personal
- Property/loan
- Documents
- Selected bank/program
- Estimates and assumptions
- Consent sending data to selected bank

Post-submit:

- Application read-only
- Perubahan melalui CS/admin workflow atau additional-document path
- Jangan edit data bebas yang sudah terkirim ke bank

## 9.11 Draft/resume

- Draft dibuat setelah produk dipilih
- Autosave saat Simpan & Lanjutkan
- File save per upload
- Home mengganti product hero dengan Resume card
- Satu draft aktif/user
- Ganti produk = confirm delete current draft lalu mulai baru

## 9.12 Tracker

Generic tracker:

```text
Diajukan
→ Verifikasi Dokumen
→ Proses Bank
→ Appraisal
→ Disetujui
→ Akad
→ Selesai
```

Additional-doc request menjadi actionable card dan item baru/updated di daftar dokumen.

## 9.13 Rejected

Tampilkan:

- Bank/program
- Tanggal
- Alasan yang dapat ditampilkan
- Saran perbaikan tanpa menjanjikan approval

CTA:

### Ajukan ke Bank Lain

- Clone data dan valid documents ke application baru
- Kembali ke compare
- Old row tetap rejected sebagai history

### Perbaiki & Ajukan Ulang

- Kembali ke field relevan
- Status kembali draft
- Re-submit ke bank yang sama
- Dokumen invalid/expired wajib diganti

## 9.14 Cancel

- Confirm modal
- Copy konsekuensi jelas
- Current decision: hard delete pre-akad data application dan document association
- **Open compliance validation:** apakah data yang sudah submitted wajib diretain; jika ya, hard delete harus diganti soft-delete/retention policy

## 9.15 Acceptance criteria

- Primary dapat diselesaikan dari product selection sampai submit
- One application maps to one bank/product
- Data invalid tidak dapat disubmit
- Draft dapat dilanjutkan dari current step
- Upload gagal dapat retry tanpa reset form
- Rejected memiliki kedua recovery paths
- Tracker mencerminkan backend status, bukan timer palsu

---

# 10. Feature Requirements — Setup Existing KPR

## 10.1 Entry

`Pantau KPR Saya` → intro monitoring.

Intro menjelaskan:

- Reminder payment
- Floating warning
- Loan progress
- Amortization
- Simulations
- Data tidak dikirim ke bank tanpa Ajukan Sekarang

## 10.2 Wizard enam step

```text
1/6 Data KPR
2/6 Bunga & Cicilan
3/6 Properti
4/6 Kondisi Keuangan
5/6 Reminder
6/6 Review
```

## 10.3 Step 1 — Data KPR

- Bank
- Product name opsional
- Conventional/Syariah
- Original principal
- Current payment
- Original tenor
- Start/akad date
- Monthly due day
- Know outstanding? yes/no
- Outstanding + remaining tenor if yes

Validation:

- Tenor 12–360 bulan
- Akad tidak masa depan
- Due day 1–31; scheduler harus menangani bulan pendek
- Outstanding ≤ original principal, kecuali special product/top-up flagged

## 10.4 Step 2 — Rate and payment condition

Pertanyaan wajib:

```text
Apakah cicilan pernah naik/berubah sejak akad?
```

### Tidak pernah berubah

Jika outstanding tidak diketahui, calculation engine boleh solve effective rate dan estimate outstanding berdasarkan original principal, payment, tenor, elapsed periods.

Hasil selalu diberi label estimate dan pilihan input official value.

### Pernah berubah

- Wajib input current outstanding
- Current payment
- Current rate
- Fixed/floating
- Remaining tenor
- Fixed-until jika masih fixed
- Jangan solve rate/outstanding menggunakan asumsi satu rate

## 10.5 Rate periods

Mendukung urutan:

```text
fixed → fixed → floating
```

Rules:

- Ordered
- No overlap
- No unexplained gap untuk jadwal penuh
- Rate > 0
- Floating future value selalu estimate

User boleh memasukkan active period saja; fitur yang membutuhkan full historical periods harus menggunakan partial-data state.

## 10.6 Step 3 — Property

- Property type
- Address/city
- Land/building area
- Certificate type
- Certificate owner
- Estimated current value
- Value date
- Dispute flag

Value boleh dilewati. Consequence:

- Reminder tetap aktif
- Equity/LTV/top-up/multiguna partial/unavailable

## 10.7 Step 4 — Financial condition

- Monthly income
- Joint income
- Current KPR payment (prefilled)
- Vehicle installment
- Credit card/paylater
- Other loan
- Routine expenses optional
- Emergency fund optional

Display DTI estimate and disclaimer.

## 10.8 Step 5 — Reminder settings

### Payment defaults

- H-7 enabled
- H-3 enabled
- H-1 enabled
- Due day disabled by default

### Fixed expiry defaults

- H-90/60/30/14/7 enabled

### Channels

- In-app enabled
- Email enabled if verified
- WhatsApp disabled/coming soon until provider exists

If already floating, fixed expiry reminder is not shown.

## 10.9 Step 6 — Review and activate

- Edit links per section
- Confirmation checkbox
- CTA Activate Monitoring
- Mortgage draft → active
- No application created

## 10.10 Setup draft/resume

- `mortgages.status=draft`
- `setup_step`
- Home Resume Setup card
- Delete draft confirmation

## 10.11 Acceptance criteria

- User dapat mengaktifkan monitoring tanpa dokumen
- Branch payment-changed menentukan input yang benar
- No reverse-engineering ketika payment changed
- Missing property value tidak memblok reminder
- Monitoring activation tidak membuat application

---

# 11. Feature Requirements — Dashboard Monitoring

## 11.1 Home normal

Urutan:

1. KPR Health
2. Next Payment
3. Warning — conditional only
4. My KPR progress
5. Opportunity

No charts on Home.

> Catatan 2026-10-05: aturan ini berlaku untuk **susunan default**. Grafik (Proyeksi Sisa Pokok, Dampak Floating, Komposisi Cicilan, Pokok vs Bunga per Tahun) hanya tersedia sebagai widget opsional yang ditambahkan user lewat *Atur Dashboard → Tambah widget*. Lihat `docs/superpowers/specs/2026-10-05-widget-catalog-design.md`.

## 11.2 KPR Health

Composite score MVP:

- Payment burden/DTI
- LTV/property position
- Rate risk
- Loan progress

Health bukan credit score bank. Formula/weight harus configurable dan didokumentasikan sebelum production. Jika input komponen tidak lengkap, tampilkan partial score, bukan angka presisi palsu.

Status (2026-10-07): formula berversi. Versi 1 = ambang di `src/domains/mortgages/derive.js` (`HEALTH_V1`). Perubahan ambang, bobot, dan label dilakukan dari admin Configuration → Formula KPR Health, dengan pratinjau dan alasan, lalu terbit sebagai versi baru. Versi lama tidak pernah diubah dan bisa dipulihkan. Halaman KPR Health menampilkan versi yang dipakai.

## 11.3 Next Payment

- Amount
- Due date
- Days remaining
- CTA detail
- Status manual for MVP

## 11.4 Fixed warning

Trigger when:

```text
0 < days_until_fixed_end <= 90
```

Milestones: H-90/60/30/14/7.

Display:

- Current rate/payment
- Estimated floating rate/payment
- Delta monthly
- CTA options: Stay, Compare Take Over, Request Repricing

Warning becomes first/hero monitoring card. Other cards remain below.

## 11.5 Already floating

- No countdown
- Current floating rate/payment
- Delta from last fixed payment if available
- Compare Options CTA

## 11.6 Partial data

Missing property value:

- Health/property features partial
- Reminder remains active
- CTA complete property

Missing rate/outstanding:

- Amortization unavailable
- Show explicit fields to complete

---

# 12. Feature Requirements — My KPR

## 12.1 Tabs

```text
Overview | Payment | Rate | Property
```

No new sidebar items.

## 12.2 Overview

- Bank/product
- Outstanding
- Original principal
- Current payment
- Remaining tenor
- Principal progress
- Start/today/estimated finish timeline
- Edit data per section

## 12.3 Payment

- Next payment
- Current-month principal and interest
- Payment calendar/history
- Manual Mark as Paid
- CTA amortization

Manual payment state must be labeled as user-recorded, not bank-confirmed.

## 12.4 Rate

- Current rate/type
- Fixed-until/countdown
- Next estimated floating
- Rate-period timeline
- Payment impact
- Compare CTA

## 12.5 Property

- Property identity
- Estimated current value/date
- Outstanding
- Estimated equity
- LTV
- Update Value CTA
- Disclaimers:
  - Not an official appraisal
  - Equity is not automatically cash

---

# 13. Feature Requirements — Amortization

## 13.1 Placement

```text
My KPR → Payment → Lihat Jadwal Amortisasi
```

Not a top-level navigation item.

## 13.2 Input

- Current outstanding
- Remaining tenor
- Payment start/date
- Rate periods
- Repayment method (MVP anuitas)

## 13.3 Summary

- Remaining principal
- Remaining tenor/date range
- Method
- Estimated total interest
- Estimated total payment
- End balance
- Rate assumptions
- Annual stacked principal vs interest chart

## 13.4 Table

Controls:

- Monthly/yearly toggle
- Year filter for monthly
- Source label

Columns:

- Payment date
- Annual rate
- Opening balance
- Payment
- Principal
- Interest
- Closing balance

## 13.5 Financial invariants

```text
sum(principal) = opening_outstanding ± rounding_tolerance
sum(payment) = sum(principal) + sum(interest)
final_balance = 0 ± rounding_tolerance
```

Adjust final installment for rounding.

## 13.6 Generation strategy

Generate from inputs/calculation engine. Do not persist every schedule row by default. Cache only if measured performance needs it. A snapshot may be required later for audit/export.

## 13.7 Responsive

- Desktop: full seven-column table
- Mobile default: yearly
- Monthly: horizontal scroll or expandable rows

## 13.8 Failure paths

- Missing outstanding/rate period → no fake table; complete-data CTA
- Invalid overlapping periods → inline error
- Calculation failure → retry and data correction

---

# 14. Feature Requirements — Explore

## 14.1 Without active mortgage

Only educational cards. Take Over/Refinancing/Multiguna cards are not rendered, not disabled.

## 14.2 With active mortgage

Always show:

1. Take Over
2. Refinancing + Top-up
3. Multiguna

## 14.3 Take Over ordering/badge

Signals:

```text
floating_signal = fixed_until <= 90 days
opportunity_signal = eligible product has positive net benefit
```

- Floating signal: warning badge and highest priority
- Opportunity signal: opportunity badge
- Both: combined message; floating framing first

Refinancing/Multiguna badges deferred until reliable property valuation/opportunity rules exist.

## 14.4 Simulation vs application

All simulation results eventually use:

```text
[Simpan Simulasi] [Ajukan Sekarang]
```

- Save Simulation: no application; simulation history is Should, not Must
- Apply Now: create application draft prefilled from mortgage/profile

---

# 15. Feature Requirements — Take Over

## 15.1 Entry modes

### Existing mortgage via Explore

Skip cold-entry wizard; prefill mortgage/property/financial data and go to baseline/compare. User confirms stale data if needed.

### Cold entry

Collect:

- Original principal
- Current payment
- Original tenor
- Start date
- New desired tenor
- Property type
- Original bank
- Payment-changed question

## 15.2 Accuracy branch

- Never changed: solve-for-rate allowed
- Changed/floating: current official outstanding required; no single-rate reverse engineering

## 15.3 Baseline

Always show current mortgage before alternatives:

- Outstanding
- Current rate/payment
- Remaining tenor
- Old-bank penalty
- Exit cost estimate

## 15.4 Comparison

- New rate periods
- Payment delta
- Total moving cost: penalty, provision, admin, appraisal, notary, insurance, other
- Break-even
- Net saving over comparison horizon
- Total lifecycle payment

## 15.5 Documents

Product-specific:

- Personal: KTP, KK, NPWP, marriage doc if relevant, income proof, statements
- Old KPR: agreement, outstanding letter, latest payment proof, penalty/payoff information
- Property: certificate, PBG/IMB, PBB, PPJB/AJB

## 15.6 Tracker

```text
Submitted
→ Document Verification
→ Bank Analysis
→ Appraisal
→ Approved
→ Old KPR Settlement
→ New KPR Akad
→ Completed
```

During settlement:

```text
Tetap bayar cicilan bank lama sampai konfirmasi pelunasan resmi diterima.
```

## 15.7 MVP status

Product requirements defined; complete design/implementation may be delivered after Primary + Monitoring foundation.

---

# 16. Refinancing + Top-up — Requirement Framework

**Status:** needs detailed product-policy validation before implementation.

## 16.1 Goal

Simulate replacing/restructuring the existing facility and optionally receiving additional funds based on property value and eligibility.

## 16.2 Reused data

- Outstanding
- Property estimate
- LTV
- Rate/remaining tenor
- Income/debts

## 16.3 Additional input

- Desired top-up amount
- Purpose of funds
- Desired tenor
- Desired payment cap

## 16.4 Required output

- Old facility vs new facility
- New principal
- Cash-out estimate
- New payment
- Fees
- Break-even
- LTV after top-up
- Total interest/payment
- Eligibility estimate and appraisal disclaimer

## 16.5 Open decisions

- Whether refinancing always means moving bank or can include repricing at existing bank
- Maximum product-specific LTV
- Purpose restrictions
- Tax/legal/insurance fees
- Minimum seasoning/payment history

No authoritative recommendation until partner policies exist.

---

# 17. Multiguna — Requirement Framework

**Status:** needs detailed product-policy validation before implementation.

## 17.1 Goal

Provide a secured loan simulation using owned property as collateral.

## 17.2 Reused data

- Property type/value/certificate ownership
- Existing encumbrance/outstanding
- Income/debts

## 17.3 Additional input

- Desired funds
- Purpose
- Tenor

## 17.4 Required output

- Estimated eligible amount
- New monthly payment
- Rate/tenor
- Fees
- LTV/combined encumbrance
- Total payment
- Disclaimer that estimate is not approval/appraisal

## 17.5 Architecture decision

Reuse Calculation Engine + Bank Product Engine with `product_type=multiguna`; do not build a separate engine unless real bank rules prove materially different.

---

# 18. Activity and Notifications

## 18.1 Event types

- Application submitted
- Document verified/needs update
- Bank-processing status change
- Approved/rejected
- Payment reminders
- Fixed expiry reminders
- Monitoring activated
- User-recorded payment

## 18.2 Delivery channels

MVP:

- In-app
- Email

Future:

- WhatsApp via provider
- Push native when mobile wrapper/app exists

## 18.3 Reliability

- Idempotent notification scheduling
- Deduplication per event/milestone/channel
- Retry with bounded attempts
- Record delivery status
- Respect user preferences
- Do not send future reminders after mortgage closed or setting disabled

## 18.4 Timezone

Store schedule with timezone semantics; default user timezone must be explicit. For Indonesian MVP, WIB may be default only if product scope is confirmed; do not assume permanently in data model.

---

# 19. Conceptual Data Model

This is product-level mapping, not final SQL.

## 19.1 users

- id
- name
- verified_phone/email
- auth status
- timezone
- created/updated

## 19.2 profiles

- user_id
- identity fields
- marital/job/employer/income fields
- consent timestamps/versions

## 19.3 applications

- id/user_id
- product_type: primary/takeover/refinancing/multiguna
- status
- current_step
- bank_product_id
- financial/property/loan snapshot
- rejection reason
- submitted/approved/rejected/completed timestamps

## 19.4 application_status_history

- application_id
- from/to status
- timestamp
- display message
- actor/source

## 19.5 documents

- owner type/id (application/profile as justified)
- document type
- file metadata/storage key
- status
- invalid reason
- version/replaced-by
- uploaded/verified timestamps

## 19.6 mortgages

- id/user_id
- status draft/active/closed
- setup_step
- bank/product/type
- original principal/current outstanding/payment
- original/remaining tenor
- start/due dates
- current rate/type/fixed-until/floating estimate
- payment method

## 19.7 rate_periods

- mortgage_id
- sequence
- start/end
- rate
- type fixed/floating
- is_estimate

## 19.8 properties

- mortgage_id/user_id
- type/address/area
- certificate type/owner
- estimated value/value date
- dispute flag

## 19.9 financial_profiles

- user_id
- income/joint income
- debts by type
- routine expenses/emergency fund optional
- updated_at

## 19.10 reminder_preferences

- mortgage_id
- payment offsets
- fixed-expiry offsets
- channels
- enabled

## 19.11 notifications

- user/event/entity
- channel
- scheduled/sent/delivery status
- dedupe key

## 19.12 payments

- mortgage_id
- due date/amount
- status user_recorded_pending/paid
- paid_at
- source manual/system future

## 19.13 bank_products

- bank/product/type
- effective date/version
- eligibility policy
- rate periods
- fees
- source/last verified
- active

## 19.14 simulations (Should)

- mortgage/user
- product type
- input snapshot
- result snapshot
- created_at

---

# 20. Calculation Engine Requirements

## 20.1 Must support

- Annuity payment
- Remaining balance
- Effective-rate solve where mathematically valid
- Multiple rate periods
- Monthly amortization
- Yearly aggregation
- DTI/payment capacity
- LTV/equity
- Fixed-to-floating payment impact
- Take Over costs, break-even, net savings

## 20.2 Precision

- Use decimal-safe money calculations; do not rely on binary float for persisted monetary truth
- Define rounding per installment and final reconciliation
- Store rate precision sufficient for bank products

## 20.3 Edge cases

- Zero/negative income or loan values
- Payment insufficient to cover interest
- Missing rate period
- Overlapping/gapped rate periods
- Break-even denominator ≤ 0
- Negative net savings
- Fixed end in past
- Due dates 29–31 in short months
- Early repayment/top-up altering schedule

## 20.4 Break-even

```text
monthly_benefit = current_payment - new_payment
break_even_months = moving_cost / monthly_benefit
```

If `monthly_benefit <= 0`, do not show positive break-even; label “Tidak mencapai break-even dari penghematan cicilan bulanan” and evaluate total-cost differences separately.

## 20.5 AI boundary

AI may explain deterministic results in future; it cannot produce rates, balances, eligibility, or approval decisions.

---

# 21. Bank Product Data Governance

This is a major operational risk.

Requirements:

- Every product has effective/start/end date
- Source and last-verified timestamp
- Versioned policy/rate/fee data
- Inactive/expired product excluded
- Estimated floating clearly labeled
- Occupation/age/property eligibility from actual policy, not generated text
- Admin workflow or controlled import required before recommendation goes live

If product data is stale beyond configured threshold, show stale-data warning or disable recommendation label.

---

# 22. Security, Privacy, Consent, Compliance

## 22.1 Sensitive data

- KTP/NIK
- NPWP
- Income/debt
- Bank statements
- Property documents
- Loan status

## 22.2 Requirements

- TLS in transit
- Encryption at rest for sensitive data/files
- Private object storage with short-lived signed access
- Strict per-user authorization
- Role-based internal access
- Audit access to sensitive files
- Redact secrets/PII from logs
- File malware/type validation
- Consent version and timestamp
- Retention/deletion policy
- Incident response and backup strategy

## 22.3 Forbidden

- Request/store bank password
- Request/store PIN
- Request/store user banking OTP
- Public document URLs
- Using uploaded documents for unrelated purpose without consent

## 22.4 Open legal/compliance work

- Validate Indonesian PDP obligations
- Validate credit intermediation/licensing model
- Validate data sharing agreement with banks/multifinance
- Validate deletion vs regulatory retention after submission
- Validate disclaimer/legal review for financial estimates

---

# 23. Non-Functional Requirements

## 23.1 Performance targets

Initial product targets (to validate):

- Core dashboard usable within 3 seconds on typical mobile 4G after authentication
- Simulation recalculation perceived realtime (<200ms client/local or <500ms API target)
- Upload supports retry and progress
- Amortization 360 months generated without UI freezing

## 23.2 Reliability

- Status transitions idempotent
- Upload retry safe
- Notification dedupe
- Financial calculation version identifiable
- Bank product version attached to submitted application snapshot

## 23.3 Accessibility

- WCAG 2.1 AA target
- 44×44px touch targets
- Keyboard operation
- Visible focus
- Error text associated with fields
- Color never sole status signal
- Tables have accessible headers/captions
- Reduced motion respected

## 23.4 Responsive

- Mobile-first
- Desktop left sidebar, mobile bottom nav
- Forms 1 column mobile, max 2 desktop
- Amortization yearly default mobile
- Wide tables scroll/expand rather than shrink illegibly

---

# 24. Analytics and Success Metrics

## 24.1 North-star candidate

```text
Monthly users who complete a meaningful KPR action:
submit application OR activate monitoring OR complete a qualified simulation.
```

## 24.2 Funnel metrics

### Application

- Registration completion
- Product selection → form start
- Step completion/drop-off
- Document completion
- Compare viewed
- Submit rate
- Approval/rejection rate where data available
- Additional-doc resolution time

### Monitoring

- Pantau KPR CTA click
- Setup start/completion
- Reminder enabled
- Dashboard weekly active use
- Warning viewed/actioned
- Payment marked
- Amortization viewed

### Opportunity

- Explore card click
- Simulation completion
- Positive net opportunity rate
- Simulation → Apply conversion
- Completed transaction/commission when integrated

## 24.3 Quality metrics

- Calculation mismatch reports
- Duplicate notification rate
- Upload failure rate
- Stale bank-product exposure
- Support contacts per completed flow

## 24.4 Guardrails

- User complaints about misleading estimates
- Data/privacy incidents
- Recommendations based on stale product data
- High cancellation after hidden cost exposure

---

# 25. Failure Paths and Edge Cases

1. OTP late/wrong/expired → retry/resend without account duplication
2. User exits form → resume last saved step
3. File upload fails → item-level retry
4. Product list unavailable → retry, do not fabricate
5. No eligible bank → explain and allow inputs adjustment
6. Bank requests extra docs → actionable request
7. Application rejected → reason + two recovery routes
8. Mortgage setup partial → reminder can remain where possible; incomplete analysis labeled
9. Notification permission denied → email remains, settings CTA
10. Fixed date already passed → already-floating state
11. Rate period invalid → block amortization and show correction
12. Property value absent → equity/LTV/top-up unavailable, no fake estimate
13. User changes critical mortgage inputs → recalculate health/amortization/reminders
14. Bank product expires during draft → force re-compare before submit
15. Application submitted then product changes → retain submitted snapshot

---

# 26. Delivery Phases

## Phase 0 — Product/data validation

- Finalize legal/privacy position
- Define bank product data ownership
- Validate formulas with finance/domain expert
- Confirm notification channels
- Confirm stack/repository

## Phase 1 — Foundation + KPR Primary

- Auth/OTP
- Shell/navigation
- Profile
- Primary application form
- Documents
- Calculation/DTI
- Product compare
- Review/submit
- Tracker/draft/rejected

## Phase 2 — Existing KPR Monitoring

- Mortgage setup
- Rate periods
- Property/financial data
- Reminder scheduler
- Home dynamic monitoring
- My KPR
- Amortization
- Activity/Profile reminder settings

## Phase 3 — Take Over

- Baseline and cost model
- Existing/cold entries
- Product-specific docs
- Break-even/net savings
- Take Over tracker including old-loan settlement

## Phase 4 — Refinancing/Top-up + Multiguna

- Partner policy validation
- Detailed calculators
- Product-specific application forms/docs/tracker

## Phase 5 — Partnerships and automation

- Bank status APIs
- eKYC/OCR/SLIK/property valuation
- WhatsApp/push
- Human advisor tooling
- Broker B2B separate portal

---

# 27. Development Work Breakdown (Stack-Agnostic)

## 27.1 Foundation

- [ ] Define domain enums/state transitions
  - Output: reviewed state diagrams
  - Verify: transition tests cover valid/invalid paths
- [ ] Implement auth + OTP
  - Verify: rate-limit, expiry, resend, session tests
- [ ] Implement access-control policies
  - Verify: cross-user data access denied
- [ ] Implement responsive shell
  - Verify: five nav items work across states

## 27.2 Calculation engine

- [ ] Implement annuity payment/outstanding/amortization
- [ ] Implement rate-period validation
- [ ] Implement solve-for-rate bounded numerical method
- [ ] Implement DTI/LTV/equity
- [ ] Implement takeover cost/break-even
- [ ] Add deterministic fixture tests and final-balance reconciliation

## 27.3 KPR Primary

- [ ] Application draft/resume
- [ ] Primary new/used conditional form
- [ ] Secure document upload
- [ ] Bank product matching
- [ ] Compare/detail simulation
- [ ] Review/consent/submit
- [ ] Tracker/additional-doc/rejected/cancel

## 27.4 Monitoring

- [ ] Mortgage setup draft/resume
- [ ] Rate-period editor
- [ ] Property/finance/reminder forms
- [ ] Dynamic Home states
- [ ] KPR Health
- [ ] My KPR tabs
- [ ] Amortization summary/table
- [ ] Manual payment history

## 27.5 Notifications

- [ ] Event model and dedupe key
- [ ] Payment reminder scheduling
- [ ] Fixed-expiry milestones
- [ ] In-app and email delivery
- [ ] Preferences and permission failure states

## 27.6 Operational/admin

- [ ] Bank/product version management
- [ ] Status-update interface
- [ ] Document-review interface
- [ ] Audit access
- [ ] Stale-data monitoring

## 27.7 Verification gates

- [ ] Financial fixture suite passes
- [ ] Authorization tests pass
- [ ] Upload security tests pass
- [ ] Primary journey E2E passes
- [ ] Monitoring journey E2E passes
- [ ] Reminder scheduling tests pass with timezone/date edge cases
- [ ] Accessibility audit passes baseline
- [ ] Responsive review passes key frames

---

# 28. Definition of Done — MVP

MVP dianggap selesai hanya jika:

1. User bisa register dan verify OTP
2. User bisa menyelesaikan KPR Primary rumah baru/bekas sampai submit
3. Draft/resume bekerja
4. Dokumen aman, dapat retry, dan status jelas
5. Compare menggunakan product data nyata/configured, bukan hardcoded demo production
6. Application tracker, additional doc, rejected recovery bekerja
7. Existing user bisa setup mortgage tanpa upload dokumen
8. Reminder payment/fixed terjadwal dan deduplicated
9. Home berubah sesuai mortgage state
10. My KPR dan amortization akurat terhadap test fixtures
11. Semua estimasi/disclaimer benar
12. Cross-user access tidak mungkin
13. Critical E2E dan financial tests lulus
14. Tidak ada klaim integrasi/approval palsu

---

# 29. Confirmed Decisions

- Fokus B2C; broker portal terpisah
- KPR Secondary dihapus sebagai produk terpisah; Primary mencakup baru dan bekas
- One application = one bank/program
- AI ditunda
- eKYC selfie P2
- Human advisor bukan MVP
- Existing KPR monitoring tidak membuat application
- Explore products muncul hanya setelah mortgage aktif
- Simulation dipisah dari Apply Now
- Amortization berada di My KPR → Payment
- Home tidak menampilkan chart
- Take Over existing user skip cold-entry wizard
- Take Over tracker punya Old KPR Settlement stage
- MVP satu draft/application aktif dan satu mortgage aktif per user
- WhatsApp belum aktif tanpa provider

---

# 30. Assumptions

- User bersedia input data mortgage manual
- Bank/product data dapat diperoleh dan dipelihara
- Appraisal/property value resmi tidak tersedia pada MVP
- Payment status manual cukup untuk MVP
- Email delivery provider tersedia
- One-bank application model sesuai model operasional awal

---

# 31. Risks

## High

1. Bank product data cepat usang
2. Calculation error berdampak finansial dan kepercayaan
3. Sensitive PII/document breach
4. Legal/licensing/data-sharing uncertainty
5. Recommendation dianggap sebagai guarantee

## Medium

1. Manual setup terlalu panjang
2. Reminder tidak terkirim karena permissions/email quality
3. User memasukkan property/outstanding tidak akurat
4. Hard-delete cancellation bertentangan dengan retention requirement

## Mitigation

- Versioned product catalog and stale threshold
- Domain expert validation + fixture tests
- Strong security/access/audit
- Explicit estimates/disclaimers
- Progressive setup and partial state
- Compliance review before production

---

# 32. Open Questions Before Build Approval

1. Stack/repository produksi apa yang digunakan?
2. Siapa pemilik dan updater data produk bank?
3. Apakah submit benar-benar lewat API bank, diteruskan ke operator internal, atau lead handoff?
4. Apakah application submitted boleh hard delete secara legal/operasional?
5. Vendor OTP/email/file storage apa yang digunakan?
6. Apakah ratio kapasitas default 35% hanya UI guidance atau policy platform?
7. Formula dan bobot KPR Health final?
8. Apakah payment reminder membutuhkan user confirmation per bulan?
9. Source estimasi floating rate?
10. Apa definisi resmi Refinancing vs Repricing pada produk ini?
11. Bank/partner mana yang mendukung Top-up/Multiguna dan kebijakannya?
12. Apakah dibutuhkan admin/operations portal pada MVP agar tracker dan document review benar-benar operasional?

---

# 33. Approval Gate

PRD ini siap untuk:

1. Review keputusan/open questions
2. Finalisasi scope MVP
3. Technical architecture berdasarkan repository nyata
4. Breakdown sprint dan estimasi

**PRD ini tidak otomatis menjadi approval untuk mulai coding.** Implementasi dimulai setelah open questions yang memengaruhi arsitektur, compliance, dan operasi dijawab atau secara eksplisit ditunda dengan asumsi yang disetujui.
