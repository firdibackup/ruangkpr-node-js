# Frontend Architecture & Delivery Plan — RuangKPR

**Versi:** 1.0  
**Tanggal:** 28 September 2026  
**Status:** Rencana implementasi frontend; wajib melewati inspeksi repository sebelum coding  
**Stack target:** Vite + React + JavaScript + shadcn/ui  
**Mode delivery:** frontend-only, mock-first, mobile-first  
**Sumber kebutuhan:** `PRD-RuangKPR-Lengkap.md` dan tiga instruksi Claude Design yang disetujui

> Dokumen ini tidak menyatakan struktur repository yang belum diperiksa sebagai fakta. Semua nama folder dan route di bawah adalah target yang harus disesuaikan setelah inspeksi repository nyata.

---

## 1. Tujuan dan batas arsitektur

Frontend ini harus membuktikan journey produk secara clickable dan konsisten sebelum backend dipilih:

1. KPR Primary dari Home sampai submit dan tracker.
2. Setup monitoring KPR aktif sampai dashboard, reminder, My KPR, dan amortisasi.
3. Take Over/Top-up sesuai fase delivery, tanpa mengganggu foundation.
4. State fresh, draft, in-process, rejected, mortgage active, warning floating, partial, loading, dan error.
5. Perhitungan finansial deterministik melalui pure functions yang dapat diuji.
6. Seluruh data prototype disimpan lokal di browser melalui satu adapter; komponen tidak mengakses `localStorage` langsung.
7. Pergantian mock ke backend dilakukan dengan mengganti implementasi adapter, bukan menulis ulang UI.

### Prinsip Ponytail/YAGNI

- Reuse artifact visual dan komponen repository sebelum membuat baru.
- Reuse komponen shadcn yang sudah terpasang; jangan install ulang atau membuat design system kedua.
- Native React state untuk state lokal dan form; Context hanya untuk state lintas route yang benar-benar diperlukan.
- Tidak menambah Redux/Zustand/TanStack Query/Axios/react-hook-form/Zod bila belum terpasang dan kebutuhan mock-first belum membuktikannya.
- Gunakan `fetch` untuk backend nanti; tidak perlu client HTTP tambahan.
- Gunakan input HTML native (`date`, `number`, `file`, radio, checkbox) sebelum library widget.
- Tidak membuat repository pattern, factory, event bus, service locator, atau generic form engine.
- Satu application aktif dan satu mortgage aktif per user pada prototype.
- Tidak menyimpan baris amortisasi; hasil selalu dihitung dari input.

---

## 2. Gate 0 — inspeksi wajib sebelum satu baris coding

Claude Code/developer **wajib berhenti dan inspeksi** repository nyata. Lokasi repository belum dikonfirmasi oleh dokumen sumber; jangan menganggap `/home/ubuntu/ruangkpr-docs` sebagai repository aplikasi.

### 2.1 Checklist inspeksi

1. Temukan repository Vite/React berdasarkan keberadaan `package.json`, `vite.config.*`, dan `src/`.
2. Baca penuh:
   - `package.json` dan lockfile aktif (`package-lock.json`, `pnpm-lock.yaml`, atau `yarn.lock`);
   - `vite.config.js`/`.mjs`;
   - `jsconfig.json` bila ada;
   - `components.json` shadcn bila ada;
   - entry (`src/main.*`) dan root app (`src/App.*`);
   - stylesheet global dan token CSS;
   - seluruh komponen di `src/components/ui`;
   - router, providers, test config, lint config, dan existing mocks/storage helpers;
   - artifact HTML approved bila ada di repository/workspace.
3. Cari pemakaian komponen/pattern sebelum membuat komponen baru:
   - Button, Card, Input, Label, Select, RadioGroup, Checkbox, Tabs, Dialog, Alert, Progress, Skeleton, Toast/Sonner, Table;
   - shell/sidebar/bottom-nav;
   - formatter Rupiah/tanggal/persen;
   - form validation dan persistence;
   - calculation helpers.
4. Jalankan baseline sesuai script yang benar-benar tersedia: install hanya bila dependency belum terpasang, lalu `lint`, `test`, dan `build` yang ada.
5. Catat hasil inspeksi singkat dalam commit/PR notes: package manager, scripts, router, test stack, alias import, komponen shadcn tersedia, token CSS, pola folder, dan konflik dengan plan ini.

### 2.2 Keputusan setelah inspeksi

| Temuan | Keputusan minimum |
|---|---|
| React Router sudah ada | Reuse konfigurasi dan gaya route existing |
| Belum ada router dan journey multi-screen harus punya URL/back button | Tambahkan `react-router-dom` saja |
| `react-hook-form` dan/atau `zod` sudah ada dan dipakai konsisten | Reuse; jangan buat pola validasi kedua |
| Belum ada form library | Native controlled/uncontrolled React + fungsi validasi kecil |
| Vitest/RTL sudah ada | Reuse konfigurasi existing |
| Belum ada test stack | Tambahkan minimum `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`; `@testing-library/jest-dom` hanya bila matcher diperlukan |
| Playwright sudah ada | Reuse untuk smoke E2E |
| Belum ada Playwright | Tambahkan hanya saat Phase E2E dimulai, bukan di bootstrap |
| shadcn components ada | Import dan komposisikan yang ada |
| komponen shadcn yang dibutuhkan belum ada | Generate hanya komponen yang benar-benar dipakai pada fase berjalan |
| Artifact approved punya token lebih rinci | Salin nilai token, bukan markup monolitik/artifact state machine |
| Existing architecture berbeda namun sehat | Adaptasikan naming/lokasi; pertahankan boundaries domain, adapter, dan pure calculation |

### 2.3 Output Gate 0 / DoD

- Repository dan package manager teridentifikasi.
- Tidak ada dependency yang ditambahkan tanpa alasan.
- Daftar komponen existing yang akan direuse tersedia.
- Visual token approved dipetakan dari artifact/CSS.
- Baseline build/lint/test dicatat: pass, atau failure existing didokumentasikan sebelum perubahan.
- Route plan dan folder target disesuaikan tanpa mengubah perilaku produk.

---

## 3. Dependency policy

### 3.1 Runtime minimum

Wajib/reuse:

- `react`
- `react-dom`
- Vite packages yang sudah ada
- `react-router-dom` **hanya bila belum ada dan route nyata diperlukan**
- dependency shadcn/ui yang sudah dihasilkan oleh komponen existing, misalnya Radix primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, dan icon package existing

Tidak ditambahkan untuk MVP mock-first:

- Redux, Zustand, MobX, XState
- TanStack Query/SWR
- Axios
- date-fns/dayjs/moment bila native `Date` + helper kecil mencukupi
- currency/money library sebelum kebutuhan precision produksi disepakati
- chart library sebelum halaman amortisasi; saat diperlukan, reuse yang sudah terpasang atau gunakan CSS/SVG sederhana untuk stacked annual bar
- form builder/schema generator
- animation library

### 3.2 Forms

- Jika `react-hook-form`/Zod sudah terpasang dan digunakan repository, reuse.
- Jika tidak, gunakan state React per screen dan validator pure berbentuk `(values) => errors`.
- Jangan menambah Zod hanya untuk validasi input browser prototype.
- Backend nanti tetap harus memvalidasi ulang seluruh payload; validasi frontend adalah UX, bukan security boundary.

### 3.3 Test dependencies

Tambahkan hanya pada fase yang membutuhkan dan hanya jika belum ada:

- Unit/component: Vitest + React Testing Library + user-event + jsdom.
- E2E: Playwright, satu browser Chromium pada CI awal.
- Tidak perlu Cypress bersamaan dengan Playwright.

---

## 4. Target folder tree

Tree ini adalah target minimum; merge dengan struktur existing setelah Gate 0.

```text
src/
├── app/
│   ├── App.jsx
│   ├── router.jsx
│   ├── AppProviders.jsx
│   └── routeGuards.js
├── components/
│   ├── ui/                         # shadcn existing/generated; jangan taruh domain logic
│   ├── layout/
│   │   ├── AppShell.jsx
│   │   ├── DesktopSidebar.jsx
│   │   ├── MobileBottomNav.jsx
│   │   └── PageHeader.jsx
│   └── shared/
│       ├── AsyncState.jsx          # loading/error/empty/partial sederhana
│       ├── CurrencyField.jsx
│       ├── FieldError.jsx
│       ├── Money.jsx
│       ├── StatusBadge.jsx
│       └── ConfirmDialog.jsx
├── domains/
│   ├── session/
│   │   ├── SessionProvider.jsx
│   │   ├── sessionApi.js
│   │   └── validation.js
│   ├── home/
│   │   ├── HomePage.jsx
│   │   ├── selectHomeState.js
│   │   └── components/
│   ├── applications/
│   │   ├── ApplicationFlow.jsx
│   │   ├── ApplicationTrackerPage.jsx
│   │   ├── applicationApi.js
│   │   ├── applicationRules.js
│   │   ├── validation.js
│   │   └── components/
│   ├── mortgages/
│   │   ├── MortgageSetupFlow.jsx
│   │   ├── MyKprPage.jsx
│   │   ├── mortgageApi.js
│   │   ├── mortgageRules.js
│   │   ├── validation.js
│   │   └── components/
│   ├── amortization/
│   │   ├── AmortizationPage.jsx
│   │   ├── calculations.js
│   │   ├── aggregateSchedule.js
│   │   └── components/
│   ├── explore/
│   │   ├── ExplorePage.jsx
│   │   ├── opportunityRules.js
│   │   └── components/
│   ├── activity/
│   │   └── ActivityPage.jsx
│   └── profile/
│       └── ProfilePage.jsx
├── calculations/
│   ├── money.js
│   ├── annuity.js
│   ├── ratePeriods.js
│   ├── affordability.js
│   ├── property.js
│   ├── takeover.js
│   └── dates.js
├── data/
│   ├── api.js                      # facade yang diimport UI
│   ├── mockApi.js                  # implementasi aktif saat mock-first
│   ├── httpApi.js                  # dibuat nanti, bukan scaffold kosong sekarang
│   ├── mockDb.js
│   ├── seed.js
│   ├── migrations.js
│   └── fixtures/
│       ├── fresh.js
│       ├── primaryDraft.js
│       ├── applicationProcess.js
│       ├── rejected.js
│       ├── mortgageActive.js
│       └── mortgagePartial.js
├── lib/
│   ├── cn.js                       # hanya bila shadcn existing memakai ini
│   ├── formatters.js
│   └── result.js
├── styles/
│   └── globals.css
├── test/
│   ├── setup.js
│   └── renderWithApp.jsx
└── main.jsx

tests/
└── e2e/                            # dibuat saat Playwright benar-benar dipakai
    ├── primary-flow.spec.js
    └── mortgage-monitoring.spec.js
```

### Aturan placement

- `components/ui`: primitive presentational shadcn; tidak tahu mortgage/application.
- `components/shared`: reusable lintas domain setelah benar-benar dipakai minimal dua domain.
- `domains/*`: page, section, orchestration, dan rule tampilan milik domain.
- `calculations/*`: pure functions, tanpa React, DOM, storage, network, atau locale formatting.
- `data/*`: boundary seluruh persistence/network. UI tidak memanggil `localStorage`.
- Jangan membuat barrel `index.js` global; import eksplisit memudahkan pencarian dan mencegah cycle.
- Jangan memecah file hanya demi satu komponen kecil; ekstrak ketika screen sulit dibaca, component reused, atau butuh unit test terpisah.

---

## 5. Routing dan lifecycle

### 5.1 Route target

```text
/                               -> redirect /home
/register                       -> Registrasi Akun
/verify                         -> Verifikasi Akun
/home                           -> Home dinamis
/apply/primary/:step            -> 1..5
/applications/:applicationId    -> tracker/detail read-only
/applications/:applicationId/documents
/monitoring/new/:step           -> 1..6
/my-kpr                         -> redirect tab sesuai state
/my-kpr/overview
/my-kpr/payment
/my-kpr/amortization
/my-kpr/rate
/my-kpr/property
/explore
/explore/takeover               -> fase Take Over
/explore/takeover/compare
/activity
/profile
```

Take Over cold-entry dapat memakai route `/apply/takeover/:step` ketika fasenya dibangun. Jangan membuat route Refinancing/Multiguna detail sebelum flow diimplementasikan; kartu memakai informational state sesuai scope.

### 5.2 Route ownership

- Router hanya menentukan page dan guard ringan.
- Lifecycle bukan encoded sebagai banyak redirect ad hoc; gunakan selector `selectHomeState(snapshot, now)` dan domain rules.
- Lima nav item selalu clickable setelah user masuk shell.
- Isi My KPR/Explore berubah berdasarkan data, bukan nav disabled.
- Route amortisasi tetap child flow My KPR > Payment, bukan top-level nav.

### 5.3 Guard minimum

- Belum verified: route private kembali ke `/register` atau `/verify` sesuai session mock.
- `/my-kpr/amortization`: jika tidak ada mortgage aktif atau data tidak lengkap, render empty/partial state dengan CTA; jangan crash atau membuat data palsu.
- Application post-submit: route form edit tidak dibuka bebas; arahkan ke tracker kecuali recovery rejected/additional-doc yang eksplisit.
- Unknown ID: Not Found domain state, bukan fallback ke fixture lain.

### 5.4 Back/refresh/deep-link

- Step disimpan sebagai bagian draft dan juga terlihat di URL.
- Refresh membaca ulang snapshot dari adapter.
- Jika URL step lebih maju daripada `currentStep`, redirect ke step tersimpan/pertama yang belum valid.
- Browser back tidak menghapus data; data hanya persisten setelah `Simpan & Lanjutkan` atau upload per file.

---

## 6. State ownership

| State | Owner | Persist? | Alasan |
|---|---|---:|---|
| Input yang sedang diketik | Component/screen | Tidak sampai save | Mencegah autosave per-keystroke |
| Field touched/errors | Component/form hook kecil | Tidak | UI sementara |
| Modal/dropdown/tab visual | Component | Tidak | Lokal |
| Session user/verified | `SessionProvider` | Ya via API adapter | Dipakai seluruh route |
| Application draft/status | API adapter + page loader state | Ya | Harus resume/deep-link |
| Mortgage draft/active | API adapter + page loader state | Ya | Harus resume/dashboard |
| Product catalog fixtures | Mock API | Ya sebagai seed/version | Sumber compare |
| Selected program sebelum save | Screen | Saat user konfirmasi | Hindari write tiap klik |
| Filter/toggle amortisasi | URL search params atau page state | Tidak | Boleh hilang saat reset; URL bila shareable |
| Derived DTI/LTV/equity/payment | Pure calculation/selectors | Tidak | Jangan simpan data turunan yang bisa stale |
| Amortization rows | Pure calculation result | Tidak | Generate on demand |
| Toast | Existing toast mechanism | Tidak | Ephemeral |

### 6.1 Context policy

Gunakan maksimum:

1. `SessionProvider` untuk user/session dan logout.
2. Provider existing shadcn/theme/toast bila sudah ada.

Tidak perlu global AppState Context berisi seluruh database. Setiap page membaca entitas dari adapter dan melakukan refresh setelah mutation. Bila prop drilling hanya satu-dua level, tetap pakai props.

### 6.2 Home state selector

Satu pure selector menerapkan prioritas PRD:

```text
rejected actionable
> application in-process
> application draft
> mortgage setup draft
> mortgage active near-floating
> mortgage active floating
> mortgage active normal/partial
> fresh
```

Input: snapshot domain dan `now` eksplisit. Output: enum view state + entity id. Jangan membaca waktu global di dalam selector agar test deterministik.

---

## 7. API adapter contract

Walau mock hanya satu implementasi, boundary ini diperlukan karena migration backend adalah requirement nyata. Ini bukan abstract class/factory; cukup object/fungsi dengan signature konsisten.

### 7.1 Result shape

```js
// Success
{ data, error: null }

// Failure
{ data: null, error: { code, message, fieldErrors?, retryable } }
```

Semua method async agar mock dan HTTP mempunyai cara pakai sama. Error yang diharapkan dikembalikan sebagai result; exception hanya untuk bug/kerusakan tidak terduga.

### 7.2 Interface minimum

```js
export const api = {
  session: {
    get(),
    register(input),
    verifyOtp(input),
    logout(),
  },
  dashboard: {
    getSnapshot(),
  },
  applications: {
    getActive(),
    getById(id),
    createDraft({ productType }),
    saveStep(id, { step, values, expectedRevision }),
    uploadDocument(id, { documentType, file }),
    removeDocument(id, documentId),
    selectProgram(id, { bankProductId, inputSnapshot }),
    submit(id, { consents, expectedRevision }),
    cancel(id),
    retrySameBank(id, patch),
    cloneForOtherBank(id),
  },
  mortgages: {
    getActive(),
    getDraft(),
    getById(id),
    createDraft(),
    saveSetupStep(id, { step, values, expectedRevision }),
    activate(id, { confirmation, expectedRevision }),
    updateSection(id, section, values),
    deleteDraft(id),
    recordPayment(id, input),
  },
  products: {
    list(input),
    getById(id),
  },
  activity: {
    list(),
  },
  profile: {
    get(),
    update(input),
    updateReminderPreferences(input),
  },
};
```

### 7.3 Contract rules

- UI mengirim domain values, bukan shape `localStorage` atau response backend mentah.
- Amount menggunakan integer Rupiah pada prototype; input string dinormalisasi di boundary form.
- Rate disimpan sebagai basis points atau integer micro-percent yang disepakati; jangan menyimpan string berformat `"5,50%"`.
- Tanggal domain memakai `YYYY-MM-DD`, bukan localized display string.
- `expectedRevision` mencegah silent overwrite saat backend hadir; mock increment revision sederhana.
- `submit` menyimpan immutable snapshot bank product dan input simulasi.
- `cancel` pada mock hard-delete sesuai keputusan produk, tetapi UI copy menandai konsekuensi. Produksi wajib menunggu keputusan retention compliance.
- Upload mock menyimpan metadata, bukan bytes/base64 dokumen sensitif ke `localStorage`.

### 7.4 Mock latency/failure

Default mock cepat dan stabil. Developer toggle (query param/dev control) boleh mensimulasikan:

- latency 300–800 ms;
- request fail;
- no bank match;
- stale product;
- upload error;
- partial mortgage.

Jangan masukkan randomness ke test. Failure scenario harus dipilih eksplisit.

---

## 8. Mock persistence

### 8.1 Storage

Satu key namespaced, contoh:

```text
ruangkpr:prototype:v1
```

Shape minimum:

```js
{
  schemaVersion: 1,
  activeScenario: "fresh",
  session: { userId, verified },
  users: [],
  profiles: [],
  applications: [],
  documents: [],
  mortgages: [],
  properties: [],
  reminderPreferences: [],
  payments: [],
  activities: [],
  bankProducts: [],
  meta: { seededAt, catalogVersion }
}
```

### 8.2 Rules

- `mockDb.js` adalah satu-satunya file yang memanggil `localStorage`.
- Parse harus memakai `try/catch`; data korup di-reset ke seed yang dipilih dan user diberi dev-visible notice, bukan blank screen.
- Setiap perubahan dilakukan read → validate → immutable update → write.
- Seed fixture punya ID stabil dan tanggal eksplisit agar screenshot/test stabil.
- Sediakan aksi development `Reset data demo` dan pemilih scenario; jangan tampilkan di production build.
- Simpan metadata file saja: nama, size, MIME, status, object URL hanya in-memory untuk preview sesi. Jangan persist blob sensitif di localStorage.
- Jangan menyimpan amortization schedule.
- Jangan menyimpan OTP nyata; mock menerima kode development yang terdokumentasi hanya di mode dev.

### 8.3 Migration storage

`migrations.js` hanya ditambah ketika schema version berubah. Untuk v1, cukup seed/reset. Jangan membuat migration framework generik. Saat v2 benar-benar ada, tambahkan fungsi `migrateV1ToV2` dan fixture test untuk data lama.

---

## 9. Domain components

Komponen berikut adalah target komposisi, bukan instruksi membuat semuanya sejak hari pertama.

### 9.1 Layout/shared

- `AppShell`: header `RuangKPR Command Center`, desktop sidebar, mobile bottom nav, content landmark.
- `PageHeader`: title, subtitle, back action optional.
- `AsyncState`: skeleton/error/empty/partial wrapper sederhana.
- `CurrencyField`: label + prefix Rp + raw input string + accessible error; bukan kalkulator.
- `StatusBadge`, `ProgressStepper`, `LinearProgress`, `SummaryRow`, `ConfirmDialog`: reuse approved/existing patterns.

### 9.2 Home

- `FreshProductGrid`: tepat Primary, Take Over, Refinancing, Multiguna.
- `ExistingMortgageEntry` dengan satu CTA `Pantau KPR Saya`.
- `ResumeApplicationCard` atau `ResumeMortgageSetupCard`.
- `ApplicationStatusCard`, `ActionRequiredCard`, `ApplicationSummaryCard`.
- `FloatingWarningCard`, `KprHealthCard`, `NextPaymentCard`, `MortgageProgressCard`, `OpportunityCard`.
- Home tidak mempunyai chart.

### 9.3 Applications

- `ApplicationStepper` dengan label khusus flow, bukan generic config engine.
- `PrimaryPropertyFields` untuk cabang rumah baru/bekas dalam screen yang sama.
- `FinancialCapacitySummary`.
- `DocumentUploadRow` dengan pending/uploading/uploaded/error/needs_update.
- `BankProgramCard`, `ProgramComparison`, `ReviewSection`.
- `ApplicationTimeline`, `RejectedActions`, `AdditionalDocumentRequest`.

### 9.4 Mortgages

- `MortgageSetupStepper` tepat 6 step.
- `PaymentChangedQuestion` sebagai cabang wajib.
- `RatePeriodEditor` yang memvalidasi urutan/overlap.
- `ReminderSettingGroup`.
- `MortgageLocalTabs`: Overview/Payment/Rate/Property.
- `PropertyEquitySummary` dan disclaimer.
- `PaymentHistory` dengan label user-recorded.

### 9.5 Amortization

- `AmortizationSummary`.
- `AnnualCompositionBars`: SVG/CSS sederhana bila tidak ada chart dependency.
- `ScheduleControls` bulanan/tahunan + filter tahun.
- `AmortizationTable`: desktop 7 kolom; mobile default tahunan dan overflow/expand untuk bulanan.
- `RateTransitionRow/Marker` dengan label estimasi floating.

### 9.6 Explore/Take Over

- `ExploreProductCard` hanya saat mortgage aktif.
- `CurrentMortgageBaseline` sebelum alternatif.
- `TakeoverProgramCard`, `MovingCostBreakdown`, `BreakEvenSummary`.
- `SimulationExitActions`: Simpan/Selesai Simulasi tidak membuat application; Ajukan membuat/melanjutkan draft.

---

## 10. Forms dan validasi

### 10.1 Pola form native React

Per screen:

```js
const [values, setValues] = useState(initialValues);
const [errors, setErrors] = useState({});
const [isSaving, setIsSaving] = useState(false);

async function handleSubmit(event) {
  event.preventDefault();
  const nextErrors = validate(values);
  if (Object.keys(nextErrors).length) {
    setErrors(nextErrors);
    focusFirstInvalidField(nextErrors);
    return;
  }
  // save through adapter, then navigate
}
```

Gunakan shared hook hanya jika pola ini berulang dan hook benar-benar mengurangi kode tanpa menyembunyikan alur.

### 10.2 Normalisasi input

- Input currency menyimpan string editing; saat submit, hapus karakter non-digit dan convert ke integer Rupiah dengan safe-range check.
- Persen UI `5,50` dinormalisasi ke unit rate canonical; formatter tidak dipakai untuk math.
- Date menggunakan input `YYYY-MM-DD` dari native input.
- Checkbox/radio menghasilkan boolean/enum, bukan label display.
- Trim nama/alamat; jangan mengubah kapitalisasi data identitas secara otomatis.

### 10.3 Waktu validasi

- Native attributes (`required`, `min`, `max`, `type`) untuk constraint dasar.
- Error domain setelah blur/submit; jangan memenuhi layar dengan error sebelum user berinteraksi.
- Validasi cross-field saat submit dan saat dependent field berubah.
- Submit disabled saat saving; jangan mengandalkan disabled untuk validasi—handler tetap memvalidasi.
- Error summary/focus field pertama untuk accessibility.

### 10.4 Exact validation rules MVP

**Registrasi:** nama ≥3 karakter; email/nomor format valid; dua consent wajib.  
**OTP mock:** tepat 6 digit; expiry/cooldown ditampilkan deterministik.  
**Primary:** amount positif; DP ≤ harga; loan amount ≤ harga−DP; tenor pilihan valid; jenis pembelian wajib; developer wajib untuk baru; seller optional untuk bekas.  
**Mortgage setup:** tenor 12–360; akad tidak masa depan; due day 1–31; outstanding positif dan ≤ principal awal kecuali special flag; jika payment pernah berubah maka official current outstanding, current rate, rate type, remaining tenor wajib.  
**Rate periods:** rate >0; ordered; no overlap; gap memblok jadwal penuh tetapi boleh menyimpan partial dengan pesan eksplisit.  
**Property:** value optional; jika ada harus positif dan value date tidak masa depan; dispute tidak memblok monitoring.  
**Documents:** JPG/PNG/PDF; ≤5MB default; metadata validation mock, server wajib ulang nanti.  
**Submit application:** seluruh required sections, required docs, satu selected bank product, product version current, dan consent eksplisit.

---

## 11. Calculation pure functions

Semua fungsi:

- menerima input eksplisit;
- tidak membaca `Date.now`, locale, storage, DOM, atau API;
- tidak memformat string display;
- mengembalikan nilai atau structured error;
- menggunakan integer Rupiah untuk uang prototype dan aturan rounding terdokumentasi.

### 11.1 Contract minimum

```js
annuityPayment({ principal, annualRateBps, months })
remainingBalance({ principal, annualRateBps, payment, paidMonths })
solveEffectiveRate({ principal, payment, months, minBps, maxBps, toleranceBps })
validateRatePeriods({ periods, scheduleStart, months })
generateAmortization({ openingPrincipal, months, firstDueDate, ratePeriods })
aggregateScheduleByYear(rows)
calculatePaymentCapacity({ monthlyIncome, jointIncome, debts, ratioBps })
calculateDti({ totalMonthlyDebt, totalMonthlyIncome })
calculatePropertyMetrics({ propertyValue, outstanding })
calculateFixedToFloatingImpact({ outstanding, remainingMonths, currentRateBps, floatingRateBps })
calculateTakeover({ current, proposed, fees, comparisonMonths })
daysUntil({ fromDate, targetDate })
resolveMonthlyDueDate({ year, month, dueDay })
```

### 11.2 Numerical policy

- Rate bps: `550` = 5,50% per tahun.
- Monthly rate berasal dari annual rate sesuai metode produk yang disetujui; MVP anuitas konvensional. Syariah tidak boleh dipaksa ke rumus bunga anuitas tanpa aturan domain terpisah.
- Cicilan dibulatkan ke Rupiah sesuai aturan yang disepakati; final installment disesuaikan agar balance nol dalam toleransi.
- `solveEffectiveRate` memakai bisection bounded, bukan Newton tanpa guard. Gagal jika payment tidak menutup bunga/range tidak punya solusi.
- Due day 29–31 diselesaikan ke hari terakhir bulan yang lebih pendek.
- `now` dan timezone diberikan oleh caller untuk countdown; jangan memakai parse tanggal ambigu.

### 11.3 Financial invariants wajib

Untuk generated schedule:

```text
sum(principal) = opening principal ± toleransi pembulatan
sum(payment) = sum(principal) + sum(interest)
final balance = 0 ± toleransi
setiap closing balance >= 0
opening row berikutnya = closing row sebelumnya
rate transition sesuai period dan ditandai estimate jika floating estimate
```

### 11.4 Error cases

- principal/rate/months invalid;
- zero income untuk DTI;
- payment insufficient to amortize;
- overlapping/gapped periods;
- fixed end in past;
- property value missing/≤ outstanding;
- monthly benefit ≤0: break-even adalah `null` dengan reason, bukan angka positif;
- negative net saving tetap ditampilkan sebagai hasil negatif, bukan disembunyikan.

### 11.5 Precision migration note

Frontend prototype menggunakan integer Rupiah dan integer rate units. Backend produksi menjadi sumber kebenaran kalkulasi dan harus memakai decimal-safe arithmetic serta formula tervalidasi ahli. Frontend dapat mempertahankan pure functions untuk preview, tetapi response backend membawa `calculationVersion`, assumptions, dan authoritative totals; parity fixtures wajib menguji keduanya.

---

## 12. Design tokens approved dan aturan visual

### 12.1 Token yang sudah dikonfirmasi

```css
:root {
  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
  --color-primary: #003da5;
  --color-app-background: #f4f6fa;
}
```

- Header: `RuangKPR Command Center`.
- Desktop: left sidebar.
- Mobile: bottom navigation.
- Lima nav: Home, My KPR, Explore, Activity, Profile.
- Mobile-first; forms satu kolom mobile, maksimal dua kolom desktop.
- Touch target minimum 44×44 px.
- Button pill, card radius/shadow/spacing/icon treatment harus disalin dari artifact approved/existing CSS.

### 12.2 Jangan menebak token

Nilai radius, shadow, spacing scale, border, destructive/success/warning colors, font weights, breakpoints, dan icon sizing tidak lengkap di dokumen teks. Gate 0 wajib mengekstraknya dari artifact approved atau CSS repository. Jangan membuat angka baru lalu menyebutnya approved.

Jika shadcn CSS variables sudah ada, map token approved ke variable existing (`--primary`, `--background`, dan seterusnya) tanpa membuat layer token paralel. Pastikan contrast setelah mapping.

### 12.3 UX constraints

- Home normal: health, next payment, conditional warning, KPR progress, opportunity; tanpa chart.
- Warning H-90 menjadi prioritas visual, card lain tetap ada di bawah.
- Semua floating future diberi label **estimasi**.
- Value properti bukan appraisal; equity bukan dana tunai; KPR Health bukan skor kredit.
- Warna bukan satu-satunya pembeda status.
- Visible focus, keyboard navigation, semantic heading/landmark, error terasosiasi `aria-describedby`.
- Reduced motion dihormati.

---

## 13. Testing pyramid dan exact checks

### 13.1 Pyramid

1. **Pure unit tests (terbanyak):** calculation, validation, lifecycle selectors.
2. **Component/integration tests (secukupnya):** conditional forms, save/resume, state rendering, adapter interactions.
3. **E2E smoke (sedikit):** journey kritis; jangan duplikasi seluruh matrix unit di browser.
4. **Manual visual/accessibility review:** key approved frames di mobile/desktop.

### 13.2 Unit exact checks

**Annuity/amortization**

- principal 600 juta, fixed rate/tenor fixture menghasilkan payment deterministik sesuai golden fixture yang sudah divalidasi domain expert—jangan mengarang expected number dari desain.
- 0% rate menghasilkan principal/months dengan final installment reconciliation.
- 360 bulan selesai tanpa NaN/Infinity.
- invariants sum principal/payment/final balance lulus.
- transisi fixed→fixed→floating memilih rate yang tepat pada boundary date.
- overlap dan gap menghasilkan error yang tepat.
- final payment tidak membuat saldo negatif.

**Solve rate**

- known generated payment menemukan rate asal dalam tolerance.
- payment terlalu kecil/no bracket menghasilkan structured error.
- fungsi tidak dipanggil oleh rule ketika `paymentChanged=true`.

**Affordability/property/takeover**

- DTI 5.750.000/15.000.000 sesuai rounding display 38,3%.
- income 0 menghasilkan unavailable, bukan Infinity.
- equity = property value−outstanding; LTV = outstanding/value.
- property missing menghasilkan partial result.
- moving cost menjumlah semua fee.
- monthly benefit ≤0 menghasilkan break-even null + copy reason.
- net saving memasukkan moving cost.

**Dates/state**

- due day 31 pada Februari resolve ke hari terakhir.
- H-90/H-60/H-30/H-14/H-7 boundary tepat.
- already floating tidak menampilkan countdown.
- home priority memilih rejected > process > application draft > mortgage setup draft > active > fresh.

**Validation**

- rumah baru mewajibkan developer; rumah bekas tidak.
- loan ≤ price−DP.
- payment-changed mewajibkan official outstanding.
- consent/application documents wajib sebelum submit.

### 13.3 Component/integration exact checks

- Home fresh menampilkan tepat 4 produk dan tidak mengandung `secondary`.
- Take Over/Refinancing/Multiguna belum-implemented tidak masuk form Primary.
- existing-KPR card hanya satu CTA `Pantau KPR Saya`.
- Registrasi/OTP tidak memakai numbering application.
- Primary step terlihat konsisten 1/5–5/5.
- Mortgage setup konsisten 1/6–6/6.
- Klik Simpan & Lanjutkan memanggil adapter sekali; typing tidak persist.
- Refresh/re-render dari mock DB membuka current step.
- Conditional developer/seller dan document copy benar.
- Upload reject type/size dan retry tidak mereset form.
- Post-submit screen read-only.
- Action-required card hilang bila tidak ada aksi.
- Explore tanpa mortgage tidak merender tiga product cards; dengan active mortgage merender ketiganya.
- Amortization partial data tidak merender fake table.
- Mobile monthly table mempunyai overflow/expand dan accessible table headers.
- Error retry memanggil load ulang tanpa full-page reload.

### 13.4 E2E exact smoke

**Primary:** register → verify → Home → Primary → 5 steps → upload mock docs → compare → select one program → review consent → submit → tracker; reload di Step 3 membuktikan resume.  
**Rejected:** fixture rejected → kedua CTA menuju compare/perbaikan yang benar; cancel modal tidak delete sebelum confirm.  
**Monitoring:** Home → Pantau → 6 steps; uji branch payment never changed dan changed; activate → Home active → Payment → Amortization.  
**Warning:** H-60 fixture → warning pertama → Rate; floating labels estimate.  
**Responsive:** journey kritis pada viewport mobile dan desktop.

### 13.5 Accessibility checks

- `axe` bila sudah tersedia; jangan tambah dependency hanya untuk menggantikan semantic review kecuali CI accessibility diputuskan.
- Keyboard-only: nav, tabs, dialog, radio, upload, submit.
- Focus masuk dialog dan kembali ke trigger.
- Focus menuju field invalid pertama.
- Status async diumumkan (`aria-live`) tanpa spam.
- Contrast WCAG AA diverifikasi untuk token hasil artifact mapping.

### 13.6 Quality commands

Gunakan scripts repository, jangan menebak. Target gate sebelum merge:

```text
lint pass
unit/component pass
production build pass
E2E smoke pass untuk fase yang sudah memiliki Playwright
manual responsive + approved-visual comparison pass
```

---

## 14. Phased implementation plan

Setiap phase menghasilkan increment clickable dan tidak menunggu backend.

### Phase 0 — Discovery dan baseline

**Dependencies:** repository + approved artifacts dapat diakses.  
**Tasks:** jalankan Gate 0; mapping token; inventory shadcn; baseline commands; sepakati package manager; adaptasi folder/route plan.  
**DoD:** seluruh output Gate 0 selesai; tidak ada asumsi repository tersisa; build baseline diketahui.

### Phase 1 — Foundation shell, adapter, fixtures

**Dependencies:** Phase 0.  
**Tasks:**

- AppShell approved, responsive sidebar/bottom-nav.
- Router hanya bila diperlukan/absent.
- Mock DB v1, seed scenarios, reset dev action.
- API facade + session/dashboard minimum.
- Formatter Rupiah/tanggal/persen.
- Async loading/error/empty primitives.
- Home selector + Home fresh fixture.

**DoD:** `/home` deep-link/refresh bekerja; 5 nav keyboard-accessible; Home fresh tepat empat produk; no `secondary`; mock reset bekerja; lint/test/build pass.

### Phase 2 — KPR Primary end-to-end mock

**Dependencies:** Phase 1; approved Primary visual.  
**Tasks:**

- register/verify mock;
- Primary 5-step flow;
- native form validation dan branching new/used;
- draft create/save/resume/delete;
- mock document metadata upload;
- DTI/capacity pure functions;
- bank fixture list, compare, selected one program;
- review/consent/submit;
- Home/My KPR draft/process/rejected states;
- tracker, additional-doc, rejected actions, cancel confirmation.

**DoD:** Primary E2E smoke lulus; refresh resume lulus; one application=one bank; post-submit read-only; exact component checks lulus; no other product masquerades as implemented.

### Phase 3 — Existing KPR setup

**Dependencies:** Phase 1 + calculation foundation; boleh paralel setelah Primary shell stabil, tetapi jangan duplikasi component patterns.  
**Tasks:**

- Intro monitoring + disclosure.
- Mortgage draft and 6-step wizard.
- Payment-changed branch.
- Rate-period editor + validation.
- Property/financial/reminder forms.
- Save per step, resume, delete draft.
- Activate to mortgage active; never create application.

**DoD:** kedua payment branches diuji; solve rate hanya pada valid branch; missing property tidak memblok reminder; activation yields mortgage active; mock persistence/reload pass.

### Phase 4 — Monitoring dashboard dan My KPR

**Dependencies:** Phase 3.  
**Tasks:**

- Home normal/warning/floating/partial.
- KPR Health presentation dengan formula sementara jelas/config input, bukan bank score.
- Next payment + manual status.
- My KPR tabs Overview/Payment/Rate/Property.
- Activity fixture dan Profile reminder settings.
- Exact disclaimers dan conditional Explore visibility.

**DoD:** state priority tests pass; no chart Home; H-90 boundary pass; manual payment label benar; five nav always clickable; partial data tidak menghasilkan angka palsu.

### Phase 5 — Calculation engine dan amortisasi

**Dependencies:** Phase 3 rate/outstanding data; formula review dari domain expert untuk golden fixtures.  
**Tasks:**

- annuity, remaining balance, rate periods, schedule, annual aggregation;
- integer money/rounding/final reconciliation;
- summary, annual composition, monthly/yearly controls;
- responsive table and transition markers;
- calculation error/partial state;
- complete unit fixture suite.

**DoD:** seluruh financial invariants lulus untuk fixtures; 360 months performant; mobile yearly default; monthly accessible; no persisted schedule; disclaimer visible.

### Phase 6 — Take Over dan Top-up

**Dependencies:** stable calculations, mortgage/profile model, bank products fixture; approved Take Over artifact.  
**Tasks:**

- cold-entry vs existing-prefilled entry;
- current mortgage baseline;
- takeover/top-up shared flow and requested top-up branch;
- costs, break-even, net saving, LTV/top-up;
- compare/detail/two exit actions;
- product-specific docs/review/tracker;
- old KPR settlement stage;
- completed conversion fixture to active mortgage.

**DoD:** both branches E2E; benefit≤0 no fake break-even; all fees visible; one bank; settlement warning; simulation does not submit; completion uses final snapshot.

### Phase 7 — Hardening dan handoff backend

**Dependencies:** target frontend journeys complete; backend contract available.  
**Tasks:** accessibility pass; visual comparison; failure matrix; performance; adapter contract fixtures; remove debug UI from production; environment config; HTTP adapter implementation only now.  
**DoD:** quality gates pass; no production sensitive data in localStorage; backend switch can be environment/config import; parity fixtures documented; open compliance decisions block production features as needed.

### Dependency graph

```text
0 Discovery
└─ 1 Foundation
   ├─ 2 Primary
   └─ 3 Mortgage Setup
      ├─ 4 Monitoring/My KPR
      └─ 5 Calculations/Amortization
         └─ 6 Take Over/Top-up
            └─ 7 Backend hardening
```

---

## 15. Task slicing dan merge discipline

Satu task/PR harus vertikal dan dapat diverifikasi, contoh:

1. `Home fresh + shell + exact four products`.
2. `Primary draft create + Step 1 save/resume`.
3. `Primary property branching + tests`.
4. `Document mock upload states`.
5. `Compare/select/review/submit`.
6. `Tracker/rejected/cancel`.
7. `Mortgage setup Step 1–2 branches`.
8. `Mortgage setup Step 3–6 activation`.
9. `Monitoring Home state selector + cards`.
10. `My KPR tabs`.
11. `Amortization engine + fixture tests`.
12. `Amortization responsive UI`.

Hindari PR horizontal besar seperti “buat semua komponen”, “buat semua services”, atau “buat semua types”. JavaScript tetap memakai JSDoc hanya pada contract/non-obvious calculation, bukan TypeScript-by-comment di setiap prop.

---

## 16. Claude Code execution instructions

### 16.1 Operating rules

1. Mulai dari `/home/ubuntu`, temukan repository; jangan `cd /workspace` dan jangan menebak path.
2. Baca empat dokumen sumber dan artifact approved yang tersedia.
3. Jalankan Gate 0 penuh sebelum edit.
4. Tampilkan ringkasan inspeksi dan pilih implementasi minimum yang cocok dengan codebase.
5. Kerjakan satu phase/task vertikal; jangan scaffold phase masa depan.
6. Reuse package, scripts, aliases, shadcn components, dan patterns existing.
7. JavaScript/JSX saja; jangan menambah TypeScript atau mengubah konfigurasi proyek ke TS.
8. Jangan install dependency tanpa membuktikan belum ada solusi native/existing.
9. Untuk logic finansial: tulis test fixture terlebih dahulu atau bersamaan, lalu implement pure function.
10. Setelah edit, jalankan lint/test/build yang relevan dan E2E untuk journey yang berubah.
11. Periksa diff: tidak ada artifact generated/lockfile change tak disengaja, secret, atau data sensitif.
12. Laporan selesai harus berisi file berubah, checks nyata beserta hasil, simplifikasi sengaja, dan blocker.

### 16.2 Prompt eksekusi yang dapat diberikan ke Claude Code

```text
Kerjakan hanya task [NAMA TASK] dari
/home/ubuntu/ruangkpr-docs/05-FRONTEND-ARCHITECTURE-DELIVERY.md.

Sebelum coding:
- temukan repo nyata dari /home/ubuntu;
- baca package.json, lockfile, Vite config, components.json, src/main, App,
  router/providers, globals/tokens, src/components/ui, tests, dan artifact approved;
- laporkan komponen/dependency/pattern yang akan direuse;
- jangan berasumsi struktur target sudah ada.

Batas:
- Vite + React JavaScript, bukan TypeScript;
- shadcn/ui existing first;
- native React forms kecuali react-hook-form/Zod sudah installed dan menjadi pola repo;
- tambah react-router-dom hanya bila absent dan route nyata memerlukannya;
- tidak Redux/Zustand/Query/Axios;
- jangan bangun feature phase berikutnya;
- jangan ubah visual approved;
- semua persistence lewat API adapter, tidak direct localStorage dari component;
- calculation harus pure dan memiliki runnable tests.

Selesai hanya setelah lint/test/build yang tersedia benar-benar dijalankan.
Laporkan command dan output status, file berubah, serta hal yang sengaja tidak dibuat.
```

### 16.3 Per-task loop

```text
inspect relevant callers/files
→ identify smallest reuse path
→ write/adjust focused test for non-trivial rule
→ implement minimum
→ run focused test
→ run lint + full relevant suite + build
→ inspect diff
→ manual click/Playwright critical path
→ report evidence
```

### 16.4 Stop conditions

Claude Code harus berhenti dan meminta keputusan bila:

- repository/artifact approved tidak ditemukan;
- package manager/lockfile konflik;
- formula financial expected fixtures belum divalidasi;
- visual token yang dibutuhkan tidak ada dan harus ditebak;
- backend/compliance decision diperlukan untuk perilaku irreversible;
- change akan menghapus/menimpa kerja existing yang tidak terkait.

---

## 17. Migration path ke backend

### 17.1 Prinsip

UI hanya bergantung pada `api` contract. Migration dilakukan endpoint per endpoint, bukan big bang dan bukan mengganti domain component.

### 17.2 Tahapan

1. **Freeze mock contract:** simpan request/response fixtures untuk session, dashboard, draft, products, submit, mortgage, activity.
2. **Backend contract review:** samakan enum/status, date, money/rate units, pagination, validation errors, revision/concurrency, product version, calculation version.
3. **Implement `httpApi.js`:** native `fetch`, credentials/token sesuai auth keputusan, JSON parsing, timeout/abort, error mapping. Jangan menambah Axios.
4. **Environment selection:** dev dapat memilih mock; staging/production HTTP. Selection satu kali di `data/api.js`, bukan conditional di components.
5. **Migrate reads first:** session/profile, products, dashboard snapshot, application/mortgage detail.
6. **Migrate reversible writes:** draft save, settings, manual payment.
7. **Migrate risky writes:** document upload, submit, cancel, retry/clone setelah auth/consent/retention siap.
8. **Calculation parity:** backend authoritative; frontend preview dibandingkan fixture; display response backend setelah submit.
9. **Remove production persistence:** localStorage demo hanya aktif mode mock/dev; production tidak seed PII.
10. **Observability:** correlation/request id, sanitized error logging, no PII/document URLs in logs.

### 17.3 Endpoint mapping candidate

Nama final mengikuti backend, tetapi capabilities minimum:

```text
GET    /session
POST   /auth/register
POST   /auth/verify
DELETE /session
GET    /dashboard
GET    /applications/active
POST   /applications
GET    /applications/:id
PATCH  /applications/:id/steps/:step
POST   /applications/:id/documents
DELETE /applications/:id/documents/:documentId
POST   /applications/:id/select-program
POST   /applications/:id/submit
DELETE /applications/:id
POST   /applications/:id/retry
POST   /applications/:id/clone
GET    /mortgages/active
POST   /mortgages
PATCH  /mortgages/:id/setup/:step
POST   /mortgages/:id/activate
PATCH  /mortgages/:id/:section
GET    /bank-products
GET    /activity
GET    /profile
PATCH  /profile
```

### 17.4 File upload migration

- Mock metadata upload diganti multipart/direct signed upload.
- Backend melakukan content-type, size, malware scanning, authorization, private storage, signed preview URL.
- UI state tetap pending → uploading → uploaded → verified/needs_update/error.
- Retry idempotent dan tidak menghapus form.

### 17.5 Auth/security migration

- Jangan menyimpan production auth token di localStorage bila secure cookie tersedia.
- Backend menegakkan ownership; frontend guard hanya UX.
- OTP rate limit/expiry, consent versions, audit logs, file access, retention, dan cross-user denial diuji server-side.
- Hard-delete submitted application tidak diaktifkan produksi sebelum legal/compliance memastikan retention policy.

### 17.6 Calculation migration

- Request menyertakan canonical inputs dan bank product version.
- Response menyertakan results, assumptions, warnings, `calculationVersion`, dan timestamp.
- Frontend formatter tetap lokal; math authoritative berasal backend untuk submit/tracker.
- Golden fixtures yang sama dijalankan pada frontend dan backend untuk parity.
- Jika mismatch melewati tolerance, blok submit atau tampilkan calculation unavailable; jangan memilih angka yang lebih nyaman.

### 17.7 Backend migration DoD

- Semua production routes tidak membaca mock DB/localStorage domain data.
- Contract/integration tests pass.
- Cross-user access denied.
- Refresh/deep-link/resume tetap berfungsi.
- Errors dipetakan ke field/global/retry state.
- Product/calculation versions tersimpan pada application snapshot.
- No PII/secrets di console/log.
- Critical E2E pass terhadap staging backend.

---

## 18. Non-functional release checklist

### Performance

- Dashboard usable target <3 detik pada mobile 4G diuji, bukan diasumsikan.
- Calculation interaktif target <200ms lokal.
- Amortisasi 360 rows tidak memblok UI; optimasi hanya jika profiling menunjukkan masalah.
- Route-level lazy loading hanya jika bundle measurement membuktikan perlu; jangan premature split semua file.

### Accessibility

- WCAG 2.1 AA target.
- 44×44 touch targets.
- Keyboard/focus/error semantics lulus.
- Table caption/header benar.
- Status bukan warna saja.

### Content integrity

- `estimasi` tampil pada floating, appraisal/value, eligibility, dan pre-approval results.
- `user-recorded` tampil pada pembayaran manual.
- Tidak ada klaim WhatsApp/bank sync tanpa provider.
- Tidak ada AI-generated authoritative financial number.

### Data integrity

- Autosave hanya Continue; upload save per file.
- One active draft/application/mortgage prototype rule konsisten.
- Simulation tidak membuat submitted application.
- Monitoring activation tidak membuat application.
- Submitted snapshot read-only.

---

## 19. Definition of Done frontend

Sebuah phase/task belum selesai sampai:

1. Acceptance behavior sesuai PRD dan artifact approved.
2. Loading, empty, error, partial, disabled/saving states relevan tersedia.
3. Mobile dan desktop verified.
4. Keyboard/accessibility baseline verified.
5. Non-trivial rules memiliki runnable tests.
6. Lint, relevant tests, dan production build pass.
7. Critical changed journey diklik nyata atau E2E pass.
8. Komponen tidak direct access localStorage/network.
9. Tidak ada dependency/abstraction speculative.
10. Tidak ada angka/visual token/claim integrasi yang ditebak.
11. File dan route yang belum dibutuhkan tidak dibuat.
12. Hasil check nyata dicatat pada PR/task report.

---

## 20. Deliberate deferrals

- Backend/auth/storage/provider nyata: tambah setelah contract dan vendor dipilih.
- Simulation history: tambah ketika requirement riwayat nyata disetujui.
- Multi-draft/multi-mortgage: tambah ketika demand terbukti.
- OCR/eKYC/SLIK/WhatsApp/property valuation: tambah setelah provider dan compliance siap.
- Full Refinancing/Multiguna: jangan scaffold; reuse calculation/application foundation saat policy partner tervalidasi.
- AI/chatbot: tidak diperlukan untuk MVP deterministik.
- Persisted amortization rows/cache: tambah hanya untuk audit/export/performance yang terukur.
- Dedicated state/data-fetching library: tambah hanya jika server synchronization/concurrency menjadi masalah nyata yang tidak lagi sederhana dengan adapter + page state.

---

## 21. Final build order recommendation

Urutan minimum yang memberikan nilai paling cepat dan risiko terkontrol:

```text
Inspect real repo
→ approved shell + fresh Home
→ Primary end-to-end
→ existing KPR setup
→ monitoring Home/My KPR
→ validated amortization engine
→ Take Over/Top-up
→ backend adapter migration
```

Urutan ini sengaja tidak membangun semua domain sekaligus. Ia membuktikan shell, form, adapter, dan persistence pada Primary; memakai ulang fondasi untuk monitoring; lalu menunda math dan opportunity yang lebih berisiko sampai fixture serta formula dapat divalidasi.
