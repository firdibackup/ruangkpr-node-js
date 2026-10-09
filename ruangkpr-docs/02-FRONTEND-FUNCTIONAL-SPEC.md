# RuangKPR — Frontend Functional Specification

**Dokumen:** 02-FRONTEND-FUNCTIONAL-SPEC.md  
**Status:** Draft implementasi  
**Target:** Vite + React + JavaScript + shadcn/ui  
**Bahasa UI:** Indonesia  
**Referensi utama:** `PRD-RuangKPR-Lengkap.md` dan artifact visual approved `RuangKPR Pengajuan Baru (Standalone).html`

> Dokumen ini adalah kontrak perilaku frontend. Bila contoh fixture bertentangan dengan data mock API, struktur/perilaku di dokumen ini tetap berlaku dan nilai mengikuti respons mock. Jangan mengarang integrasi backend, bank, storage, OTP, notifikasi, appraisal, atau sinkronisasi pembayaran.

---

## 1. Keputusan Produk dan Batas Implementasi

### 1.1 Keputusan wajib

- KPR Secondary dihapus. `KPR Primary` mencakup rumah baru dari developer **dan** rumah bekas dari pemilik.
- Satu `application` mewakili satu bank/program. Tidak ada multi-bank submit.
- Take Over dan Refinancing + Top-up memakai satu flow optimasi; `requestedTopup=0` berarti Take Over biasa, `requestedTopup>0` berarti Take Over/Refinancing + Top-up.
- Monitoring KPR membuat `mortgage`, bukan `application`.
- Frontend-only; seluruh akses data melalui mock API async. Jangan menyebut provider backend.
- Satu draft aktif dan satu mortgage aktif per user untuk MVP.
- Simpan simulasi tidak membuat pengajuan. Karena riwayat simulasi belum masuk MVP, CTA dapat menyelesaikan simulasi dan kembali ke Explore.
- Tidak ada AI/chatbot, OCR/eKYC, appraisal otomatis, koneksi bank, atau WhatsApp aktif.
- Data produk bank adalah fixture, berlabel tanggal pembaruan. Rekomendasi hanya rule-based dan tidak boleh dinarasikan sebagai persetujuan.

### 1.2 Visual baseline

- Font: Plus Jakarta Sans.
- Primary: `#003DA5`; app background: `#F4F6FA`.
- Header desktop: `RuangKPR Command Center`.
- Reuse pola card, pill button, spacing, radius, shadow, icon, status badge, progress stepper artifact approved.
- Gunakan komponen shadcn/ui yang sudah tersedia sebelum komponen custom: Button, Card, Input, Label, Select, RadioGroup, Checkbox, Tabs, Dialog, AlertDialog, Alert, Badge, Progress, Skeleton, Table, Accordion, Tooltip, Toast/Sonner, Sheet, DropdownMenu.
- Ikon harus dari dependency yang sudah terpasang; jangan tambah paket ikon.
- Homepage aktif tidak memiliki chart.

### 1.3 Tidak dibuat

- Route/kartu/string/id `secondary`.
- Banyak draft/mortgage aktif.
- Multi-bank submit.
- Provider OTP/upload/notifikasi nyata.
- Jadwal amortisasi tersimpan permanen; frontend menghitung dari input mock.
- Riwayat simulasi.
- Weighted preference engine.
- Pengaturan admin/backoffice.

---

## 2. Kontrak Aplikasi Frontend

### 2.1 Struktur minimum

```text
src/
  app/                 router, providers, shell, route guards
  components/          shared visual primitives/patterns
  features/
    auth/
    home/
    primary/
    mortgage-setup/
    my-kpr/
    amortization/
    optimization/
    explore/
    activity/
    profile/
  lib/                 format, validation, calculation, dates
  mocks/               fixtures + async mock API
```

Bukan kewajiban membuat folder lebih dalam jika belum dibutuhkan. Feature menyimpan page, schema/validator JS, dan fixture khususnya berdekatan.

### 2.2 State sumber kebenaran

```js
session = { status: 'guest'|'authenticated', userId }
user = { id, fullName, contact, contactType, profile }
application = null | {
  id, productType: 'primary'|'takeover', optimizationMode: null|'takeover'|'topup',
  status: 'draft'|'submitted'|'verification'|'bank_processing'|'appraisal'|
          'approved'|'old_loan_settlement'|'disbursed'|'rejected',
  currentStep, selectedBankProductId, pendingActions, rejection, updatedAt
}
mortgage = null | { id, status: 'draft'|'active'|'replaced'|'closed', setupStep, ... }
```

Prioritas render Home:

1. mortgage setup draft;
2. application draft;
3. application pre-akad/rejected;
4. mortgage active dan fixed berakhir ≤90 hari;
5. mortgage active sudah floating;
6. mortgage active normal/partial;
7. fresh.

Jika fixture ilegal memiliki application aktif dan mortgage setup draft bersamaan, tampilkan error-state diagnostik non-teknis: `Data akun belum dapat ditampilkan` + `Coba Lagi`; log warning di console development.

### 2.3 Mock API

Semua operasi async agar UI melatih state nyata:

```text
getSession, register, verifyOtp, resendOtp
getDashboard, getApplication, createDraft, saveDraftStep, deleteDraft
uploadDocument, retryUpload, submitApplication, cancelApplication
cloneRejectedApplication, reopenRejectedApplication
getMortgage, createMortgageDraft, saveMortgageStep, activateMortgage, updateMortgage
getBankProducts, calculateSimulation
getActivities, markActivityRead
getProfile, updateProfile, updateReminderPreferences
```

Ketentuan:

- Latensi fixture 300–800 ms; mode error dapat dipilih fixture/dev control, bukan UI produksi.
- Mutasi optimistis hanya untuk preferensi non-kritis. Submit, delete, upload, activation, dan pembayaran menunggu sukses API.
- Error tidak menghapus input lokal.
- Tombol aksi yang sedang berjalan disabled dan berlabel progres (`Menyimpan…`, `Mengunggah…`, `Mengirim…`).
- Double-submit dicegah.
- Mock persistence boleh memakai `localStorage`; versi key harus eksplisit agar fixture lama dapat direset.

### 2.4 Format dan validasi bersama

- Currency input menyimpan integer rupiah, tampilan `Rp` + grouping Indonesia; tolak negatif, desimal, NaN, dan nilai kosong untuk required.
- Persen menyimpan decimal numerik; rentang umum `>0` dan `<=100`; tampil dua digit bila input memilikinya.
- Tanggal menggunakan input native `type=date`; simpan ISO `YYYY-MM-DD`; tanggal akad/lahir tidak boleh masa depan.
- NIK: tepat 16 digit; jangan format dengan spasi; pesan `NIK harus terdiri dari 16 angka.`
- Email: validasi format dasar browser; telepon Indonesia: digit setelah normalisasi `+62/62/0`, minimum 9 maksimum 15 digit.
- Nama required minimum 3 karakter setelah trim.
- Tenor: integer 12–360 bulan kecuali pilihan produk fixture membatasi lebih sempit.
- Jatuh tempo: integer 1–31. Untuk bulan tanpa tanggal itu, copy reminder menjelaskan jatuh pada hari terakhir bulan.
- Upload: PDF/JPG/JPEG/PNG, maksimum 5 MB/file. Validasi sebelum request.
- Error field muncul setelah blur atau submit pertama; summary error di atas form setelah submit gagal dan fokus berpindah ke field invalid pertama.
- CTA primer disabled hanya bila prasyarat objektif belum terpenuhi atau request berjalan; jangan memakai disabled untuk menyembunyikan alasan—tampilkan helper/error.

### 2.5 Status global setiap page

Setiap screen data-backed wajib memiliki:

- **Loading:** skeleton dengan bentuk layout final, nav tetap operasional; jangan spinner fullscreen untuk perpindahan tab shell.
- **Error:** Alert `Data gagal dimuat.` + `Coba Lagi`; pertahankan shell dan data cache terakhir bila ada dengan label `Data mungkin belum terbaru`.
- **Empty:** penjelasan sebab + satu CTA relevan; tidak menampilkan tabel/kartu kosong.
- **Saving:** CTA disabled, aria-busy, label progres.
- **Success:** toast untuk save ringan; success page/card untuk submit, activation, dan destructive recovery.
- **Offline/mock failure:** `Koneksi bermasalah. Periksa koneksi lalu coba lagi.`; input tetap ada.

---

## 3. Route dan Page Inventory

### 3.1 Route table

| Route | Page | Guard/kondisi | Entry/exit utama |
|---|---|---|---|
| `/register` | Registrasi Akun | guest | → `/verify` |
| `/verify` | Verifikasi OTP | pending registration | → `/` |
| `/` | Home dinamis | authenticated | kartu produk/nav |
| `/apply/primary/:step` | Wizard Primary step 1–5 | auth, draft primary | → compare/submit |
| `/apply/primary/success` | Submit success | submitted primary | → `/my-kpr` |
| `/monitoring/intro` | Intro Pantau KPR | auth, no active mortgage | → setup |
| `/monitoring/setup/:step` | Setup mortgage step 1–6 | mortgage draft | → activation |
| `/monitoring/success` | Activation success | newly active mortgage | → `/` |
| `/optimize/intro` | Intro optimasi cold-entry | auth | → wizard |
| `/optimize/:step` | Optimasi step 1–7 | auth; draft takeover | compare/docs/submit |
| `/optimize/baseline` | Baseline KPR lama | valid steps 1–5 | → programs |
| `/optimize/programs` | Daftar program | calculation success | → detail |
| `/optimize/programs/:id` | Detail simulasi | known fixture id | save/apply |
| `/optimize/programs/:id/confirm` | Konfirmasi satu bank | selected program | → docs |
| `/optimize/success` | Submit success | submitted takeover | → tracker |
| `/my-kpr` | Resolver My KPR | auth | state-specific |
| `/my-kpr/application` | Tracker pengajuan | application exists | action/docs/cancel |
| `/my-kpr/overview` | Mortgage overview | active mortgage | tabs/edit |
| `/my-kpr/payment` | Payment | active mortgage | amortization/mark paid |
| `/my-kpr/amortization` | Amortisasi | active mortgage | back Payment |
| `/my-kpr/rate` | Rate | active mortgage | Explore |
| `/my-kpr/property` | Property | active mortgage | update value |
| `/my-kpr/health` | KPR Health detail | active mortgage | Explore |
| `/explore` | Explore dinamis | auth | education/optimization |
| `/activity` | Activity | auth | linked detail |
| `/profile` | Profile | auth | edit/settings/logout |
| `/profile/edit` | Edit profil | auth | save/back |
| `/profile/reminders` | Reminder preferences | active mortgage | save/back |
| `/education/:slug` | Artikel fixture | known slug | back |
| `*` | Not Found | all | Home |

### 3.2 Canonical redirects

- `/my-kpr` → fresh empty, draft checklist, tracker, rejected, atau `/my-kpr/overview` sesuai state.
- Akses `/apply/primary/:step` tanpa draft: kembali `/` + toast `Draft pengajuan tidak ditemukan.`
- Step di atas `currentStep` diarahkan ke step terakhir yang boleh diakses.
- User dengan mortgage aktif masuk `/monitoring/setup/*`: redirect `/my-kpr/overview`.
- Tanpa mortgage aktif masuk detail monitoring: `/my-kpr` empty state.
- Program id tidak ditemukan: inline not-found + `Kembali ke Daftar Program`.
- Setelah `disbursed`, tracker dialihkan ke mortgage aktif yang dibuat dari fixture final akad.

---

## 4. Navigasi dan Shell

### 4.1 Shell utama

Lima item selalu clickable: Home, My KPR, Explore, Activity, Profile.

- Desktop `>=1024px`: sidebar kiri tetap, header Command Center, content max-width 1200 px.
- Tablet `768–1023px`: sidebar ringkas atau top header + bottom nav mengikuti baseline tanpa mengubah urutan.
- Mobile `<768px`: bottom nav fixed; safe-area padding; label+ikon; content tidak tertutup nav.
- Active item memakai `aria-current="page"`, bukan warna saja.
- Badge Activity menampilkan jumlah unread maksimal `9+`; kosong jika 0.
- Wizard boleh menyembunyikan shell visual penuh agar fokus, tetapi menyediakan back link, progress, dan tombol keluar. Jika user keluar setelah perubahan belum tersimpan, tampilkan dialog.

### 4.2 Back behavior

- Back pada step: kembali ke step sebelumnya tanpa menyimpan perubahan step aktif; bila dirty, dialog `Keluar tanpa menyimpan perubahan?`.
- Browser back harus konsisten dengan UI back.
- Modal tidak menambah history kecuali Sheet/detail yang sengaja deep-link; Escape menutup modal non-blocking.
- Setelah mutasi destructive, history tidak boleh kembali ke resource yang sudah dihapus; gunakan replace navigation.

---

## 5. Authentication

### AUTH-01 Registrasi Akun — `/register`

**Tujuan:** membuat sesi mock; copy subtitle mengikuti produk bila route membawa `intent`, tanpa membuat draft sebelum verifikasi.

**Field**

| Field | Required | Aturan |
|---|---:|---|
| Nama lengkap | ya | trim, min 3 |
| WhatsApp atau email | ya | valid salah satu; deteksi tipe |
| Syarat & Ketentuan | ya | checkbox |
| Kebijakan Privasi | ya | checkbox terpisah |

**CTA:** `Daftar`; secondary `Sudah punya akun? Masuk` hanya jika mock login screen tersedia, selain itu jangan tampilkan tautan mati.

**State/flow:** default → validating → registering → OTP. API error inline umum; duplicate contact: `Kontak sudah terdaftar.` CTA tetap bisa dicoba setelah edit. Success navigate `/verify`, contact dimasking.

**Aksesibilitas/responsive:** checkbox memiliki label link yang bisa dibuka tanpa mengubah checkbox; form satu kolom; tombol 100% mobile; autofill `name`, `email`/`tel`.

**Acceptance:** submit invalid tidak memanggil API; sukses menyimpan pending contact, bukan application; tidak ada label step pengajuan.

### AUTH-02 Verifikasi Akun — `/verify`

- Enam input digit atau satu input dengan visual slots; paste 6 digit didukung; hanya angka.
- CTA `Verifikasi`; resend disabled dengan countdown lalu `Kirim Ulang`.
- State: default, verifying, wrong code, expired, resend loading/success/error.
- Wrong code mengosongkan slot dan fokus ke awal; expired menyediakan resend.
- Success membuat session authenticated dan meneruskan intent ke Home, bukan otomatis submit/create bank application.
- Screen reader mendapat satu label `Kode verifikasi 6 digit`; timer memakai live region sopan, bukan announce tiap detik.

---

## 6. Home

### HOME-01 Fresh — `/`

**Konten berurutan:** greeting; empat kartu produk; Cara Kerja; insight; entry monitoring.

**Kartu:**

1. `KPR Primary` — `Beli rumah baru atau rumah bekas.` → buat draft setelah konfirmasi bila tidak ada draft, lalu `/apply/primary/1`.
2. `Take Over` — `Pindahkan KPR kamu ke bank lain.` → `/optimize/intro`.
3. `Refinancing` — `Pindahkan KPR sekaligus ajukan dana tambahan.` → `/optimize/intro?mode=topup`.
4. `Multiguna` — tampil sebagai produk; bila flow belum tercakup implementasi ini, informational dialog `Flow Multiguna belum tersedia pada versi ini.` tanpa mengarahkan ke Primary.

Cara Kerja: `Pilih Produk → Isi Data → Bandingkan Program → Ajukan Online`; tanpa CTA; jangan gunakan `Ajukan Sekaligus`.

Monitoring card hanya satu CTA `Pantau KPR Saya` → `/monitoring/intro`; copy bahwa data tidak dikirim ke bank.

**Empty/error:** insight kosong menyembunyikan section; produk gagal dimuat menampilkan error section dan monitoring tetap tersedia. Loading memakai empat skeleton cards.

**Acceptance:** tepat empat produk; tidak ada secondary; satu application=satu program copy terlihat; semua card keyboard-operable; tidak ada tombol simulasi Take Over pada monitoring card.

### HOME-02 Application Draft

Hero produk diganti card resume: produk, `Step X dari N`, nama step, progress, `Terakhir disimpan`, CTA `Lanjutkan`, link `Batal & mulai produk lain`.

- Primary memakai 5 step; Optimization memakai 7 step.
- Link batal membuka destructive dialog; sukses hard-delete draft+dokumen mock lalu kembali fresh.
- Cara Kerja dan insight tetap tampil.
- Loading skeleton mempertahankan satu hero; stale `currentStep` fallback ke step 1 dan log warning.

### HOME-03 Mortgage Setup Draft

Card `Lanjutkan pengaturan KPR kamu`, Step X/6, progress, timestamp, `Lanjutkan Pengaturan`, `Hapus data`. Hapus hanya mortgage draft, bukan profile/application.

### HOME-04 Application In Process

Urutan:

1. Status Pengajuan + current stage stepper + estimasi waktu jika fixture menyediakan.
2. `Perlu Tindakan` hanya bila pendingActions non-empty; item membuka upload/action terkait.
3. Ringkasan read-only bank/program/plafon/cicilan estimasi; CTA `Hubungi CS` bila ingin ubah.
4. Insight.

Primary stages: Diajukan → Verifikasi → Proses Bank → Appraisal → Disetujui → Akad.  
Take Over stages menambah Pelunasan KPR Lama sebelum Akad/Selesai.

Tidak ada Next Payment atau Opportunity. Status tidak boleh dipalsukan dari progress lokal.

### HOME-05 Rejected

Headline penolakan, bank, alasan dari fixture, saran kontekstual, CTA `Ajukan ke Bank Lain` dan `Perbaiki & Ajukan Ulang`.

- Bank lain: clone data/dokumen valid ke application baru/draft step compare; aplikasi lama tetap history.
- Perbaiki: application sama kembali draft ke step relevan; dokumen penyebab `needs_update` wajib diganti.
- Loading CTA independent; kegagalan tidak mengubah rejected state.

### HOME-06 Monitoring Active Normal

Urutan tetap:

1. KPR Health: skor besar, label, satu kalimat, `Lihat penyebab`.
2. Pembayaran berikutnya: nominal, tanggal, countdown, `Lihat detail`.
3. Warning conditional—tidak dirender pada normal.
4. KPR Saya: sisa vs awal, progress, `Lihat perjalanan KPR`.
5. Peluang: copy netral, `Buka Explore`/`Bandingkan`.

Tidak ada chart. Jika score tidak dapat dihitung, ganti card partial + `Lengkapi Data`, jangan tampilkan skor palsu.

### HOME-07 Mendekati Floating

Trigger `0 < daysUntilFixedEnd <= 90`. Warning menjadi card pertama: hari tersisa, rate sekarang, **estimasi** floating, cicilan sekarang, estimasi sesudah, selisih. CTA `Lihat Pilihan` membuka tab Bunga. Opsi: `Tetap di bank sekarang` → konfirmasi, lalu card disembunyikan sampai milestone berikutnya (H-60/30/14/7); `Bandingkan Take Over` → langsung daftar program bank (simulasi default dari data KPR), atau halaman Simulasi Take Over bila data pengajuan belum lengkap.

Health, payment, mortgage, opportunity tetap di bawah. Threshold event H-90/60/30/14/7 tidak berarti card hanya muncul tepat hari itu; card terlihat sepanjang ≤90 hari.

### HOME-08 Sudah Floating

Jika current rate type floating atau fixedUntil sudah lewat dan fixture menandai periode floating aktif: hilangkan countdown; card `KPR kamu sekarang menggunakan bunga floating`; rate/cicilan saat ini dan perubahan dari fixed bila data ada; CTA Explore. Jangan menampilkan estimasi pada nilai aktual; next future floating tetap estimasi.

### HOME-09 Partial/Error

- Nilai properti tidak ada: card `Lengkapi nilai properti`; equity/LTV/top-up/multiguna unavailable; reminder tetap aktif.
- Rate/outstanding tidak lengkap: warning analisis/amortisasi unavailable + CTA edit section.
- Dashboard fetch error: satu error panel + retry; cache diberi stale label.

---

## 7. KPR Primary — Wizard 5 Step

Progress user-facing wajib:

1. Pilih Produk
2. Data Diri, Properti & Pinjaman
3. Upload Dokumen
4. Bandingkan Program Bank
5. Review & Submit

Autosave ketika `Simpan & Lanjutkan`; upload tersimpan per file. Step 1 membuat draft setelah user menekan CTA, bukan saat card sekadar fokus.

### PRI-01 Pilih Produk — `/apply/primary/1`

- Card tunggal `KPR Primary — rumah baru atau rumah bekas` terpilih.
- Field `Jenis pembelian`: `Rumah baru dari developer` / `Rumah bekas dari pemilik`.
- CTA `Lanjutkan`; back Home.
- Required radio. Ganti pilihan setelah data step 2 ada memunculkan dialog bahwa field khusus akan direset; shared fields dipertahankan.
- Acceptance: tidak ada Secondary; save menghasilkan `productType=primary` dan purchaseType.

### PRI-02 Data Diri, Properti & Pinjaman — `/apply/primary/2`

**Data pribadi**

| Field | Req | Validasi/conditional |
|---|---:|---|
| Nama sesuai KTP | ya | min 3 |
| NIK | ya | 16 digit |
| Tempat lahir | ya | min 2 |
| Tanggal lahir | ya | masa lalu; usia ditampilkan sebagai estimasi, tidak menjamin eligible |
| Jenis kelamin | ya | select/radio |
| Status perkawinan | ya | enum fixture |
| Alamat KTP | ya | min 10 |
| Nomor ponsel | ya | format telepon |
| Email | ya | email valid |

**Pekerjaan**

| Field | Req | Aturan |
|---|---:|---|
| Jenis pekerjaan | ya | karyawan/wiraswasta/profesional/lainnya |
| Nama perusahaan/usaha | ya | label dinamis |
| Jabatan/bidang usaha | ya | label dinamis |
| Lama bekerja/usaha | ya | tahun 0–60; bulan 0–11; total >0 |
| Penghasilan bulanan gross | ya | >0 |
| Gabungkan pendapatan pasangan | tidak | checkbox |
| Penghasilan pasangan | conditional | >0 bila checkbox aktif |
| Cicilan kendaraan | ya | >=0 |
| Kartu kredit/paylater | ya | >=0 |
| Pinjaman lain | ya | >=0 |

**Properti & pinjaman**

| Field | Req | Aturan |
|---|---:|---|
| Jenis pembelian | ya | prefilled Step 1, editable dengan reset confirmation |
| Nama developer | jika baru | min 2 |
| Nama penjual | tidak, jika bekas | sembunyi untuk baru |
| Jenis properti | ya | rumah tapak/apartemen/ruko/tanah/gudang sesuai fixture product; tidak menjamin eligible |
| Alamat properti | ya | min 10 |
| Kota/kabupaten | ya | fixture select/search |
| Harga properti | ya | >0 |
| Uang muka | ya | >=0 dan < harga |
| Jumlah pinjaman | ya | auto `harga-DP`, editable; >0 dan <= harga |
| Tenor | ya | 12–360 bulan |
| Dana cair/tabungan | tidak | >=0 |

**Computed inline:** estimasi DTI dan kemampuan cicilan. Bila melebihi threshold fixture, Alert warning tidak memblokir save kecuali loan amount tidak valid. Copy `Estimasi, bukan keputusan bank.`

**CTA:** `Simpan & Lanjutkan`; secondary `Kembali`.

**State:** conditional fields benar-benar unmount dan nilainya dihapus; API save error mempertahankan form; currency parse error inline; saving tidak dapat dipicu dua kali.

**Responsive/a11y:** section memakai heading/fieldset; dua kolom hanya field berpasangan desktop; mobile satu kolom; ringkasan sticky hanya desktop dan tidak menutupi CTA.

### PRI-03 Upload Dokumen — `/apply/primary/3`

Item minimum:

- KTP — required.
- NPWP — required sesuai fixture; bila kebijakan fixture menandai optional, UI mengikuti metadata.
- Slip Gaji/Bukti Penghasilan — required.
- Dokumen Properti — required; helper baru: `SPR/PPJB dari developer`; bekas: `AJB/sertifikat/dokumen penjual yang tersedia`.
- Dokumen Tambahan — optional.

Status item: pending, uploading(percent), uploaded, error, needs_update, verified. Aksi: Upload, Ganti, Hapus, Coba Lagi. File tersimpan segera saat upload sukses. Navigasi meninggalkan upload aktif memunculkan konfirmasi. Required uploaded diperlukan untuk lanjut; verified tidak diperlukan pada draft.

Error: type/size sebelum request; network error per item; file rejected mock menampilkan alasan. Jangan menampilkan preview data sensitif otomatis; hanya nama, ukuran, tipe.

### PRI-04 Bandingkan Program Bank — `/apply/primary/4`

**Loading:** 3 skeleton program cards. **Result card:** bank/program, fixed rate+period, estimasi floating, estimasi cicilan, tenor, biaya awal yang tersedia, label estimated eligibility, reason match, data updated date. **Sort:** cicilan terendah, biaya awal terendah, fixed terlama, total pembayaran. Filter hanya bila fixture mendukung; jangan membuat filter mati.

Satu radio/select per program. `Lihat Detail` membuka detail/Sheet dengan breakdown dan disclaimer. Selecting one does not submit. DTI warning remains visible. Recommendation label `Sesuai profil` bukan `Pasti disetujui`.

Empty: `Belum ada program yang cocok dengan data ini.` CTA `Ubah Data Pinjaman`; tampilkan edukasi tanpa membuat program fiktif. Product unavailable: retry. Stale product: warning tanggal data dan konfirmasi sebelum lanjut. Calculation error: `Simulasi belum dapat dihitung` + `Periksa Data`.

CTA `Pilih Program & Lanjutkan` disabled sampai satu program dipilih. Acceptance: hanya satu selectedBankProductId.

### PRI-05 Review & Submit — `/apply/primary/5`

Section read-only dengan `Edit`: pribadi/pekerjaan; properti+pinjaman; program bank; dokumen. Editing kembali ke step terkait dan tidak menghapus pilihan kecuali perubahan memengaruhi hasil; bila data finansial/pinjaman berubah, selected program direset dan user wajib compare ulang.

Consent terpisah:

- data benar;
- setuju data dikirim ke bank yang disebut untuk pengajuan ini;
- setuju terms/privacy bila belum direkam.

CTA `Submit Pengajuan`; disabled sampai semua required valid, dokumen uploaded, program dipilih, consent checked. Copy `Pengajuan ini hanya dikirim ke satu bank/program.`

Submit success → status submitted, form read-only, route success. Error mempertahankan consent kecuali API menyatakan session expired; session expired meminta login tanpa membuang draft.

### PRI-06 Submit Success

Headline `Pengajuan berhasil dikirim`; application ID; bank/program; next expected stage; CTA `Pantau Pengajuan`. Jangan menjanjikan durasi bila tidak ada fixture. Back tidak kembali ke editable review.

### PRI-07 Tracker Primary

Status stepper dengan timestamp: Diajukan, Verifikasi, Proses Bank, Appraisal, Disetujui, Akad. Dokumen checklist; pending action; program read-only. CTA `Hubungi CS`, `Batalkan Pengajuan` sesuai policy fixture. Setelah submit tidak ada edit umum; hanya upload replacement untuk `needs_update`.

Cancel membuka dialog yang menjelaskan konsekuensi. Untuk mock MVP ikuti requirement hard-delete, tetapi tampilkan catatan implementasi di source bahwa retention produksi perlu keputusan compliance. Sukses replace route Home.

### PRI-08 Rejected Recovery

Sesuai HOME-05. `Ajukan ke Bank Lain` membawa clone ke step 4; `Perbaiki` ke step 2/3 sesuai reason code. Reason tidak dikenal → step 2 dan Alert umum. Aplikasi lama muncul di Activity.

---

## 8. Setup Monitoring, Reminder, dan Mortgage Aktif

Wizard tepat 6 step; draft `mortgage.status=draft`; tidak membuat application.

### MON-00 Intro — `/monitoring/intro`

Benefits: reminder pembayaran, warning fixed, progres/sisa KPR, amortisasi, simulasi. Copy wajib: `Data yang kamu masukkan tidak akan dikirim ke bank sampai kamu memilih “Ajukan Sekarang”.` CTA `Mulai Tambahkan KPR`; back. Klik CTA membuat mortgage draft step 1; failure tetap di intro.

### MON-01 Data KPR — step 1/6

| Field | Req | Aturan |
|---|---:|---|
| Bank | ya | fixture list + `Bank lainnya` text conditional |
| Nama produk | tidak | max 100 |
| Jenis KPR | ya | konvensional/syariah; perhitungan mock MVP harus menjelaskan bila hanya anuitas konvensional didukung |
| Pinjaman awal | ya | >0 |
| Cicilan saat ini | ya | >0 |
| Tenor awal | ya | 12–360 |
| Tanggal akad | ya | tidak masa depan |
| Jatuh tempo | ya | 1–31 |
| Tahu sisa pokok? | ya | ya/tidak |
| Sisa pokok | jika ya | >0, <= pinjaman awal |
| Sisa tenor | jika ya | 1..tenor awal dan konsisten secara wajar; warning bukan blok untuk selisih kalender |

CTA `Simpan & Lanjutkan`; save step 1.

### MON-02 Bunga & Cicilan — step 2/6

Pertanyaan wajib `Apakah cicilan kamu pernah naik atau berubah sejak akad?`

**Belum pernah berubah:** rate saat ini >0; jenis fixed/floating; fixed until required untuk fixed dan setelah tanggal akad; estimasi floating optional >0. Jika outstanding unknown, CTA `Hitung Kondisi KPR` menjalankan solve-for-rate mock; loading scoped. Hasil menampilkan estimasi effective rate/outstanding/remaining tenor, disclaimer, `Gunakan Estimasi` atau `Saya Punya Angka Resmi`.

**Pernah berubah:** wajib sisa pokok resmi, cicilan, rate saat ini, type, sisa tenor; fixedUntil hanya fixed. Dilarang menjalankan solve-for-rate. Copy menjelaskan gunakan angka bank.

**Rate periods optional:** tambah/ubah/hapus period; rate >0; start/end valid; urut; tidak overlap; next start setelah previous end; floating future berlabel estimasi. Skip diperbolehkan dengan current+next period.

Calculation failure tidak merusak input; CTA `Periksa Data` fokus ke invalid source.

### MON-03 Properti — step 3/6

Field: property type; address; city; land/building area (>0 sesuai type; land optional untuk apartment); certificate status; owner; current estimated value optional; valuation date required bila value ada dan tidak masa depan; dispute yes/no.

`Isi nilai properti nanti` membuka confirm: equity/LTV/Top-up/Multiguna belum lengkap; reminder tetap bisa. Dispute yes memberi warning manual review namun tidak memblokir monitoring. Disclaimer bukan appraisal resmi.

### MON-04 Kondisi Keuangan — step 4/6

Income >0; joint-income toggle + spouse income; mortgage payment prefilled editable through explicit `Ubah`; vehicle/card/other >=0; regular expense and emergency fund optional >=0. Inline total installment, DTI, status; disclaimer bukan keputusan bank. Jika angka mortgage diubah, sinkronkan source mortgage setelah konfirmasi karena memengaruhi amortisasi.

### MON-05 Reminder — step 5/6

Default payment H-7/H-3/H-1 selected; Hari-H optional. Fixed expiry H-90/H-60/H-30/H-14/H-7 selected jika masih fixed. Channels In-app dan Email selected; WhatsApp disabled `Segera hadir`.

- Minimal satu payment offset dan satu channel required.
- Jika sudah floating, fixed reminder section diganti info dan values dikosongkan.
- Jika browser notification permission denied, in-app tetap berarti Activity inbox; jangan meminta browser permission secara otomatis. Alert email remains active.
- Due-day preview memperhitungkan akhir bulan.

### MON-06 Review & Activate — step 6/6

Read-only sections KPR, rate, property, finance, reminder dengan Edit. Checkbox data benar. CTA `Aktifkan Pemantauan KPR`. Sukses mengubah draft→active, tidak membuat application; success page `Pemantauan KPR aktif` + `Reminder pertama sudah dijadwalkan` hanya jika fixture berhasil menjadwalkan; CTA Dashboard.

Activation error mempertahankan draft dan checkbox. Missing optional property value ditandai `Belum diisi`, tidak memblokir.

---

## 9. My KPR dan Monitoring Detail

### MYKPR-00 Resolver/Empty/Draft

- Fresh: icon, `Belum ada KPR atau pengajuan`, CTA `Mulai Pengajuan` → Home dan `Pantau KPR Saya` bila relevan.
- Application draft: checklist 5/7 steps, last edited, CTA continue/delete.
- Mortgage setup draft: checklist 6 steps, continue/delete.
- In process/rejected: tracker.
- Active: redirect Overview.

### MYKPR-01 Overview — `/my-kpr/overview`

Header bank+product; sisa pokok hero; pinjaman awal, cicilan, sisa tenor; progress pokok; timeline mulai/hari ini/estimasi lunas; CTA `Edit Data KPR` membuka section editor.

Edit rules: perubahan outstanding/rate/tenor meminta confirmation `Proyeksi pembayaran dan Health akan dihitung ulang.` Save async; success refetch summary. Empty/partial fields display `Belum diisi` and CTA section. Nilai estimasi diberi label.

Local tabs: Overview, Payment, Rate, Property. Mobile horizontally scrollable with selected tab kept visible; keyboard roving tab semantics.

### MYKPR-02 Payment — `/my-kpr/payment`

Next payment amount/date/countdown; principal/interest month if calculable; CTA `Lihat Jadwal Amortisasi`; monthly payment history with status paid/upcoming/late/manual. CTA `Tandai Pembayaran` opens dialog date+amount, both required positive/date valid; explicit copy status manual and not synced with bank.

Empty history still shows next payment and `Belum ada pembayaran yang ditandai`. Error history isolated from summary. Success adds Activity event and toast.

### MYKPR-03 Amortization — `/my-kpr/amortization`

**Eligibility:** active mortgage + complete outstanding, remaining tenor, valid ratePeriods.

**Summary:** period, remaining tenor, method Anuitas, opening outstanding, estimated total interest, total payment, ending balance, rate assumptions, annual stacked composition chart. Chart must include accessible tabular/text alternative.

**Schedule controls:** Bulanan/Tahunan toggle; mobile default Tahunan, desktop may default Bulanan; year filter only monthly; source label `KPR aktif · sisa pokok`.

**Columns monthly:** Tanggal Angsuran, Bunga Tahunan, Saldo Awal, Cicilan, Pokok, Bunga, Sisa Pokok. Annual aggregates preserve opening/ending balance and sum payment/principal/interest. Mark fixed→floating transition row/year; floating label `estimasi`.

**Financial invariants:** principal sum equals opening outstanding within Rp1 rounding tolerance; ending balance 0; total payment=principal+interest; final installment adjusts rounding; invalid/negative amortization produces calculation error, never a fabricated table.

**States:** calculation skeleton; partial data CTA `Lengkapi Data Bunga`; calculation error with source fields; zero rows error; filter empty impossible if valid schedule—fallback `Tidak ada jadwal pada tahun ini`.

**Responsive:** full 7-column table desktop; mobile annual cards/table; monthly uses horizontal scroll with sticky first date column or expandable rows—never compress unreadably. Toggle and filter accessible labels. Disclaimer exact: `Proyeksi berdasarkan data KPR yang kamu masukkan. Bunga floating dan pembayaran aktual dapat berubah mengikuti kebijakan bank.`

**Acceptance:** no stored row assumption; transition marked; totals reconcile; mobile usable at 320 px.

### MYKPR-04 Rate — `/my-kpr/rate`

Current rate/type; fixed end+countdown if applicable; next estimated floating; period timeline; impact current→estimated payment; CTA `Bandingkan Pilihan` → Explore. Missing future rate displays `Estimasi floating belum diisi` + Edit. Already floating hides fixed countdown. Rate history dates/rates available as semantic list, not visual-only timeline.

### MYKPR-05 Property — `/my-kpr/property`

Address/type/LT/LB/certificate; current estimated value; outstanding; estimated equity; LTV; valuation date; `Perbarui Nilai`. Dialog field value >0 and date valid. Disclaimer: value not appraisal; equity not automatically cash. Missing value displays partial CTA, no zero equity.

### MYKPR-06 Health — `/my-kpr/health`

Score, status, breakdown Beban Cicilan, Nilai Properti, Risiko Bunga, Progres Pinjaman; each score, evidence, and progress. Recommendations as bullets; CTA Explore when actionable. Missing component shows `Belum dapat dihitung`, overall score only shown if rule fixture permits partial score; never substitute zero. Disclaimer `KPR Health bukan skor kredit dan tidak menentukan persetujuan bank.`

---

## 10. Take Over + Top-up Terpadu

### 10.1 Entry modes

- **Cold entry Home:** full 7-step flow.
- **Explore with active mortgage:** skip profile/KPR/property/finance data entry; call simulation with existing mortgage; land on Baseline/Programs. `Ajukan Sekarang` creates application prefilled, selected mode/program, then routes documents/review. Never ask six old-mortgage questions again.
- `mode=takeover`: requestedTopup=0.
- `mode=topup`: requestedTopup>0 and top-up fields shown.

### OPT-00 Intro

Explain requirements, 10–15 minute estimate, resumable, data not sent before explicit submit. For Top-up mention funds are estimated and subject to appraisal/eligibility. CTA `Mulai`; creates draft only on success.

### OPT-01 Profil & Pekerjaan — step 1/7

Reuse Primary personal/employment fields and validators. Existing profile is prefilled; show `Data dari profil kamu` and editable. Application captures mock snapshot on submit. No duplicate request if data valid.

### OPT-02 KPR Lama — step 2/7

Fields: origin bank, optional product, original principal/payment/tenor/agreement date/due day, changed-payment question, current outstanding if known, remaining tenor, current rate/type, fixedUntil if fixed, early repayment penalty optional.

Branch:

- Never changed: estimation allowed only if necessary; input principal+payment+tenor+elapsed months; result effective rate/outstanding/remaining tenor; confirm estimate or official data.
- Changed: outstanding/current rate/remaining tenor required; no solve-for-rate.
- Empty penalty may use bank policy fixture and must show `estimasi`; unavailable policy shows `Belum diketahui`, not 0.

### OPT-03 Mode & Goal — step 3/7

Radio:

- `Pindah KPR tanpa dana tambahan` → requestedTopup=0.
- `Pindah KPR + dana tambahan` → required amount >0; purpose enum Renovasi/Pendidikan/Modal Usaha/Konsolidasi Utang/Kebutuhan Lain; custom purpose required for Lain; desired tenor; comfortable max installment optional.

Goal single-select: installment lighter, longer fixed, shorter tenor, smaller total interest. Goal sorts results only. Switching topup→takeover clears amount/purpose after confirmation.

### OPT-04 Properti — step 4/7

Reuse monitoring property fields; estimated current value required for Top-up calculations, optional with warning for Take Over matching; dispute warns manual review. Value labeled estimate, not appraisal.

### OPT-05 Kemampuan Bayar — step 5/7

Income prefilled, joint income, current mortgage payment, vehicle/card/other debt, available funds for moving cost. Show obligations and estimated DTI. Policy varies per bank. For Top-up show estimated maximum gross/net:

```text
maxCollateralLoan = estimatedValue * bankMaxLtv
maxGrossTopup = maxCollateralLoan - oldOutstanding
maxNetTopup = maxGrossTopup - deductedCosts
```

If inputs/product LTV unavailable, do not calculate. All outputs `estimasi`. CTA `Lihat Kondisi KPR`.

### OPT-06 Baseline — `/optimize/baseline`

Always before alternatives. Show old bank, outstanding, current rate/payment/remaining tenor; exit fees: penalty, document admin, total; unknown values explicit. CTA `Bandingkan Program`. Calculation/loading/error scoped; back step 5.

### OPT-07 Program List — `/optimize/programs`

Sort: total cost, installment, fixed length, tenor. Cards Take Over show program, fixed/floating estimate, new payment, difference, move cost, break-even, estimated eligibility, goal match. Top-up cards additionally: new principal, old payoff, costs, net funds, requested amount, met/gap, LTV, installment.

Top-up recommendation order: estimated eligible; net funds meets need; payment within comfort; reasonable move cost; total payment; fixed preference. Do not sort only by largest funds.

No-match: show why categories if supplied; CTA adjust values; no fabricated options. Stale/unavailable states same Primary. Selecting opens detail; no submit.

### OPT-08 Program Detail Simulation

Comparison current vs selected; all cost items (old penalty, provision, admin, appraisal, notary, insurance) with unknown/estimate labels; total; payment difference; break-even; estimated net saving. Tenor control has native numeric/select alternative to slider; changes recalculate asynchronously/debounced and show local skeleton.

If monthly benefit <=0, show `Tidak ada break-even dari penghematan cicilan bulanan` and never positive month. Top-up breakdown: new principal, payoff, gross top-up, deducted fees, net received, new LTV/payment. Changes update all dependent values.

CTA `Selesai Simulasi` (or `Simpan Simulasi` with explanation no history) returns Explore without application for active-mortgage simulation; `Ajukan [Bank]` proceeds confirmation and creates/updates draft only then. Calculation error keeps last valid values marked stale and disables apply until recalculated.

### OPT-09 One-bank Confirmation

Bank/program, fixed/rate, principal, tenor, estimated installment/cost. Copy `Pengajuan ini hanya dikirim ke satu bank/program.` CTA `Kembali`, `Lanjut Dokumen`. Explicit confirm sets selectedBankProductId.

### OPT-10 Documents — step 6/7

Groups:

- Identity/financial: KTP, KK, NPWP, marriage book conditional, income proof, bank statement.
- Old KPR: old agreement, outstanding letter, latest payment evidence, payoff/penalty info optional per metadata.
- Property: certificate, PBG/IMB, latest PBB, PPJB/AJB conditional.

Same upload state contract as Primary. Bank requests render in `Permintaan Bank` section. Required metadata determines continue; no hard-coded claim all banks require identical documents.

### OPT-11 Review & Submit — step 7/7

Read-only profile, old KPR, property, mode/top-up, new program, docs. Consents data correctness and named-bank transfer. Submit disabled until valid. On success all fields read-only, route success/tracker.

### OPT-12 Tracker, Settlement, Completion

Stages: Diajukan → Verifikasi Dokumen → Proses Bank → Appraisal → Disetujui → Pelunasan KPR Lama → Akad KPR Baru → Selesai.

- Pending document opens in-place re-upload.
- Settlement page warning: keep paying old bank until official payoff confirmation; show collateral document status and CS CTA.
- Completion: application completed; old mortgage replaced/closed; new mortgage active from final contract fixture; monitoring uses final, not simulation values.
- Approved but not settled remains application, not new active mortgage.

### OPT-13 Rejected/Cancel

Same two recovery actions as Primary. Bank other → cloned draft at program comparison with valid documents. Repair → reason-mapped step; Top-up DTI can map to mode/goal or finance. Cancel confirmation explicit permanent mock deletion. Failures keep current state.

---

## 11. Explore

### EXP-01 Tanpa Mortgage Aktif

Render education only plus note `Take Over, Refinancing, dan Multiguna aktif setelah KPR disetujui dan akad.` Do not render disabled product cards. Article cards need title, teaser, reading-time optional, route. Empty articles shows neutral empty, not product cards.

### EXP-02 Dengan Mortgage Aktif

Cards: Take Over, Refinancing + Top-up, Multiguna. Take Over order/badge:

- floating signal only: first + `Fixed rate berakhir N hari lagi`.
- opportunity only: `N program lebih murah ditemukan` from mock engine.
- both: one badge prioritizing floating then opportunity.
- neither: default order/no badge.

Refinancing/Multiguna no conditional badge. Take Over/Top-up route simulation using existing mortgage and skip duplicate wizard. Multiguna informational state until full flow is approved; do not route into takeover under a false label.

Loading signals must not reorder cards repeatedly: use skeleton list until both resolved. Engine error renders default order and small `Peluang belum dapat diperbarui`, cards remain usable for user-initiated simulation.

---

## 12. Activity

### ACT-01 List — `/activity`

Tabs/filter `Semua`, `Pengajuan`, `Pembayaran`, `Reminder` only if each has content or keep all with counts consistently. Group by Hari ini/Kemarin/date. Event types: status application, document request, reminder scheduled/sent/failed, fixed warning, payment marked, mortgage activation, rejection/completion.

Each row: icon, title, description, timestamp, unread indicator, optional CTA/deep-link. Selecting marks read only after successful mock call or optimistic rollback on error. `Tandai semua dibaca` only when unread >0.

Loading skeleton; empty `Belum ada aktivitas`; pagination/load-more if fixture count exceeds page size; retry preserving existing list. Activity is history, not reminder settings. Screen readers announce unread text, not dot only.

---

## 13. Profile

### PRO-01 Profile — `/profile`

Sections: identity summary; contact; personal/employment summary; Documents summary (if feature exposed, read-only statuses only); Reminder Settings only with active mortgage; privacy/legal links; logout.

CTA `Edit Profil`, `Ubah Pengaturan` reminders. Sensitive NIK masked except edit screen; documents never previewed. Logout dialog warns unsaved drafts remain saved, then clears session only, not mock data.

Empty profile uses `Lengkapi Profil`; load error isolated per section where possible.

### PRO-02 Edit Profile

Reuse shared profile fields/validation. Changing data used by submitted application does not mutate submitted snapshot; show note. Save success toast+back. Dirty navigation dialog. Contact change requiring OTP is not implemented unless mock supports it; otherwise contact read-only with helper, do not pretend update works.

### PRO-03 Reminder Preferences

Reuse MON-05 controls. Active mortgage required. Save async; permission-denied alert; WhatsApp disabled. Success updates Profile summary and Activity event only if mock returns it. Error preserves toggles.

---

## 14. Shared Dialogs and System Screens

### Delete draft

Title specific (`Hapus draft pengajuan?` / `Hapus data KPR?`); body names deleted data/documents; cancel autofocus; destructive button `Ya, Hapus`; pending prevents close; error inline.

### Cancel application

Explain current process and permanent mock deletion. Do not use ambiguous `OK`. Submitted retention remains product/compliance decision before production.

### Unsaved changes

`Perubahan belum disimpan.` buttons `Tetap di Halaman` and `Keluar Tanpa Menyimpan`.

### Not Found

`Halaman tidak ditemukan`, Home CTA. Shell shown if authenticated.

### Session expired

Dialog `Sesi berakhir`; CTA login/register route; preserve serializable unsaved form locally where safe; never persist raw file contents.

---

## 15. Accessibility Contract

- Target WCAG 2.1 AA basics; color contrast AA for text/control/status.
- Semantic landmarks: header/nav/main; one h1/page; hierarchical headings.
- Hit target minimum 44×44 CSS px.
- Every input has visible label, programmatic description/error via `aria-describedby`, required indication text and semantics.
- Errors not color-only; warning/status always icon/text.
- Focus visible; after route change focus h1; after modal close return trigger; after submit errors focus summary/first invalid; toast not steal focus.
- Dialog traps focus, Escape closes except destructive request currently running.
- Stepper exposes current step (`aria-current=step`) and completed labels.
- Tabs implement keyboard arrows/Home/End or use shadcn Radix behavior.
- Currency prefix is decorative or part of accessible name, not duplicated.
- Charts have text/table equivalents; progress bars expose value/min/max and contextual label.
- Tables have caption/headers; mobile card version preserves labels.
- Loading skeleton `aria-hidden`; container `aria-busy=true`; final content announced politely once.
- Countdown text is calculated on load/day change; no noisy per-second announcement except OTP timer visually.
- File input keyboard-operable; dropzone is enhancement, not only method.
- Disabled controls include nearby reason.
- Respect `prefers-reduced-motion`; no essential info dependent on animation.

---

## 16. Responsive Contract

### Mobile 320–767

- One-column forms/cards; 16 px page gutter (or approved token).
- Bottom nav fixed; add content bottom padding.
- Primary CTA full-width; paired destructive/secondary actions stack with safe order.
- Wizard progress compact text + bar; step names wrap.
- No horizontal page scroll except explicit amortization/table container.
- Dialog becomes bottom sheet only if baseline component supports semantics; otherwise centered dialog with viewport-safe scroll.
- Currency inputs numeric keyboard hint (`inputMode=numeric`).

### Tablet 768–1023

- One/two columns based on semantic pairing; no arbitrary equal-card grid for warning dashboard.
- Tables may scroll; navigation remains consistent.

### Desktop >=1024

- Sidebar + header; content max 1200 px.
- Forms max readable width; optional summary rail sticky.
- Warning spans main width; supporting cards may form grid below.
- Full amortization 7 columns.

At 200% zoom, no loss of CTA/content and no overlapping fixed nav.

---

## 17. Calculation and Display Rules

- Keep raw numeric values separate from formatted strings.
- Do not parse rendered currency back into calculations.
- Financial calculations use integer rupiah where practical; rate calculation retains sufficient decimal precision; round only display/final installment.
- Dates use local calendar semantics. Product timezone is Asia/Jakarta; mock timestamps display WIB and absolute date where ambiguity matters.
- `daysUntilFixedEnd` compares local calendar dates, not milliseconds/24h susceptible to DST/time offsets.
- Break-even only when monthly benefit >0 and all move costs known/estimated. Unknown costs make break-even `Belum dapat dihitung`.
- Net saving labels horizon/tenor assumption.
- DTI = total monthly obligations / income; zero/missing income produces unavailable, not Infinity.
- Equity = property estimate - outstanding; negative equity shown honestly with warning.
- LTV = outstanding/property estimate; missing/zero property unavailable.
- Progress principal = `(initial-outstanding)/initial`, clamp visual 0–100 but log/flag inconsistent source.
- Floating rate before actual period always `estimasi`.
- `eligible` is always `Estimasi sesuai/tidak sesuai profil`, never approval.

---

## 18. Per-Screen State Matrix Ringkas

| Screen group | Loading | Empty/partial | Error | Success |
|---|---|---|---|---|
| Auth | button/OTP slots | n/a | field/general | redirect |
| Home | card skeleton | fresh/partial cards | retry + stale cache | state-derived render |
| Wizard | initial form skeleton; saving CTA | conditional helper | retain values | next step + saved time |
| Upload | row progress | pending rows | retry per file | uploaded status |
| Bank list | card skeleton | no match + edit | retry/product stale | one selection |
| Review | section skeleton | block with linked missing section | retain consent/data | success page |
| Tracker | stepper skeleton | no pending action hides card | retry | current status |
| Monitoring | card skeleton | partial data CTA | cached stale + retry | active dashboard |
| Amortization | chart/table skeleton | incomplete inputs | calculation error | reconciled schedule |
| Explore | cards/signal skeleton | education-only | default order + notice | simulation route |
| Activity | list skeleton | no activities | retry existing | mark-read |
| Profile | section skeleton | complete profile CTA | section retry | toast/back |

---

## 19. Acceptance Criteria End-to-End

### 19.1 Global

- [ ] Vite React JavaScript; tidak menambahkan TypeScript requirement.
- [ ] shadcn/ui reused; tidak menambah dependency tanpa kebutuhan terbukti.
- [ ] Visual tokens approved dipertahankan.
- [ ] Semua data async melalui mock API dan memiliki loading/error.
- [ ] Semua form memvalidasi trust boundary di frontend dan mempertahankan input saat error.
- [ ] Route guards dan canonical redirects bekerja.
- [ ] Lima nav selalu clickable; konten mengikuti state.
- [ ] Tidak ada string/id/route Secondary.
- [ ] Tidak ada klaim backend/provider/integrasi nyata.
- [ ] Tidak ada multi-bank submission atau AI recommendation.
- [ ] Keyboard-only dan screen-reader basics lolos pada journey utama.
- [ ] Mobile 320 px dan desktop 1440 px tidak memiliki overlap/overflow tak disengaja.

### 19.2 Primary

- [ ] Fresh Home menampilkan tepat empat product cards.
- [ ] Primary mencakup rumah baru+bekas dalam satu flow.
- [ ] Progress visible konsisten 1/5–5/5.
- [ ] Developer hanya rumah baru; seller optional hanya bekas.
- [ ] Dokumen properti copy dinamis.
- [ ] Autosave hanya Continue; file per upload.
- [ ] Compare menangani loading/no-match/stale/calculation error.
- [ ] Tepat satu bank/program dipilih.
- [ ] Review mengharuskan dokumen, program, consent.
- [ ] Post-submit read-only; tracker sesuai status.
- [ ] Rejected kedua recovery path bekerja dan history lama tetap ada.

### 19.3 Monitoring/reminder/amortisasi

- [ ] Pantau KPR membuat mortgage draft, bukan application.
- [ ] Wizard tepat 6 step dan resume/hapus bekerja.
- [ ] Solve-for-rate hanya bila payment belum pernah berubah.
- [ ] Rate periods tidak overlap dan mendukung fixed→fixed→floating.
- [ ] Reminder default benar; WhatsApp disabled Segera hadir.
- [ ] Activation menghasilkan active mortgage.
- [ ] Home normal hanya 5-card model dan tanpa chart.
- [ ] H-90 warning prioritas; already-floating tanpa countdown.
- [ ] My KPR tabs Overview/Payment/Rate/Property.
- [ ] Pembayaran manual tidak diklaim sync bank.
- [ ] Amortisasi ada di Payment, bukan nav utama.
- [ ] Mobile default annual; desktop full table; transition floating marked estimate.
- [ ] Total amortisasi reconcile dan error tidak menghasilkan jadwal palsu.
- [ ] Property/equity/health disclaimers terlihat.

### 19.4 Take Over + Top-up

- [ ] Cold entry menyelesaikan 7 step sampai submit.
- [ ] Existing mortgage melewati input ulang dan langsung simulation path.
- [ ] Take Over/top-up memakai flow engine yang sama.
- [ ] `requestedTopup=0` dan `>0` mengendalikan cabang dengan benar.
- [ ] Changed-payment branch mewajibkan outstanding resmi dan melarang solve-for-rate.
- [ ] Baseline lama tampil sebelum alternatives.
- [ ] Semua biaya tersedia ditampilkan dan unknown tidak menjadi 0.
- [ ] Break-even positif tidak tampil bila monthly benefit <=0.
- [ ] Top-up menampilkan max loan/gross/net funds/gap/new LTV sebagai estimasi.
- [ ] Simulasi selesai tidak membuat application.
- [ ] Ajukan membuat satu application untuk bank terpilih.
- [ ] Dokumen Take Over berbeda dari Primary.
- [ ] Tracker memiliki stage Pelunasan KPR Lama dan warning tetap membayar bank lama.
- [ ] Completion memakai data akad final, bukan simulasi.

### 19.5 Explore/Activity/Profile

- [ ] Explore tanpa mortgage menyembunyikan product cards, bukan disable.
- [ ] Explore aktif mengurutkan/badge Take Over dari dua sinyal independen.
- [ ] Engine signal error tidak memblokir simulasi manual.
- [ ] Activity mendukung empty/loading/error/read/unread/deep-link.
- [ ] Settings reminder tidak diedit di Activity.
- [ ] Profile memasking data sensitif dan submitted snapshot tidak berubah saat profile diedit.
- [ ] Logout tidak menghapus saved drafts.

---

## 20. Test Scenarios Minimum untuk Claude Code

Implementasi dianggap siap review setelah automated/component/E2E checks minimum berikut lulus (gunakan test tooling yang sudah ada; jangan menambah framework bila repository sudah memiliki satu):

1. Register invalid → no API; valid → OTP; wrong/expired/resend/success.
2. Fresh Home exactly four products and no `secondary` text in rendered app.
3. Primary new house and used house branches; conditional values cleared safely.
4. Primary upload invalid type/size, retry, required gating.
5. Primary no bank match, select one program, review consent, submit, tracker.
6. Draft reload resumes correct 5-step/7-step route; delete replaces history.
7. Rejected clone vs repair produce distinct state behavior.
8. Monitoring unknown outstanding + never changed produces estimation confirmation.
9. Monitoring changed payment never calls solve-for-rate.
10. Rate period overlap blocks continue.
11. Reminder defaults, already-floating branch, WhatsApp disabled.
12. Monitoring activation creates mortgage and no application.
13. Home normal/H-90/floating/partial fixtures render correct hierarchy.
14. Payment manual mark; Activity event; no bank-sync claim.
15. Amortization monthly/annual totals reconcile; last balance zero; transition label; partial/error states.
16. Explore no mortgage education only; active signals reorder/badge correctly.
17. Existing-mortgage Take Over skips duplicate wizard.
18. Cold Take Over and Top-up branches; requestedTopup invariant.
19. Benefit <=0 has no positive break-even.
20. Top-up met and gap cards calculate/display dependent fields.
21. Simulation exit creates no application; Apply creates one selected bank draft.
22. Settlement warning and completed mortgage transition.
23. Keyboard route through nav, modal, tabs, file input, review submit.
24. Mobile viewport 320×568 and desktop 1440×900 smoke journeys without clipped CTA.
25. Mock API failure at save/upload/submit preserves entered values and permits retry.

---

## 21. Implementation Notes (Binding)

- Prefer route/config data arrays for step labels and status stages; do not duplicate visible progress strings in multiple pages.
- Use one shared money/date/percent formatter and one shared upload row.
- Reuse shared profile/property/financial field groups where behavior truly identical; product-specific requirements remain explicit metadata, not one giant condition-heavy universal form.
- Native date input and semantic form controls preferred.
- Keep calculation functions pure and separately runnable/testable. UI should consume result/error objects, not contain formulas inline.
- Persist only serializable mock metadata. Browser cannot reliably persist File objects; mock uploaded docs persist name/type/size/status, never fake binary storage.
- Never show backend field names, stack traces, raw exception, or mock controls in user UI.
- Unknown data displays `Belum tersedia`/`Belum diketahui`, not `0`.
- Any number based on non-final rate/value/product fee uses `Estimasi` in the same visual context.
- One deliberate MVP ceiling: one active draft and one active mortgage. Do not scaffold multi-entity switchers until required.
