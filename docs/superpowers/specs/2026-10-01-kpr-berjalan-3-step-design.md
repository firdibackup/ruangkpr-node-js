# Setup "KPR Berjalan" 3 Step: Reminder Floating untuk Pemula

Tanggal: 2026-10-01 · Mengikuti pola 3 tahap Primary dan Take Over (`2026-10-01-primary-wizard-3-tahap-design.md`, `2026-10-01-takeover-wizard-3-tahap-design.md`).

## Tujuan

Setup pemantauan KPR yang sudah berjalan (`/monitoring/setup/*`) jadi **alat pasang reminder**, terutama reminder sebelum bunga fixed berubah ke floating. Isinya 3 step singkat yang bisa diselesaikan pemula tanpa dokumen bank.

Kriteria sukses:

- Setup selesai dengan **5 data wajib**: bank, cicilan per bulan, tanggal jatuh tempo, jenis bunga (fixed / floating / belum tahu), dan tanggal fixed berakhir (hanya untuk fixed). Ada **3 data opsional** untuk perkiraan cicilan setelah floating.
- Tidak ada pertanyaan yang dijawab di satu step lalu diminta lagi di step lain. Setiap data hanya punya satu tempat isian.
- Fitur lain (KPR Health, amortisasi, LTV/top-up, simulasi Take Over dari KPR) tetap ada. Fitur yang datanya belum lengkap menampilkan ajakan "Lengkapi" yang mengarah ke satu tempat isian.
- KPR aktif dan draft yang sudah tersimpan tetap terbaca tanpa migrasi schema.

## Keputusan yang sudah disepakati

- 3 step: **KPR kamu**, **Bunga**, **Reminder**. Persen 10 → 45 → 75, dan 100% setelah aktif. Label `Bagian {n} dari 3 · {nama}`.
- Data lain bersifat **opsional dan dilengkapi nanti** di My KPR atau Profil, tepat saat fitur yang membutuhkannya dibuka. Fitur tidak dihapus.
- Perkiraan "cicilan setelah fixed" berupa bagian **opsional di step 2**, dengan hasil yang langsung tampil.
- **Sisa pinjaman tidak pernah ditanyakan di setup.** Nilainya dihitung dari cicilan, bunga, dan sisa tenor.

## 1. Tiga step

### Step 1 · KPR kamu (`/monitoring/setup/1`)

| Field | Aturan |
|---|---|
| Bank | Wajib. Pilihan `BANKS`; `Bank lainnya` → field nama bank (min 2 huruf). |
| Cicilan per bulan | Wajib, > 0 |
| Jatuh tempo setiap tanggal | Wajib, 1–31. Hint tanggal > 28 tetap dipakai. |

**Hanya di mode edit** (`?edit=...`), sebagai field opsional:

- Nama produk KPR (maks 100)
- Jenis KPR: Konvensional / Syariah, default Konvensional
- Pinjaman awal (> 0; kalau sisa pinjaman diketahui, tidak boleh lebih kecil dari sisa pinjaman)

### Step 2 · Bunga (`/monitoring/setup/2`)

| Field | Aturan |
|---|---|
| "Bunga KPR kamu sekarang?" | Wajib. `Masih fixed` / `Sudah floating` / `Belum tahu`. Disimpan sebagai `currentRateType`: `'fixed'` / `'floating'` / `null`. |
| Fixed berakhir | Wajib jika `Masih fixed`. Hint: "Lihat di surat akad atau aplikasi bank. Kalau hanya tahu bulannya, pilih tanggal 1." Kalau ≤ hari ini (`clock`): error "Tanggal ini sudah lewat, berarti bunga kamu sudah floating." dengan tombol `Pilih Sudah floating`. |

Bagian lipat **"Mau tahu perkiraan cicilan setelah fixed? (opsional)"**:

- Saat setup, bagian ini hanya muncul untuk `Masih fixed` dengan Jenis KPR konvensional.
- Di mode edit selalu terbuka untuk semua jenis bunga, tanpa field bunga floating jika bukan fixed.

| Field | Aturan |
|---|---|
| Bunga sekarang | Opsional, 0,01–30% |
| Sisa tenor | Opsional. Dua angka: tahun (0–30) + bulan (0–11). Disimpan sebagai `remainingTenorMonths = tahun × 12 + bulan`, total 1–360. Pola sama dengan "Lama Bekerja" di Primary. |
| Perkiraan bunga floating | Opsional, 0,01–30%. Hint: "Belum tahu? Tanyakan ke bank, atau isi perkiraan dulu. Bisa diubah kapan saja." |
| Sisa pinjaman dari bank | **Hanya di mode edit**, opsional. Diisi = angka resmi. Kosong = memakai perkiraan. |

- **Hasil langsung**, jika cicilan (step 1), bunga, sisa tenor, bunga floating, dan fixed berakhir terisi: "Cicilan bisa naik jadi ± {rupiahShort(next)}/bln (+{rupiahShort(delta)})". Sumbernya `deriveMortgage(preview, clock).floatingImpact`, dengan `preview` = draft + nilai form + `outstandingPrincipal` dari `calculateMaxPrincipal`.
- Kalau baru sebagian terisi: "Isi ketiganya untuk melihat perkiraan."
- Kalau hasilnya turun atau sama: tampilkan apa adanya, misalnya "Cicilan diperkirakan turun …" atau "tidak berubah".

### Step 3 · Reminder (`/monitoring/setup/3`)

1. Kartu **"Yang akan kami ingatkan"** memakai `InsightGrid` dari `src/components/shared/milestone.jsx`:
   - `Fixed berakhir`: `{dateShort(fixedUntil)}`, caption `{daysLabel(hari)}`. Hanya untuk fixed.
   - `Pengingat floating`: `{jumlah} kali`, caption `H-90 … H-7` dari pilihan reminder yang masih akan datang. Hanya untuk fixed.
   - `Bayar cicilan`: `Tiap tgl {dueDay}`, caption pilihan H-7/H-3/H-1/Hari-H.
   - `Cicilan setelah fixed`: `± {rupiahShort}` dengan caption `+{delta}/bln`. Hanya jika `floatingImpact` ada.
   - **Sudah floating:** `Notice` info "Bunga kamu sudah floating. Kami ingatkan pembayaran tiap bulan. Bandingkan program bank lain di Explore."
   - **Belum tahu:** `Notice` warn "Jenis bunga belum diketahui. Reminder floating aktif setelah kamu mengisinya", dengan tautan `Isi sekarang` ke `/monitoring/setup/2?edit=review`.
   - Tautan `Ubah` untuk KPR (step 1) dan Bunga (step 2) memakai `?edit=review` dan kembali ke step 3.
2. `ReminderSettingsForm` yang sudah ada. Default `DEFAULT_REMINDERS`; grup fixed hanya untuk fixed yang belum lewat.
3. Centang wajib: "Data yang saya masukkan benar".
4. Tombol utama **`Aktifkan Reminder`** → `api.mortgages.activate` → `/monitoring/success` (tidak berubah). Catatan "Aktivasi tidak membuat pengajuan ke bank." tetap dipakai.

**Dihapus dari setup:**

- Step Properti, Keuangan, dan Review terpisah.
- Field: nama produk, jenis KPR, pinjaman awal (setup mode); tenor awal; tanggal akad; "tahu sisa pokok?"; "cicilan pernah berubah?"; riwayat bunga; pengeluaran rutin; dana darurat.

### Progress

- `setupMeta.js`:
  - `SETUP_STEPS = ['KPR kamu', 'Bunga', 'Reminder']`
  - `SETUP_TITLES = ['Data KPR kamu', 'Bunga KPR kamu', 'Atur reminder']`
  - `SETUP_PERCENT = [10, 45, 75]`
- `WizardProgress`: `label="Bagian {n} dari 3 · {SETUP_STEPS[n-1]}"`, `steps={SETUP_STEPS}`, `current={n}`, `reached={min(setupStep, 3)}`, `percent={SETUP_PERCENT[max(n, reached) - 1]}`. `savedLabel` tetap.
- `MortgageDraftHero` (Home): `Bagian {step} dari 3 · {SETUP_STEPS[step-1]}` dan `HeroProgress value={SETUP_PERCENT[step-1]}`.
- Checklist draft `MyKprLayout`: 3 item.
- Intro (`MonitoringIntro`): tambah kalimat "Cukup 3 langkah singkat. Data lain bisa dilengkapi nanti."

## 2. Satu data, satu tempat

| Data | Satu-satunya tempat isian |
|---|---|
| `bankName`, `currentPayment`, `dueDay` | Step 1 |
| `productName`, `scheme`, `originalPrincipal` | Step 1, mode edit |
| `currentRateType`, `fixedUntil` | Step 2 |
| `currentRateBps`, `remainingTenorMonths`, `estimatedFloatingRateBps` | Step 2, bagian opsional |
| `outstandingPrincipal` resmi | Step 2, mode edit (`Sisa pinjaman dari bank`) |
| `outstandingPrincipal` perkiraan | Tidak diisi user. Dihitung API. |
| Penghasilan & cicilan lain (`finance`) | Profil → Edit (`/profile/edit`). Satu sumber: `db.finance`. |
| Properti | Tab Properti (`/my-kpr/property?edit=1`), tidak berubah |
| `reminders` | Step 3 (draft) atau `/profile/reminders` (aktif) |

### Aturan di mock API (`src/data/mockApi.js`)

Berlaku untuk `mortgages.saveSetupStep` dan `mortgages.update`.

1. **Sisa pinjaman perkiraan.**
   - Setelah nilai digabung, kalau `currentPayment`, `currentRateBps`, atau `remainingTenorMonths` **berubah di simpanan ini**, atau `outstandingPrincipal` masih kosong:
   - Jika `outstandingEstimated !== false`, ketiga nilai > 0, dan `scheme !== 'sharia'` → `outstandingPrincipal = calculateMaxPrincipal({ payment: currentPayment, annualRateBps: currentRateBps, termMonths: remainingTenorMonths })` dan `outstandingEstimated = true`.
   - Jika data belum cukup dan sisa pinjaman tidak resmi → `outstandingPrincipal = null` dan `outstandingEstimated = null`.
   - Simpanan yang tidak menyentuh ketiga nilai tidak mengubah sisa pinjaman. Data KPR aktif lama dengan estimasi metode lama jadi tetap stabil.
2. **Sisa pinjaman resmi.** Form edit mengirim `outstandingPrincipal: angka, outstandingEstimated: false`. Mengosongkan field mengirim `outstandingPrincipal: null, outstandingEstimated: null`, lalu aturan 1 menghitung ulang perkiraan.
3. **Jenis bunga.** `floating` atau `null` → `fixedUntil = null` dan `estimatedFloatingRateBps = null`.
4. **`setupStep`** = `min(3, max(setupStep, step + 1))`. `activate` mengisi `setupStep = 3`.
5. Aturan `OFFICIAL_OUTSTANDING_REQUIRED` di `saveSetupStep` **dihapus**. API `mortgages.estimate` tetap ada untuk Take Over.
6. **`activate` mewajibkan:**
   - `bankName`, `currentPayment`, `dueDay`
   - `fixedUntil` jika `currentRateType === 'fixed'`
   - reminder valid (`validateReminders`)

   Tidak lagi wajib: sisa pokok, sisa tenor, bunga, pinjaman awal, tenor awal, tanggal akad, penghasilan. Penjadwalan reminder dan activity tidak berubah.
7. **`profile.update`** dengan `finance` juga menggabungkan `finance` ke semua mortgage berstatus `draft` atau `active`. Ini memperbaiki data dobel: sebelumnya KPR Health tetap memakai penghasilan lama setelah Profil diubah.
8. Field lama yang tidak ditanya lagi tidak ditulis dan tidak dihapus: `knowsOutstanding`, `paymentEverChanged`, `rateHistory`, `startDate`, `originalTenorMonths`, `finance.routineExpenses`, `finance.emergencyFund`.

### Data kosong di `src/domains/mortgages/derive.js`

| Fungsi | Perubahan |
|---|---|
| `rateMode` | `!m.currentRateType` → `{ mode: null, daysUntilFixedEnd: null }`, diperiksa paling awal |
| `deriveMortgage` · `paidRatio` | `null` jika `originalPrincipal` atau `outstandingPrincipal` kosong |
| `healthScore` | Komponen `progress` → `null` jika `paidRatio == null`. Tanpa komponen yang diketahui → `{ score: null, partial: true, label: 'Belum lengkap', tone: 'mute', components }`. |
| `paymentWindow` | Tanpa `startDate` → tidak memfilter berdasarkan tanggal akad |

`applicationHealth` milik Take Over selalu mengirim `paidRatio` berupa angka, jadi perilakunya tidak berubah.

## 3. Lengkapi nanti

| Fitur | Tampilan saat data kurang | Tujuan tombol |
|---|---|---|
| Kartu status bunga di Home (`MonitoringDashboard`) saat `mode === null` | `Notice` warn: "Jenis bunga belum diketahui. Cek di aplikasi bank supaya kami bisa mengingatkan sebelum floating." · `Isi jenis bunga` | `/monitoring/setup/2?edit=home` |
| Perkiraan floating (Home, tab Bunga) | Notice "Estimasi floating belum diisi" yang sudah ada | Tautan yang sudah ada |
| Amortisasi | Notice `scheduleMissing` yang sudah ada | Tautan yang sudah ada (`setup/2?edit=mykpr`) |
| KPR Health / ring di Home saat `score === null` | Ganti ring dengan teks "Lengkapi data untuk melihat KPR Health" + daftar tombol per komponen yang kosong | Penghasilan → `/profile/edit`; pinjaman awal → `/monitoring/setup/1?edit=mykpr`; nilai properti → `/my-kpr/property?edit=1`; jenis bunga → `/monitoring/setup/2?edit=mykpr` |
| Progres pokok lunas (Home `MonitoringDashboard`, tab Ringkasan `MyKprTabs`, `HealthPage`) saat `paidRatio == null` | `ProgressBar` disembunyikan; teks "Progres pelunasan belum diketahui" + tautan `Isi pinjaman awal` | `/monitoring/setup/1?edit=mykpr` |
| KPR Health komponen DTI kosong | Teks "Penghasilan belum diisi" yang ada + tautan `Lengkapi` | `/profile/edit` |
| Simulasi Take Over / Refinancing dari KPR (`GoalStartPage`) saat bunga, sisa tenor, atau sisa pinjaman kosong | Form disembunyikan, diganti `Notice` warn: "Untuk simulasi, lengkapi bunga dan sisa tenor KPR kamu dulu." · `Lengkapi data bunga` | `/monitoring/setup/2?edit=explore` (kunci `RETURN` baru `explore: '/explore'`) |
| Profil → Edit | Form keuangan ditambah 3 field opsional, default 0: Cicilan kendaraan, Kartu kredit / paylater, Pinjaman lain | — |

`explore.get` sudah menangkap error simulasi (`opportunity.available = false`), jadi tidak berubah.

### Route & data lama

- `/monitoring/setup/:step` dengan `step` 4–6 → `Navigate` ke `/monitoring/setup/3`. Contohnya tautan lama `setup/6?edit=review`.
- `RETURN.review = '/monitoring/setup/3'`.
- Draft dengan `setupStep` > 3 dibaca sebagai 3 di semua tempat resume: `MonitoringIntro`, `MyKprLayout`, `MortgageDraftHero`, dan guard wizard.
- Step 3 untuk KPR aktif (`editingActive`) → `Navigate` ke `/profile/reminders`.
- Nilai awal step 2 untuk draft: `currentRateType ?? (setupStep > 2 ? 'unknown' : '')`. Untuk KPR aktif: `currentRateType ?? 'unknown'`.
- Seed `mortgage_setup_draft` (setupStep 3, `reminders: null`) langsung ke step Reminder dengan `DEFAULT_REMINDERS`.
- KPR aktif di seed dan localStorage tetap memakai data lengkapnya. Tidak perlu migrasi `schemaVersion`.

## 4. Perubahan file

| File | Perubahan |
|---|---|
| `src/domains/mortgages/setupMeta.js` | 3 step, judul, `SETUP_PERCENT` |
| `src/domains/mortgages/MortgageSetupWizard.jsx` | Ditulis ulang jadi 3 step: `LoanStep` (5 field + field edit), `RateStep` (pilihan bunga + bagian opsional + perkiraan langsung), `ReminderStep` (kartu insight + reminder + aktivasi). `PropertyStep`, `FinanceStep`, `ReviewStep`, dan riwayat bunga dihapus. |
| `src/domains/mortgages/validation.js` | `validateLoanStep` dan `validateRateStep` sesuai aturan baru. `validatePropertyStep` dan `validateFinanceStep` dihapus jika tidak ada pemakai lain. `validateRatePeriods` milik `mortgages/validation.js` dihapus (fungsi bernama sama di `calculations/finance.js` tetap). |
| `src/domains/mortgages/derive.js` | Penanganan data kosong (bagian 2) |
| `src/data/mockApi.js` | Aturan 1–7 bagian 2 |
| `src/domains/home/MonitoringDashboard.jsx` | Notice jenis bunga belum diketahui; ring health saat `score === null` |
| `src/domains/mortgages/HealthPage.jsx` | Tampilan "Lengkapi data" dan tautan per komponen |
| `src/domains/optimize/GoalStartPage.jsx` | Penjaga data kurang |
| `src/domains/profile/ProfilePages.jsx` | 3 field cicilan lain di form keuangan |
| `src/domains/home/HomePage.jsx` | `MortgageDraftHero` 3 step |
| `src/domains/mortgages/MyKprTabs.jsx` | Progres pokok lunas saat `paidRatio == null` |
| `src/domains/mortgages/MyKprLayout.jsx` | Checklist draft 3 item, resume dibatasi 3 |
| `src/domains/mortgages/MonitoringPages.jsx` | Resume dibatasi 3; kalimat intro |

UI hanya lewat `src/data/api.js`; `mockDb.js` tetap satu-satunya batas localStorage. Tidak ada dependency baru.

## 5. Testing

- **Vitest**
  - `mortgages/validation.test.js`:
    - step 1 wajib 3 field
    - step 2: jenis bunga wajib; fixed wajib tanggal > hari ini; tanggal lewat memberi pesan "sudah floating"; field opsional hanya divalidasi jika diisi; sisa tenor 1–360 bulan
  - `derive` (file test baru `derive.test.js` di folder yang sama):
    - `rateMode` dengan `currentRateType: null` → `mode: null`
    - `paidRatio` null tanpa pinjaman awal
    - `healthScore` tanpa komponen → `score: null`
    - riwayat bayar tetap terisi tanpa `startDate`
  - `data/mockApi.test.js`:
    - sisa pinjaman perkiraan = `calculateMaxPrincipal` setelah step 2 lengkap
    - angka resmi tidak ditimpa saat bunga berubah
    - mengosongkan angka resmi menghitung ulang perkiraan
    - pilih floating mengosongkan `fixedUntil` dan bunga floating
    - aktivasi berhasil dengan 5 data
    - `profile.update` memperbarui `finance` KPR aktif
    - tes lama `OFFICIAL_OUTSTANDING_REQUIRED` untuk `saveSetupStep` dihapus, tes `estimate` tetap ada
- **Playwright** `tests/e2e/mortgage-monitoring.spec.js`:
  - setup 3 step jalur fixed + perkiraan (`Bagian 1 dari 3`, `10% selesai.`, perkiraan "Cicilan bisa naik jadi" tampil, kartu "Yang akan kami ingatkan", aktivasi → dashboard)
  - jalur `Belum tahu` → aktif → Notice jenis bunga di Home
  - simulasi Take Over dari KPR dengan data minimal menampilkan penjaga
  - tes lain di file disesuaikan jika memakai step lama
- `npm run lint`, `npm run build`.

## Di luar scope

- Tab Properti dan form editnya (tidak berubah).
- Pengaturan reminder `/profile/reminders` (tidak berubah).
- Dokumen PRD dan kontrak API di `ruangkpr-docs/`.
- Pembuatan mortgage otomatis dari pengajuan yang sudah akad (`mockApi` sekitar baris 200) tetap mengisi data lengkap.
