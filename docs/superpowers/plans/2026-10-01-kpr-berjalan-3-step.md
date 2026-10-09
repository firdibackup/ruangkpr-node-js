# Setup KPR Berjalan 3 Step: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setup "Sudah punya KPR berjalan" jadi 3 step (KPR kamu, Bunga, Reminder) dengan 5 data wajib dan 3 data opsional. Fokusnya reminder sebelum floating. Data lain dilengkapi nanti tanpa bentrok.

**Architecture:**
- Sisa pinjaman tidak pernah ditanyakan. Mock API menghitungnya dari cicilan, bunga, dan sisa tenor (`calculateMaxPrincipal`), kecuali user mengisi angka resmi.
- `derive.js` dibuat tahan data kosong.
- Wizard ditulis ulang jadi 3 step. Field opsional ditampilkan penuh hanya saat KPR aktif diedit dari My KPR.
- Halaman yang memakai data KPR menampilkan tautan "Lengkapi" ke satu tempat isian.

**Tech Stack:** React 19, React Router, Vite, Tailwind, Vitest (`npm test`), Playwright (`npm run e2e`), oxlint (`npm run lint`).

**Spec:** `docs/superpowers/specs/2026-10-01-kpr-berjalan-3-step-design.md`

**Klarifikasi spec:** "mode edit" dengan field opsional penuh (nama produk, jenis KPR, pinjaman awal, sisa pinjaman dari bank, bagian bunga yang selalu terbuka) berlaku saat **KPR aktif** diedit dari My KPR atau Home. Tautan `Ubah` di step 3 pada draft (`?edit=review`) tetap menampilkan form sederhana, supaya pemula tidak melihat field tambahan di tengah setup.

## Prasyarat (sebelum Task 1)

`git status --short | grep -v graphify-out` harus kosong. Saat plan ini ditulis, `src/domains/home/MonitoringDashboard.jsx` masih punya perubahan yang belum di-commit (blok "Peluang" dipindah ke atas dashboard). Commit atau stash dulu, karena Task 6 menyunting file itu dan mengacu pada komentar `{/* Opportunity leads the dashboard; ...`.

## Global Constraints

- UI hanya lewat `src/data/api.js`; `mockDb.js` tetap satu-satunya batas localStorage. Tidak ada dependency baru.
- Nama step persis: `KPR kamu`, `Bunga`, `Reminder`. Judul subtitle: `Data KPR kamu`, `Bunga KPR kamu`, `Atur reminder`. Persen `[10, 45, 75]`.
- Label progress: `Bagian {n} dari 3 · {nama step}`.
- Pilihan jenis bunga: `Masih fixed` / `Sudah floating` / `Belum tahu`. Disimpan sebagai `currentRateType`: `'fixed'` / `'floating'` / `null`.
- Pesan tanggal fixed lewat, persis: `Tanggal ini sudah lewat, berarti bunga kamu sudah floating.`
- Tombol aktivasi: `Aktifkan Reminder`.
- Route `/monitoring/setup/4..6` diarahkan ke `/monitoring/setup/3`. `RETURN.review = '/monitoring/setup/3'`, `RETURN.explore = '/explore'`.
- Field lama (`knowsOutstanding`, `paymentEverChanged`, `rateHistory`, `startDate`, `originalTenorMonths`, `finance.routineExpenses`, `finance.emergencyFund`) tidak ditulis dan tidak dihapus. Tidak ada migrasi `schemaVersion`.
- Visual mengikuti pola yang ada: `Panel`/`rounded-card`, token warna yang ada, tombol ≥ 44px (`min-h-11`), breakpoint `lg` (1024px). Tidak ada animasi dekoratif.
- Gaya kode: `HomePage.jsx` memakai kutip ganda dan titik koma. File lain memakai kutip tunggal tanpa titik koma.
- Pesan commit diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Setiap task hanya meng-commit file yang disebut di task itu.

## Review Focus

1. **Draft lama** (setupStep 3–6 dari setup 6 step, atau tautan lama `setup/6?edit=review`) harus terbuka di step Reminder tanpa error. Dijaga oleh e2e di Task 5.
2. **KPR aktif lama dengan sisa pokok estimasi metode lama.** Menyimpan step 1 tanpa mengubah cicilan tidak boleh mengubah sisa pinjaman. Dijaga oleh unit test di Task 2.
3. **Tanggal fixed yang sudah lewat** memunculkan pesan dan tombol `Pilih Sudah floating` yang benar-benar mengganti pilihan. Dijaga oleh e2e di Task 4.
4. **KPR aktif minimal** (bunga "Belum tahu", tanpa tenor/pinjaman awal) tidak boleh menampilkan teks `null`, `NaN`, atau `undefined`, dan tidak boleh berlabel "Fixed". Dijaga oleh e2e di Task 6.
5. **KPR Health tanpa satu pun komponen** tidak boleh menghasilkan skor NaN. Dijaga oleh unit test di Task 1. Tampilan UI-nya dicek manual di Task 9, karena semua skenario seed punya data penghasilan.

---

### Task 1: `derive.js` tahan data kosong

**Files:**
- Modify: `src/domains/mortgages/derive.js` (`rateMode`, `healthScore`, `paymentWindow`, `deriveMortgage`)
- Create: `src/domains/mortgages/derive.test.js`

**Interfaces:**
- Produces:
  - `rateMode(m, asOf)` → `{ mode: null, daysUntilFixedEnd: null }` saat `!m.currentRateType`
  - `deriveMortgage(m, asOf).paidRatio` → `number | null`
  - `healthScore(...)` → `{ score: number | null, partial, label, tone, components }`; `score: null` dengan `label: 'Belum lengkap'` dan `tone: 'mute'` saat tidak ada komponen yang diketahui

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/domains/mortgages/derive.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { deriveMortgage, healthScore, rateMode } from './derive'

const today = '2026-09-28'
// What the 3-step setup can leave behind: bank, cicilan, jatuh tempo, and "Belum tahu" for the rate type.
const minimal = { id: 'mtg_min', status: 'active', bankName: 'Bank ABC', currentPayment: 4_127_324, dueDay: 22, currentRateType: null, payments: [] }

describe('derive with reminder-only data', () => {
  it('an unknown rate type is not read as a healthy normal rate', () => {
    expect(rateMode({ currentRateType: null }, today)).toEqual({ mode: null, daysUntilFixedEnd: null })
  })

  it('pelunasan progress is unknown without the original principal, not 0%', () => {
    expect(deriveMortgage(minimal, today).paidRatio).toBeNull()
    expect(deriveMortgage({ ...minimal, originalPrincipal: 600_000_000, outstandingPrincipal: 450_000_000 }, today).paidRatio).toBe(0.25)
  })

  it('KPR Health has no score (not NaN) when no component is known', () => {
    expect(healthScore({ dtiRatio: null, ltvRatio: null, mode: null, daysUntilFixedEnd: null, paidRatio: null })).toMatchObject({ score: null, partial: true, label: 'Belum lengkap', tone: 'mute' })
    expect(deriveMortgage(minimal, today).health.score).toBeNull()
  })

  it('payment history still lists due dates without an akad date', () => {
    expect(deriveMortgage(minimal, today).dueWindow).toEqual(['2026-09-22', '2026-10-22', '2026-11-22'])
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/domains/mortgages/derive.test.js`
Expected: FAIL. `rateMode` mengembalikan `mode: 'normal'`, `paidRatio` 0, `score` 50, dan `dueWindow` `[]`.

- [ ] **Step 3: Implementasi**

Di `src/domains/mortgages/derive.js`:

a. Baris pertama di dalam `rateMode`:

```js
  // "Belum tahu" in setup: no floating reminder and no made-up "normal" rate score.
  if (!m.currentRateType) return { mode: null, daysUntilFixedEnd: null }
```

b. Di `healthScore`, ganti komponen `progress` jadi:

```js
    { key: 'progress', name: 'Progres pinjaman', score: paidRatio == null ? null : Math.min(100, Math.round(50 + 70 * paidRatio)) },
```

Lalu tepat setelah `const known = components.filter((c) => c.score !== null)`, tambahkan:

```js
  if (!known.length) return { score: null, partial: true, label: 'Belum lengkap', tone: 'mute', components }
```

c. Di `paymentWindow`, ganti `.filter((x) => x > m.startDate)` jadi:

```js
.filter((x) => !m.startDate || x > m.startDate)
```

d. Di `deriveMortgage`, ganti baris `const paidRatio = ...` jadi:

```js
  // Unknown (null), not 0%, until both the original principal and today's balance are known.
  const paidRatio = m.originalPrincipal > 0 && m.outstandingPrincipal != null ? Math.min(1, Math.max(0, (m.originalPrincipal - m.outstandingPrincipal) / m.originalPrincipal)) : null
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/domains/mortgages/`
Expected: PASS, termasuk `validation.test.js` yang lama (test derive di sana memakai data lengkap).

Run: `npx vitest run src/domains/optimize/insights.test.js`
Expected: PASS. `applicationHealth` selalu mengirim `paidRatio` berupa angka.

- [ ] **Step 5: Commit**

```bash
git add src/domains/mortgages/derive.js src/domains/mortgages/derive.test.js
git commit -m "fix(kpr): perhitungan KPR tahan data kosong

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Aturan data di mock API

**Files:**
- Modify: `src/data/mockApi.js` (import, helper baru `applyMortgageRules`, `profile.update`, `mortgages.saveSetupStep`, `mortgages.activate`, `mortgages.update`)
- Test: `src/data/mockApi.test.js` (blok `describe('monitoring', ...)`)

**Interfaces:**
- Consumes: `calculateMaxPrincipal({ payment, annualRateBps, termMonths })` dari `@/calculations/finance` (sudah ada)
- Produces:
  - `saveSetupStep` / `update` mengisi `outstandingPrincipal` dan `outstandingEstimated` otomatis
  - `setupStep` maksimal 3
  - `activate` cukup dengan `bankName`, `currentPayment`, `dueDay` (+ `fixedUntil` jika fixed) dan reminder valid
  - `profile.update` menyalin `finance` ke mortgage `draft`/`active`

- [ ] **Step 1: Tulis test yang gagal**

Di `src/data/mockApi.test.js`, tambahkan import:

```js
import { calculateMaxPrincipal } from '@/calculations/finance'
```

Ubah `import { SCENARIOS, createSeed } from './seed'` jadi `import { DEFAULT_REMINDERS, SCENARIOS, createSeed } from './seed'`.

Ganti seluruh test pertama di `describe('monitoring', ...)`, yaitu `it('changed payment requires official outstanding; activation creates no application', ...)`, dengan:

```js
  const step1 = { bankName: 'Bank ABC', currentPayment: 4_127_324, dueDay: 22 }
  const fixedRate = { currentRateType: 'fixed', fixedUntil: '2026-12-22', currentRateBps: 550, remainingTenorMonths: 183, estimatedFloatingRateBps: 900 }

  it('reminder-only setup: 5 fields activate; sisa pinjaman is derived, never asked', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(m.id, { step: 1, values: step1 })
    const saved = await api.mortgages.saveSetupStep(m.id, { step: 2, values: fixedRate })
    expect(saved.outstandingPrincipal).toBe(calculateMaxPrincipal({ payment: 4_127_324, annualRateBps: 550, termMonths: 183 }))
    expect(saved.outstandingEstimated).toBe(true)
    expect(saved.setupStep).toBe(3)
    await api.mortgages.saveSetupStep(m.id, { step: 3, values: { reminders: structuredClone(DEFAULT_REMINDERS) } })
    const r = await api.mortgages.activate(m.id, { confirmDataCorrect: true })
    expect(r.applicationCreated).toBe(false)
    const snap = await api.dashboard.getSnapshot()
    expect(snap.applications).toHaveLength(0)
    expect(selectHomeState(snap, snap.clock).state).toBe('mortgage_active_warning')
  })

  it('official sisa pinjaman wins until cleared; floating clears the fixed-only fields', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(m.id, { step: 1, values: step1 })
    await api.mortgages.saveSetupStep(m.id, { step: 2, values: fixedRate })
    await api.mortgages.saveSetupStep(m.id, { step: 2, values: { outstandingPrincipal: 500_000_000, outstandingEstimated: false } })
    let saved = await api.mortgages.saveSetupStep(m.id, { step: 2, values: { currentRateBps: 600 } })
    expect(saved).toMatchObject({ outstandingPrincipal: 500_000_000, outstandingEstimated: false })
    saved = await api.mortgages.saveSetupStep(m.id, { step: 2, values: { outstandingPrincipal: null, outstandingEstimated: null } })
    expect(saved.outstandingPrincipal).toBe(calculateMaxPrincipal({ payment: 4_127_324, annualRateBps: 600, termMonths: 183 }))
    expect(saved.outstandingEstimated).toBe(true)
    saved = await api.mortgages.saveSetupStep(m.id, { step: 2, values: { currentRateType: 'floating' } })
    expect(saved).toMatchObject({ fixedUntil: null, estimatedFloatingRateBps: null })
  })

  it('"Belum tahu" activates with payment reminders; fixed without an end date does not', async () => {
    mockControls.reset('fresh')
    const m = await api.mortgages.createSetup()
    await api.mortgages.saveSetupStep(m.id, { step: 1, values: step1 })
    await api.mortgages.saveSetupStep(m.id, { step: 2, values: { currentRateType: 'fixed', fixedUntil: null } })
    await api.mortgages.saveSetupStep(m.id, { step: 3, values: { reminders: structuredClone(DEFAULT_REMINDERS) } })
    await expectCode(api.mortgages.activate(m.id, { confirmDataCorrect: true }), 'VALIDATION_FAILED')
    await api.mortgages.saveSetupStep(m.id, { step: 2, values: { currentRateType: null } })
    await expect(api.mortgages.activate(m.id, { confirmDataCorrect: true })).resolves.toMatchObject({ applicationCreated: false })
  })

  it('saving unrelated fields keeps an existing sisa pinjaman stable', async () => {
    mockControls.reset('mortgage_active_normal')
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    const saved = await api.mortgages.saveSetupStep(m.id, { step: 1, values: { bankName: m.bankName, currentPayment: m.currentPayment, dueDay: m.dueDay } })
    expect(saved.outstandingPrincipal).toBe(m.outstandingPrincipal)
  })

  it('estimate API still refuses a changed payment (the Take Over wizard uses it)', async () => {
    mockControls.reset('fresh')
    await expectCode(api.mortgages.estimate({ originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22, paymentEverChanged: true }), 'OFFICIAL_OUTSTANDING_REQUIRED')
    const est = await api.mortgages.estimate({ originalPrincipal: 600_000_000, currentPayment: 4_127_324, originalTenorMonths: 240, startDate: '2021-12-22', dueDay: 22, paymentEverChanged: false })
    expect(est).toMatchObject({ effectiveRateBps: 550, paidMonths: 57, remainingMonths: 183, estimated: true })
    expect(Math.abs(est.outstanding - 510_515_794)).toBeLessThan(5)
  })

  it('profile finance edits reach the active mortgage (KPR Health reads that copy)', async () => {
    mockControls.reset('mortgage_active_normal')
    await api.profile.update({ finance: { monthlyIncome: 20_000_000, vehicleDebt: 1_000_000 } })
    const [m] = (await api.dashboard.getSnapshot()).mortgages
    expect(m.finance).toMatchObject({ monthlyIncome: 20_000_000, vehicleDebt: 1_000_000 })
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/data/mockApi.test.js -t monitoring`
Expected: FAIL. `outstandingPrincipal` undefined, aktivasi "Belum tahu" ditolak karena sisa pokok/penghasilan masih wajib, `fixedUntil` tidak dikosongkan saat pilih floating, dan `finance` KPR tidak tersinkron.

- [ ] **Step 3: Implementasi**

Di `src/data/mockApi.js`:

a. Ganti import finance (baris 4) jadi:

```js
import { CalculationError, calculateMaxPrincipal, calculateOutstanding, solveAnnualRateBps } from '@/calculations/finance'
```

b. Tambahkan helper tepat **sebelum** `function syncProfile(db, values) {`:

```js
// The setup asks cicilan, bunga and sisa tenor, never sisa pokok. The estimate lives here, the one place every
// writer goes through, and is redone only when one of its inputs changed, so older estimates stay stable.
// An official figure (outstandingEstimated === false) wins until the user clears it.
const OUTSTANDING_INPUTS = ['currentPayment', 'currentRateBps', 'remainingTenorMonths']
function applyMortgageRules(m, before) {
  if (m.currentRateType !== 'fixed') {
    m.fixedUntil = null
    m.estimatedFloatingRateBps = null
  }
  if (m.outstandingEstimated === false && m.outstandingPrincipal > 0) return
  if (!OUTSTANDING_INPUTS.some((k) => before[k] !== m[k]) && m.outstandingPrincipal != null) return
  const ready = m.currentPayment > 0 && m.currentRateBps > 0 && m.remainingTenorMonths > 0 && m.scheme !== 'sharia'
  m.outstandingPrincipal = ready ? calculateMaxPrincipal({ payment: m.currentPayment, annualRateBps: m.currentRateBps, termMonths: m.remainingTenorMonths }) : null
  m.outstandingEstimated = ready ? true : null
}
```

c. `profile.update`: ganti baris `if (finance) db.finance = { ...db.finance, ...finance }` jadi:

```js
        if (finance) {
          db.finance = { ...db.finance, ...finance }
          // One source: KPR Health reads the mortgage copy, so keep it in step with the profile.
          for (const m of db.mortgages) if (m.status === 'draft' || m.status === 'active') m.finance = { ...m.finance, ...finance }
        }
```

d. Ganti seluruh isi `saveSetupStep` jadi:

```js
      saveSetupStep: call('mortgages.saveSetupStep', (db, id, { step, values }) => {
        const m = findMortgage(db, id)
        if (m.status !== 'draft' && m.status !== 'active') fail('INVALID_STATE_TRANSITION', 'Data KPR ini tidak bisa diubah.', 400)
        if (values.reminders && (!values.reminders.payment.length || !(values.reminders.channels.inApp || values.reminders.channels.email))) {
          fail('VALIDATION_FAILED', 'Pilih minimal satu jadwal pembayaran dan satu kanal.', 400)
        }
        const before = { ...m }
        Object.assign(m, values)
        applyMortgageRules(m, before)
        if (m.status === 'draft') m.setupStep = Math.min(3, Math.max(m.setupStep, step + 1))
        if (values.finance) db.finance = { ...db.finance, ...values.finance }
        touch(db, m)
        return m
      }),
```

e. Di `activate`, ganti baris `const missing = [...]` sampai `if (!(m.finance?.monthlyIncome > 0)) missing.push('finance.monthlyIncome')` jadi:

```js
        // Reminder-only setup: everything else is optional and filled in later from My KPR.
        const missing = ['bankName', 'currentPayment', 'dueDay'].filter((k) => m[k] == null || m[k] === '')
        if (m.currentRateType === 'fixed' && !m.fixedUntil) missing.push('fixedUntil')
        if (!m.reminders?.payment?.length || !(m.reminders.channels.inApp || m.reminders.channels.email)) missing.push('reminders')
```

Ganti juga `m.setupStep = 6` jadi `m.setupStep = 3`.

f. Di `update`, tambahkan `const before = { ...m }` tepat setelah pengecekan status (`if (m.status !== 'active') fail(...)`). Lalu tambahkan `applyMortgageRules(m, before)` tepat setelah `Object.assign(m, core)`.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/data/mockApi.test.js`
Expected: PASS, semua test termasuk blok lain

- [ ] **Step 5: Commit**

```bash
git add src/data/mockApi.js src/data/mockApi.test.js
git commit -m "feat(kpr): aktivasi cukup data reminder, sisa pinjaman dihitung otomatis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `setupMeta.js` dan validasi 2 step pertama

**Files:**
- Modify: `src/domains/mortgages/setupMeta.js` (isi ulang)
- Modify: `src/domains/mortgages/validation.js` (`validateLoanStep`, `validateRateStep` diganti; `validateRatePeriods`, `validatePropertyStep`, `validateFinanceStep` dihapus; `FIXED_PASSED` baru)
- Test: `src/domains/mortgages/validation.test.js` (blok `describe('mortgage setup validation', ...)`)

**Interfaces:**
- Produces:
  - `SETUP_STEPS: string[3]`, `SETUP_TITLES: string[3]`, `SETUP_PERCENT: number[3]`
  - `setupStepOf(m) → 1..3`
  - `rateTypeLabel(type) → 'Fixed' | 'Floating' | 'Belum diketahui'`
  - `progressGap(m, edit) → { label, to }`
  - `validateLoanStep(v, { editing?: boolean, outstanding?: number|null }) → errors`, dengan form keys `bankName`, `bankOther`, `currentPayment`, `dueDay`, `originalPrincipal`
  - `validateRateStep(v, { today }) → errors`, dengan form keys `rateStatus` (`'fixed'|'floating'|'unknown'|''`), `fixedUntil`, `currentRate`, `tenorYears`, `tenorMonths`, `floatingRate`, `outstanding`
  - `FIXED_PASSED: string`

- [ ] **Step 1: Tulis test yang gagal**

Di `src/domains/mortgages/validation.test.js`, ganti baris import validasi jadi:

```js
import { FIXED_PASSED, validateLoanStep, validateRateStep, validateReminders } from './validation'
```

Ganti seluruh `describe('mortgage setup validation', ...)` jadi:

```js
describe('mortgage setup validation', () => {
  const loan = { bankName: 'Bank ABC', bankOther: '', currentPayment: '4127324', dueDay: '22' }

  it('step 1 needs only bank, cicilan and due day', () => {
    expect(validateLoanStep(loan)).toEqual({})
    expect(Object.keys(validateLoanStep({ bankName: '', bankOther: '', currentPayment: '', dueDay: '' }))).toEqual(['bankName', 'currentPayment', 'dueDay'])
    expect(validateLoanStep({ ...loan, dueDay: '32' }).dueDay).toBeTruthy()
    expect(validateLoanStep({ ...loan, bankName: 'Bank lainnya', bankOther: 'B' }).bankOther).toBeTruthy()
  })

  it('edit mode: pinjaman awal is optional but cannot be below the remaining loan', () => {
    expect(validateLoanStep({ ...loan, originalPrincipal: '' }, { editing: true })).toEqual({})
    expect(validateLoanStep({ ...loan, originalPrincipal: '400000000' }, { editing: true, outstanding: 450_000_000 }).originalPrincipal).toBeTruthy()
    expect(validateLoanStep({ ...loan, originalPrincipal: '600000000' }, { editing: true, outstanding: 450_000_000 })).toEqual({})
  })

  it('step 2: the rate status is required; fixed needs a future end date', () => {
    expect(validateRateStep({ rateStatus: '' }, { today }).rateStatus).toBeTruthy()
    expect(validateRateStep({ rateStatus: 'unknown' }, { today })).toEqual({})
    expect(validateRateStep({ rateStatus: 'floating' }, { today })).toEqual({})
    expect(validateRateStep({ rateStatus: 'fixed', fixedUntil: '' }, { today }).fixedUntil).toBeTruthy()
    expect(validateRateStep({ rateStatus: 'fixed', fixedUntil: '2026-09-01' }, { today }).fixedUntil).toBe(FIXED_PASSED)
    expect(validateRateStep({ rateStatus: 'fixed', fixedUntil: '2026-12-22' }, { today })).toEqual({})
  })

  it('step 2 estimate fields are optional and checked only when filled', () => {
    const base = { rateStatus: 'fixed', fixedUntil: '2026-12-22' }
    expect(validateRateStep({ ...base, currentRate: '', floatingRate: '', tenorYears: '', tenorMonths: '', outstanding: '' }, { today })).toEqual({})
    expect(validateRateStep({ ...base, currentRate: '45' }, { today }).currentRate).toBeTruthy()
    expect(validateRateStep({ ...base, floatingRate: '45' }, { today }).floatingRate).toBeTruthy()
    expect(validateRateStep({ ...base, tenorYears: '31' }, { today }).tenorYears).toBeTruthy()
    expect(validateRateStep({ ...base, tenorYears: '15', tenorMonths: '12' }, { today }).tenorMonths).toBeTruthy()
    expect(validateRateStep({ ...base, tenorYears: '15', tenorMonths: '3' }, { today })).toEqual({})
    expect(validateRateStep({ ...base, outstanding: '0' }, { today }).outstanding).toBeTruthy()
  })

  it('reminders need one payment offset and one channel', () => {
    expect(validateReminders({ payment: [], channels: { inApp: false, email: false } })).toMatchObject({ payment: expect.any(String), channels: expect.any(String) })
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/domains/mortgages/validation.test.js`
Expected: FAIL, karena `FIXED_PASSED` tidak diekspor dan validasi lama meminta `originalPrincipal`, `startDate`, dan seterusnya.

- [ ] **Step 3: Implementasi `setupMeta.js`**

Ganti seluruh isi `src/domains/mortgages/setupMeta.js`:

```js
export const SETUP_STEPS = ['KPR kamu', 'Bunga', 'Reminder']
export const SETUP_TITLES = ['Data KPR kamu', 'Bunga KPR kamu', 'Atur reminder']
// Same front-loaded curve as the application wizards: each step ends a phase (45% / 75%), 100% once active.
export const SETUP_PERCENT = [10, 45, 75]

// Drafts saved by the old 6-step setup resume on the last (Reminder) step.
export const setupStepOf = (m) => Math.min(m.setupStep ?? 1, SETUP_STEPS.length)

export const rateTypeLabel = (type) => (type === 'fixed' ? 'Fixed' : type === 'floating' ? 'Floating' : 'Belum diketahui')

// Where to fill in what the pelunasan progress needs: pinjaman awal (step 1) or bunga & sisa tenor (step 2).
export const progressGap = (m, edit) =>
  m.originalPrincipal > 0 ? { label: 'Isi bunga & sisa tenor', to: `/monitoring/setup/2?edit=${edit}` } : { label: 'Isi pinjaman awal', to: `/monitoring/setup/1?edit=${edit}` }
```

- [ ] **Step 4: Implementasi `validation.js`**

Di `src/domains/mortgages/validation.js`:
- hapus `validateLoanStep`, `validateRateStep`, `validateRatePeriods`, `validatePropertyStep`, dan `validateFinanceStep` yang lama;
- pertahankan `minLen`, `rateError`, dan `validateReminders`.

Lalu tambahkan setelah `rateError`:

```js
export const FIXED_PASSED = 'Tanggal ini sudah lewat, berarti bunga kamu sudah floating.'

// Setup step 1 (reminder-only). `editing` = active KPR edited from My KPR, which also shows pinjaman awal.
export function validateLoanStep(v, { editing = false, outstanding = null } = {}) {
  const e = {}
  if (!v.bankName) e.bankName = 'Pilih bank.'
  if (v.bankName === 'Bank lainnya' && !minLen(v.bankOther, 2)) e.bankOther = 'Isi nama bank.'
  if (!(toMoney(v.currentPayment) > 0)) e.currentPayment = 'Isi cicilan per bulan.'
  const due = toInt(v.dueDay)
  if (!(due >= 1 && due <= 31)) e.dueDay = 'Isi tanggal 1–31.'
  if (editing) {
    const principal = toMoney(v.originalPrincipal)
    if (principal !== null && !(principal > 0)) e.originalPrincipal = 'Isi pinjaman awal lebih dari 0, atau kosongkan.'
    else if (principal > 0 && outstanding > principal) e.originalPrincipal = 'Pinjaman awal tidak boleh lebih kecil dari sisa pinjaman.'
  }
  return e
}

// Setup step 2. rateStatus: 'fixed' | 'floating' | 'unknown'. The estimate fields are optional: checked only when filled.
export function validateRateStep(v, { today }) {
  const e = {}
  if (!v.rateStatus) e.rateStatus = 'Pilih salah satu.'
  if (v.rateStatus === 'fixed') {
    if (!v.fixedUntil) e.fixedUntil = 'Pilih tanggal fixed berakhir.'
    else if (v.fixedUntil <= today) e.fixedUntil = FIXED_PASSED
    const f = rateError(v.floatingRate, false)
    if (f) e.floatingRate = f
  }
  const r = rateError(v.currentRate, false)
  if (r) e.currentRate = r
  const years = toInt(v.tenorYears)
  const months = toInt(v.tenorMonths)
  if (months !== null && months > 11) e.tenorMonths = 'Isi 0–11 bulan.'
  else if (years !== null || months !== null) {
    const total = (years ?? 0) * 12 + (months ?? 0)
    if (!(total >= 1 && total <= 360)) e.tenorYears = 'Sisa tenor harus 1 bulan sampai 30 tahun.'
  }
  const out = toMoney(v.outstanding)
  if (out !== null && !(out > 0)) e.outstanding = 'Isi sisa pinjaman lebih dari 0, atau kosongkan.'
  return e
}
```

Ubah import di atas file jadi `import { toBps, toInt, toMoney } from '@/lib/format'` (tetap, `toBps` dipakai `rateError`).

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run src/domains/mortgages/validation.test.js`
Expected: PASS

**Catatan:** `npm run lint` dan `npm run build` sengaja **belum** dijalankan di task ini. `MortgageSetupWizard.jsx` masih mengimpor fungsi yang dihapus, dan baru diganti di Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/domains/mortgages/setupMeta.js src/domains/mortgages/validation.js src/domains/mortgages/validation.test.js
git commit -m "feat(kpr): validasi setup 3 step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Wizard setup 3 step

**Files:**
- Modify: `src/domains/mortgages/MortgageSetupWizard.jsx` (isi ulang seluruh file)
- Test: `tests/e2e/mortgage-monitoring.spec.js` (test pertama)

**Interfaces:**
- Consumes:
  - dari Task 3: `SETUP_STEPS`, `SETUP_TITLES`, `SETUP_PERCENT`, `setupStepOf`, `validateLoanStep`, `validateRateStep`, `validateReminders`, `FIXED_PASSED`
  - dari Task 1: `deriveMortgage`
  - dari Task 2: aturan API
  - dari pekerjaan sebelumnya: `InsightGrid` (`@/components/shared/milestone`), `WizardProgress` dengan prop `percent`, `calculateMaxPrincipal`
- Produces: route `/monitoring/setup/1..3` dengan label field persis: `Bank`, `Nama bank`, `Cicilan per bulan`, `Jatuh tempo setiap tanggal`, `Fixed berakhir`, `Bunga sekarang`, `Sisa tenor`, `Tambahan bulan`, `Perkiraan bunga floating`, `Sisa pinjaman dari bank`, `Nama produk KPR`, `Pinjaman awal`, `Jenis KPR`

- [ ] **Step 1: Ubah e2e supaya gagal**

Di `tests/e2e/mortgage-monitoring.spec.js`, ganti test pertama mulai dari `test('monitoring: 6-step setup ...` sampai baris `await expect(page.getByText('Fixed rate berakhir 85 hari lagi')).toBeVisible()` dengan:

```js
test('monitoring: 3-step reminder setup (fixed + perkiraan) → active dashboard → payment → amortization; no application created', async ({ page }) => {
  await useScenario(page, 'fresh', '/')
  await page.getByRole('link', { name: /Pantau KPR Saya/ }).click()
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/1/)
  await expect(page.getByText('Bagian 1 dari 3 · KPR kamu')).toBeVisible()
  await expect(page.getByText('10% selesai.')).toBeAttached()

  await page.getByLabel('Bank').selectOption('Bank ABC')
  await page.getByLabel('Cicilan per bulan').fill('4127324')
  await page.getByLabel('Jatuh tempo setiap tanggal').fill('22')
  await save(page)

  await expect(page).toHaveURL(/setup\/2/)
  await expect(page.getByText('45% selesai.')).toBeAttached()
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  // A past end date means the rate is already floating: one tap fixes the answer.
  await page.getByLabel('Fixed berakhir').fill('2026-09-01')
  await expect(page.getByText('Tanggal ini sudah lewat, berarti bunga kamu sudah floating.')).toBeVisible()
  await page.getByRole('button', { name: 'Pilih Sudah floating' }).click()
  await expect(page.getByRole('radio', { name: /Sudah floating/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: /Masih fixed/ }).click()
  await page.getByLabel('Fixed berakhir').fill('2026-12-22')
  await page.getByRole('button', { name: /Mau tahu perkiraan cicilan setelah fixed/ }).click()
  await page.getByLabel('Bunga sekarang').fill('5,50')
  await page.getByLabel('Sisa tenor').fill('15')
  await page.getByLabel('Tambahan bulan').fill('3')
  await page.getByLabel('Perkiraan bunga floating').fill('9,00')
  await expect(page.getByText(/Cicilan bisa naik jadi/)).toBeVisible()
  await save(page)

  await expect(page).toHaveURL(/setup\/3/)
  await expect(page.getByText('Yang akan kami ingatkan')).toBeVisible()
  await expect(page.getByText('85 hari lagi', { exact: true })).toBeVisible()
  await expect(page.getByText('Cicilan setelah fixed')).toBeVisible()
  const payment = page.getByRole('group', { name: 'Pembayaran bulanan' })
  await expect(payment.getByRole('checkbox', { name: 'H-7' })).toHaveAttribute('aria-checked', 'true')
  await expect(payment.getByRole('checkbox', { name: 'Hari-H' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('group', { name: 'Masa fixed berakhir' }).getByRole('checkbox', { name: 'H-90' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('checkbox', { name: /WhatsApp/ })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('checkbox', { name: 'Data yang saya masukkan benar' }).check()
  await page.getByRole('button', { name: 'Aktifkan Reminder' }).click()
  await expect(page.getByRole('heading', { name: 'Pemantauan KPR aktif' })).toBeVisible()
  await page.getByRole('link', { name: 'Lihat Dashboard' }).click()

  await expect(page.getByText('Fixed rate berakhir 85 hari lagi')).toBeVisible()
```

Sisa test, mulai dari `await expect(page.locator('main canvas, main [data-chart]')).toHaveCount(0)` sampai akhir, **tidak diubah**. Amortisasi tetap jalan karena sisa pinjaman dihitung dari cicilan, 5,50%, dan 183 bulan.

- [ ] **Step 2: Jalankan e2e, pastikan gagal**

Run: `npx playwright test tests/e2e/mortgage-monitoring.spec.js -g "3-step reminder setup"`
Expected: FAIL di `Bagian 1 dari 3 · KPR kamu`

- [ ] **Step 3: Tulis ulang `src/domains/mortgages/MortgageSetupWizard.jsx`**

Isi lengkap file:

```jsx
import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckIcon, ChevronDownIcon, LockIcon, PencilIcon } from 'lucide-react'
import { api } from '@/data/api'
import { DEFAULT_REMINDERS } from '@/data/seed'
import { daysUntil } from '@/calculations/dates'
import { calculateMaxPrincipal } from '@/calculations/finance'
import { useForm, useResource } from '@/lib/hooks'
import { BANKS, bpsInput, dateShort, daysLabel, intInput, moneyInput, rupiahShort, toBps, toInt, toMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/AppShell'
import { CheckboxField, DateField, ErrorSummary, FormGrid, MoneyField, NumberField, RadioCards, RateField, SelectField, TextField } from '@/components/shared/fields'
import { UnsavedChangesGuard } from '@/components/shared/dialogs'
import { InsightGrid } from '@/components/shared/milestone'
import { WizardProgress } from '@/components/shared/progress'
import { ErrorPanel, Notice, PageSkeleton, Spinner } from '@/components/shared/ui'
import { deriveMortgage } from './derive'
import { ReminderSettingsForm } from './ReminderSettingsForm'
import { SETUP_PERCENT, SETUP_STEPS, SETUP_TITLES, setupStepOf } from './setupMeta'
import { FIXED_PASSED, validateLoanStep, validateRateStep, validateReminders } from './validation'

const RETURN = { mykpr: '/my-kpr/overview', home: '/', profile: '/profile', rate: '/my-kpr/rate', property: '/my-kpr/property', explore: '/explore', review: '/monitoring/setup/3' }
const SCHEMES = [
  { value: 'conventional', label: 'Konvensional' },
  { value: 'sharia', label: 'Syariah' },
]
const RATE_STATUS = [
  { value: 'fixed', label: 'Masih fixed', description: 'Bunga dan cicilan tetap sampai tanggal tertentu.' },
  { value: 'floating', label: 'Sudah floating', description: 'Bunga mengikuti bank dan bisa berubah.' },
  { value: 'unknown', label: 'Belum tahu', description: 'Tidak apa-apa. Reminder bayar tetap jalan.' },
]
const PAY_LABEL = { 7: 'H-7', 3: 'H-3', 1: 'H-1', 0: 'Hari-H' }

export function MortgageSetupWizard() {
  const { step } = useParams()
  const n = Number(step)
  const [params] = useSearchParams()
  const edit = params.get('edit')
  const navigate = useNavigate()
  const { data: snap, error, reload, setData } = useResource(() => api.dashboard.getSnapshot())

  // Links from the old 6-step setup (e.g. setup/6?edit=review) land on the Reminder step.
  if (n > 3 && n <= 6) return <Navigate to="/monitoring/setup/3" replace />
  if (!(n >= 1 && n <= 3)) return <Navigate to="/monitoring/intro" replace />
  if (!snap) return error ? <ErrorPanel onRetry={reload} /> : <PageSkeleton />
  const draft = snap.mortgages.find((m) => m.status === 'draft')
  const active = snap.mortgages.find((m) => m.status === 'active')
  const editingActive = !!edit && edit !== 'review' && !draft && !!active
  const m = editingActive ? active : draft
  if (!m) return <Navigate to={active ? '/my-kpr/overview' : '/monitoring/intro'} replace />
  // Reminders of an active KPR are managed in Profile → Reminder.
  if (editingActive && n === 3) return <Navigate to="/profile/reminders" replace />
  const reached = setupStepOf(m)
  if (m.status === 'draft' && n > reached) return <Navigate to={`/monitoring/setup/${reached}`} replace />

  const returnTo = edit ? RETURN[edit] ?? '/my-kpr/overview' : null
  const backTo = returnTo ?? (n === 1 ? '/monitoring/intro' : `/monitoring/setup/${n - 1}`)
  const onSaved = (saved) => {
    setData((s) => ({ ...s, mortgages: s.mortgages.map((x) => (x.id === saved.id ? saved : x)) }))
    toast(edit ? 'Perubahan tersimpan.' : 'Tersimpan.')
    navigate(returnTo ?? `/monitoring/setup/${n + 1}`)
  }
  const common = { m, clock: snap.clock, onSaved, editing: !!edit, backTo, navigate }

  return (
    <>
      <PageHeader title={edit ? 'Edit Data KPR' : 'Tambahkan KPR'} subtitle={SETUP_TITLES[n - 1]} back={backTo} />
      {!editingActive && (
        <WizardProgress
          label={`Bagian ${n} dari 3 · ${SETUP_STEPS[n - 1]}`}
          steps={SETUP_STEPS}
          current={n}
          reached={reached}
          percent={SETUP_PERCENT[Math.max(n, reached) - 1]}
          savedLabel="Tersimpan setiap klik Simpan & Lanjutkan"
        />
      )}
      {editingActive && (
        <Notice tone="info" title="Kamu sedang mengubah KPR aktif">
          Perubahan cicilan, bunga, atau sisa tenor akan menghitung ulang perkiraan sisa pinjaman, reminder, dan KPR Health.
        </Notice>
      )}
      {n === 1 && <LoanStep {...common} />}
      {n === 2 && <RateStep {...common} />}
      {n === 3 && <ReminderStep {...common} />}
    </>
  )
}

function SetupLayout({ children, footer, onSubmit }) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 rounded-card bg-card p-5 shadow-card sm:p-7">
        {children}
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">{footer}</div>
      </div>
      <aside className="flex flex-[1_1_280px] flex-col gap-4 lg:sticky lg:top-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-[22px]">
          <LockIcon className="size-5 text-primary" aria-hidden />
          <p className="text-sm leading-[21px] text-ink-2">Data yang kamu masukkan tidak dikirim ke bank. Kami hanya memakainya untuk reminder dan perkiraan.</p>
        </div>
      </aside>
    </form>
  )
}

function Section({ title, desc, children }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {desc && <p className="text-sm leading-[21px] text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Footer({ editing, backTo, navigate, saving }) {
  return (
    <>
      <Button variant="neutral" onClick={() => navigate(backTo)}>
        {editing ? 'Batal' : 'Kembali'}
      </Button>
      <Button type="submit" disabled={saving} aria-busy={saving}>
        {saving && <Spinner />}
        {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan & Lanjutkan'}
      </Button>
    </>
  )
}

function useSave(m, step, onSaved) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (values) => {
    setSaving(true)
    setError('')
    try {
      onSaved(await api.mortgages.saveSetupStep(m.id, { step, values }))
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }
  return { saving, error, save }
}

// ---------- Step 1 · KPR kamu ----------
function LoanStep({ m, onSaved, editing, backTo, navigate }) {
  const full = m.status === 'active' // My KPR edit: the optional fields the setup skips
  const known = BANKS.some((b) => b.value === m.bankName)
  const validate = useCallback((v) => validateLoanStep(v, { editing: full, outstanding: m.outstandingPrincipal }), [full, m.outstandingPrincipal])
  const form = useForm(
    {
      bankName: !m.bankName ? '' : known ? m.bankName : 'Bank lainnya',
      bankOther: known ? '' : m.bankName ?? '',
      currentPayment: moneyInput(m.currentPayment),
      dueDay: intInput(m.dueDay),
      productName: m.productName ?? '',
      scheme: m.scheme ?? 'conventional',
      originalPrincipal: moneyInput(m.originalPrincipal),
    },
    validate,
  )
  const { saving, error, save } = useSave(m, 1, onSaved)
  const v = form.values
  const onSubmit = form.submit((x) =>
    save({
      bankName: x.bankName === 'Bank lainnya' ? x.bankOther.trim() : x.bankName,
      currentPayment: toMoney(x.currentPayment),
      dueDay: toInt(x.dueDay),
      ...(full ? { productName: x.productName.trim() || null, scheme: x.scheme, originalPrincipal: toMoney(x.originalPrincipal) } : {}),
    }),
  )
  return (
    <SetupLayout onSubmit={onSubmit} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}>
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Data KPR kamu" desc={full ? undefined : 'Cukup 3 data untuk mulai mendapat reminder.'}>
        <FormGrid>
          <SelectField label="Bank" options={BANKS} {...form.bind('bankName')} />
          {v.bankName === 'Bank lainnya' && <TextField label="Nama bank" placeholder="Nama bank kamu" {...form.bind('bankOther')} />}
          <MoneyField label="Cicilan per bulan" placeholder="4.250.000" {...form.bind('currentPayment')} />
          <NumberField label="Jatuh tempo setiap tanggal" placeholder="22" maxLength={2} hint={toInt(v.dueDay) > 28 ? 'Di bulan tanpa tanggal ini, jatuh tempo pada hari terakhir bulan.' : ''} {...form.bind('dueDay')} />
          {full && (
            <>
              <TextField label="Nama produk KPR" optional placeholder="KPR Fixed 5 Tahun" maxLength={100} {...form.bind('productName')} />
              <MoneyField label="Pinjaman awal" optional placeholder="600.000.000" hint="Untuk menghitung progres pelunasan." {...form.bind('originalPrincipal')} />
              <RadioCards label="Jenis KPR" options={SCHEMES} span {...form.bind('scheme')} />
            </>
          )}
        </FormGrid>
        {full && v.scheme === 'sharia' && <Notice tone="warn">KPR syariah: reminder tetap aktif, tetapi amortisasi dan perkiraan floating belum tersedia.</Notice>}
      </Section>
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 2 · Bunga ----------
// A saved draft past step 2 with no rate type answered "Belum tahu"; an untouched draft has no answer yet.
const statusOf = (m) => m.currentRateType ?? (m.status === 'active' || m.setupStep > 2 ? 'unknown' : '')

// Same math as the dashboard: derive the mortgage as if these numbers were saved. Sisa pinjaman comes from the
// cicilan unless an official figure is typed. Null until every input is valid.
function floatingPreview(m, v, clock) {
  const rateBps = toBps(v.currentRate)
  const floatingBps = toBps(v.floatingRate)
  const termMonths = (toInt(v.tenorYears) ?? 0) * 12 + (toInt(v.tenorMonths) ?? 0)
  const rateOk = (bps) => bps > 0 && bps <= 3000
  if (v.rateStatus !== 'fixed' || !(v.fixedUntil > clock) || !(m.currentPayment > 0) || !rateOk(rateBps) || !rateOk(floatingBps) || !(termMonths >= 1 && termMonths <= 360)) return null
  const outstandingPrincipal = toMoney(v.outstanding) || calculateMaxPrincipal({ payment: m.currentPayment, annualRateBps: rateBps, termMonths })
  return deriveMortgage({ ...m, scheme: 'conventional', currentRateType: 'fixed', fixedUntil: v.fixedUntil, currentRateBps: rateBps, remainingTenorMonths: termMonths, estimatedFloatingRateBps: floatingBps, outstandingPrincipal }, clock).floatingImpact
}

function RateStep({ m, clock, onSaved, editing, backTo, navigate }) {
  const full = m.status === 'active'
  const validate = useCallback((v) => validateRateStep(v, { today: clock }), [clock])
  const form = useForm(
    {
      rateStatus: statusOf(m),
      fixedUntil: m.fixedUntil ?? '',
      currentRate: bpsInput(m.currentRateBps),
      tenorYears: m.remainingTenorMonths ? String(Math.floor(m.remainingTenorMonths / 12)) : '',
      tenorMonths: m.remainingTenorMonths ? String(m.remainingTenorMonths % 12) : '',
      floatingRate: bpsInput(m.estimatedFloatingRateBps),
      outstanding: m.outstandingEstimated === false ? moneyInput(m.outstandingPrincipal) : '',
    },
    validate,
  )
  const [open, setOpen] = useState(!!(m.currentRateBps || m.remainingTenorMonths || m.estimatedFloatingRateBps))
  const { saving, error, save } = useSave(m, 2, onSaved)
  const v = form.values
  const fixed = v.rateStatus === 'fixed'
  const canEstimate = fixed && m.scheme !== 'sharia'
  const showFields = full || (canEstimate && open)
  const passed = fixed && !!v.fixedUntil && v.fixedUntil <= clock
  const impact = canEstimate ? floatingPreview(m, v, clock) : null

  const onSubmit = form.submit((x) => {
    const type = x.rateStatus === 'unknown' ? null : x.rateStatus
    const years = toInt(x.tenorYears)
    const months = toInt(x.tenorMonths)
    const official = toMoney(x.outstanding)
    return save({
      currentRateType: type,
      fixedUntil: type === 'fixed' ? x.fixedUntil : null,
      currentRateBps: toBps(x.currentRate),
      remainingTenorMonths: years === null && months === null ? null : (years ?? 0) * 12 + (months ?? 0),
      estimatedFloatingRateBps: type === 'fixed' ? toBps(x.floatingRate) : null,
      // Official sisa pinjaman (edit only): typed → it wins; cleared → back to the estimate.
      ...(full && official ? { outstandingPrincipal: official, outstandingEstimated: false } : {}),
      ...(full && !official && m.outstandingEstimated === false ? { outstandingPrincipal: null, outstandingEstimated: null } : {}),
    })
  })

  return (
    <SetupLayout onSubmit={onSubmit} footer={<Footer editing={editing} backTo={backTo} navigate={navigate} saving={saving} />}>
      <UnsavedChangesGuard when={form.dirty && !saving} />
      <ErrorSummary show={form.showSummary} count={Object.keys(form.errors).length} />
      <Section title="Bunga KPR kamu">
        <RadioCards label="Bunga KPR kamu sekarang?" layout="column" options={RATE_STATUS} {...form.bind('rateStatus')} />
        {fixed && (
          <DateField label="Fixed berakhir" hint="Lihat di surat akad atau aplikasi bank. Kalau hanya tahu bulannya, pilih tanggal 1." {...form.bind('fixedUntil')} />
        )}
        {passed && (
          <Notice
            tone="warn"
            role="status"
            action={
              <Button variant="outline" size="sm" onClick={() => form.setValues({ ...v, rateStatus: 'floating', fixedUntil: '' })}>
                Pilih Sudah floating
              </Button>
            }
          >
            {FIXED_PASSED}
          </Notice>
        )}
        {v.rateStatus === 'unknown' && <Notice tone="muted">Cek di aplikasi bank atau surat akad nanti. Kamu bisa mengisinya kapan saja dari My KPR.</Notice>}
      </Section>

      {!full && canEstimate && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-[#c9d3e3] px-[18px] py-3 text-left text-sm font-bold text-ink-2"
        >
          Mau tahu perkiraan cicilan setelah fixed? (opsional)
          <ChevronDownIcon className={cn('size-4 shrink-0', open && 'rotate-180')} aria-hidden />
        </button>
      )}
      {showFields && (
        <Section title={full ? 'Bunga & sisa tenor' : 'Perkiraan cicilan setelah fixed'} desc={full ? 'Dipakai untuk amortisasi, perkiraan floating, dan simulasi Take Over.' : undefined}>
          <FormGrid>
            <RateField label="Bunga sekarang" optional {...form.bind('currentRate')} />
            {fixed && <RateField label="Perkiraan bunga floating" optional placeholder="10,50" hint="Belum tahu? Tanyakan ke bank, atau isi perkiraan dulu. Bisa diubah kapan saja." {...form.bind('floatingRate')} />}
            <NumberField label="Sisa tenor" optional suffix="tahun" placeholder="15" maxLength={2} {...form.bind('tenorYears')} />
            <NumberField label="Tambahan bulan" optional suffix="bulan" placeholder="0" maxLength={2} {...form.bind('tenorMonths')} />
            {full && (
              <MoneyField
                label="Sisa pinjaman dari bank"
                optional
                span
                hint={m.outstandingEstimated && m.outstandingPrincipal ? `Perkiraan saat ini ± ${rupiahShort(m.outstandingPrincipal)}. Isi angka dari bank kalau ada.` : 'Kosongkan untuk memakai perkiraan dari cicilan, bunga, dan sisa tenor.'}
                {...form.bind('outstanding')}
              />
            )}
          </FormGrid>
          {canEstimate &&
            (impact ? (
              <p role="status" className="rounded-2xl bg-secondary px-[18px] py-4 text-sm leading-[21px] font-semibold text-ink-2">
                {impact.direction === 'increase'
                  ? `Cicilan bisa naik jadi ± ${rupiahShort(impact.estimatedNextPayment)}/bln (+${rupiahShort(impact.monthlyDelta)}) mulai ${dateShort(impact.resetDate)}.`
                  : impact.direction === 'decrease'
                    ? `Cicilan diperkirakan turun jadi ± ${rupiahShort(impact.estimatedNextPayment)}/bln mulai ${dateShort(impact.resetDate)}.`
                    : 'Cicilan diperkirakan tidak berubah setelah fixed.'}
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground">Isi bunga sekarang, sisa tenor, dan perkiraan bunga floating untuk melihat perkiraan.</p>
            ))}
        </Section>
      )}
      {error && <Notice tone="bad" role="alert">{error}</Notice>}
    </SetupLayout>
  )
}

// ---------- Step 3 · Reminder ----------
function ReminderStep({ m, clock, navigate }) {
  const isFixed = m.currentRateType === 'fixed' && !!m.fixedUntil && m.fixedUntil > clock
  const [reminders, setReminders] = useState(() => {
    const r = structuredClone(m.reminders ?? DEFAULT_REMINDERS)
    return isFixed ? r : { ...r, fixedExpiry: [] }
  })
  const [agree, setAgree] = useState(false)
  const [tried, setTried] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const errors = validateReminders(reminders)
  const days = isFixed ? daysUntil({ fromDate: clock, targetDate: m.fixedUntil }) : null
  const upcoming = isFixed ? reminders.fixedExpiry.filter((h) => days >= h) : []
  const fi = deriveMortgage(m, clock).floatingImpact
  const edit = (step) => () => navigate(`/monitoring/setup/${step}?edit=review`)
  // The reward for the two short steps: what the app will actually do with them.
  const items = [
    isFixed && { k: 'Fixed berakhir', v: dateShort(m.fixedUntil), sub: daysLabel(days) },
    isFixed && { k: 'Pengingat floating', v: `${upcoming.length} kali`, sub: upcoming.length ? upcoming.map((h) => `H-${h}`).join(' · ') : 'Tidak ada jadwal tersisa' },
    { k: 'Bayar cicilan', v: `Tiap tgl ${m.dueDay}`, sub: reminders.payment.length ? reminders.payment.map((h) => PAY_LABEL[h]).join(' · ') : 'Belum dipilih' },
    fi?.direction === 'increase' && { k: 'Cicilan setelah fixed', v: `± ${rupiahShort(fi.estimatedNextPayment)}`, sub: `+${rupiahShort(fi.monthlyDelta)}/bln (perkiraan)` },
  ].filter(Boolean)

  const activate = async (e) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length || !agree || pending) return
    setPending(true)
    setError('')
    try {
      await api.mortgages.saveSetupStep(m.id, { step: 3, values: { reminders } })
      const res = await api.mortgages.activate(m.id, { confirmDataCorrect: true })
      navigate('/monitoring/success', { replace: true, state: { scheduled: res.scheduledReminderCount } })
    } catch (err) {
      setError(err.message)
      setPending(false)
    }
  }

  return (
    <SetupLayout
      onSubmit={activate}
      footer={
        <>
          <Button variant="neutral" onClick={() => navigate('/monitoring/setup/2')}>
            Kembali
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending} className={!agree ? 'bg-border text-ink-3 hover:bg-border' : ''}>
            {pending && <Spinner />}
            {pending ? 'Mengaktifkan…' : 'Aktifkan Reminder'}
          </Button>
        </>
      }
    >
      <Section title="Yang akan kami ingatkan">
        <InsightGrid items={items} />
        {m.currentRateType === 'floating' && <Notice tone="info">Bunga kamu sudah floating. Kami ingatkan pembayaran tiap bulan. Bandingkan program bank lain di Explore.</Notice>}
        {!m.currentRateType && (
          <Notice
            tone="warn"
            action={
              <button type="button" onClick={edit(2)} className="min-h-11 text-[13px] font-bold text-primary underline">
                Isi sekarang
              </button>
            }
          >
            Jenis bunga belum diketahui. Reminder floating aktif setelah kamu mengisinya.
          </Notice>
        )}
        <div className="flex flex-wrap gap-x-5">
          <button type="button" onClick={edit(1)} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-primary">
            <PencilIcon className="size-3.5" aria-hidden />
            Ubah data KPR
          </button>
          <button type="button" onClick={edit(2)} className="flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-primary">
            <PencilIcon className="size-3.5" aria-hidden />
            Ubah bunga
          </button>
        </div>
      </Section>
      <Section title="Atur reminder" desc="Pengaturan default sudah dipilih. Ubah bila perlu.">
        <ReminderSettingsForm value={reminders} onChange={setReminders} dueDay={m.dueDay} isFixed={isFixed} fixedUntil={m.fixedUntil} errors={tried ? errors : {}} />
      </Section>
      <CheckboxField label="Data yang saya masukkan benar" checked={agree} onChange={setAgree} error={tried && !agree ? 'Centang konfirmasi data dulu.' : undefined} />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckIcon className="size-3.5 text-success" aria-hidden />
        Aktivasi tidak membuat pengajuan ke bank.
      </p>
      {error && <Notice tone="bad" role="alert">{error} Draft dan pilihanmu tetap tersimpan.</Notice>}
    </SetupLayout>
  )
}
```

- [ ] **Step 4: Jalankan e2e, unit test, lint, pastikan lulus**

Run: `npx playwright test tests/e2e/mortgage-monitoring.spec.js -g "3-step reminder setup"`
Expected: PASS

Run: `npm test`
Expected: PASS

Run: `npm run lint`
Expected: tidak ada error. Kalau `Notice` belum menerima prop `action` atau `role`, cek `src/components/shared/ui.jsx`. Keduanya sudah dipakai di file lain.

- [ ] **Step 5: Commit**

```bash
git add src/domains/mortgages/MortgageSetupWizard.jsx tests/e2e/mortgage-monitoring.spec.js
git commit -m "feat(kpr): setup KPR berjalan 3 step untuk reminder floating

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Resume draft & progress 3 step di luar wizard

**Files:**
- Modify: `src/domains/home/HomePage.jsx` (`MortgageDraftHero`, import)
- Modify: `src/domains/mortgages/MyKprLayout.jsx` (checklist draft)
- Modify: `src/domains/mortgages/MonitoringPages.jsx` (resume + kalimat intro)
- Test: `tests/e2e/mortgage-monitoring.spec.js` (test baru)

**Interfaces:**
- Consumes: `SETUP_STEPS`, `SETUP_PERCENT`, `setupStepOf` (Task 3)

- [ ] **Step 1: Tulis e2e yang gagal**

Tambahkan di `tests/e2e/mortgage-monitoring.spec.js`, setelah test pertama:

```js
test('old setup draft resumes on the Reminder step in 3-step language', async ({ page }) => {
  await useScenario(page, 'mortgage_setup_draft', '/')
  await expect(page.getByText('Bagian 3 dari 3 · Reminder')).toBeVisible()
  await page.getByRole('button', { name: 'Lanjutkan Pengaturan' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/3/)
  await expect(page.getByText('Yang akan kami ingatkan')).toBeVisible()
  await page.goto('/monitoring/setup/6?edit=review') // link from the old 6-step setup
  await expect(page).toHaveURL(/monitoring\/setup\/3$/)
  await page.goto('/my-kpr')
  await expect(page.locator('main ol > li')).toHaveText([/KPR kamu/, /Bunga/, /Reminder/])
})
```

- [ ] **Step 2: Jalankan e2e, pastikan gagal**

Run: `npx playwright test tests/e2e/mortgage-monitoring.spec.js -g "old setup draft"`
Expected: FAIL. Home masih menampilkan `Step 3 dari 6 — ...`.

- [ ] **Step 3: Implementasi `HomePage.jsx`**

a. Ganti `import { SETUP_STEPS } from "@/domains/mortgages/setupMeta";` jadi:

```jsx
import {
  SETUP_PERCENT,
  SETUP_STEPS,
  setupStepOf,
} from "@/domains/mortgages/setupMeta";
```

b. Di `MortgageDraftHero`, ganti `const step = Math.min(mortgage.setupStep, 6);` jadi `const step = setupStepOf(mortgage);`.

c. Ganti:

```jsx
          Step {step} dari 6 — {SETUP_STEPS[step - 1]}
```

jadi:

```jsx
          Bagian {step} dari 3 · {SETUP_STEPS[step - 1]}
```

d. Ganti `value={stepPercent(step, 6)}` jadi `value={SETUP_PERCENT[step - 1]}`.

e. Jalankan `grep -n "stepPercent" src/domains/home/HomePage.jsx`. Kalau hanya baris import yang tersisa, hapus `stepPercent` dari import `@/components/shared/progress`.

- [ ] **Step 4: Implementasi `MyKprLayout.jsx`**

a. Ganti `import { SETUP_STEPS } from './setupMeta'` jadi `import { SETUP_STEPS, setupStepOf } from './setupMeta'`.

b. Tepat setelah `const draft = snap.mortgages.find((m) => m.status === 'draft')`, tambahkan:

```jsx
  const draftStep = draft ? setupStepOf(draft) : null
```

c. Ganti `const state = n < draft.setupStep ? 'done' : n === draft.setupStep ? 'current' : 'todo'` jadi:

```jsx
              const state = n < draftStep ? 'done' : n === draftStep ? 'current' : 'todo'
```

d. Ganti `navigate(`/monitoring/setup/${draft.setupStep}`)` jadi `navigate(`/monitoring/setup/${draftStep}`)`.

- [ ] **Step 5: Implementasi `MonitoringPages.jsx`**

a. Tambahkan import `import { setupStepOf } from './setupMeta'`.

b. Ganti `navigate(`/monitoring/setup/${Math.min(m.setupStep, 6)}`)` jadi `navigate(`/monitoring/setup/${setupStepOf(m)}`)`.

c. Tepat setelah `</ul>` di `MonitoringIntro`, tambahkan:

```jsx
          <p className="text-[13px] leading-5 text-ink-3">Cukup 3 langkah singkat. Data lain bisa dilengkapi nanti.</p>
```

- [ ] **Step 6: Jalankan e2e & lint, pastikan lulus**

Run: `npx playwright test tests/e2e/mortgage-monitoring.spec.js`
Expected: PASS, semua test di file

Run: `npm run lint`
Expected: tidak ada error

- [ ] **Step 7: Commit**

```bash
git add src/domains/home/HomePage.jsx src/domains/mortgages/MyKprLayout.jsx src/domains/mortgages/MonitoringPages.jsx tests/e2e/mortgage-monitoring.spec.js
git commit -m "feat(kpr): draft setup dilanjutkan dalam 3 step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tampilan "Lengkapi" untuk KPR dengan data minimal

**Files:**
- Modify: `src/domains/home/MonitoringDashboard.jsx` (notice jenis bunga, panel KPR Health, panel KPR Saya)
- Modify: `src/domains/mortgages/MyKprTabs.jsx` (`OverviewTab`)
- Modify: `src/domains/mortgages/HealthPage.jsx`
- Test: `tests/e2e/mortgage-monitoring.spec.js` (test baru)

**Interfaces:**
- Consumes: `rateTypeLabel`, `progressGap` (Task 3); `d.mode === null`, `d.paidRatio === null`, `d.health.score === null` (Task 1)

- [ ] **Step 1: Tulis e2e yang gagal**

Tambahkan di `tests/e2e/mortgage-monitoring.spec.js`:

```js
test('beginner path: "Belum tahu" still activates; Home and My KPR ask for what is missing, never show null', async ({ page }) => {
  await useScenario(page, 'fresh', '/monitoring/intro')
  await page.getByRole('button', { name: 'Mulai Tambahkan KPR' }).click()
  await page.getByLabel('Bank').selectOption('Bank ABC')
  await page.getByLabel('Cicilan per bulan').fill('4127324')
  await page.getByLabel('Jatuh tempo setiap tanggal').fill('22')
  await save(page)
  await page.getByRole('radio', { name: /Belum tahu/ }).click()
  await expect(page.getByRole('button', { name: /Mau tahu perkiraan/ })).toHaveCount(0)
  await save(page)
  await expect(page.getByText('Jenis bunga belum diketahui. Reminder floating aktif setelah kamu mengisinya.')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Data yang saya masukkan benar' }).check()
  await page.getByRole('button', { name: 'Aktifkan Reminder' }).click()
  await page.getByRole('link', { name: 'Lihat Dashboard' }).click()

  await expect(page.getByText('Jenis bunga belum diketahui', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Isi jenis bunga' })).toHaveAttribute('href', '/monitoring/setup/2?edit=home')
  await expect(page.locator('main')).not.toContainText(/null|NaN|undefined/)
  await page.goto('/my-kpr/overview')
  await expect(page.getByRole('link', { name: 'Isi pinjaman awal' })).toBeVisible()
  await expect(page.locator('main')).not.toContainText(/null|NaN|undefined/)
  await page.goto('/my-kpr/health')
  await expect(page.locator('main')).not.toContainText(/null|NaN|undefined/)
})
```

- [ ] **Step 2: Jalankan e2e, pastikan gagal**

Run: `npx playwright test tests/e2e/mortgage-monitoring.spec.js -g "beginner path"`
Expected: FAIL di `Jenis bunga belum diketahui`

- [ ] **Step 3: `MonitoringDashboard.jsx`**

a. Tambahkan import `import { progressGap, rateTypeLabel } from '@/domains/mortgages/setupMeta'`.

b. Tepat **sebelum** baris `{/* Opportunity leads the dashboard; only the fixed-rate warning sits above it. */}`, sisipkan:

```jsx
      {d.mode === null && (
        <Notice tone="warn" title="Jenis bunga belum diketahui" action={<Link to="/monitoring/setup/2?edit=home" className="text-[13px] font-bold text-primary underline">Isi jenis bunga</Link>}>
          Cek di aplikasi bank supaya kami bisa mengingatkan sebelum floating.
        </Notice>
      )}
```

c. Ganti seluruh blok `<Panel className="order-1 flex-row items-center gap-6 xl:order-none"> ... </Panel>` (panel KPR Health yang berisi `<HealthRing health={d.health} ...`) jadi:

```jsx
          {d.health.score == null ? (
            <Panel className="order-1 xl:order-none">
              <span className="text-[13px] font-extrabold text-ink-3">KPR Health</span>
              <p className="text-sm leading-[21px] text-ink-2">Lengkapi data untuk melihat KPR Health.</p>
              <Link to="/my-kpr/health" className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary">
                Lihat yang perlu dilengkapi
                <ArrowRightIcon className="size-[15px]" aria-hidden />
              </Link>
            </Panel>
          ) : (
            <Panel className="order-1 flex-row items-center gap-6 xl:order-none">
              <HealthRing health={d.health} size={d.mode === 'normal' ? 112 : 92} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-[13px] font-extrabold text-ink-3">KPR Health</span>
                <Chip tone={d.health.tone}>{d.health.label}</Chip>
                <p className="text-sm leading-[21px] text-ink-2">{d.health.score >= 80 ? 'Kondisi KPR kamu sehat.' : HEALTH_SENTENCE[weakest?.key]}</p>
                {d.health.partial && <p className="text-xs text-warning-text">Skor parsial — sebagian komponen belum dapat dihitung.</p>}
                <Link to="/my-kpr/health" className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary">
                  Lihat penyebab
                  <ArrowRightIcon className="size-[15px]" aria-hidden />
                </Link>
              </div>
            </Panel>
          )}
```

d. Di panel "KPR Saya", ganti:

```jsx
                <span className="text-[13px] text-muted-foreground">dari {rupiah(m.originalPrincipal)}</span>
              </div>
              <ProgressBar value={d.paidRatio * 100} label="Pokok lunas" />
              <span className="text-[13px] font-bold text-primary">{Math.round(d.paidRatio * 100)}% pokok lunas</span>
```

dengan:

```jsx
                {m.originalPrincipal > 0 && <span className="text-[13px] text-muted-foreground">dari {rupiah(m.originalPrincipal)}</span>}
              </div>
              {d.paidRatio == null ? (
                <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
                  Progres pelunasan belum diketahui.
                  <Link to={progressGap(m, 'home').to} className="flex min-h-11 items-center font-bold text-primary underline">
                    {progressGap(m, 'home').label}
                  </Link>
                </span>
              ) : (
                <>
                  <ProgressBar value={d.paidRatio * 100} label="Pokok lunas" />
                  <span className="text-[13px] font-bold text-primary">{Math.round(d.paidRatio * 100)}% pokok lunas</span>
                </>
              )}
```

e. Di `SummaryRows` panel yang sama:

- di baris `Bunga saat ini`, ganti teks chip `{isFloating ? 'Floating' : 'Fixed'}` jadi `{isFloating ? 'Floating' : rateTypeLabel(m.currentRateType)}`;
- ganti baris `Masa fixed berakhir` jadi:

```jsx
                { k: 'Masa fixed berakhir', v: isFloating ? 'Sudah berakhir' : m.currentRateType === 'fixed' ? dateShort(m.fixedUntil) : 'Belum diketahui' },
```

- ganti baris `Sisa tenor` jadi:

```jsx
                { k: 'Sisa tenor', v: m.remainingTenorMonths ? `${tenorLabel(m.remainingTenorMonths)} lagi` : 'Belum diisi' },
```

- [ ] **Step 4: `MyKprTabs.jsx` (`OverviewTab`)**

a. Tambahkan import `import { progressGap, rateTypeLabel } from './setupMeta'` dan `Link` (sudah diimpor dari `react-router-dom` di file ini).

b. Ganti:

```jsx
        <ProgressBar value={d.paidRatio * 100} size="lg" label="Progres pokok lunas" />
        <span className="text-sm font-bold text-primary">{Math.round(d.paidRatio * 100)}% lunas</span>
```

dengan:

```jsx
        {d.paidRatio == null ? (
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
            Progres pelunasan belum diketahui.
            <Link to={progressGap(m, 'mykpr').to} className="flex min-h-11 items-center font-bold text-primary underline">
              {progressGap(m, 'mykpr').label}
            </Link>
          </span>
        ) : (
          <>
            <ProgressBar value={d.paidRatio * 100} size="lg" label="Progres pokok lunas" />
            <span className="text-sm font-bold text-primary">{Math.round(d.paidRatio * 100)}% lunas</span>
          </>
        )}
```

c. Di `SummaryRows`, ganti baris `Sisa Tenor` dan `Bunga` jadi:

```jsx
            { k: 'Sisa Tenor', v: m.remainingTenorMonths ? `${m.remainingTenorMonths} bulan (${tenorLabel(m.remainingTenorMonths)})` : 'Belum diisi' },
            { k: 'Bunga', v: m.currentRateBps ? `${percentBps(m.currentRateBps)} ${rateTypeLabel(m.currentRateType)}` : rateTypeLabel(m.currentRateType) },
```

- [ ] **Step 5: `HealthPage.jsx`**

a. Tambahkan import `Link` (ubah jadi `import { Link, Navigate, useNavigate } from 'react-router-dom'`) dan `import { progressGap } from './setupMeta'`.

b. Setelah `const weakest = ...`, tambahkan:

```jsx
  // One "Lengkapi" link per component that cannot be scored yet, each to the single place that field is asked.
  const complete = {
    dti: { label: 'Isi penghasilan', to: '/profile/edit' },
    ltv: { label: 'Isi nilai properti', to: '/my-kpr/property?edit=1' },
    rate: { label: 'Isi jenis bunga', to: '/monitoring/setup/2?edit=mykpr' },
    progress: progressGap(m, 'mykpr'),
  }
```

c. Di objek `evidence`, ganti `rate` dan `progress` jadi:

```jsx
    rate: d.mode == null ? 'Jenis bunga belum diketahui' : d.mode === 'floating' ? 'Sudah menggunakan bunga floating' : d.daysUntilFixedEnd != null ? `Fixed berakhir ${d.daysUntilFixedEnd} hari lagi` : 'Tanggal akhir fixed belum diisi',
    progress: d.paidRatio == null ? 'Progres pelunasan belum diketahui' : `${Math.round(d.paidRatio * 100)}% pokok sudah lunas`,
```

d. Di `todo`, ganti `d.mode !== 'normal' && 'Bandingkan opsi Take Over ...'` jadi `(d.mode === 'warning' || d.mode === 'floating') && 'Bandingkan opsi Take Over atau repricing sebelum/selama floating.'`.

e. Ganti `subtitle` di `PageHeader` jadi:

```jsx
subtitle={h.score == null ? 'Belum lengkap · lengkapi data di bawah' : `${h.score}/100 · ${h.label}${h.partial ? ' · skor parsial' : ''}`}
```

f. Ganti blok `<div className="mb-2.5 flex items-center gap-4"> ... </div>` (ring + chip) jadi:

```jsx
          {h.score == null ? (
            <p className="mb-2.5 text-[15px] leading-[22px] font-semibold text-ink-2">Lengkapi data di bawah untuk melihat KPR Health.</p>
          ) : (
            <div className="mb-2.5 flex items-center gap-4">
              <HealthRing health={h} size={96} />
              <div className="flex min-w-0 flex-col items-start gap-2">
                <Chip tone={h.tone}>{h.label}</Chip>
                <p className="text-[15px] leading-[22px] font-semibold text-ink-2">{h.score >= 80 ? 'Kondisi KPR kamu sehat.' : HEALTH_SENTENCE[weakest?.key]}</p>
              </div>
            </div>
          )}
```

g. Di dalam `<li>` tiap komponen, tepat setelah `<span className="text-[13px] text-ink-3">{evidence[c.key]}</span>`, tambahkan:

```jsx
                {c.score === null && (
                  <Link to={complete[c.key].to} className="flex min-h-11 w-fit items-center text-[13px] font-bold text-primary underline">
                    {complete[c.key].label}
                  </Link>
                )}
```

- [ ] **Step 6: Jalankan e2e & lint, pastikan lulus**

Run: `npx playwright test tests/e2e/mortgage-monitoring.spec.js`
Expected: PASS, semua test

Run: `npm run lint`
Expected: tidak ada error

- [ ] **Step 7: Commit**

```bash
git add src/domains/home/MonitoringDashboard.jsx src/domains/mortgages/MyKprTabs.jsx src/domains/mortgages/HealthPage.jsx tests/e2e/mortgage-monitoring.spec.js
git commit -m "feat(kpr): ajakan lengkapi data untuk KPR dengan data minimal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Penjaga simulasi Take Over dari KPR yang datanya kurang

**Files:**
- Modify: `src/domains/optimize/GoalStartPage.jsx`
- Test: `tests/e2e/mortgage-monitoring.spec.js` (test "beginner path" dari Task 6)

**Interfaces:**
- Consumes: `RETURN.explore` di wizard (Task 4), yang membuat `/monitoring/setup/2?edit=explore` kembali ke `/explore`

- [ ] **Step 1: Perpanjang e2e supaya gagal**

Di akhir test `beginner path ...`, sebelum penutup `})`, tambahkan:

```js

  // Take Over from the monitored KPR needs bunga & sisa tenor first (sisa pinjaman is derived from them).
  await page.goto('/optimize/start?mode=takeover')
  await expect(page.getByText('Untuk simulasi, lengkapi bunga dan sisa tenor KPR kamu dulu.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lihat Kondisi KPR' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Lengkapi data bunga' }).click()
  await expect(page).toHaveURL(/monitoring\/setup\/2\?edit=explore/)
```

- [ ] **Step 2: Jalankan e2e, pastikan gagal**

Run: `npx playwright test tests/e2e/mortgage-monitoring.spec.js -g "beginner path"`
Expected: FAIL di teks penjaga (form simulasi masih tampil)

- [ ] **Step 3: Implementasi**

Di `src/domains/optimize/GoalStartPage.jsx`:

a. Ganti baris `const years = m ? Math.min(25, ...) : 15` jadi:

```jsx
  const years = m?.remainingTenorMonths ? Math.min(25, Math.max(5, Math.round(m.remainingTenorMonths / 12 / 5) * 5)) : 15
```

b. Tepat setelah `if (!m) return <Navigate to={`/optimize/intro?mode=${initialMode}`} replace />`, tambahkan:

```jsx
  // The reminder-only setup may not know the old loan's balance yet: ask for it before simulating.
  const loanReady = m.currentPayment > 0 && m.currentRateBps > 0 && m.remainingTenorMonths > 0 && m.outstandingPrincipal > 0
  if (!loanReady) {
    return (
      <>
        <OptimizeHeader title={`Simulasi ${modeName(initialMode)}`} subtitle="Memakai data KPR yang kamu pantau. Tidak ada data yang dikirim ke bank." back="/explore" />
        <Notice
          tone="warn"
          title="Data KPR belum cukup untuk simulasi"
          action={
            <Link to="/monitoring/setup/2?edit=explore" className="text-[13px] font-bold text-primary underline">
              Lengkapi data bunga
            </Link>
          }
        >
          Untuk simulasi, lengkapi bunga dan sisa tenor KPR kamu dulu.
        </Notice>
      </>
    )
  }
```

`Link`, `Notice`, `OptimizeHeader`, dan `modeName` sudah diimpor di file ini. Hook (`useForm`, `useState`) sudah dipanggil sebelum early return, jadi urutan hook tetap aman.

- [ ] **Step 4: Jalankan e2e (KPR & Take Over), pastikan lulus**

Run: `npx playwright test tests/e2e/mortgage-monitoring.spec.js tests/e2e/takeover-flow.spec.js`
Expected: PASS. Skenario seed Take Over dari Explore punya data lengkap, jadi tidak terhalang.

- [ ] **Step 5: Commit**

```bash
git add src/domains/optimize/GoalStartPage.jsx tests/e2e/mortgage-monitoring.spec.js
git commit -m "feat(takeover): minta data bunga sebelum simulasi dari KPR minimal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Cicilan lain di Profil, satu sumber data keuangan

**Files:**
- Modify: `src/domains/profile/ProfilePages.jsx` (`ProfileForm`)

**Interfaces:**
- Consumes: sinkron `profile.update` → `finance` mortgage (Task 2, sudah ada unit test-nya)

- [ ] **Step 1: Implementasi**

Di `ProfileForm`:

a. Di nilai awal `useForm`, setelah `partnerIncome: moneyInput(f.partnerIncome),`, tambahkan:

```jsx
      vehicleDebt: moneyInput(f.vehicleDebt), cardDebt: moneyInput(f.cardDebt), otherDebt: moneyInput(f.otherDebt),
```

b. Di `api.profile.update`, ganti objek `finance` jadi:

```jsx
        finance: {
          monthlyIncome: toMoney(x.monthlyIncome), jointIncome: x.jointIncome, partnerIncome: x.jointIncome ? toMoney(x.partnerIncome) : null,
          vehicleDebt: toMoney(x.vehicleDebt), cardDebt: toMoney(x.cardDebt), otherDebt: toMoney(x.otherDebt),
        },
```

c. Tepat setelah `{v.jointIncome && <MoneyField label="Penghasilan pasangan" span {...form.bind('partnerIncome')} />}`, tambahkan:

```jsx
            <MoneyField label="Cicilan kendaraan" optional placeholder="0" {...form.bind('vehicleDebt')} />
            <MoneyField label="Kartu kredit / paylater" optional placeholder="0" {...form.bind('cardDebt')} />
            <MoneyField label="Pinjaman lain" optional placeholder="0" span hint="Dipakai untuk rasio cicilan di KPR Health." {...form.bind('otherDebt')} />
```

- [ ] **Step 2: Verifikasi**

Run: `npm run lint`. Expected: tidak ada error.
Run: `npx vitest run src/data/mockApi.test.js -t "profile finance"`. Expected: PASS.

Cek manual: `npm run dev`, scenario `mortgage_active_normal`.
1. Buka `/profile/edit`, isi `Cicilan kendaraan` 1.000.000, lalu Simpan.
2. Buka `/my-kpr/health`. Komponen Beban cicilan harus naik sesuai rasio yang baru.

- [ ] **Step 3: Commit**

```bash
git add src/domains/profile/ProfilePages.jsx
git commit -m "feat(profile): cicilan lain diisi di profil untuk KPR Health

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verifikasi akhir

- [ ] **Step 1: Lint, unit test, build**

Run: `npm run lint`. Expected: tidak ada error.
Run: `npm test`. Expected: semua PASS.
Run: `npm run build`. Expected: sukses.

- [ ] **Step 2: Semua e2e**

Run: `npm run e2e`
Expected: PASS. Kalau ada spec lain yang masih memakai label setup lama (`Aktifkan Pemantauan KPR`, `Step x dari 6`, `Jumlah pinjaman awal`), cari dengan `grep -rn "Aktifkan Pemantauan\|dari 6\|Jumlah pinjaman awal" tests src`, lalu sesuaikan. Laporkan output yang gagal apa adanya.

- [ ] **Step 3: Cek manual**

`npm run dev`, viewport 320×568 dan 1440×900:
- **Setup 3 step** (scenario `fresh`): tidak ada scroll horizontal; pilihan jenis bunga tersusun 1 kolom; tombol toggle perkiraan ≥ 44px; kartu "Yang akan kami ingatkan" 1 kolom di mobile.
- **KPR Health tanpa skor:** di DevTools → Application → localStorage, hapus `finance.monthlyIncome` pada KPR aktif hasil setup "Belum tahu" (atau aktifkan dari scenario dengan `finance: {}`). Home harus menampilkan "Lengkapi data untuk melihat KPR Health." tanpa ring kosong. `/my-kpr/health` harus menampilkan tautan `Isi penghasilan`, `Isi nilai properti`, `Isi jenis bunga`, dan `Isi pinjaman awal`.
- **Edit KPR aktif** (`/monitoring/setup/2?edit=mykpr`): bagian "Bunga & sisa tenor" langsung terbuka. Isi `Sisa pinjaman dari bank`, simpan, lalu pastikan Overview tidak lagi menandai sisa pokok sebagai estimasi. Kosongkan lagi, lalu pastikan tanda estimasi kembali.

- [ ] **Step 4: Review diff**

Run: `git log --oneline -9` dan `git diff HEAD~8 --stat`. Pastikan hanya file di plan ini yang berubah.
