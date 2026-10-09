# Wizard Take Over & Refinancing: 3 Tahap + Milestone Insight

Tanggal: 2026-10-01 · Sub-proyek 2 dari 2. Lanjutan dari `2026-10-01-primary-wizard-3-tahap-design.md`.

## Tujuan

Pola Primary diterapkan ke wizard Take Over:

- 3 tahap dan 3 bar progress.
- Persen bulat yang naik cepat di awal.
- Milestone berisi insight setelah Tahap 1 dan Tahap 2.

**Refinancing tercakup otomatis.** Kartu "Refinancing" di Home membuka `/optimize/intro?mode=topup` ("Refinancing + Top-up"), yang memakai wizard yang sama.

Kriteria sukses:

- User melihat "Bagian X dari 3" dan persen kelipatan 5.
- Muncul layar "Tahap 1 selesai" setelah data KPR lama dikonfirmasi.
- Muncul banner "Tahap 2 selesai" di Baseline.
- Semua angka berasal dari fungsi yang sudah ada.
- Route, autosave, `currentStep`, dan alur simulasi dari Explore (`/optimize/start`) tidak berubah.

## Keputusan yang sudah disepakati

- Pengelompokan dan persen mengikuti Primary. Tahap 1 selesai = 45%, Tahap 2 selesai = 75%.
- Milestone 1 berupa layar terpisah, seperti Primary.
- **Milestone 2 = halaman Baseline yang sudah ada**, ditambah banner. Tidak ada layar atau klik tambahan.
- Tidak ada hitungan atau API baru. Milestone merangkum hasil `insights.js`, `takeoverBaseline`, dan simulasi.

## Dependensi

Prop opsional `percent` di `WizardProgress` berasal dari sub-proyek 1. Kalau saat implementasi prop itu belum ada, tambahkan di sini dengan perilaku yang sama: mengganti angka dan sr-only, tetap di-tween, dan tanpa prop perilakunya tidak berubah.

## 1. Struktur tahap & progress

Layar diberi nomor 1–9 khusus untuk progress:

| # | Layar (route) | Tahap | Persen | Posisi bar |
|---|---|---|---|---|
| 1 | Data pribadi `/optimize/1` | 1 · Kamu & KPR Lama | 10 | 1 |
| 2 | Pekerjaan `/optimize/1/pekerjaan` | 1 | 20 | 1.333 |
| 3 | KPR lama `/optimize/2`, `/2/estimasi`, `/2/resmi` | 1 | 30 | 1.667 |
| 4 | Kemampuan bayar `/optimize/3` (+ milestone 1) | 2 · Kondisi & Tujuan | 45 | 2 |
| 5 | Properti `/optimize/4` | 2 | 55 | 2.333 |
| 6 | Tujuan `/optimize/5` | 2 | 65 | 2.667 |
| 7 | Baseline, Program, Detail, Konfirmasi | 3 · Pilih Bank & Kirim | 75 | 3 |
| 8 | Dokumen `/optimize/6` | 3 | 85 | 3.333 |
| 9 | Review `/optimize/7` | 3 | 95 | 3.667 |

Pemetaan `app.currentStep` ke nomor layar terjauh (`reached`):

| `currentStep` | 1 | 2 | 3 | 4 | 5 | 6 tanpa `selection` | 6 dengan `selection` | 7 |
|---|---|---|---|---|---|---|---|---|
| Layar | 1 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |

- Di layar Pekerjaan, layar 2 sudah memberi 20%, jadi `Math.max(app.currentStep, 1.5)` di `OptimizeStepPage` dihapus.
- Label progress: `Bagian {tahap} dari 3 · {nama tahap}`. Angka dan bar memakai `max(layar dibuka, reached)`. Kembali mengedit tidak menurunkan progress.
- Subtitle `PageHeader` tidak lagi memuat `Step x/7`. Isinya hanya nama layar: `Data pribadi`, `Pekerjaan & penghasilan`, `KPR lama`, dan seterusnya.
- `DraftHero` di Home untuk draft Take Over menampilkan `Bagian {tahap} dari 3`, nama tahap, dan persen dari tabel ini.
- `OptimizeIntro`, `GoalStartPage`, dan halaman program dari simulasi Explore (sumber `mortgage`) tetap tanpa progress, sama seperti sekarang.
- Checklist draft 7 item di `ApplicationTracker` tidak berubah.

## 2. Milestone 1: layar "Tahap 1 selesai"

### Alur

- Setelah **Gunakan Estimasi** (`OldLoanEstimatePage`) atau simpan sukses di `OldLoanOfficialPage` → `navigate('/optimize/3', { state: { milestone: 1 } })`.
- `OptimizeStepPage` untuk `n === 3` merender `TakeoverMilestone`, bukan `CapacityStep`, jika `location.state?.milestone === 1`. Progress di layar ini memakai layar 4 (45%).
- Tombol utama `Lanjut ke Tahap 2 →` → `navigate('/optimize/3', { replace: true })`.
- Tombol sekunder `Kembali` → `/optimize/2/estimasi` atau `/optimize/2/resmi`, sesuai `oldLoan.source`.
- Header: judul `Tahap 1 selesai`, subtitle `{nama mode} · gambaran KPR lama kamu`.
- Milestone tidak muncul saat melanjutkan draft dari Home/tracker. Mengonfirmasi ulang KPR lama memunculkannya lagi dengan angka terbaru.

### Isi

Dihitung di client dari `app.data` dan `clock`, jadi tidak perlu loading atau error state.

| Insight | Format contoh | Sumber |
|---|---|---|
| Sisa bunga jika tetap | `± Rp280 jt` | `goalConditions().totalInterest` (field baru, dari `takeoverBaseline`) |
| Pokok sudah lunas | `18%` | `applicationHealth(data, clock, null).paidRatio` |
| Status bunga | `Fixed · 120 hari lagi` / `Sudah floating` / `Belum diketahui` | `goalConditions().rate` |
| Chip | `Perkiraan lunas Agu 2041` | `goalConditions().payoffDate` (field baru) |

- `goalConditions` mendapat 2 field baru: `totalInterest: baseline?.totalInterest ?? null` dan `payoffDate: baseline?.payoffDate ?? null`.
- Kalau baseline `null`, tile sisa bunga dan chip lunas disembunyikan.
- Bunga `Belum diketahui` terjadi di jalur estimasi, karena jenis bunga tidak diisi. Tidak ada saran tambahan.
- Sisa bunga dibulatkan ke bawah ke Rp 10 jt, lalu ditampilkan dengan `rupiahShort` dan prefix `±`.
- Ditutup `Disclaimer`: "Estimasi dari data KPR lama yang kamu isi, bukan angka resmi bank."

## 3. Milestone 2: banner "Tahap 2 selesai" di Baseline

Tampil di atas isi `BaselinePage` yang sudah ada, **hanya jika** `sim.source.type === 'application'`. Isi Baseline di bawahnya tidak berubah.

- Judul `✓ Tahap 2 selesai`.
- `HealthRing` dan `Chip` label skor dari `applicationHealth(app.data, clock, app.data.property?.estimatedValue)`. Ditambah satu kalimat: `"Kondisi KPR kamu sehat."` jika skor ≥ 80, selain itu `HEALTH_SENTENCE[komponen terlemah]`. Ini logika yang sama dengan `HealthAside`.
- Satu baris teaser dari `sim.items`:

| Kondisi | Teks |
|---|---|
| Take Over, ada `monthlyDiff > 0` | `{N} program cocok · cicilan bisa turun hingga {rupiahShort(max monthlyDiff)}/bln` |
| Take Over, tidak ada `monthlyDiff > 0` | `{N} program cocok · belum ada yang menurunkan cicilan` |
| Top-up, ada `topup.fundingGap ≤ 0` | `{N} program cocok · {M} memenuhi kebutuhan dana {rupiahShort(requestedTopup)}` |
| Top-up, tidak ada | `{N} program cocok · belum ada yang memenuhi kebutuhan dana` |
| `N = 0` | `Belum ada program yang cocok`. Tombol Bandingkan Program tetap ada dan mengarah ke empty state "Ubah tujuan" yang sudah ada. |

- Data `app` dan `clock` diambil lewat `useOptimize()` di `BaselinePage`. Ini 1 panggilan snapshot tambahan ke mock API, dan tetap lewat `api.js`.
- Header Baseline tetap `Kondisi KPR kamu`. Progress di layar 7 (75%).

## 4. Visual

Pola Primary dipakai lagi: `Panel` radius 24px, angka besar `text-[30px] font-extrabold`, `Chip`, `Notice`, `Disclaimer`, dan `Button` tinggi ≥ 44px. Grid 1 kolom di mobile dan 3 kolom mulai `lg`. Tidak ada animasi dekoratif.

Kalau `PrimaryMilestone` dari sub-proyek 1 sudah ada saat implementasi, kerangkanya dipisah ke `src/components/shared/` dan dipakai kedua milestone. Kerangka ini terdiri dari ikon sukses, judul, grid insight, disclaimer, dan tombol. Kalau belum ada, `TakeoverMilestone` memakai kelas yang sama, dan pemisahan dilakukan begitu Primary selesai.

## 5. Perubahan file

| File | Perubahan |
|---|---|
| `src/domains/applications/meta.js` | `TAKEOVER_PHASES`, `TAKEOVER_PERCENT`, `takeoverProgress(screen)`, `takeoverScreenOf(app)`. Helper internal `phaseProgress(phases, percent, screen)` dipakai bersama `primaryProgress` (tes Primary tetap hijau). `draftProgress(app)` → `{ phase, label, percent }` untuk Home. |
| `src/domains/optimize/shared.jsx` | `OptimizeHeader({ screen, reached = screen, ... })` menggantikan `n`/`comparePhase`. Progress dihitung dari `takeoverProgress` dan dikirim ke `WizardProgress` lewat `steps` (nama tahap), `current` (nomor tahap layar dibuka, bilangan bulat, agar gaya "langkah saat ini" tetap jalan), `reached` (posisi bar dari `max(screen, reached)`), dan `percent` (dari `max(screen, reached)`). |
| `src/domains/optimize/OptimizeSteps.jsx` | `OptimizeStepPage`: nomor layar, `reached`, subtitle baru, dan render `TakeoverMilestone` saat `state.milestone === 1` |
| `src/domains/optimize/OldLoanPages.jsx` | Header memakai layar 3. Navigasi setelah konfirmasi membawa `state.milestone = 1`. |
| `src/domains/optimize/ProgramPages.jsx` | `Header` memakai layar 7. Banner milestone 2 di `BaselinePage`. |
| `src/domains/optimize/TakeoverMilestone.jsx` (baru) | Layar milestone 1 |
| `src/domains/optimize/insights.js` | `goalConditions` + `totalInterest`, `payoffDate` |
| `src/domains/home/HomePage.jsx` | `DraftHero` memakai `draftProgress(app)` untuk Primary dan Take Over |

UI hanya mengakses data lewat `src/data/api.js`. Tidak ada dependency baru.

## 6. Testing

- **Vitest**
  - `meta.test.js`: `takeoverProgress` untuk layar 1–9 (tahap, persen, posisi), dan `takeoverScreenOf` untuk `currentStep` 1–7, termasuk 6 dengan dan tanpa `selection`. `draftProgress` untuk satu draft Primary dan satu Take Over. Tes `primaryProgress` tetap lulus.
  - `insights.test.js`: `goalConditions` mengembalikan `totalInterest > 0` dan `payoffDate` untuk data lengkap, serta `null` keduanya saat data KPR lama belum lengkap.
- **Playwright** `tests/e2e/takeover-flow.spec.js`:
  - layar Pekerjaan `20% selesai.` (sebelumnya `7%`)
  - setelah Angka Resmi → `Tahap 1 selesai` dengan sisa bunga & pokok lunas terlihat → `Lanjut ke Tahap 2` → `/optimize/3` Kemampuan bayar
  - setelah Tujuan → Baseline menampilkan `Tahap 2 selesai` dan teaser program
  - alur simulasi dari Explore (`/optimize/start`) tidak menampilkan banner
- `npm run lint`, `npm run build`.

## Di luar scope

- Halaman sukses submit, `OptimizeIntro`, `GoalStartPage`.
- Pembaruan dokumen PRD di `ruangkpr-docs/`.
