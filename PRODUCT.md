# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pengguna B2C (web responsif, mobile-first), dari PRD §2:

- **A. Calon pembeli rumah** — belum punya KPR, ingin membeli rumah baru atau bekas. Job: menemukan program yang sesuai kemampuan, memahami cicilan dan biaya, lalu mengajukan tanpa bingung. Belum paham DTI, fixed/floating, biaya awal, dokumen, dan proses bank.
- **B. Pemilik KPR aktif yang ingin reminder** — KPR sudah berjalan, belum ingin pindah bank. Job: diingatkan soal pembayaran dan akhir masa fixed supaya tidak terlambat atau kaget saat cicilan berubah.
- **C. Pemilik KPR yang menimbang Take Over** — job: membandingkan KPR sekarang dengan bank baru memakai biaya total dan break-even, bukan bunga promo saja; boleh berhenti di simulasi.
- **D. Pemilik properti yang butuh dana tambahan** — job: memahami apakah Refinancing + Top-up atau Multiguna cocok, berapa dana yang mungkin tersedia, dan kewajibannya.

Pengguna internal: **tim operasional RuangKPR** (role `super_admin`) yang memproses pengajuan, user, katalog bank/produk, artikel edukasi, dan konfigurasi lewat dashboard `/admin`, serta **penulis konten** (role `content_writer`) yang hanya mengelola artikel edukasi. Bekerja terutama dari laptop/desktop; HP hanya untuk cek cepat. Role: `user`, `super_admin`, `content_writer`.

Di luar MVP: broker/agen KPR B2B, staf bank sebagai operator penuh, pengguna dengan banyak KPR aktif sekaligus, dan sinkronisasi rekening bank otomatis.

## Product Purpose

RuangKPR adalah **Personal KPR Financial Assistant**: menemani pengguna sejak ingin mengajukan KPR, selama pengajuan diproses, sampai KPR aktif berjalan bertahun-tahun. Alurnya **Know → Warn → Act**: memahami kondisi KPR dan kemampuan bayar, diingatkan sebelum pembayaran dan sebelum fixed berubah jadi floating, lalu mensimulasikan dan mengajukan ke satu bank/program.

Keberhasilan (PRD §1.6): pengajuan KPR Primary selesai secara digital; tracker pengajuan transparan; pengajuan yang sudah akad otomatis menjadi KPR aktif tanpa input ulang; monitoring KPR siap dalam 5–8 menit; reminder tepat waktu; dampak floating terlihat sebelum terjadi; simulasi tanpa memaksa pengguna mengajukan.

Model bisnis: lead/pengajuan ke mitra bank atau multifinance; komisi/provisi hanya bila kerja sama dan transaksi memungkinkan.

## Positioning

Bukan "kalkulator KPR yang lebih lengkap", tetapi **dashboard yang menjaga KPR tetap terkontrol sepanjang masa kreditnya**. Pembedanya: dashboard KPR aktif yang terbaca dalam 5–10 detik; early warning fixed-to-floating H-90/60/30/14/7; amortisasi mengikuti struktur bunga fixed → fixed → floating; simulasi keputusan berbasis biaya total dan break-even; perjalanan berkelanjutan dari pengajuan ke KPR aktif ke monitoring; simulasi dipisah dari pengajuan.

## Operating Context

- **B2C:** pengguna di rumah, kebanyakan dari HP. Daftar dengan email + password (kode 6 digit ke email untuk verifikasi) atau akun Google, lalu masuk dengan email + password; lupa password lewat link di email (tanpa nomor HP). Mengunggah dokumen (KTP, NPWP, slip gaji, dokumen properti; JPG/PNG/PDF). Menandai pembayaran sendiri secara manual. Menerima reminder pembayaran (H-7/3/1) dan peringatan akhir masa fixed.
- **Admin:** tim ops di desktop meninjau dokumen, meminta revisi, memindahkan status pengajuan sesuai alur bank (`submitted → docs_verification → bank_processing → appraisal → approved → akad → disbursed`), mengelola katalog dan artikel, serta mengubah konfigurasi yang versioned (termasuk rumus KPR Health).
- **Tahap saat ini:** prototype frontend-first. Semua data mock dan disimpan di `localStorage`; satu browser bisa menyimpan banyak akun; panel Demo hanya ada di mode dev.
- Dokumen sumber: `ruangkpr-docs/01–05` dan rencana admin `ruangkpr-docs/2026-10-07_110428-admin-dashboard.md`.

## Capabilities and Constraints

- **Sudah ada:** registrasi email + password (verifikasi lewat kode email, lupa password lewat link email), pengajuan KPR Primary 7 langkah dengan tracker dan pemulihan saat ditolak, setup KPR berjalan + monitoring + reminder + amortisasi + KPR Health, simulasi dan pengajuan Take Over + Top-up, Explore (edukasi), Activity, Profile, dan dashboard admin (fase awal).
- **Batas MVP:** satu pengajuan aktif dan satu KPR aktif per akun; satu pengajuan = satu bank/program (tanpa multi-bank); belum ada backend, provider OTP/storage/email, AI, eKYC/OCR, maupun sinkronisasi bank.
- **Istilah domain:** KPR, DP, DTI, LTV, fixed/floating, tenor, akad, appraisal, Take Over, Refinancing + Top-up, Multiguna, break-even.
- **Belum diputuskan:** kebijakan retensi (pembatalan masih hard delete di mock, hapus akun, dokumen); angka final yang wajib saat akad; daftar kode penolakan; zona waktu laporan. Rinciannya di §12 rencana admin.

## Brand Commitments

- **RuangKPR adalah layanan RE/MAX.** Nama dan balon RE/MAX boleh tampil di produk; palet UI memakai sistem warna Teal / Aqua (`src/brand/tokens.css`, panduan clone di `BRANDING.md`).
- Nama tampilan "RuangKPR"; shell B2C memakai tagline "Command Center" (PRD §4.2), dashboard admin menampilkan label role ("Super admin", "Content writer").
- Visual language dan shell mengikuti artifact Claude Design yang sudah disetujui; shell atau visual language baru butuh persetujuan eksplisit (PRD §4.2).
- **Suara:** Bahasa Indonesia dengan sapaan "kamu"; istilah keuangan dijelaskan dengan bahasa sederhana; setiap angka hasil kalkulasi disertai asumsi dan disclaimer bahwa itu estimasi.

## Evidence on Hand

- **Belum ada bukti nyata:** tidak ada mitra bank yang boleh disebut, jumlah pengguna, testimoni, maupun studi kasus. Jangan menampilkan atau mengarang klaim semacam itu.
- Data demo bersifat fiktif dan tidak boleh disajikan sebagai data asli: bank "Bank ABC/XYZ/DEF/GHI" (`src/data/catalog.js`), user contoh dan skenario (`src/data/seed.js`), artikel edukasi (`src/data/articles.js`).
- Aset yang ada: ilustrasi dan foto di `public/brand/` (`cover-auth.webp`, `card-kpr.webp`, `card-overview.webp`, `no-kpr-page.webp`) dan ikon layanan di `public/brand/icon-service/`. Sebagian memakai balon RE/MAX dan palet merah-biru lama.

## Product Principles

1. **Know → Warn → Act.** Tampilkan yang perlu diketahui sekarang; detail ada saat diminta (progressive disclosure: glance → understand → decide).
2. **Estimasi bukan persetujuan.** Angka otoritatif hanya dari engine kalkulasi yang deterministik dan selalu disertai asumsi; AI tidak membuat angka.
3. **Tidak ada pengiriman data diam-diam.** Data baru dikirim ke bank setelah consent dan aksi eksplisit pengguna; simulasi tidak pernah membuat pengajuan.
4. **Jujur soal integrasi dan bukti.** Pembayaran manual tidak tampil seolah tersinkron bank, dan tidak ada klaim mitra, angka, atau testimoni yang belum nyata.
5. **Keamanan di trust boundary tidak disederhanakan.** Validasi, consent, kontrol akses (termasuk role admin), dan perlindungan dokumen selalu ditegakkan.

## Accessibility & Inclusion

- Target WCAG 2.1 AA (PRD §23.3; spesifikasi 02 §15): kontras teks/kontrol/status AA, fokus keyboard terlihat, target sentuh minimal 44px.
- Pengguna B2C memiliki literasi keuangan beragam: istilah seperti DTI, LTV, dan floating perlu penjelasan singkat di tempat dipakai.
- Mobile-first untuk B2C; dashboard admin diprioritaskan untuk desktop tetapi tetap bisa dipakai di HP.
