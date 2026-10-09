# Wizard KPR Primary: 3 Tahap + Milestone Insight

Tanggal: 2026-10-01 · Sub-proyek 1 dari 2 (sub-proyek 2: Take Over & Refinancing, pola yang sama)

## Tujuan

Form pengajuan KPR Primary terasa lebih ringan dan memberi "hadiah" saat diisi:

1. 7 layar dikelompokkan jadi **3 tahap**; progress bar jadi **3 bar**.
2. Angka persen **dibulatkan dan dibuat cepat di awal** supaya user merasa sudah jauh.
3. Setiap tahap ditutup **layar milestone** berisi insight hasil hitungan dari data yang sudah diisi, hanya jika memang bisa dihitung.

Kriteria sukses: user melihat "Bagian X dari 3", angka persen bulat (kelipatan 5), dan dua layar milestone dengan angka nyata dari katalog program bank. Alur simpan, route, dan pengajuan ulang tidak berubah.

## Keputusan yang sudah disepakati

- **Kelompokkan, bukan gabung layar.** 7 layar tetap ada dan pendek. Route `/apply/primary/1..7`, autosave per layar, `currentStep` di mock API, `relevantStep` saat ditolak, dan `resumePath` tidak berubah.
- **Pola persen: cepat di awal.**
- **Insight di layar milestone terpisah**, bukan kartu atau dialog.

## 1. Struktur tahap & progress

| Tahap | Nama di bar | Layar (nomor route) |
|---|---|---|
| 1 | Tentang Kamu | 1 Data Diri, 2 Pekerjaan & Penghasilan |
| 2 | Rumah & Pinjaman | 3 Properti, 4 Pinjaman |
| 3 | Pilih Bank & Kirim | 5 Upload Dokumen, 6 Bandingkan Program Bank, 7 Review & Submit |

Persen per layar yang sedang dibuka (layar `n` berarti layar 1..n−1 sudah tersimpan):

| Layar | 1 | 2 | 3 | 4 | 5 | 6 | 7 | Submit |
|---|---|---|---|---|---|---|---|---|
| Persen | 10 | 30 | 45 | 60 | 75 | 85 | 95 | 100 (halaman sukses yang ada) |

Posisi bar (pecahan, 1-based, dipakai sebagai `current`/`reached` di `WizardProgress`):

| Layar | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Posisi | 1 | 1.5 | 2 | 2.5 | 3 | 3.333 | 3.667 |

- Label progress: `Bagian {tahap} dari 3 · {nama tahap}`. Judul layar di `PageHeader` (`HEADERS`) tetap per layar.
- Angka dan bar memakai layar terjauh, yaitu `max(layar dibuka, app.currentStep)`, sesuai perilaku sekarang. Kembali mengedit tidak menurunkan progress.
- `sr-only` tetap berbunyi `{persen}% selesai.`
- Kartu "Lanjutkan pengajuan kamu" di Home (`DraftHero`) untuk draft Primary menampilkan `Bagian {tahap} dari 3`, nama tahap, dan persen dari tabel yang sama. Draft Take Over tidak berubah.
- Tidak berubah: checklist draft 7 item di `ApplicationTracker`, wizard Take Over (`OptimizeHeader`), dan wizard Setup KPR.

## 2. Layar milestone

### Alur

- Setelah **Simpan** sukses di layar 2 → navigasi ke `/apply/primary/3` dengan `state: { milestone: 1 }`.
- Setelah **Simpan** sukses di layar 4 → navigasi ke `/apply/primary/5` dengan `state: { milestone: 2 }`.
- `PrimaryWizard` merender layar milestone, bukan form, jika `location.state?.milestone` ada.
- Tombol utama `Lanjut ke Tahap {2|3} →` → `navigate('/apply/primary/{3|5}', { replace: true })` tanpa state. Akibatnya, tombol back browser dari form berikutnya kembali ke layar 2/4, bukan ke milestone.
- Tombol sekunder `Kembali` → layar 2/4.
- Milestone **tidak muncul** saat edit dari Review (`fromReview`) atau saat melanjutkan draft dari Home/tracker. Menyimpan ulang layar 2/4 (bukan dari Review) memunculkannya lagi dengan angka terbaru.
- Progress di layar milestone memakai layar tujuan (45% / 75%; bar tahap yang baru selesai penuh), sehingga animasi naik terlihat sebagai momen selesai.
- Header: judul `Tahap {1|2} selesai`, subtitle `KPR Primary · hasil dari data kamu`, back ke layar 2/4.

### Milestone 1: setelah Tahap 1 (data: penghasilan, cicilan lain, umur, pekerjaan)

Sumber: method API baru `api.bankProducts.affordability({ applicationId })`.

| Insight | Format contoh | Perhitungan |
|---|---|---|
| Cicilan aman | `Rp3,8 jt/bln` | `calculatePaymentCapacity(...).remainingCapacity` (35% − cicilan lain) |
| Plafon KPR hingga | `± Rp660 jt` · `tenor 30 th` | Maksimum dari semua program terbuka: `calculateMaxPrincipal({ payment: remainingCapacity, annualRateBps: bunga fixed, termMonths: tenor maks })` |
| Harga rumah hingga | `± Rp730 jt` · `DP min 10%` | Plafon program terbaik ÷ `maximumLtvBps` program itu |
| Chip | `3 program bank terbuka untuk profilmu` | Jumlah program terbuka |

Program **terbuka** jika aktif dan berlaku pada `asOf`, `productTypes` memuat `primary`, penghasilan ≥ `minimumIncome`, pekerjaan ada di `occupations`, umur ≥ `minimumAge`, dan tenor maksimalnya ≥ 12 bulan.
Tenor maksimal = `min(maximumTenorMonths, (maximumAgeAtMaturity − umur) × 12)`. Jenis properti dan LTV belum diketahui di tahap ini, jadi tidak dipakai sebagai filter.

Kenapa memakai bunga fixed: cicilan pertama di `generateAmortizationSchedule` adalah annuity bunga fixed sepanjang tenor penuh, sama dengan yang dinilai `comparePrimaryPrograms` (`withinCapacity`).

### Milestone 2: setelah Tahap 2 (data: + harga, DP, pinjaman, tenor)

Sumber: `api.bankProducts.compare({ applicationId })` yang sudah ada. Tidak ada fungsi baru.

| Insight | Format contoh | Perhitungan |
|---|---|---|
| Program cocok | `3 program` | `items.length` |
| Cicilan mulai | `Rp2,8 jt/bln` · `fixed 5 th` | item dengan `payment` terendah; caption dari `fixedMonths` |
| Rasio cicilan | `28% dari penghasilan` · chip `Aman` / `Di atas batas aman` | `dtiRatio` item termurah dibanding `capacity.ratioBps` (35%) |

### Kondisi khusus

| Kondisi | Tampilan |
|---|---|
| `remainingCapacity ≤ 0` | Plafon & harga rumah tidak ditampilkan. `Notice` warn: "Cicilan lain sudah memakai seluruh batas aman 35%. Coba lunasi sebagian cicilan lain atau gabungkan penghasilan pasangan." |
| 0 program terbuka (M1) | Cicilan aman tetap tampil, ditambah `Notice`: "Belum ada program yang terbuka untuk profil ini." |
| 0 program cocok (M2) | `Notice` dengan alasan unik dari `excluded[].reasons` (maks 2) dan tombol `Ubah data pinjaman` → layar 4. |
| Loading | `Spinner` di panel insight. Tombol Lanjut tetap aktif. |
| Error API | Pesan singkat dan tombol `Coba lagi` (reload). Tombol Lanjut tetap aktif. |

Semua milestone ditutup dengan `Disclaimer`: "Estimasi berdasarkan program bank yang tersedia, bukan keputusan bank."

### Visual

Memakai pola yang sudah ada: `Panel` (radius 24px), angka besar seperti counter dokumen (`text-[30px] font-extrabold`), `IconBox`/ikon sukses, `Chip`, `Notice`, `Disclaimer`, dan `Button` (tinggi ≥ 44px).
Grid insight: 1 kolom di mobile, 3 kolom mulai `lg` (1024px). Tidak ada confetti atau animasi dekoratif selain tween progress yang sudah ada.
Plafon dan harga rumah dibulatkan ke bawah ke Rp 10 jt lalu ditampilkan dengan `rupiahShort` dan prefix `±` (contoh hitungan 660.456.611 → `± Rp660 jt`, 733.840.679 → `± Rp730 jt`). Cicilan memakai `rupiahShort` (`Rp3,8 jt/bln`). Fungsi kalkulasi tetap mengembalikan angka rupiah utuh; pembulatan hanya di tampilan.

## 3. Perubahan file

| File | Perubahan |
|---|---|
| `src/domains/applications/meta.js` | `PRIMARY_PHASES`, `PRIMARY_PERCENT`, `primaryProgress(screen)` → `{ phase, label, position, percent }` |
| `src/components/shared/progress.jsx` | `WizardProgress`: prop opsional `percent` (override angka & sr-only, tetap di-tween). Tanpa prop, perilaku sama persis. |
| `src/domains/applications/PrimaryWizard.jsx` | Progress dari `primaryProgress`; render `PrimaryMilestone` saat `location.state.milestone` |
| `src/domains/applications/PrimaryDetailsStep.jsx` | Navigasi setelah simpan layar 2/4 membawa `state.milestone` |
| `src/domains/applications/PrimaryMilestone.jsx` (baru) | Layar milestone 1 & 2 |
| `src/calculations/finance.js` | `calculateMaxPrincipal({ payment, annualRateBps, termMonths })`, dibulatkan ke bawah |
| `src/calculations/programs.js` | `primaryAffordability({ products, input, asOf, ratioBps })` → `{ capacity, openCount, best: { principal, priceMax, tenorMonths, fixedRateBps, maxLtvBps } \| null }` |
| `src/data/mockApi.js` | `bankProducts.affordability({ applicationId })`: input penghasilan, cicilan lain, `birthDate`, pekerjaan dari `app.data`; `CALCULATION_INPUT_INCOMPLETE` jika penghasilan kosong |
| `src/domains/home/HomePage.jsx` | `DraftHero`: Primary memakai `primaryProgress` |

UI hanya mengakses data lewat `src/data/api.js`; `mockDb.js` tetap satu-satunya batas localStorage. Tidak ada dependency baru.

## 4. Testing

- **Vitest**
  - `finance.test.js`: `calculateMaxPrincipal` hitung bolak-balik dengan `calculateAnnuityPayment` (selisih cicilan ≤ Rp 1), dan `payment ≤ 0` → 0.
  - `programs.test.js`, `primaryAffordability`:
    - data contoh (15 jt, cicilan lain 1,5 jt, umur 30) → 3 program terbuka, plafon > 0
    - umur 50 → tenor dibatasi umur
    - cicilan lain melebihi 35% → `best: null`
    - penghasilan di bawah semua minimum → `openCount: 0`
  - `meta` test: tabel persen dan posisi `primaryProgress` untuk layar 1–7.
- **Playwright** `tests/e2e/primary-flow.spec.js`:
  - label `Bagian 1 dari 3`, `10% selesai.`
  - setelah layar 2 → `Tahap 1 selesai` dengan cicilan aman & plafon terlihat → `Lanjut ke Tahap 2` → form Properti
  - setelah layar 4 → `Tahap 2 selesai` dengan program cocok → `Lanjut ke Tahap 3` → Dokumen
  - kembali mengedit layar 2 tetap menunjukkan `45% selesai.`
- `npm run lint`, `npm run build`.

## Di luar scope

- Take Over & Refinancing (sub-proyek 2: `TAKEOVER_STEPS`, `OptimizeHeader`, insight di `src/domains/optimize/insights.js`).
- Pembaruan dokumen PRD di `ruangkpr-docs/`.
- Perubahan halaman sukses submit.
