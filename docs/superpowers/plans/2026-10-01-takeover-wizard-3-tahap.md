# Wizard Take Over & Refinancing 3 Tahap: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wizard Take Over (sekaligus Refinancing + Top-up) tampil sebagai 3 tahap. Persennya bulat dan naik cepat di awal. Tahap 1 ditutup layar milestone "Tahap 1 selesai", dan Tahap 2 ditutup banner "Tahap 2 selesai" di Baseline.

**Architecture:**
- Ada 9 "layar progress" (1–9) yang dipetakan ke 3 tahap lewat helper murni di `meta.js`. Helper ini dipakai bersama Primary.
- `OptimizeHeader` menerima nomor layar, bukan step 1–7. Route, autosave, dan `currentStep` tidak berubah.
- Milestone 1 memakai `location.state` pada `/optimize/3`. Milestone 2 berupa banner di `BaselinePage`.
- Kerangka milestone dipakai bersama Primary lewat `src/components/shared/milestone.jsx`.

**Tech Stack:** React 19, React Router, Vite, Tailwind, Vitest (`npm test`), Playwright (`npm run e2e`), oxlint (`npm run lint`).

**Spec:** `docs/superpowers/specs/2026-10-01-takeover-wizard-3-tahap-design.md` (pola dasar: `docs/superpowers/specs/2026-10-01-primary-wizard-3-tahap-design.md`)

## Prasyarat (sebelum Task 1)

Pekerjaan Primary (sub-proyek 1) **harus sudah di-commit**. Plan ini memakai `primaryProgress`, prop `percent` di `WizardProgress`, dan `PrimaryMilestone.jsx` dari pekerjaan itu, dan juga mengubahnya.

Jalankan `git status --short | grep -v graphify-out`. Hasilnya harus kosong. Kalau masih ada file lain yang berubah (misalnya `MonitoringDashboard.jsx`, `MyKprTabs.jsx`, `derive.js`), commit atau stash dulu. Setiap task di bawah hanya meng-commit file yang disebut di task itu.

## Global Constraints

- UI hanya mengakses data lewat `src/data/api.js`. `mockDb.js` tetap satu-satunya batas localStorage. Tidak ada dependency baru.
- Nama tahap persis seperti ini: `Kamu & KPR Lama`, `Kondisi & Tujuan`, `Pilih Bank & Kirim`.
- Persen per layar 1–9: `[10, 20, 30, 45, 55, 65, 75, 85, 95]`.
- Label progress: `Bagian {tahap} dari 3 · {nama tahap}`. Teks sr-only: `{persen}% selesai.`
- Route `/optimize/*`, autosave per layar, `app.currentStep`, dan alur simulasi dari Explore (`/optimize/start`) tidak berubah.
- Disclaimer milestone 1, persis: `Estimasi dari data KPR lama yang kamu isi, bukan angka resmi bank.`
- Visual mengikuti pola yang ada: `Panel` radius 24px, token warna yang ada, tombol tinggi ≥ 44px, grid 1 kolom di mobile dan 3 kolom mulai `lg` (1024px). Tidak ada animasi dekoratif.
- Gaya kode per file: `OptimizeSteps.jsx` dan `HomePage.jsx` memakai tanda kutip ganda dan titik koma. File lain memakai kutip tunggal tanpa titik koma.
- Pesan commit diakhiri baris `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Jalur estimasi KPR lama (`rateType: null`).** Milestone 1 harus tetap menampilkan sisa bunga, dengan status bunga "Belum diketahui". Dijaga oleh test di Task 2.
2. **Baseline dari simulasi Explore (sumber `mortgage`).** Tidak boleh menampilkan "Tahap 2 selesai". Dijaga oleh e2e di Task 6.
3. **Teaser mode Top-up.** Harus mencakup program yang memenuhi dana, tidak ada yang memenuhi, dan 0 program. Dijaga oleh unit test di Task 6.
4. **Reload atau back setelah klik "Lanjut ke Tahap 2".** Milestone tidak boleh muncul lagi. Dijaga oleh e2e di Task 5.
5. **Kembali mengedit layar sebelumnya.** Persen tetap memakai layar terjauh yang tersimpan, misalnya Pekerjaan tetap 45% setelah KPR lama dikonfirmasi. Dijaga oleh e2e di Task 3.

---

### Task 1: Helper progress Take Over di `meta.js`

**Files:**
- Modify: `src/domains/applications/meta.js`
- Test: `src/domains/applications/meta.test.js`

**Interfaces:**
- Consumes: `PRIMARY_PHASES`, `PRIMARY_PERCENT`, `PRIMARY_STEPS` (sudah ada di `meta.js`)
- Produces:
  - `TAKEOVER_PHASES: { label: string, screens: number[] }[]`
  - `TAKEOVER_PERCENT: number[]`
  - `takeoverProgress(screen: 1..9) → { phase: 1|2|3, label: string, position: number, percent: number }`
  - `takeoverScreenOf(app) → 1..9`
  - `draftProgress(app) → { phase, label, position, percent }`
  - `primaryProgress(screen)` tetap dengan signature dan hasil yang sama

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `src/domains/applications/meta.test.js`, lalu ganti baris import di atas file:

```js
import { describe, expect, it } from 'vitest'
import { draftProgress, primaryProgress, takeoverProgress, takeoverScreenOf } from './meta'
```

```js
describe('takeoverProgress', () => {
  it('maps the 9 Take Over screens onto 3 phases ending at the same 45% / 75% as Primary', () => {
    const p = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(takeoverProgress)
    expect(p.map((x) => x.phase)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3])
    expect(p.map((x) => x.percent)).toEqual([10, 20, 30, 45, 55, 65, 75, 85, 95])
    expect(p.map((x) => Math.round(x.position * 1000) / 1000)).toEqual([1, 1.333, 1.667, 2, 2.333, 2.667, 3, 3.333, 3.667])
    expect(p.map((x) => x.label)).toEqual(['Kamu & KPR Lama', 'Kamu & KPR Lama', 'Kamu & KPR Lama', 'Kondisi & Tujuan', 'Kondisi & Tujuan', 'Kondisi & Tujuan', 'Pilih Bank & Kirim', 'Pilih Bank & Kirim', 'Pilih Bank & Kirim'])
  })
})

describe('takeoverScreenOf', () => {
  it('maps currentStep to the furthest saved screen; step 6 depends on the program pick', () => {
    const at = (currentStep, selection = null) => takeoverScreenOf({ currentStep, selection })
    expect([1, 2, 3, 4, 5].map((s) => at(s))).toEqual([1, 3, 4, 5, 6])
    expect(at(6)).toBe(7)
    expect(at(6, { bankProductId: 'bpr_x' })).toBe(8)
    expect(at(7, { bankProductId: 'bpr_x' })).toBe(9)
  })
})

describe('draftProgress', () => {
  it('reads Primary and Take Over drafts in their own phase tables', () => {
    expect(draftProgress({ productType: 'primary', currentStep: 3 })).toMatchObject({ phase: 2, label: 'Rumah & Pinjaman', percent: 45 })
    expect(draftProgress({ productType: 'primary', currentStep: 9 })).toMatchObject({ phase: 3, percent: 95 })
    expect(draftProgress({ productType: 'takeover', currentStep: 3, selection: null })).toMatchObject({ phase: 2, label: 'Kondisi & Tujuan', percent: 45 })
    expect(draftProgress({ productType: 'takeover', currentStep: 6, selection: null })).toMatchObject({ phase: 3, percent: 75 })
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/domains/applications/meta.test.js`
Expected: FAIL, karena `takeoverProgress is not a function` (atau import tidak ditemukan)

- [ ] **Step 3: Implementasi minimal**

Di `src/domains/applications/meta.js`, ganti fungsi `primaryProgress` yang sekarang (blok komentar `// \`position\` is ...` beserta fungsinya) dengan:

```js
// `screen` is the 1-based progress screen; `position` the fractional bar position (2nd of 2 screens → 1.5)
// that WizardProgress takes as `reached`.
function phaseProgress(phases, percents, screen) {
  const i = phases.findIndex((p) => p.screens.includes(screen))
  const { label, screens } = phases[i]
  return { phase: i + 1, label, position: i + 1 + screens.indexOf(screen) / screens.length, percent: percents[screen - 1] }
}
export const primaryProgress = (screen) => phaseProgress(PRIMARY_PHASES, PRIMARY_PERCENT, screen)

// Take Over has 9 progress screens: 1 Data pribadi, 2 Pekerjaan, 3 KPR lama, 4 Kemampuan bayar, 5 Properti,
// 6 Tujuan, 7 Baseline & program, 8 Dokumen, 9 Review. Phase ends land on the same 45% / 75% as Primary.
export const TAKEOVER_PHASES = [
  { label: 'Kamu & KPR Lama', screens: [1, 2, 3] },
  { label: 'Kondisi & Tujuan', screens: [4, 5, 6] },
  { label: 'Pilih Bank & Kirim', screens: [7, 8, 9] },
]
export const TAKEOVER_PERCENT = [10, 20, 30, 45, 55, 65, 75, 85, 95]
export const takeoverProgress = (screen) => phaseProgress(TAKEOVER_PHASES, TAKEOVER_PERCENT, screen)

// Furthest saved Take Over screen. currentStep 6 is the compare phase until a program is picked.
export function takeoverScreenOf(app) {
  const s = app.currentStep
  if (s <= 1) return 1
  if (s === 2) return 3
  if (s <= 5) return s + 1
  if (s === 6) return app.selection ? 8 : 7
  return 9
}

// Home "Lanjutkan pengajuan" card: the same phase, label and percent the wizard shows.
export const draftProgress = (app) =>
  app.productType === 'primary' ? primaryProgress(Math.min(app.currentStep, PRIMARY_STEPS.length)) : takeoverProgress(takeoverScreenOf(app))
```

`draftProgress` dipakai di bawah `productName`/`stepsOf`. Karena memakai `const`, letakkan blok ini **setelah** deklarasi `PRIMARY_PHASES` dan `PRIMARY_PERCENT`. Posisinya sama dengan fungsi lama.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/domains/applications/meta.test.js`
Expected: PASS, 4 test (termasuk `primaryProgress` lama)

- [ ] **Step 5: Commit**

```bash
git add src/domains/applications/meta.js src/domains/applications/meta.test.js
git commit -m "feat(takeover): peta 9 layar progress ke 3 tahap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `goalConditions` mengembalikan biaya tetap di bank lama

**Files:**
- Modify: `src/domains/optimize/insights.js:45-56` (objek return `goalConditions`)
- Test: `src/domains/optimize/insights.test.js`

**Interfaces:**
- Consumes: `takeoverBaseline()` dari `@/calculations/programs` (sudah dipanggil di `goalConditions`)
- Produces: `goalConditions(data, clock)` mendapat 2 field tambahan: `totalInterest: number | null` dan `payoffDate: 'YYYY-MM-DD' | null`

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di dalam `describe('goalConditions', ...)` di `src/domains/optimize/insights.test.js`:

```js
  it('prices staying with the old bank for the phase 1 milestone', () => {
    const c = goalConditions(data, clock)
    expect(c.totalInterest).toBe(500_000_000) // 180 × Rp5 jt − Rp400 jt sisa pokok
    expect(c.payoffDate).toBe('2041-09-12')
  })

  it('still prices staying on the estimate path, where the rate type is unknown', () => {
    const c = goalConditions({ ...data, oldLoan: { ...data.oldLoan, rateType: null } }, clock)
    expect(c.rate.mode).toBeNull()
    expect(c.totalInterest).toBe(500_000_000)
  })

  it('leaves staying costs null until the old loan is complete', () => {
    const c = goalConditions({ ...data, oldLoan: { originalPrincipal: 500_000_000 } }, clock)
    expect(c.totalInterest).toBeNull()
    expect(c.payoffDate).toBeNull()
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/domains/optimize/insights.test.js`
Expected: FAIL, karena `expected undefined to be 500000000`

- [ ] **Step 3: Implementasi minimal**

Di `src/domains/optimize/insights.js`, di objek `return` milik `goalConditions`, tambahkan tepat setelah baris `exitCosts: baseline?.exit.total ?? null,`:

```js
    // What staying costs (phase 1 milestone): interest left and payoff month at the recorded payment.
    totalInterest: baseline?.totalInterest ?? null,
    payoffDate: baseline?.payoffDate ?? null,
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/domains/optimize/insights.test.js`
Expected: PASS, semua test

- [ ] **Step 5: Commit**

```bash
git add src/domains/optimize/insights.js src/domains/optimize/insights.test.js
git commit -m "feat(takeover): sisa bunga & perkiraan lunas di goalConditions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `OptimizeHeader` 3 tahap di semua layar Take Over

**Files:**
- Modify: `src/domains/optimize/shared.jsx` (`OptimizeHeader` dan import)
- Modify: `src/domains/optimize/OptimizeSteps.jsx:109-187` (`OptimizeStepPage`) dan import
- Modify: `src/domains/optimize/OldLoanPages.jsx:51,168` dan import
- Modify: `src/domains/optimize/ProgramPages.jsx:63-66` (`Header`)
- Test: `tests/e2e/takeover-flow.spec.js`

**Interfaces:**
- Consumes: `TAKEOVER_PHASES`, `takeoverProgress`, `takeoverScreenOf` (Task 1), dan prop `percent` di `WizardProgress` (sub-proyek 1)
- Produces: `OptimizeHeader({ screen?: 1..9, reached?: 1..9 = screen, title, subtitle, back, saving })`. Tanpa `screen`, progress tidak tampil, seperti `OptimizeIntro` dan `GoalStartPage` sekarang. Prop `n` dan `comparePhase` dihapus.

- [ ] **Step 1: Ubah e2e supaya gagal**

Di `tests/e2e/takeover-flow.spec.js`, test `cold-entry take over ...`:

1. Ganti dua baris berikut:

```js
  await expect(page).toHaveURL(/optimize\/1$/)
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
```

dengan:

```js
  await expect(page).toHaveURL(/optimize\/1$/)
  await expect(page.getByText('Bagian 1 dari 3 · Kamu & KPR Lama')).toBeVisible()
  await expect(page.getByText('10% selesai.')).toBeAttached()
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
```

2. Ganti:

```js
  await expect(page.getByText('7% selesai.')).toBeAttached() // saved personal data moves the percent within step 1
```

dengan:

```js
  await expect(page.getByText('20% selesai.')).toBeAttached() // Pekerjaan is its own progress screen
```

3. Ganti:

```js
  await expect(page).toHaveURL(/optimize\/3/) // Kemampuan bayar
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
```

dengan:

```js
  await expect(page).toHaveURL(/optimize\/3/) // Kemampuan bayar
  // Going back to edit keeps the furthest saved percent instead of dropping it.
  await page.goto('/optimize/1/pekerjaan')
  await expect(page.getByText('45% selesai.')).toBeAttached()
  await page.goto('/optimize/3')
  await expect(page.getByText('Bagian 2 dari 3 · Kondisi & Tujuan')).toBeVisible()
  await page.getByRole('button', { name: 'Isi contoh data' }).click()
```

- [ ] **Step 2: Jalankan e2e, pastikan gagal**

Run: `npx playwright test tests/e2e/takeover-flow.spec.js -g "cold-entry"`
Expected: FAIL di `Bagian 1 dari 3 · Kamu & KPR Lama` (label masih `Step 1 dari 7 · ...`)

- [ ] **Step 3: Implementasi `OptimizeHeader`**

Di `src/domains/optimize/shared.jsx`:
- ganti import `import { TAKEOVER_STEPS } from '@/domains/applications/meta'` dengan `import { TAKEOVER_PHASES, takeoverProgress } from '@/domains/applications/meta'`;
- ganti seluruh fungsi `OptimizeHeader` dengan:

```jsx
const PHASE_LABELS = TAKEOVER_PHASES.map((p) => p.label)

// `screen` is the Take Over progress screen on display (1–9, see takeoverProgress); `reached` the furthest
// saved one, so stepping back to edit never lowers the percent. No `screen` → no progress (intro, Explore).
export function OptimizeHeader({ screen, reached = screen, title, subtitle, back, saving }) {
  const shown = screen && takeoverProgress(screen)
  const furthest = screen && takeoverProgress(Math.max(screen, reached))
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} back={back} />
      {screen && (
        <WizardProgress
          label={`Bagian ${shown.phase} dari 3 · ${shown.label}`}
          steps={PHASE_LABELS}
          current={shown.phase}
          reached={furthest.position}
          percent={furthest.percent}
          saving={saving}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Implementasi `OptimizeStepPage`**

Di `src/domains/optimize/OptimizeSteps.jsx`:

a. Tambahkan import setelah blok import `@/domains/applications/validation`:

```jsx
import { takeoverScreenOf } from "@/domains/applications/meta";
```

b. Tambahkan konstanta setelah `YES_NO_CHANGED`:

```jsx
// Screen names under the page title; the "Bagian X dari 3" label lives in the progress card.
const SUBTITLES = {
  1: "Data pribadi",
  2: "KPR lama",
  3: "Kemampuan bayar",
  4: "Properti",
  5: "Tujuan",
  6: "Dokumen",
  7: "Review",
};
```

c. Di `OptimizeStepPage`, ganti blok dari `const subtitle =` sampai penutup `<OptimizeHeader ... />`, yaitu:

```jsx
  const subtitle =
    n === 1
      ? `Step 1/7 · ${employment ? "Pekerjaan & penghasilan" : "Data pribadi"}`
      : `Step ${n}/7`;

  return (
    <>
      <OptimizeHeader
        n={n}
        // Personal data is already saved here (guarded above): count it as half of step 1.
        reached={employment ? Math.max(app.currentStep, 1.5) : app.currentStep}
        title={`Pengajuan ${PN}`}
        subtitle={subtitle}
        back={fromReview ? "/optimize/7" : back}
      />
```

dengan:

```jsx
  // Progress screens (takeoverProgress): 1 Data pribadi, 2 Pekerjaan, step n → n + 1 up to Tujuan, then Dokumen 8, Review 9.
  const screen = n === 1 ? (employment ? 2 : 1) : n <= 5 ? n + 1 : n + 2;
  const subtitle =
    n === 1 && employment ? "Pekerjaan & penghasilan" : SUBTITLES[n];

  return (
    <>
      <OptimizeHeader
        screen={screen}
        reached={takeoverScreenOf(app)}
        title={`Pengajuan ${PN}`}
        subtitle={subtitle}
        back={fromReview ? "/optimize/7" : back}
      />
```

- [ ] **Step 5: Implementasi `OldLoanPages` dan `ProgramPages`**

`src/domains/optimize/OldLoanPages.jsx`:
- tambahkan import `import { takeoverScreenOf } from '@/domains/applications/meta'` setelah import `@/components/shared/ui`;
- baris 51: ganti `<OptimizeHeader n={2} reached={app.currentStep} title={...} subtitle="Step 2/7 · KPR lama" back="/optimize/2" />` jadi:

```jsx
      <OptimizeHeader screen={3} reached={takeoverScreenOf(app)} title={`Pengajuan ${modeName(app.optimizationMode)}`} subtitle="KPR lama" back="/optimize/2" />
```

- baris 168: ganti jadi:

```jsx
      <OptimizeHeader screen={3} reached={takeoverScreenOf(app)} title={`Pengajuan ${modeName(app.optimizationMode)}`} subtitle="KPR lama" back={changed ? '/optimize/2' : '/optimize/2/estimasi'} />
```

`src/domains/optimize/ProgramPages.jsx`, di fungsi `Header`, ganti baris return dengan:

```jsx
  return <OptimizeHeader screen={fromApp ? 7 : null} title={title} subtitle={subtitle} back={back} />
```

- [ ] **Step 6: Jalankan e2e dan unit test, pastikan lulus**

Run: `npx playwright test tests/e2e/takeover-flow.spec.js`
Expected: PASS, semua test di file (termasuk alur Explore, karena tanpa `screen` tidak ada progress)

Run: `npm run lint`
Expected: tidak ada error. Kalau ada `TAKEOVER_STEPS` yang tidak terpakai di `shared.jsx`, importnya sudah diganti di Step 3.

- [ ] **Step 7: Commit**

```bash
git add src/domains/optimize/shared.jsx src/domains/optimize/OptimizeSteps.jsx src/domains/optimize/OldLoanPages.jsx src/domains/optimize/ProgramPages.jsx tests/e2e/takeover-flow.spec.js
git commit -m "feat(takeover): progress 3 tahap dengan persen bulat

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Kerangka milestone bersama, dipakai dulu oleh Primary

**Files:**
- Create: `src/components/shared/milestone.jsx`
- Modify: `src/lib/format.js` (tambah `rupiahApprox` setelah `rupiahShort`)
- Modify: `src/domains/applications/PrimaryMilestone.jsx` (ditulis ulang memakai kerangka bersama, perilaku sama)
- Test: `tests/e2e/primary-flow.spec.js` (regresi, tidak diubah)

**Interfaces:**
- Produces:
  - `MilestonePanel({ title: string, sub: string, disclaimer: string, onBack: () => void, onNext: () => void, nextLabel: string, children })`
  - `InsightGrid({ items: { k: string, v: ReactNode, sub?: ReactNode }[] })`
  - `rupiahApprox(n: number) → string`, contoh `660_456_611 → '± Rp660 jt'`

- [ ] **Step 1: Pastikan e2e Primary hijau sebelum refactor**

Run: `npx playwright test tests/e2e/primary-flow.spec.js`
Expected: PASS. Kalau gagal, berhenti: prasyarat Primary belum selesai.

- [ ] **Step 2: Tambah `rupiahApprox` di `src/lib/format.js`**

Tepat setelah fungsi `rupiahShort`:

```js
// Plafon, house price and remaining interest read as a ballpark: floored to Rp10 jt (callers keep exact Rupiah).
export const rupiahApprox = (n) => `± ${rupiahShort(n >= 1e7 ? Math.floor(n / 1e7) * 1e7 : n)}`
```

- [ ] **Step 3: Buat `src/components/shared/milestone.jsx`**

```jsx
import { ArrowRightIcon, CircleCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Disclaimer, IconBox, Panel } from './ui'

// Closing screen of a wizard phase (Primary & Take Over): what the data entered so far already tells the user.
export function MilestonePanel({ title, sub, disclaimer, onBack, onNext, nextLabel, children }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel className="gap-5 sm:p-7">
        <div className="flex items-start gap-3.5">
          <IconBox icon={CircleCheckIcon} tone="ok" size="xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg font-extrabold text-pretty">{title}</h2>
            <p className="text-[13px] leading-5 text-muted-foreground">{sub}</p>
          </div>
        </div>
        {children}
        <Disclaimer>{disclaimer}</Disclaimer>
      </Panel>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="neutral" onClick={onBack}>
          Kembali
        </Button>
        <Button onClick={onNext}>
          {nextLabel}
          <ArrowRightIcon aria-hidden />
        </Button>
      </div>
    </div>
  )
}

// Big-number insight tiles: 1 column on mobile, 3 from lg (1024px).
export function InsightGrid({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {items.map((x) => (
        <div key={x.k} className="flex min-w-0 flex-col gap-1 rounded-2xl bg-muted px-[18px] py-4">
          <dt className="text-[13px] font-extrabold text-ink-3">{x.k}</dt>
          <dd className="flex flex-col gap-1.5">
            <span className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] tabular">{x.v}</span>
            {x.sub && <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">{x.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
```

- [ ] **Step 4: Tulis ulang `src/domains/applications/PrimaryMilestone.jsx`**

Isi lengkap file. Isi insight, state error/loading, dan teks tidak berubah; hanya kerangkanya yang pindah ke `MilestonePanel`/`InsightGrid`:

```jsx
import { CloudOffIcon } from 'lucide-react'
import { api } from '@/data/api'
import { useResource } from '@/lib/hooks'
import { rupiahApprox, rupiahShort, tenorLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { InsightGrid, MilestonePanel } from '@/components/shared/milestone'
import { Chip, Notice, Spinner } from '@/components/shared/ui'

const COPY = {
  1: { title: 'Gambaran kemampuan KPR kamu', sub: 'Dihitung dari penghasilan, cicilan lain, usia, dan pekerjaan yang kamu isi.' },
  2: { title: 'Program bank yang cocok dengan rencanamu', sub: 'Dihitung dari harga rumah, uang muka, jumlah pinjaman, dan tenor yang kamu isi.' },
}

// Closes phase 1 (after screen 2) or phase 2 (after screen 4) with numbers from the bank catalog.
export function PrimaryMilestone({ milestone, app, go }) {
  const { data, error, reload } = useResource(
    () => (milestone === 1 ? api.bankProducts.affordability({ applicationId: app.id }) : api.bankProducts.compare({ applicationId: app.id })),
    [app.id, milestone],
  )
  const next = milestone * 2 + 1
  const { title, sub } = COPY[milestone]

  return (
    <MilestonePanel
      title={title}
      sub={sub}
      disclaimer="Estimasi berdasarkan program bank yang tersedia, bukan keputusan bank."
      onBack={() => go(`/apply/primary/${next - 1}`)}
      // replace: browser back from the next form returns to screen 2 / 4, not to this milestone.
      onNext={() => go(`/apply/primary/${next}`, { replace: true })}
      nextLabel={`Lanjut ke Tahap ${milestone + 1}`}
    >
      {data ? (
        milestone === 1 ? (
          <AffordabilityInsights data={data} />
        ) : (
          <MatchInsights data={data} onEditLoan={() => go('/apply/primary/4')} />
        )
      ) : error ? (
        <Notice
          tone="muted"
          icon={CloudOffIcon}
          role="alert"
          title="Hasil hitungan belum bisa dimuat"
          action={
            <Button variant="neutral" size="sm" onClick={reload}>
              Coba lagi
            </Button>
          }
        >
          {error.code === 'CALCULATION_INPUT_INCOMPLETE' ? error.message : 'Periksa koneksi, lalu coba lagi. Kamu tetap bisa lanjut mengisi.'}
        </Notice>
      ) : (
        <div role="status" className="flex min-h-[132px] items-center justify-center gap-2 rounded-2xl bg-muted text-[13px] font-semibold text-ink-3">
          <Spinner className="text-primary" />
          Menghitung dari data kamu…
        </div>
      )}
    </MilestonePanel>
  )
}

function AffordabilityInsights({ data: { capacity, openCount, best } }) {
  const room = capacity.remainingCapacity > 0
  return (
    <>
      {room && openCount > 0 && <Chip tone="ok">{openCount} program bank terbuka untuk profilmu</Chip>}
      <InsightGrid
        items={[
          { k: 'Cicilan aman', v: `${rupiahShort(Math.max(0, capacity.remainingCapacity))}/bln`, sub: `${capacity.ratioBps / 100}% penghasilan − cicilan lain` },
          best && { k: 'Plafon KPR hingga', v: rupiahApprox(best.principal), sub: `tenor ${tenorLabel(best.tenorMonths)}` },
          best && { k: 'Harga rumah hingga', v: rupiahApprox(best.priceMax), sub: `DP min ${100 - best.maxLtvBps / 100}%` },
        ].filter(Boolean)}
      />
      {!room && <Notice tone="warn">Cicilan lain sudah memakai seluruh batas aman {capacity.ratioBps / 100}%. Coba lunasi sebagian cicilan lain atau gabungkan penghasilan pasangan.</Notice>}
      {!openCount && <Notice tone="warn">Belum ada program yang terbuka untuk profil ini.</Notice>}
    </>
  )
}

function MatchInsights({ data: { items, excluded, capacity }, onEditLoan }) {
  if (!items.length) {
    const reasons = [...new Set(excluded.flatMap((x) => x.reasons))].slice(0, 2)
    return (
      <Notice
        tone="warn"
        title="Belum ada program yang cocok"
        action={
          <Button variant="outline" size="sm" onClick={onEditLoan}>
            Ubah data pinjaman
          </Button>
        }
      >
        {reasons.length ? `${reasons.join('. ')}.` : 'Coba ubah uang muka, jumlah pinjaman, atau tenor.'}
      </Notice>
    )
  }
  const cheapest = items.reduce((a, b) => (b.payment < a.payment ? b : a))
  const safe = cheapest.dtiRatio <= capacity.ratioBps / 10_000
  return (
    <InsightGrid
      items={[
        { k: 'Program cocok', v: `${items.length} program`, sub: 'sesuai harga, DP & tenor kamu' },
        { k: 'Cicilan mulai', v: `${rupiahShort(cheapest.payment)}/bln`, sub: `${cheapest.bank.name} · fixed ${tenorLabel(cheapest.fixedMonths)}` },
        {
          k: 'Rasio cicilan',
          v: `${Math.round(cheapest.dtiRatio * 100)}%`,
          sub: (
            <>
              dari penghasilan
              <Chip tone={safe ? 'ok' : 'warn'}>{safe ? 'Aman' : 'Di atas batas aman'}</Chip>
            </>
          ),
        },
      ]}
    />
  )
}
```

**Catatan:** kalau isi `PrimaryMilestone.jsx` saat eksekusi sudah berbeda dari salinan di atas (karena Primary diubah lagi), jangan menimpanya. Lakukan perubahan minimal saja:
- ganti kerangka `<div>`/`<Panel>`/tombol dengan `MilestonePanel`;
- ganti `Insights` dengan `InsightGrid`;
- ganti `approx` dengan `rupiahApprox`;
- hapus `Insights` dan `approx` lokal.

- [ ] **Step 5: Jalankan regresi**

Run: `npx playwright test tests/e2e/primary-flow.spec.js`
Expected: PASS (sama seperti Step 1)

Run: `npm run lint`
Expected: tidak ada error, tidak ada import yang tidak terpakai (`ArrowRightIcon`, `CircleCheckIcon`, `Disclaimer`, `IconBox`, `Panel` sudah tidak diimpor di `PrimaryMilestone.jsx`)

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/milestone.jsx src/lib/format.js src/domains/applications/PrimaryMilestone.jsx
git commit -m "refactor: kerangka layar milestone dipakai bersama

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Milestone 1 Take Over, "Tahap 1 selesai"

**Files:**
- Create: `src/domains/optimize/TakeoverMilestone.jsx`
- Modify: `src/domains/optimize/OptimizeSteps.jsx` (`OptimizeStepPage`: deteksi milestone, header, dan render)
- Modify: `src/domains/optimize/OldLoanPages.jsx` (dua `navigate('/optimize/3')`)
- Test: `tests/e2e/takeover-flow.spec.js`

**Interfaces:**
- Consumes: `goalConditions().totalInterest/payoffDate/rate` (Task 2), `applicationHealth().paidRatio`, `MilestonePanel`, `InsightGrid`, `rupiahApprox` (Task 4)
- Produces: `TakeoverMilestone({ app, clock: 'YYYY-MM-DD', onBack: () => void, onNext: () => void })`. Penanda navigasi: `location.state.milestone === 1` pada `/optimize/3`.

- [ ] **Step 1: Ubah e2e supaya gagal**

Di test `cold-entry take over ...`, ganti:

```js
  await page.getByLabel('Sisa tenor').fill('181')
  await save()

  await expect(page).toHaveURL(/optimize\/3/) // Kemampuan bayar
```

dengan:

```js
  await page.getByLabel('Sisa tenor').fill('181')
  await save()

  // Phase 1 milestone: what staying with the old bank looks like.
  await expect(page).toHaveURL(/optimize\/3/)
  await expect(page.getByRole('heading', { name: 'Tahap 1 selesai' })).toBeVisible()
  await expect(page.getByText('45% selesai.')).toBeAttached()
  await expect(page.getByText('Sisa bunga jika tetap')).toBeVisible()
  await expect(page.getByText('Pokok sudah lunas')).toBeVisible()
  await expect(page.getByText('Floating', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Lanjut ke Tahap 2' }).click()
  await page.reload() // "Lanjut" replaced the milestone entry: reloading stays on the form
  await expect(page.getByRole('heading', { name: 'Tahap 1 selesai' })).toHaveCount(0)

  await expect(page).toHaveURL(/optimize\/3/) // Kemampuan bayar
```

- [ ] **Step 2: Jalankan e2e, pastikan gagal**

Run: `npx playwright test tests/e2e/takeover-flow.spec.js -g "cold-entry"`
Expected: FAIL di heading `Tahap 1 selesai` (langsung tampil form Kemampuan bayar)

- [ ] **Step 3: Buat `src/domains/optimize/TakeoverMilestone.jsx`**

```jsx
import { daysLabel, monthYear, percentRatio, rupiahApprox } from '@/lib/format'
import { InsightGrid, MilestonePanel } from '@/components/shared/milestone'
import { Chip } from '@/components/shared/ui'
import { applicationHealth, goalConditions } from './insights'

// Short value + caption: the 30px tile fits one word; the detail goes underneath.
function rateInsight(r) {
  if (r.mode == null) return { v: 'Belum diketahui', sub: 'jenis bunga belum diisi' }
  if (r.mode === 'floating') return { v: 'Floating', sub: 'bunga bisa naik mengikuti bank' }
  return { v: 'Fixed', sub: r.daysUntilFixedEnd != null ? `berakhir ${daysLabel(r.daysUntilFixedEnd)}` : 'masa fixed masih berjalan' }
}

// Closes phase 1 (profile + old loan): what staying with the old bank looks like. Pure client-side math, no loading state.
export function TakeoverMilestone({ app, clock, onBack, onNext }) {
  const c = goalConditions(app.data, clock)
  const { paidRatio } = applicationHealth(app.data, clock, null)
  return (
    <MilestonePanel
      title="Gambaran KPR lama kamu"
      sub="Dihitung dari data KPR lama yang kamu isi."
      disclaimer="Estimasi dari data KPR lama yang kamu isi, bukan angka resmi bank."
      onBack={onBack}
      onNext={onNext}
      nextLabel="Lanjut ke Tahap 2"
    >
      {c.payoffDate && <Chip tone="info">Perkiraan lunas {monthYear(c.payoffDate)}</Chip>}
      <InsightGrid
        items={[
          c.totalInterest != null && { k: 'Sisa bunga jika tetap', v: rupiahApprox(c.totalInterest), sub: 'kalau tidak pindah bank' },
          { k: 'Pokok sudah lunas', v: percentRatio(paidRatio, 0), sub: 'dari pinjaman awal' },
          { k: 'Status bunga', ...rateInsight(c.rate) },
        ].filter(Boolean)}
      />
    </MilestonePanel>
  )
}
```

(Spec menulis status bunga sebagai `Fixed · 120 hari lagi`. Di sini teksnya dipecah jadi nilai `Fixed` dan caption `berakhir 120 hari lagi`, supaya tile 30px tidak terpotong di mobile.)

- [ ] **Step 4: Wiring di `OptimizeStepPage`**

Di `src/domains/optimize/OptimizeSteps.jsx`:

a. Tambahkan import setelah import `./shared`:

```jsx
import { TakeoverMilestone } from "./TakeoverMilestone";
```

b. Tepat setelah `const fromReview = location.state?.from === "review";`, tambahkan:

```jsx
  // Set only by OldLoanPages right after the old loan is confirmed; "Lanjut" replaces it away.
  const milestone = n === 3 && location.state?.milestone === 1;
```

c. Di `<OptimizeHeader ...>` (hasil Task 3), ganti prop `title` dan `subtitle` jadi:

```jsx
        title={milestone ? "Tahap 1 selesai" : `Pengajuan ${PN}`}
        subtitle={milestone ? `${PN} · gambaran KPR lama kamu` : subtitle}
```

d. Ganti baris `{n === 3 && <CapacityStep {...props} />}` dengan:

```jsx
      {milestone && (
        <TakeoverMilestone
          app={app}
          clock={snap.clock}
          onBack={() => navigate(back)}
          // replace: reload or browser back from Kemampuan bayar never re-shows the milestone.
          onNext={() => navigate("/optimize/3", { replace: true })}
        />
      )}
      {n === 3 && !milestone && <CapacityStep {...props} />}
```

(`back` untuk `n === 3` sudah `/optimize/2/estimasi` atau `/optimize/2/resmi`, sesuai `oldLoan.source`.)

- [ ] **Step 5: Bawa penanda milestone dari `OldLoanPages`**

Di `src/domains/optimize/OldLoanPages.jsx`, ganti **kedua** `navigate('/optimize/3')`, satu di `use` milik `OldLoanEstimatePage` dan satu di `onSubmit` milik `OldLoanOfficialPage`, dengan:

```js
      navigate('/optimize/3', { state: { milestone: 1 } })
```

- [ ] **Step 6: Jalankan e2e dan lint, pastikan lulus**

Run: `npx playwright test tests/e2e/takeover-flow.spec.js`
Expected: PASS, semua test

Run: `npm run lint`
Expected: tidak ada error

- [ ] **Step 7: Commit**

```bash
git add src/domains/optimize/TakeoverMilestone.jsx src/domains/optimize/OptimizeSteps.jsx src/domains/optimize/OldLoanPages.jsx tests/e2e/takeover-flow.spec.js
git commit -m "feat(takeover): layar milestone Tahap 1 selesai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Milestone 2, banner "Tahap 2 selesai" di Baseline

**Files:**
- Modify: `src/domains/optimize/insights.js` (tambah `simulationTeaser`)
- Test: `src/domains/optimize/insights.test.js`
- Modify: `src/domains/optimize/ProgramPages.jsx` (`BaselinePage`, komponen lokal `PhaseTwoBanner`, import)
- Test: `tests/e2e/takeover-flow.spec.js`

**Interfaces:**
- Consumes: `applicationHealth` (sudah ada), `HEALTH_SENTENCE` dan `HealthRing` dari `@/domains/home/MonitoringDashboard`, `useOptimize` dari `./shared`
- Produces: `simulationTeaser({ items: { monthlyDiff: number, topup: { fundingGap: number } | null }[], input: { mode: 'takeover'|'topup', requestedTopup?: number } }) → string`

- [ ] **Step 1: Tulis unit test yang gagal**

Ganti baris import di `src/domains/optimize/insights.test.js` dengan:

```js
import { applicationHealth, goalConditions, simulationTeaser } from './insights'
```

Tambahkan di akhir file:

```js
describe('simulationTeaser', () => {
  const item = (monthlyDiff, fundingGap = null) => ({ monthlyDiff, topup: fundingGap == null ? null : { fundingGap } })

  it('take over: the biggest monthly cut, or says nothing lowers the payment', () => {
    expect(simulationTeaser({ items: [item(350_000), item(850_000), item(-100_000)], input: { mode: 'takeover' } })).toBe('3 program cocok · cicilan bisa turun hingga Rp850 rb/bln')
    expect(simulationTeaser({ items: [item(0), item(-100_000)], input: { mode: 'takeover' } })).toBe('2 program cocok · belum ada yang menurunkan cicilan')
  })

  it('top-up: counts programs that cover the requested funds', () => {
    const input = { mode: 'topup', requestedTopup: 100_000_000 }
    expect(simulationTeaser({ items: [item(0, -5_000_000), item(0, 0), item(0, 20_000_000)], input })).toBe('3 program cocok · 2 memenuhi kebutuhan dana Rp100 jt')
    expect(simulationTeaser({ items: [item(0, 20_000_000), item(0)], input })).toBe('2 program cocok · belum ada yang memenuhi kebutuhan dana')
  })

  it('says so when no program matches', () => {
    expect(simulationTeaser({ items: [], input: { mode: 'topup', requestedTopup: 100_000_000 } })).toBe('Belum ada program yang cocok')
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/domains/optimize/insights.test.js`
Expected: FAIL, karena `simulationTeaser is not a function`

- [ ] **Step 3: Implementasi `simulationTeaser`**

Di `src/domains/optimize/insights.js`, tambahkan import di atas:

```js
import { rupiahShort } from '@/lib/format'
```

Tambahkan di akhir file:

```js
// Phase 2 milestone teaser on Baseline: one line from the simulation already loaded there.
export function simulationTeaser({ items, input }) {
  const n = items.length
  if (!n) return 'Belum ada program yang cocok'
  if (input.mode === 'topup') {
    const funded = items.filter((x) => x.topup && x.topup.fundingGap <= 0).length
    return funded ? `${n} program cocok · ${funded} memenuhi kebutuhan dana ${rupiahShort(input.requestedTopup)}` : `${n} program cocok · belum ada yang memenuhi kebutuhan dana`
  }
  const cut = Math.max(0, ...items.map((x) => x.monthlyDiff))
  return cut > 0 ? `${n} program cocok · cicilan bisa turun hingga ${rupiahShort(cut)}/bln` : `${n} program cocok · belum ada yang menurunkan cicilan`
}
```

- [ ] **Step 4: Jalankan unit test, pastikan lulus**

Run: `npx vitest run src/domains/optimize/insights.test.js`
Expected: PASS

- [ ] **Step 5: Ubah e2e supaya gagal**

Di `tests/e2e/takeover-flow.spec.js`:

1. Di fungsi `openFirstProgram`, ganti:

```js
  await expect(page.getByText('Estimasi biaya keluar dari bank lama')).toBeVisible()
```

dengan:

```js
  await expect(page.getByText('Estimasi biaya keluar dari bank lama')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tahap 2 selesai' })).toHaveCount(0) // Explore simulation is not an application
```

2. Di test `cold-entry take over ...`, ganti:

```js
  await expect(page).toHaveURL(/optimize\/baseline/)
  await expect(page.getByText('Angka resmi dari bank')).toBeVisible()
```

dengan:

```js
  await expect(page).toHaveURL(/optimize\/baseline/)
  await expect(page.getByRole('heading', { name: 'Tahap 2 selesai' })).toBeVisible()
  await expect(page.getByText('75% selesai.')).toBeAttached()
  await expect(page.getByText(/\d+ program cocok/)).toBeVisible()
  await expect(page.getByText('Angka resmi dari bank')).toBeVisible()
```

- [ ] **Step 6: Jalankan e2e, pastikan gagal**

Run: `npx playwright test tests/e2e/takeover-flow.spec.js -g "cold-entry"`
Expected: FAIL di heading `Tahap 2 selesai`

- [ ] **Step 7: Implementasi banner di `ProgramPages.jsx`**

a. Tambahkan import (setelah import `@/domains/home/selectHomeState`):

```jsx
import { HEALTH_SENTENCE, HealthRing } from '@/domains/home/MonitoringDashboard'
import { applicationHealth, simulationTeaser } from './insights'
```

Lalu ganti `import { OptimizeHeader, modeName } from './shared'` dengan:

```jsx
import { OptimizeHeader, modeName, useOptimize } from './shared'
```

b. Di `BaselinePage`, tepat setelah `const { data: sim, error, reload, loading } = useSimulation()`, tambahkan (sebelum early return):

```jsx
  const { app, snap } = useOptimize() // the draft behind an application simulation, for the phase 2 banner
```

c. Di JSX `BaselinePage`, tepat setelah `<Header sim={sim} title="Kondisi KPR kamu" ... />`, tambahkan:

```jsx
      {sim.source.type === 'application' && app && <PhaseTwoBanner sim={sim} app={app} clock={snap.clock} />}
```

d. Tambahkan komponen lokal tepat di atas `export function BaselinePage()`:

```jsx
// Phase 2 milestone (application flow only): the now-complete KPR Health score + one teaser from the simulation.
function PhaseTwoBanner({ sim, app, clock }) {
  const h = applicationHealth(app.data, clock, app.data.property?.estimatedValue ?? null)
  const weakest = h.components.filter((x) => x.score !== null).sort((a, b) => a.score - b.score)[0]
  // Same sentence logic as the Properti step's HealthAside.
  const sentence = h.score >= 80 ? 'Kondisi KPR kamu sehat.' : weakest?.key === 'rate' && h.rate.mode === 'floating' ? 'Bunga kamu sudah floating.' : HEALTH_SENTENCE[weakest?.key]
  return (
    <section aria-labelledby="phase2-title" className="flex flex-col gap-4 rounded-card bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-7">
      <HealthRing health={h} size={88} />
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <h2 id="phase2-title" className="flex items-center gap-2 text-lg font-extrabold">
          <CircleCheckIcon className="size-5 text-success-strong" aria-hidden />
          Tahap 2 selesai
        </h2>
        <Chip tone={h.tone}>
          Kesehatan KPR: {h.label}
          {h.partial ? ' · parsial' : ''}
        </Chip>
        {sentence && <p className="text-[13px] leading-5 font-semibold text-ink-2">{sentence}</p>}
        <p className="text-sm font-bold text-primary">{simulationTeaser(sim)}</p>
      </div>
    </section>
  )
}
```

(`CircleCheckIcon` dan `Chip` sudah diimpor di `ProgramPages.jsx`.)

- [ ] **Step 8: Jalankan semua test, pastikan lulus**

Run: `npx vitest run src/domains/optimize/insights.test.js`
Expected: PASS

Run: `npx playwright test tests/e2e/takeover-flow.spec.js`
Expected: PASS, semua test (alur Explore tanpa banner, cold-entry dengan banner)

Run: `npm run lint`
Expected: tidak ada error

- [ ] **Step 9: Commit**

```bash
git add src/domains/optimize/insights.js src/domains/optimize/insights.test.js src/domains/optimize/ProgramPages.jsx tests/e2e/takeover-flow.spec.js
git commit -m "feat(takeover): banner Tahap 2 selesai di Baseline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Kartu draft di Home memakai `draftProgress`

**Files:**
- Modify: `src/domains/home/HomePage.jsx` (import dari `@/domains/applications/meta` dan `DraftHero`)
- Test: `tests/e2e/takeover-flow.spec.js`

**Interfaces:**
- Consumes: `draftProgress(app)` (Task 1)

- [ ] **Step 1: Ubah e2e supaya gagal**

Di akhir test `cold-entry take over ...`, setelah baris `await expect(page.getByText('Data perlu dicek ulang')).toBeVisible() ...`, tambahkan:

```js

  // Home resumes the draft in the same 3-phase language as the wizard.
  await page.goto('/')
  await expect(page.getByText('Take Over · Bagian 3 dari 3')).toBeVisible()
  await expect(page.getByText('Pilih Bank & Kirim')).toBeVisible()
```

- [ ] **Step 2: Jalankan e2e, pastikan gagal**

Run: `npx playwright test tests/e2e/takeover-flow.spec.js -g "cold-entry"`
Expected: FAIL. Kartu masih menampilkan `Take Over · Step 6 dari 7`.

- [ ] **Step 3: Implementasi**

Di `src/domains/home/HomePage.jsx`:

a. Di blok import dari `@/domains/applications/meta`, ganti `primaryProgress,` dengan `draftProgress,`, lalu hapus `stepsOf,`. `stepsOf` hanya dipakai di `DraftHero`; cek dengan `grep -n "stepsOf" src/domains/home/HomePage.jsx` setelah edit, hasilnya harus kosong. Biarkan import `stepPercent` karena masih dipakai kartu Setup KPR.

b. Di `DraftHero`, ganti:

```jsx
  const steps = stepsOf(app);
  const step = Math.min(app.currentStep, steps.length);
  // Primary drafts read in 3 phases with their own percent table; Take Over keeps step N of 7.
  const phase = app.productType === "primary" ? primaryProgress(step) : null;
```

dengan:

```jsx
  // Same phase, label and percent the wizard shows (Primary and Take Over).
  const progress = draftProgress(app);
```

c. Ganti:

```jsx
        <p className="text-[15px] text-white/80">
          {productName(app)} ·{" "}
          {phase
            ? `Bagian ${phase.phase} dari 3`
            : `Step ${step} dari ${steps.length}`}
        </p>
        <p className="text-[15px] font-bold">
          {phase ? phase.label : steps[step - 1]}
        </p>
```

dengan:

```jsx
        <p className="text-[15px] text-white/80">
          {productName(app)} · Bagian {progress.phase} dari 3
        </p>
        <p className="text-[15px] font-bold">{progress.label}</p>
```

d. Ganti `value={phase ? phase.percent : stepPercent(step, steps.length)}` dengan `value={progress.percent}`.

- [ ] **Step 4: Jalankan e2e (Take Over & Primary), pastikan lulus**

Run: `npx playwright test tests/e2e/takeover-flow.spec.js tests/e2e/primary-flow.spec.js`
Expected: PASS. Kartu draft Primary tetap `Bagian X dari 3`.

Run: `npm run lint`
Expected: tidak ada error

- [ ] **Step 5: Commit**

```bash
git add src/domains/home/HomePage.jsx tests/e2e/takeover-flow.spec.js
git commit -m "feat(home): kartu draft Take Over memakai 3 tahap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verifikasi akhir

**Files:** tidak ada perubahan kode, kecuali ada temuan.

- [ ] **Step 1: Lint, unit test, build**

Run: `npm run lint`. Expected: tidak ada error.
Run: `npm test`. Expected: semua test Vitest PASS.
Run: `npm run build`. Expected: build sukses tanpa error.

- [ ] **Step 2: Semua e2e**

Run: `npm run e2e`
Expected: PASS untuk semua spec. Kalau ada yang gagal di luar `takeover-flow` atau `primary-flow`, laporkan output-nya apa adanya. Jangan diklaim lulus.

- [ ] **Step 3: Cek visual mobile 320px**

Jalankan `npm run dev`. Di DevTools, set viewport 320×568, reset scenario `fresh` lewat DevPanel, lalu jalankan Take Over sampai:
- `/optimize/3` (milestone 1)
- `/optimize/baseline` (banner)

Pastikan:
- tidak ada scroll horizontal;
- tile insight tersusun 1 kolom;
- tombol "Kembali" dan "Lanjut ke Tahap 2" setinggi ≥ 44px;
- ring kesehatan dan teks banner tidak bertumpuk.

Ulangi dengan mode Refinancing (`/optimize/intro?mode=topup`). Di Tujuan pilih "+ Dana tambahan", lalu pastikan teaser berbunyi "… memenuhi kebutuhan dana …" atau "… belum ada yang memenuhi kebutuhan dana".

- [ ] **Step 4: Review diff**

Run: `git log --oneline -8` dan `git diff HEAD~7 --stat`.
Pastikan hanya file yang disebut di plan ini yang berubah. Pastikan juga tidak ada sisa `Step x/7` di layar Take Over: `grep -rn "Step [0-9]/7\|dari 7" src/domains/optimize` harus kosong.
