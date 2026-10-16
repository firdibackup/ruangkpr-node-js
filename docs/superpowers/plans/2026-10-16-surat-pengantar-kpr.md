# Surat Pengantar Aplikasi KPR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super admins print a prefilled, editable RE/MAX "Surat Pengantar Aplikasi KPR" for an application that is at the bank, saved per application.

**Architecture:** Rules live in one module (`src/domains/admin/coverLetter.js`): printable statuses, checklist rows per variant, prefill, validation. `mockApi` exposes `admin.applications.coverLetter` / `saveCoverLetter` over `db.coverLetters`, plus a `coverLetter` section in configuration. Supabase stores letters in an admin-only `cover_letters` table. The page is a form plus an A4 preview that prints with `window.print()` and Tailwind `print:` variants.

**Tech Stack:** React 19 + Vite, Tailwind v4, shadcn/Radix, Vitest, Playwright, Supabase (Postgres RLS, pgTAP).

**Spec:** `docs/superpowers/specs/2026-10-16-surat-pengantar-kpr-design.md`

## Global Constraints

- No new dependencies.
- UI calls only `api` from `@/data/api`; logic stays in `src/data/mockApi.js` over the store (`localStore` / `supabaseStore`).
- `PRINTABLE_STATUSES = ['bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed']`.
- Letters never go on the application JSON; they live in `db.coverLetters` (Supabase: `cover_letters`, super admin only).
- Money is integer Rupiah. Text fields max 160 characters, property address max 300.
- Required: `maName`, `maId`, `officeName`, `customerName`, `propertyAddress`, `bankName`, `boName`, `feeAccount`, `loanAmount > 0`, valid `submittedDate`, `applicantColumn`. `salesOfficer` optional.
- Touch targets ≥ 44px; desktop breakpoint `lg` (1024px); Plus Jakarta Sans and app tokens for the admin UI (the A4 sheet itself is black-on-white Arial/Times like the bank form).
- Copy in Bahasa Indonesia.
- Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Clicking **Cetak** on a saved, unchanged letter → prints, writes nothing, adds no audit entry (Task 2 test "unchanged save").
- Office defaults never set, or a configuration saved before this feature → letter opens with empty office fields; saving lists field errors instead of crashing (Task 2 tests "old configuration" and "validation").
- Application not yet at the bank or rejected → page shows "Surat pengantar tersedia setelah pengajuan diteruskan ke bank."; API and database refuse writes (Task 2 test; Task 3 pgTAP).
- Checklist keys that do not belong to this letter's variant (forged or stale) → dropped on save (Task 2 test with `not_a_row`).
- Amount cleared in the form → sheet shows "Rp." without the terbilang line; save says "Isi nominal KPR yang diajukan." (Task 1 `terbilang(null)`; Task 2 validation test).

---

### Task 1: `terbilang` helper

**Files:**
- Modify: `src/lib/format.js` (append after `labelOf`, end of file)
- Create: `src/lib/format.test.js`

**Interfaces:**
- Produces: `terbilang(n: number) => string` — whole Rupiah in Indonesian words with capitalised words and " Rupiah"; `''` for anything that is not a non-negative integer.

- [ ] **Step 1: Write the failing test**

`src/lib/format.test.js`:
```js
import { describe, expect, it } from 'vitest'
import { terbilang } from './format'

describe('terbilang', () => {
  it('spells whole Rupiah the way a bank letter writes it', () => {
    expect(terbilang(0)).toBe('Nol Rupiah')
    expect(terbilang(11)).toBe('Sebelas Rupiah')
    expect(terbilang(15)).toBe('Lima Belas Rupiah')
    expect(terbilang(21)).toBe('Dua Puluh Satu Rupiah')
    expect(terbilang(100)).toBe('Seratus Rupiah')
    expect(terbilang(110)).toBe('Seratus Sepuluh Rupiah')
    expect(terbilang(1_000)).toBe('Seribu Rupiah')
    expect(terbilang(11_000)).toBe('Sebelas Ribu Rupiah')
    expect(terbilang(100_000)).toBe('Seratus Ribu Rupiah')
    expect(terbilang(1_500_000)).toBe('Satu Juta Lima Ratus Ribu Rupiah')
    expect(terbilang(1_001_000)).toBe('Satu Juta Seribu Rupiah')
    expect(terbilang(400_000_000)).toBe('Empat Ratus Juta Rupiah')
    expect(terbilang(2_750_000_000)).toBe('Dua Miliar Tujuh Ratus Lima Puluh Juta Rupiah')
    expect(terbilang(1_000_000_000_000)).toBe('Satu Triliun Rupiah')
  })

  it('returns nothing for an empty or invalid amount', () => {
    expect(terbilang(null)).toBe('')
    expect(terbilang(-5)).toBe('')
    expect(terbilang(1.5)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format.test.js`
Expected: FAIL — `terbilang is not a function` (or not exported).

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/format.js`:
```js

// Whole Rupiah in words for letters ("Empat Ratus Juta Rupiah"); '' when there is no valid amount.
const UNITS = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
const SCALES = [
  [1e12, 'Triliun'],
  [1e9, 'Miliar'],
  [1e6, 'Juta'],
  [1e3, 'Ribu'],
]
function words(n) {
  if (n < 12) return UNITS[n]
  if (n < 20) return `${UNITS[n - 10]} Belas`
  if (n < 100) return `${UNITS[Math.floor(n / 10)]} Puluh ${words(n % 10)}`.trim()
  if (n < 200) return `Seratus ${words(n - 100)}`.trim()
  if (n < 1000) return `${UNITS[Math.floor(n / 100)]} Ratus ${words(n % 100)}`.trim()
  if (n < 2000) return `Seribu ${words(n - 1000)}`.trim()
  const [size, name] = SCALES.find(([s]) => n >= s)
  return `${words(Math.floor(n / size))} ${name} ${words(n % size)}`.trim()
}
export const terbilang = (n) => (Number.isInteger(n) && n >= 0 ? `${n === 0 ? 'Nol' : words(n)} Rupiah` : '')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.js src/lib/format.test.js
git commit -m "feat(format): terbilang for whole Rupiah

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cover letter rules, API, and office defaults

**Files:**
- Create: `src/domains/admin/coverLetter.js`
- Modify: `src/data/mockApi.js` (imports near line 11; `DEFAULT_CONFIG`/`configOf`/`CONFIG_LABEL`/`configInput`/`configIssues` near lines 1012–1035; new helpers after `applicationDetail` near line 730; new endpoints after `addNote` near line 2171)
- Test: `src/data/mockApi.test.js` (new `describe` after the `admin applications` block, near line 451)

**Interfaces:**
- Produces (from `src/domains/admin/coverLetter.js`):
  - `PRINTABLE_STATUSES: string[]`
  - `APPLICANT_COLUMNS: { value: 'employee'|'entrepreneur'|'professional', label: string }[]`
  - `OFFICE_FIELDS`, `DEFAULT_OFFICE`, `officeInput(v) => office`, `officeIssues(office) => { [field]: message }`
  - `variantOf(app) => 'primary'|'takeover'|'topup'`
  - `letterRows(variant) => { applicant: Row[], house: Row[], second: { title: string, rows: Row[] } }` where `Row = { key, label, docs }`
  - `prefillLetter({ app, data, userName, office }) => Letter`
  - `letterInput(variant, values) => Letter`, `letterIssues(letter) => { [field]: message }`
  - `Letter = { maName, maId, officeName, customerName, propertyAddress, bankName, loanAmount, takeoverAmount?, topupAmount?, submittedDate, salesOfficer, boName, feeAccount, applicantColumn, checked: string[] }` (+ `id`, `updatedAt`, `updatedBy` once saved)
- Produces (API):
  - `api.admin.applications.coverLetter(id) => { application: { id, status, productType, optimizationMode, userName }, variant, rows, letter, saved: boolean }`
  - `api.admin.applications.saveCoverLetter(id, { values }) => same shape`
  - `api.admin.config.update('coverLetter', { values, reason, expectedVersion })`; `config.coverLetter` always present in `api.admin.config.get()`.
- Audit action: `application.cover_letter`, `resource: { type: 'application', id, label: <user name> }`.

- [ ] **Step 1: Write the failing tests**

In `src/data/mockApi.test.js`, add after the closing `})` of `describe('admin applications', …)`:
```js
describe('admin cover letter', () => {
  const FIRDI = 'app_01J8Z19RZ4VE4Q2AB7M5N8XKCF' // KPR Primary at the bank: Bank ABC, Rp400 jt
  const office = { officeName: 'RE/MAX Eagle Citraland', maName: 'Like', maId: 'R230021', boName: 'Budiono Yuwono', feeAccount: 'Rek. Bank BCA 511.010.6060 a/n PT. BUANA JAYA MAPAN' }
  const saveOffice = async (values = office, reason = 'Data kantor RE/MAX') => api.admin.config.update('coverLetter', { values, reason, expectedVersion: (await api.admin.config.get()).config.version })

  it('prefills from the application and the office defaults, only once the application is at the bank', async () => {
    mockControls.reset('admin_ops')
    await expectCode(api.admin.applications.coverLetter('app_sample_01'), 'INVALID_STATE_TRANSITION') // submitted
    await expectCode(api.admin.applications.coverLetter('app_sample_06'), 'INVALID_STATE_TRANSITION') // rejected
    await expectCode(api.admin.applications.coverLetter('app_nope'), 'RESOURCE_NOT_FOUND')
    await saveOffice()
    const d = await api.admin.applications.coverLetter(FIRDI)
    expect(d).toMatchObject({ variant: 'primary', saved: false, application: { id: FIRDI, userName: 'Firdi Audi' }, rows: { second: { title: 'Dokumen Penjual' } } })
    expect(d.letter).toEqual({
      ...office,
      customerName: 'Firdi Audi',
      propertyAddress: 'Rumah Griya Asri Blok C2 No. 8, Bekasi',
      bankName: 'Bank ABC',
      loanAmount: 400_000_000,
      submittedDate: '2026-09-25',
      salesOfficer: '',
      applicantColumn: 'employee',
      checked: ['app_ktp_kk', 'app_npwp', 'app_income', 'app_property'],
    })
  })

  it('take over uses the old-loan table; take over + top-up splits the amount', async () => {
    mockControls.reset('admin_ops')
    let d = await api.admin.applications.coverLetter('app_sample_05') // Sari, Take Over at the bank
    expect(d.variant).toBe('takeover')
    expect(d.rows.second.title).toBe('Dokumen KPR Lama')
    expect(d.letter.checked).toEqual(['app_ktp_kk', 'app_npwp', 'app_savings', 'app_income', 'app_property', 'house_certificate', 'house_permit', 'house_pbb', 'old_agreement', 'old_outstanding', 'old_payment'])
    expect(d.letter).not.toHaveProperty('topupAmount')

    const db = loadDb()
    const app = db.accounts.flatMap((a) => a.applications).find((a) => a.id === 'app_sample_05')
    const outstanding = app.snapshot.data.oldLoan.outstanding
    app.optimizationMode = 'topup'
    app.selection.loanAmount = outstanding + 150_000_000
    saveDb(db)
    d = await api.admin.applications.coverLetter('app_sample_05')
    expect(d.variant).toBe('topup')
    expect(d.rows.second.rows.at(-1)).toMatchObject({ key: 'topup_plan', label: 'Rencana Penggunaan Dana' })
    expect(d.letter).toMatchObject({ loanAmount: outstanding + 150_000_000, takeoverAmount: outstanding, topupAmount: 150_000_000 })
  })

  it('validation: required fields, amount, date, and column', async () => {
    mockControls.reset('admin_ops')
    const d = await api.admin.applications.coverLetter(FIRDI) // no office defaults yet: those fields are empty
    const e = await api.admin.applications.saveCoverLetter(FIRDI, { values: { ...d.letter, loanAmount: null, submittedDate: '2026-02-30', applicantColumn: 'boss' } }).catch((x) => x)
    expect(e.code).toBe('VALIDATION_FAILED')
    expect(e.fieldErrors.map((f) => f.field).sort()).toEqual(['applicantColumn', 'boName', 'feeAccount', 'loanAmount', 'maId', 'maName', 'officeName', 'submittedDate'])
    expect(e.fieldErrors.find((f) => f.field === 'loanAmount').message).toBe('Isi nominal KPR yang diajukan.')
    const long = await api.admin.applications.saveCoverLetter(FIRDI, { values: { ...d.letter, ...office, salesOfficer: 'x'.repeat(161) } }).catch((x) => x)
    expect(long.fieldErrors).toEqual([{ field: 'salesOfficer', message: 'Maksimal 160 karakter.' }])
  })

  it('saves the edited letter, keeps it when the defaults change, and audits only real changes', async () => {
    mockControls.reset('admin_ops')
    const d0 = await api.admin.applications.coverLetter(FIRDI)
    const values = { ...d0.letter, ...office, salesOfficer: '  Hilda ', checked: [...d0.letter.checked, 'app_license', 'not_a_row', 'app_license'] }
    let d = await api.admin.applications.saveCoverLetter(FIRDI, { values })
    expect(d.saved).toBe(true)
    expect(d.letter).toMatchObject({ salesOfficer: 'Hilda', checked: ['app_ktp_kk', 'app_npwp', 'app_income', 'app_license', 'app_property'], updatedBy: { name: 'Admin RuangKPR' } })
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'application.cover_letter', resource: { type: 'application', id: FIRDI, label: 'Firdi Audi' }, after: { salesOfficer: 'Hilda' } })

    await saveOffice({ ...office, maName: 'Budi' }, 'MA baru di kantor')
    d = await api.admin.applications.coverLetter(FIRDI)
    expect(d.letter.maName).toBe('Like')

    // unchanged save: what Cetak sends for a saved letter
    const before = (await api.admin.audit.list()).items.length
    await api.admin.applications.saveCoverLetter(FIRDI, { values: d.letter })
    expect((await api.admin.audit.list()).items).toHaveLength(before)
  })

  it('only super admins open it, and the applicant never receives it', async () => {
    mockControls.reset('admin_ops')
    const d = await api.admin.applications.coverLetter(FIRDI)
    await api.admin.applications.saveCoverLetter(FIRDI, { values: { ...d.letter, ...office, salesOfficer: 'Sales Rahasia' } })
    await signIn('Penulis Konten', 'penulis@ruangkpr.id')
    await expectCode(api.admin.applications.coverLetter(FIRDI), 'FORBIDDEN')
    await signIn('Firdi Audi', 'firdi.audi@email.com')
    await expectCode(api.admin.applications.saveCoverLetter(FIRDI, { values: d.letter }), 'FORBIDDEN')
    expect(JSON.stringify(await api.dashboard.getSnapshot())).not.toContain('Sales Rahasia')
  })

  it('office defaults: empty at first (also for an older saved configuration), trimmed, capped, audited', async () => {
    mockControls.reset('admin_ops')
    const db = loadDb()
    db.config = { version: 2, reminders: DEFAULT_REMINDERS, upload: { maxFileMb: 5, formats: ['jpg', 'png', 'pdf'] } }
    saveDb(db)
    const { config } = await api.admin.config.get()
    expect(config.coverLetter).toEqual({ officeName: '', maName: '', maId: '', boName: '', feeAccount: '' })
    await expectCode(api.admin.config.update('coverLetter', { values: { ...office, feeAccount: 'x'.repeat(161) }, reason: 'Data kantor', expectedVersion: 2 }), 'VALIDATION_FAILED')
    const d = await api.admin.config.update('coverLetter', { values: { ...office, maName: '  Like  ' }, reason: 'Data kantor', expectedVersion: 2 })
    expect(d.config.coverLetter).toEqual(office)
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'config.update', resource: { type: 'config', id: 'coverLetter', label: 'Surat pengantar' } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/mockApi.test.js -t "admin cover letter"`
Expected: FAIL — `api.admin.applications.coverLetter is not a function` / unknown config section.

- [ ] **Step 3: Create the rules module**

`src/domains/admin/coverLetter.js`:
```js
// Surat Pengantar Aplikasi KPR (spec 2026-10-16): when it can be printed, the bank form's checklist rows, the prefill
// from an application, and what a saved letter holds. mockApi and the admin page share these.
import { parseIsoDate } from '@/calculations/dates'

export const PRINTABLE_STATUSES = ['bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed']

export const APPLICANT_COLUMNS = [
  { value: 'employee', label: 'Pegawai' },
  { value: 'entrepreneur', label: 'Pengusaha' },
  { value: 'professional', label: 'Profesional' },
]
const COLUMN_OF = { civil_servant: 'employee', private_employee: 'employee', contract_employee: 'employee', entrepreneur: 'entrepreneur', freelancer: 'professional' }

// Office defaults kept in Configuration (config.coverLetter); a new letter starts from them.
export const OFFICE_FIELDS = ['officeName', 'maName', 'maId', 'boName', 'feeAccount']
export const DEFAULT_OFFICE = Object.fromEntries(OFFICE_FIELDS.map((k) => [k, '']))
export const officeInput = (v = {}) => Object.fromEntries(OFFICE_FIELDS.map((k) => [k, String(v[k] ?? '').trim()]))
export const officeIssues = (v) => Object.fromEntries(OFFICE_FIELDS.filter((k) => v[k].length > 160).map((k) => [k, 'Maksimal 160 karakter.']))

// `docs` names the RuangKPR documents behind a row, per product (Take Over + Top-up reads `takeover`). A row starts
// ticked when all of them are verified; a row without them is ticked by hand.
const row = (key, label, docs = {}) => ({ key, label, docs })
const APPLICANT_ROWS = [
  row('app_ktp_kk', 'Fotokopi KTP dan Kartu Keluarga (suami dan istri)', { primary: ['ktp'], takeover: ['ktp', 'family_card'] }),
  row('app_marriage', 'Copy Akta Nikah / Cerai / Kematian / Perjanjian Pranikah', { takeover: ['marriage_document'] }),
  row('app_npwp', 'Copy NPWP / SPT PPh 21 Pribadi', { primary: ['npwp'], takeover: ['npwp'] }),
  row('app_savings', 'Copy Rek. Tabungan / Giro terakhir', { takeover: ['bank_statement'] }),
  row('app_income', 'Asli Surat Keterangan Kerja dan Slip Gaji', { primary: ['income_proof'], takeover: ['income_proof'] }),
  row('app_license', 'Copy Surat Izin Praktek'),
  row('app_company', 'Fotokopi Akta Pendirian Perusahaan dan perubahannya, NPWP, SIUP, TDP **'),
  row('app_property', 'Surat Pemesanan Rumah (untuk rumah baru) atau Sertifikat, IMB, Denah Bangunan, AJB dan PBB (untuk rumah second)', { primary: ['property_document'], takeover: ['certificate'] }),
]
const HOUSE_ROWS = [
  row('house_certificate', 'Copy sertifikat HM / HGB', { takeover: ['certificate'] }),
  row('house_permit', 'Copy IMB', { takeover: ['building_permit'] }),
  row('house_plan', 'Copy Denah Bangunan'),
  row('house_ajb', 'Copy Akte Jual Beli', { takeover: ['sale_purchase_agreement'] }),
  row('house_pbb', 'Copy PBB Terakhir', { takeover: ['land_tax'] }),
]
const SELLER_ROWS = [
  row('seller_ktp', 'Copy KTP Penjual'),
  row('seller_spouse_ktp', 'Copy KTP istri/suami Penjual'),
  row('seller_kk', 'Copy Kartu Keluarga Penjual'),
  row('seller_marriage', 'Copy Akta Nikah Penjual'),
  row('seller_npwp', 'Copy NPWP Penjual'),
  row('seller_death', 'Copy Akta Kematian dan Keterangan Waris (jika Penjual meninggal)'),
]
const OLD_LOAN_ROWS = [
  row('old_agreement', 'Copy Akad Kredit Lama', { takeover: ['old_loan_agreement'] }),
  row('old_outstanding', 'Surat Keterangan Sisa Pokok', { takeover: ['outstanding_letter'] }),
  row('old_payment', 'Bukti Angsuran Terakhir', { takeover: ['latest_payment_proof'] }),
  row('old_payoff', 'Informasi Pelunasan / Penalti', { takeover: ['payoff_info'] }),
]
const FUND_PLAN_ROW = row('topup_plan', 'Rencana Penggunaan Dana', { takeover: ['fund_plan'] })

export const variantOf = (app) => (app.productType === 'primary' ? 'primary' : app.optimizationMode === 'topup' ? 'topup' : 'takeover')

export function letterRows(variant) {
  const second = variant === 'primary' ? { title: 'Dokumen Penjual', rows: SELLER_ROWS } : { title: 'Dokumen KPR Lama', rows: variant === 'topup' ? [...OLD_LOAN_ROWS, FUND_PLAN_ROW] : OLD_LOAN_ROWS }
  return { applicant: APPLICANT_ROWS, house: HOUSE_ROWS, second }
}
const allRows = (variant) => {
  const r = letterRows(variant)
  return [...r.applicant, ...r.house, ...r.second.rows]
}

// The day the application went to the bank, in WIB.
const wibDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso))

// A letter nobody saved yet: the application's own data (the submitted snapshot) and the office defaults.
export function prefillLetter({ app, data, userName, office }) {
  const variant = variantOf(app)
  const group = variant === 'primary' ? 'primary' : 'takeover'
  const verified = (type) => app.documents?.[type]?.status === 'verified'
  const loanAmount = app.selection?.loanAmount ?? null
  const outstanding = data.oldLoan?.outstanding ?? 0
  const forwarded = app.statusHistory?.find((h) => h.status === 'bank_processing')?.at
  return {
    ...officeInput(office),
    customerName: data.personal?.fullName || userName,
    propertyAddress: data.property?.address ?? '',
    bankName: app.selection?.bankName ?? '',
    loanAmount,
    ...(variant === 'topup' && { takeoverAmount: outstanding, topupAmount: Math.max(0, (loanAmount ?? 0) - outstanding) }),
    submittedDate: forwarded ? wibDate(forwarded) : '',
    salesOfficer: '',
    applicantColumn: COLUMN_OF[data.employment?.occupation] ?? 'employee',
    checked: allRows(variant)
      .filter((r) => r.docs[group]?.every(verified))
      .map((r) => r.key),
  }
}

const TEXT_FIELDS = ['maName', 'maId', 'officeName', 'customerName', 'propertyAddress', 'bankName', 'salesOfficer', 'boName', 'feeAccount']
const REQUIRED = {
  maName: 'Isi nama Marketing Associate.',
  maId: 'Isi No. ID RE/MAX.',
  officeName: 'Isi kantor RE/MAX.',
  customerName: 'Isi nama nasabah.',
  propertyAddress: 'Isi alamat properti.',
  bankName: 'Isi nama bank.',
  boName: 'Isi nama Business Owner.',
  feeAccount: 'Isi rekening marketing fee.',
}
const amount = (x) => (Number.isInteger(x) ? x : null)

// What a save stores: trimmed text, whole-Rupiah amounts, and only this letter's checklist rows, in form order.
export function letterInput(variant, v = {}) {
  const checked = Array.isArray(v.checked) ? v.checked : []
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, String(v[k] ?? '').trim()])),
    loanAmount: amount(v.loanAmount),
    ...(variant === 'topup' && { takeoverAmount: amount(v.takeoverAmount), topupAmount: amount(v.topupAmount) }),
    submittedDate: String(v.submittedDate ?? ''),
    applicantColumn: String(v.applicantColumn ?? ''),
    checked: allRows(variant)
      .map((r) => r.key)
      .filter((k) => checked.includes(k)),
  }
}

export function letterIssues(l) {
  const e = {}
  for (const [k, message] of Object.entries(REQUIRED)) if (!l[k]) e[k] = message
  for (const k of TEXT_FIELDS) {
    const max = k === 'propertyAddress' ? 300 : 160
    if (!e[k] && l[k].length > max) e[k] = `Maksimal ${max} karakter.`
  }
  if (!(Number.isInteger(l.loanAmount) && l.loanAmount > 0)) e.loanAmount = 'Isi nominal KPR yang diajukan.'
  for (const k of ['takeoverAmount', 'topupAmount']) if (k in l && !(Number.isInteger(l[k]) && l[k] >= 0)) e[k] = 'Isi nominal (boleh 0).'
  if (!parseIsoDate(l.submittedDate)) e.submittedDate = 'Pilih tanggal pengajuan.'
  if (!APPLICANT_COLUMNS.some((c) => c.value === l.applicantColumn)) e.applicantColumn = 'Pilih kolom pemohon.'
  return e
}
```

- [ ] **Step 4: Wire the configuration section in `mockApi.js`**

Add the import after `import { STAGE_NOTE_STATUSES, STATUS_LABEL } from '@/domains/applications/meta'`:
```js
import { DEFAULT_OFFICE, PRINTABLE_STATUSES, letterInput, letterIssues, letterRows, officeInput, officeIssues, prefillLetter, variantOf } from '@/domains/admin/coverLetter'
```

Replace:
```js
const DEFAULT_CONFIG = { version: 1, reminders: DEFAULT_REMINDERS, upload: DEFAULT_UPLOAD }
const configOf = (db) => db.config ?? DEFAULT_CONFIG
const CONFIG_LABEL = { reminders: 'Pengingat default', upload: 'Unggah dokumen' }
```
with:
```js
const DEFAULT_CONFIG = { version: 1, reminders: DEFAULT_REMINDERS, upload: DEFAULT_UPLOAD, coverLetter: DEFAULT_OFFICE }
// A configuration saved before a section existed reads that section's defaults.
const configOf = (db) => ({ ...DEFAULT_CONFIG, ...db.config })
const CONFIG_LABEL = { reminders: 'Pengingat default', upload: 'Unggah dokumen', coverLetter: 'Surat pengantar' }
```

In `configInput`, add as the first line of the body:
```js
  if (section === 'coverLetter') return officeInput(v)
```
In `configIssues`, add as the first line of the body:
```js
  if (section === 'coverLetter') return officeIssues(v)
```

- [ ] **Step 5: Add the letter helpers and endpoints in `mockApi.js`**

After the closing `}` of `function applicationDetail(db, owner, app)`, add:
```js

// Surat pengantar (spec 2026-10-16) lives in db.coverLetters, never on the application: the applicant reads that.
function printableApp(db, id) {
  const found = findUserApp(db, id)
  if (!PRINTABLE_STATUSES.includes(found.app.status)) fail('INVALID_STATE_TRANSITION', 'Surat pengantar tersedia setelah pengajuan diteruskan ke bank.', 409)
  return found
}
function coverLetterView(db, id) {
  const { owner, app } = printableApp(db, id)
  const variant = variantOf(app)
  const saved = (db.coverLetters ?? []).find((l) => l.id === id)
  return {
    application: { id: app.id, status: app.status, productType: app.productType, optimizationMode: app.optimizationMode, userName: owner.user.name },
    variant,
    rows: letterRows(variant),
    letter: saved ?? prefillLetter({ app, data: app.snapshot?.data ?? app.data, userName: owner.user.name, office: configOf(db).coverLetter }),
    saved: Boolean(saved),
  }
}
```

In `admin.applications`, after the `addNote: call(…)` entry, add:
```js
        coverLetter: call('admin.applications.coverLetter', coverLetterView, { admin: true }),
        saveCoverLetter: call(
          'admin.applications.saveCoverLetter',
          (db, id, { values } = {}) => {
            const { owner, app } = printableApp(db, id)
            const next = letterInput(variantOf(app), values)
            failOnFields(letterIssues(next), 'Periksa kembali isian surat.')
            const letters = (db.coverLetters ??= [])
            const i = letters.findIndex((l) => l.id === id)
            const diff = changes(letters[i] ?? {}, next, Object.keys(next))
            if (!diff) return coverLetterView(db, id) // printing an unchanged letter writes nothing
            const saved = { id, ...next, updatedAt: nowIso(db), updatedBy: { id: db.user.id, name: db.user.name } }
            if (i >= 0) letters[i] = saved
            else letters.push(saved)
            audit(db, { action: 'application.cover_letter', resource: { type: 'application', id, label: owner.user.name }, ...diff })
            return coverLetterView(db, id)
          },
          { admin: true },
        ),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/data/mockApi.test.js`
Expected: PASS, including the 6 new `admin cover letter` tests and every existing test (the `configOf` change must not break the dashboard snapshot or configuration tests).

- [ ] **Step 7: Commit**

```bash
git add src/domains/admin/coverLetter.js src/data/mockApi.js src/data/mockApi.test.js
git commit -m "feat(admin): cover letter data, prefill and office defaults

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Supabase table, RLS, and store

**Files:**
- Create: `supabase/migrations/20261016090000_cover_letters.sql`
- Create: `supabase/tests/011_cover_letters.test.sql`
- Modify: `src/data/supabase/store.js:95` (planWrites) and `:157-186` (admin load)
- Modify: `src/data/supabase/store.test.js` (new test in `describe('planWrites')`)
- Modify: `supabase/README.md:14` (migration status line)

**Interfaces:**
- Consumes: `db.coverLetters: Letter[]` (each with `id` = application id) from Task 2.
- Produces: table `public.cover_letters (id text pk → applications.id on delete cascade, doc jsonb)`; `apply_writes` accepts `"cover_letters": ["id", "doc"]`.

- [ ] **Step 1: Write the failing store test**

In `src/data/supabase/store.test.js`, inside `describe('planWrites', …)`, add:
```js
  it('cover letters insert once, then update their doc', () => {
    const before = base()
    const after = structuredClone(before)
    after.coverLetters = [{ id: 'app_1', salesOfficer: 'Hilda' }]
    expect(planWrites(before, after, versions)).toEqual([{ op: 'insert', table: 'cover_letters', values: { id: 'app_1', doc: after.coverLetters[0] } }])
    const later = structuredClone(after)
    later.coverLetters[0].salesOfficer = 'Rudi'
    expect(planWrites(after, later, versions)).toEqual([{ op: 'update', table: 'cover_letters', id: 'app_1', values: { doc: later.coverLetters[0] } }])
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/data/supabase/store.test.js`
Expected: FAIL — received `[]`.

- [ ] **Step 3: Update `store.js`**

In `planWrites`, after the `admin_notes` line, add:
```js
  ops.push(...diffList('cover_letters', before.coverLetters, after.coverLetters))
```
In `load`, inside `if (admin && role)`, extend the `Promise.all` destructuring and list:
```js
      const [profiles, roles, allApps, allMortgages, notes, audit, changes, letters] = await Promise.all([
```
and add as the last entry of the array (after the `user_changes` query):
```js
        must(sb.from('cover_letters').select('doc')),
```
After `db.adminNotes = docs(notes)`, add:
```js
      db.coverLetters = docs(letters)
```

- [ ] **Step 4: Run the store test to verify it passes**

Run: `npx vitest run src/data/supabase/store.test.js`
Expected: PASS.

- [ ] **Step 5: Write the migration**

`supabase/migrations/20261016090000_cover_letters.sql` — the table, grants and policies below, followed by a full copy of `public.apply_writes`. Print the current function with:
```bash
sed -n '/^create or replace function public.apply_writes/,/^end \$\$;/p' supabase/migrations/20261014100000_kept_application_data.sql
```
paste it under the comment, and change only the `v_allowed` tail from:
```
    "admin_notes": ["id", "application_id", "doc"]
```
to:
```
    "admin_notes": ["id", "application_id", "doc"],
    "cover_letters": ["id", "doc"]
```
File head:
```sql
-- Surat pengantar per pengajuan (spec 2026-10-16). Only super admins read or write a letter, and only while its
-- application is at the bank or later. Kept out of applications.doc: the applicant reads that row and may rewrite it
-- as a draft after a rejection.
create table public.cover_letters (
  id text primary key references public.applications (id) on delete cascade,
  doc jsonb not null
);

alter table public.cover_letters enable row level security;
revoke all on public.cover_letters from anon, authenticated;
grant all on public.cover_letters to service_role;
grant select, insert, update on public.cover_letters to authenticated;

create policy cover_letters_select on public.cover_letters for select to authenticated
  using ((select private.has_role('super_admin')));
create policy cover_letters_insert on public.cover_letters for insert to authenticated
  with check ((select private.has_role('super_admin')) and exists (
    select 1 from public.applications a
     where a.id = cover_letters.id
       and a.status in ('bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed')));
create policy cover_letters_update on public.cover_letters for update to authenticated
  using ((select private.has_role('super_admin')))
  with check ((select private.has_role('super_admin')) and exists (
    select 1 from public.applications a
     where a.id = cover_letters.id
       and a.status in ('bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed')));

-- As in 20261014100000_kept_application_data, with cover_letters writable.
```
Verify the copy: `grep -c '"cover_letters": \["id", "doc"\]' supabase/migrations/20261016090000_cover_letters.sql` → `1`.

- [ ] **Step 6: Write the pgTAP test**

`supabase/tests/011_cover_letters.test.sql`:
```sql
-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Users: A (applicant), S (super_admin), W (content_writer). A's application app_t11b is at the bank, app_t11v still in
-- document verification.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000011a1', 'a11@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000011c1', 's11@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000011d1', 'w11@test.local', '{}', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000011c1', 'super_admin'), ('00000000-0000-4000-8000-0000000011d1', 'content_writer');
insert into public.applications (id, user_id, doc) values
  ('app_t11b', '00000000-0000-4000-8000-0000000011a1', '{"status":"bank_processing","productType":"primary"}'),
  ('app_t11v', '00000000-0000-4000-8000-0000000011a1', '{"status":"docs_verification","productType":"primary"}');

set local role authenticated;

-- ---------- the applicant and the content writer cannot write a letter ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011a1","role":"authenticated"}', true);
select throws_ok($$insert into public.cover_letters (id, doc) values ('app_t11b', '{"salesOfficer":"A"}')$$, '42501', 'new row violates row-level security policy for table "cover_letters"', 'the applicant cannot write a letter for their own application');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011d1","role":"authenticated"}', true);
select throws_ok($$insert into public.cover_letters (id, doc) values ('app_t11b', '{"salesOfficer":"W"}')$$, '42501', 'new row violates row-level security policy for table "cover_letters"', 'a content writer cannot write a letter');

-- ---------- the super admin writes one once the application is at the bank ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011c1","role":"authenticated"}', true);
select throws_ok($$insert into public.cover_letters (id, doc) values ('app_t11v', '{"salesOfficer":"S"}')$$, '42501', 'new row violates row-level security policy for table "cover_letters"', 'no letter before the application is at the bank');
select lives_ok($$insert into public.cover_letters (id, doc) values ('app_t11b', '{"id":"app_t11b","salesOfficer":"Hilda"}')$$, 'the super admin writes a letter for an application at the bank');
select is((select count(*)::int from public.cover_letters), 1, 'the super admin reads the letter');
select lives_ok($$select public.apply_writes('[{"op":"update","table":"cover_letters","id":"app_t11b","values":{"doc":{"id":"app_t11b","salesOfficer":"Rudi"}}}]')$$, 'apply_writes updates a letter');

-- ---------- the applicant never sees it ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011a1","role":"authenticated"}', true);
select is((select count(*)::int from public.cover_letters), 0, 'the applicant reads no letter');
select lives_ok($$update public.cover_letters set doc = '{"salesOfficer":"A"}' where id = 'app_t11b'$$, 'an update by the applicant touches no row');
reset role;
select is((select doc ->> 'salesOfficer' from public.cover_letters where id = 'app_t11b'), 'Rudi', 'the letter is unchanged by the applicant');

-- ---------- a rejected application's letter is frozen; deleting the application deletes it ----------
update public.applications set doc = doc || '{"status":"rejected"}' where id = 'app_t11b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011c1","role":"authenticated"}', true);
select throws_ok($$update public.cover_letters set doc = '{"salesOfficer":"S"}' where id = 'app_t11b'$$, '42501', 'new row violates row-level security policy for table "cover_letters"', 'no edits once the application is rejected');
reset role;
delete from public.applications where id = 'app_t11b';
select is((select count(*)::int from public.cover_letters), 0, 'deleting the application deletes its letter');

select * from finish();
rollback;
```

- [ ] **Step 7: Run pgTAP (when a database is reachable)**

Run: `npx supabase test db --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@localhost:54329/postgres"` against a database that already has the new migration applied (local stack, or the VPS through the SSH tunnel in `supabase/README.md`).
Expected: `011_cover_letters.test.sql .. ok` (11/11) and the other files unchanged.
Applying the migration to the VPS changes the live database: ask the user before running `db push` there. If no database is reachable, record "pgTAP 011 not run" for the final report.

- [ ] **Step 8: Update the migration status in `supabase/README.md`**

On line 14, after the sentence listing migrations that **sudah jalan**, add:
```
Migration `20261016090000_cover_letters` (surat pengantar) **belum jalan** di VPS; test pgTAP-nya `011` (11 test).
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261016090000_cover_letters.sql supabase/tests/011_cover_letters.test.sql src/data/supabase/store.js src/data/supabase/store.test.js supabase/README.md
git commit -m "feat(supabase): admin-only cover_letters table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Letter page, print, entry button, audit labels

**Files:**
- Create: `public/remax-logo.png` (from the sample PDF)
- Create: `src/domains/admin/CoverLetterPage.jsx`
- Modify: `src/app/App.jsx` (import + route after `applications/:applicationId`)
- Modify: `src/domains/admin/ApplicationsPages.jsx:4,357` (icon import, header action)
- Modify: `src/domains/admin/AdminLayout.jsx` (`print:` classes on aside, mobile header, account bar, main)
- Modify: `src/styles/globals.css` (`@page`)
- Modify: `src/domains/admin/labels.js` (action + field labels)

**Interfaces:**
- Consumes: `api.admin.applications.coverLetter(id)`, `api.admin.applications.saveCoverLetter(id, { values })`, `APPLICANT_COLUMNS` (Task 2), `terbilang` (Task 1), `productName(app)` from `@/domains/applications/meta`.
- Produces: route `/admin/applications/:applicationId/surat-pengantar`; link "Surat pengantar" on the detail page; preview `article` named "Pratinjau surat pengantar"; checklist checkboxes named "{row label} — {column}"; buttons "Simpan" and "Cetak"; field labels used by Task 6 ("Sales Officer bank", …).

- [ ] **Step 1: Extract the RE/MAX logo from the sample PDF**

```bash
uvx --with pymupdf python - <<'EOF'
import fitz
src = r"c:\Users\jayac\Downloads\SURAT PENGANTAR APLIKASI KPR MayBank _Ruko Citramaja A25 no 527_Like Huang.pdf"
out = r"C:\Users\jayac\AppData\Local\Temp\claude\C--Users-jayac-Documents-ruang-kpr-node-js\b8ed5c9c-bf19-40fa-90a9-c1e29cf8d6dc\scratchpad"
doc = fitz.open(src)
page = doc[0]
for i, img in enumerate(page.get_images(full=True)):
    pix = fitz.Pixmap(doc, img[0])
    if pix.n - pix.alpha >= 4:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    pix.save(rf"{out}\logo-{i}.png")
    print(i, pix.width, pix.height, page.get_image_rects(img[0]))
# Fallback when the logo is vector art: render the top-left corner at 300 dpi.
page.get_pixmap(clip=fitz.Rect(30, 15, 135, 65), dpi=300).save(rf"{out}\logo-clip.png")
EOF
```
Open the PNGs with the Read tool, pick the RE/MAX one (the image placed top-left; the clip if it is vector), and copy it:
```bash
cp "<scratchpad>/logo-<n>.png" public/remax-logo.png
```
If neither is sharp, stop and ask the user for the logo file.

- [ ] **Step 2: Add the audit labels**

In `src/domains/admin/labels.js`:
- Add `import { APPLICANT_COLUMNS } from './coverLetter'` below the existing import.
- In `ACTION_LABEL`, after `'application.stage_note': 'Info untuk user',` add `'application.cover_letter': 'Surat pengantar',`.
- In `FIELD_LABEL`, after `schedule: 'Jadwal',` add (first run `grep -nE "^\s+(officeName|maName|maId|boName|feeAccount|customerName|propertyAddress|loanAmount|takeoverAmount|topupAmount|submittedDate|salesOfficer|applicantColumn|checked):" src/domains/admin/labels.js` — it must print nothing, so no key is duplicated):
```js
  officeName: 'Kantor RE/MAX',
  maName: 'Marketing Associate',
  maId: 'No. ID RE/MAX',
  boName: 'Business Owner',
  feeAccount: 'Rekening marketing fee',
  customerName: 'Nama nasabah',
  propertyAddress: 'Alamat properti',
  loanAmount: 'Besarnya KPR',
  takeoverAmount: 'Take over KPR lama',
  topupAmount: 'Top-up',
  submittedDate: 'Tanggal pengajuan',
  salesOfficer: 'Sales Officer',
  applicantColumn: 'Kolom pemohon',
  checked: 'Checklist dokumen',
```
- Append `'loanAmount', 'takeoverAmount', 'topupAmount'` to `MONEY`, `'submittedDate'` to `DATES`, and `applicantColumn: APPLICANT_COLUMNS,` to `CHOICES`.
- In `formatValue`, before `if (typeof v === 'boolean')`, add:
```js
  if (key === 'checked') return `${v.length} baris`
```

- [ ] **Step 3: Create the page**

`src/domains/admin/CoverLetterPage.jsx`:
```jsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PrinterIcon } from 'lucide-react'
import { api } from '@/data/api'
import { productName } from '@/domains/applications/meta'
import { useResource } from '@/lib/hooks'
import { dateLong, moneyInput, terbilang, toInt } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { DateField, MoneyField, RadioCards, TextAreaField, TextField } from '@/components/shared/fields'
import { ErrorPanel, PageSkeleton, Panel, PanelTitle, Spinner } from '@/components/shared/ui'
import { APPLICANT_COLUMNS } from './coverLetter'
import { AdminHeader } from './shared'

const MONEY_KEYS = ['loanAmount', 'takeoverAmount', 'topupAmount']
const asErrors = (e) => Object.fromEntries((e.fieldErrors ?? []).map((x) => [x.field, x.message]))
// The form keeps amounts as digit strings (MoneyField); the API and the sheet take whole Rupiah.
const toForm = (letter) => ({ ...letter, ...Object.fromEntries(MONEY_KEYS.filter((k) => k in letter).map((k) => [k, moneyInput(letter[k])])) })
const toValues = (form) => ({ ...form, ...Object.fromEntries(MONEY_KEYS.filter((k) => k in form).map((k) => [k, toInt(form[k])])) })
const LOAD_ERROR = { RESOURCE_NOT_FOUND: 'Pengajuan tidak ditemukan.', INVALID_STATE_TRANSITION: 'Surat pengantar tersedia setelah pengajuan diteruskan ke bank.' }

export function CoverLetterPage() {
  const { applicationId } = useParams()
  const back = `/admin/applications/${applicationId}`
  const { data, error, reload, setData } = useResource(() => api.admin.applications.coverLetter(applicationId), [applicationId])
  if (!data) {
    const known = LOAD_ERROR[error?.code]
    return (
      <>
        <AdminHeader title="Surat pengantar" back={back} />
        {error ? <ErrorPanel title={known} message={known ? null : undefined} onRetry={known ? undefined : reload} /> : <PageSkeleton />}
      </>
    )
  }
  return <CoverLetterEditor data={data} back={back} onSaved={setData} />
}

function CoverLetterEditor({ data, back, onSaved }) {
  const { application: app, variant, rows } = data
  const [form, setForm] = useState(() => toForm(data.letter))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const dirty = !data.saved || JSON.stringify(form) !== JSON.stringify(toForm(data.letter))
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const toggle = (key, on) => setForm((f) => ({ ...f, checked: on ? [...f.checked, key] : f.checked.filter((k) => k !== key) }))
  const save = async () => {
    setSaving(true)
    try {
      const d = await api.admin.applications.saveCoverLetter(app.id, { values: toValues(form) })
      onSaved(d)
      setForm(toForm(d.letter))
      setErrors({})
      return true
    } catch (e) {
      setErrors(asErrors(e))
      toast.error(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }
  const onSave = async () => {
    if (await save()) toast('Surat pengantar disimpan.')
  }
  // Printing saves first, so the paper always matches what is stored.
  const onPrint = async () => {
    if (!dirty || (await save())) window.print()
  }
  const text = (k, label, props = {}) => <TextField label={label} value={form[k]} onChange={set(k)} error={errors[k]} {...props} />
  const money = (k, label, props = {}) => <MoneyField label={label} value={form[k]} onChange={set(k)} error={errors[k]} {...props} />
  const loan = toInt(form.loanAmount)
  return (
    <>
      <div className="print:hidden">
        <AdminHeader
          title="Surat pengantar"
          subtitle={`${app.userName} · ${productName(app)}`}
          back={back}
          actions={
            <>
              <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={onSave}>
                {saving && <Spinner />}
                Simpan
              </Button>
              <Button size="sm" disabled={saving} onClick={onPrint}>
                <PrinterIcon aria-hidden />
                Cetak
              </Button>
            </>
          }
        />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] print:block">
        <Panel className="print:hidden">
          <PanelTitle sub="Terisi dari data pengajuan dan Konfigurasi. Centang dokumen langsung di surat.">Isian surat</PanelTitle>
          <Group legend="Marketing Associate">
            {text('maName', 'Nama Marketing Associate', { required: true })}
            {text('maId', 'No. ID RE/MAX', { required: true })}
            {text('officeName', 'Kantor RE/MAX', { required: true })}
          </Group>
          <Group legend="Nasabah & pengajuan">
            {text('customerName', 'Nama nasabah', { required: true })}
            <TextAreaField label="Alamat properti (jaminan)" required value={form.propertyAddress} onChange={set('propertyAddress')} error={errors.propertyAddress} />
            {text('bankName', 'Bank', { required: true })}
            {money('loanAmount', 'Besarnya KPR yang diajukan', { required: true, hint: loan > 0 ? terbilang(loan) : undefined })}
            {variant === 'topup' && (
              <>
                {money('takeoverAmount', 'Take over KPR lama', { required: true })}
                {money('topupAmount', 'Top-up', { required: true })}
              </>
            )}
            <DateField label="Tanggal pengajuan" required value={form.submittedDate} onChange={set('submittedDate')} error={errors.submittedDate} />
            {text('salesOfficer', 'Sales Officer bank', { optional: true, hint: 'Kosongkan untuk ditulis tangan.' })}
            <RadioCards label="Kolom pemohon di checklist" value={form.applicantColumn} onChange={set('applicantColumn')} options={APPLICANT_COLUMNS} error={errors.applicantColumn} />
          </Group>
          <Group legend="Business Owner & fee">
            {text('boName', 'Nama Business Owner', { required: true })}
            <TextAreaField label="Rekening marketing fee" required value={form.feeAccount} onChange={set('feeAccount')} error={errors.feeAccount} />
          </Group>
        </Panel>
        <div className="min-w-0 overflow-x-auto rounded-card bg-muted p-4 print:overflow-visible print:bg-transparent print:p-0">
          <CoverLetterSheet letter={toValues(form)} variant={variant} rows={rows} onToggle={toggle} />
        </div>
      </div>
    </>
  )
}

function Group({ legend, children }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-sm font-bold text-ink-2">{legend}</legend>
      {children}
    </fieldset>
  )
}

const PRODUCT_LINE = { primary: 'KPR', takeover: 'KPR Take Over', topup: 'KPR Take Over + Top-up' }
const rp = (n) => (Number.isInteger(n) ? `Rp. ${n.toLocaleString('id-ID')},00` : 'Rp.')
const cell = 'border border-black px-1 py-0.5 align-middle'
const head = `${cell} bg-neutral-300 text-center font-bold`

function Fact({ label, children }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>: {children}</dd>
    </>
  )
}

// On screen a checkbox (44px row); on paper a √ when ticked.
function CheckCell({ label, checked, onToggle }) {
  return (
    <td className={`${cell} p-0 text-center`}>
      <label className="flex min-h-11 cursor-pointer items-center justify-center print:min-h-0">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} aria-label={label} className="size-5 accent-black print:hidden" />
        {checked && <span className="hidden print:inline">√</span>}
      </label>
    </td>
  )
}

// The bank form as it prints on A4 (spec 2026-10-16 §2). A print document: it keeps the form's black-on-white look
// instead of the app's visual language.
function CoverLetterSheet({ letter: l, variant, rows, onToggle }) {
  const ticked = (key) => l.checked.includes(key)
  const houseRow = (r, i) => (
    <tr key={r.key}>
      <td className={`${cell} text-center`}>{i + 1}</td>
      <td className={cell}>{r.label}</td>
      <CheckCell label={`${r.label} — Rumah Bekas`} checked={ticked(r.key)} onToggle={(on) => onToggle(r.key, on)} />
    </tr>
  )
  return (
    <article
      aria-label="Pratinjau surat pengantar"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      className="mx-auto flex min-h-[297mm] w-[210mm] flex-col gap-[3mm] bg-white p-[12mm] text-[10pt] leading-snug text-black shadow-card [print-color-adjust:exact] print:min-h-0 print:w-full print:p-0 print:shadow-none"
    >
      <header className="flex items-center justify-between gap-4 border-b-2 border-black pb-[3mm]">
        <img src="/remax-logo.png" alt="RE/MAX" className="h-[15mm] w-auto" />
        <h2 className="text-center text-[14pt] font-extrabold">SURAT PENGANTAR APLIKASI KPR</h2>
        <span className="max-w-[45mm] text-right text-[13pt] font-extrabold">{l.bankName}</span>
      </header>
      <p className="font-bold">Bersama surat ini kami :</p>
      <dl className="grid grid-cols-[55mm_1fr]">
        <Fact label="Nama Marketing Associate">{l.maName}</Fact>
        <Fact label="No. ID RE/MAX">{l.maId}</Fact>
        <Fact label="Dari kantor RE/MAX">{l.officeName}</Fact>
      </dl>
      <p className="font-bold">
        Mengajukan aplikasi {PRODUCT_LINE[variant]} – {l.bankName} untuk :
      </p>
      <dl className="grid grid-cols-[55mm_1fr]">
        <Fact label="Nama Nasabah">{l.customerName}</Fact>
        <Fact label="Alamat Properti (Jaminan)">{l.propertyAddress}</Fact>
        <Fact label="Besarnya KPR yang diajukan">
          {rp(l.loanAmount)}
          {l.loanAmount > 0 && <span className="block pl-[2mm]">({terbilang(l.loanAmount)})</span>}
        </Fact>
        {variant === 'topup' && (
          <>
            <Fact label="– Take over KPR lama">{rp(l.takeoverAmount)}</Fact>
            <Fact label="– Top-up">{rp(l.topupAmount)}</Fact>
          </>
        )}
        <Fact label="Tanggal Pengajuan">{l.submittedDate ? dateLong(l.submittedDate) : ''}</Fact>
      </dl>
      <p>
        Pengajuan ke Sales Officer {l.bankName} : {l.salesOfficer || '______________________'}
      </p>
      <p>
        <b>Kami sertakan kelengkapan dokumen sebagai berikut</b> : (<i>beri tanda √ pada data yang disertakan</i>)
      </p>
      <div style={{ fontFamily: '"Times New Roman", Times, serif' }} className="grid grid-cols-[63%_37%] items-start text-[8.5pt] leading-tight">
        <table className="w-full border-collapse">
          <caption className="sr-only">Dokumen aplikan</caption>
          <thead>
            <tr>
              <th className={head}>No.</th>
              <th className={head}>Dokumen Aplikan</th>
              {APPLICANT_COLUMNS.map((c) => (
                <th key={c.value} className={head}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.applicant.map((r, i) => (
              <tr key={r.key}>
                <td className={`${cell} text-center`}>{i + 1}</td>
                <td className={cell}>{r.label}</td>
                {APPLICANT_COLUMNS.map((c) =>
                  c.value === l.applicantColumn ? (
                    <CheckCell key={c.value} label={`${r.label} — ${c.label}`} checked={ticked(r.key)} onToggle={(on) => onToggle(r.key, on)} />
                  ) : (
                    <td key={c.value} className={cell} />
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full border-collapse">
          <caption className="sr-only">Dokumen rumah</caption>
          <thead>
            <tr>
              <th className={head}>No.</th>
              <th className={head}>Dokumen Rumah</th>
              <th className={head}>Rumah Bekas</th>
            </tr>
          </thead>
          <tbody>
            {rows.house.map(houseRow)}
            <tr>
              <th colSpan={3} scope="colgroup" className={head}>
                {rows.second.title}
              </th>
            </tr>
            {rows.second.rows.map(houseRow)}
          </tbody>
        </table>
      </div>
      <p className="text-[8.5pt] font-bold italic">**) untuk pengusaha dengan badan hukum PT</p>
      <div className="border border-black px-[2mm] py-[1mm]">
        <p>Mohon Marketing Fee dikirimkan ke :</p>
        <p className="whitespace-pre-line">{l.feeAccount}</p>
      </div>
      <div className="grid grid-cols-2 text-center">
        <p className="flex flex-col">
          <span className="invisible">Mengetahui,</span>
          <b>Marketing Associate RE/MAX</b>
          <span className="mt-[22mm]">
            ({l.maName} {l.officeName})
          </span>
        </p>
        <p className="flex flex-col">
          <span>Mengetahui,</span>
          <b>Business Owner RE/MAX</b>
          <span className="mt-[22mm]">({l.boName})</span>
        </p>
      </div>
      <p className="text-[8.5pt] font-bold">***surat keterangan ini harus disertai dengan stempel kantor RE/MAX &amp; Tuliskan Nama Jelas BO &amp; MA</p>
      <ul className="border border-black px-[2mm] py-[1mm] text-[8pt]">
        <li className="font-bold">☐ Serahkan 1 lembar asli dan kelengkapannya ke kantor cabang bersangkutan atau kepada PIC {l.bankName} yang telah ditunjuk</li>
        <li>☐ Simpan 1 lembar Copy sebagai bukti</li>
        <li>☐ Sebagai bukti ke RE/MAX Indonesia, mohon e-mail ke support@remax.co.id atau fax ke RE/MAX Indonesia, Attn : Business Operation Dept – Fax (021) 5151 392, dengan melampirkan fotocopy KTP</li>
      </ul>
    </article>
  )
}
```

- [ ] **Step 4: Route, entry button, print chrome**

`src/app/App.jsx`: add `import { CoverLetterPage } from '@/domains/admin/CoverLetterPage'` after the `ApplicationsPages` import, and after `{ path: 'applications/:applicationId', element: <ApplicationDetailPage /> },` add:
```jsx
          { path: 'applications/:applicationId/surat-pengantar', element: <CoverLetterPage /> },
```

`src/domains/admin/ApplicationsPages.jsx`:
- Change the lucide import to `import { CircleCheckIcon, CircleDashedIcon, ClockIcon, PrinterIcon, TriangleAlertIcon } from 'lucide-react'`.
- Add `import { PRINTABLE_STATUSES } from './coverLetter'` before `import { PRODUCT_TYPES } from './labels'`.
- In `ApplicationDetailPage`, replace `actions={<StatusChip status={app.status} />}` with:
```jsx
        actions={
          <>
            {PRINTABLE_STATUSES.includes(app.status) && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/admin/applications/${app.id}/surat-pengantar`}>
                  <PrinterIcon aria-hidden />
                  Surat pengantar
                </Link>
              </Button>
            )}
            <StatusChip status={app.status} />
          </>
        }
```

`src/domains/admin/AdminLayout.jsx`:
- `<aside className="sticky top-0 hidden …lg:flex">` → append ` print:hidden` to its className.
- `<header className="sticky top-0 z-30 … lg:hidden">` → append ` print:hidden`.
- `<div className="hidden items-center justify-end gap-4 lg:flex">` (account bar) → append ` print:hidden`.
- `<main id="main" … className="flex-1 px-4 pt-5 pb-16 outline-none sm:px-6 lg:px-10 lg:pt-6">` → append ` print:p-0!`.

`src/styles/globals.css`: append
```css

/* Printed pages (admin cover letter): A4 with the form's own margins. */
@page {
  size: A4;
  margin: 10mm;
}
```

- [ ] **Step 5: Lint and build**

Run: `npm run lint` then `npm run build`
Expected: both succeed with no new warnings.

- [ ] **Step 6: Look at it in the browser**

Run the app with mock data (`VITE_DATA_SOURCE=mock npm run dev`), sign in as `admin@ruangkpr.id` / `ruangkpr123` in the `admin_ops` scenario, open Firdi Audi → "Surat pengantar". Check: the sheet matches the sample layout, the checklist ticks under Pegawai, editing a field updates the sheet, and the browser print preview (Ctrl+P) shows only the letter on one A4 page. Check `app_sample_05` (Take Over) shows "Dokumen KPR Lama".

- [ ] **Step 7: Commit**

```bash
git add public/remax-logo.png src/domains/admin/CoverLetterPage.jsx src/app/App.jsx src/domains/admin/ApplicationsPages.jsx src/domains/admin/AdminLayout.jsx src/styles/globals.css src/domains/admin/labels.js
git commit -m "feat(admin): print the KPR cover letter from an application at the bank

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Office defaults in Configuration

**Files:**
- Modify: `src/domains/admin/ConfigurationPage.jsx` (field import line 11; new panel before `ConfigurationPage`; placement in the right column)

**Interfaces:**
- Consumes: `data.config.coverLetter` and `api.admin.config.update('coverLetter', …)` (Task 2).
- Produces: panel "Surat pengantar" with fields "Kantor RE/MAX", "Nama MA default", "No. ID RE/MAX MA default", "Nama Business Owner", "Rekening marketing fee"; button "Simpan default surat"; toast "Default surat pengantar tersimpan." (used by Task 6).

- [ ] **Step 1: Add the panel**

Change the fields import to:
```js
import { CheckboxField, FieldError, NumberField, TextAreaField, TextField } from '@/components/shared/fields'
```
Before `// Settings that apply to every user (admin plan §4.7).`, add:
```jsx
const OFFICE_LABELS = [
  ['officeName', 'Kantor RE/MAX'],
  ['maName', 'Nama MA default'],
  ['maId', 'No. ID RE/MAX MA default'],
  ['boName', 'Nama Business Owner'],
  ['feeAccount', 'Rekening marketing fee'],
]

function CoverLetterPanel({ data, onSaved }) {
  const [saved, setSaved] = useState(data.config.coverLetter)
  const [value, setValue] = useState(saved)
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(saved)
  const save = async (reason) => {
    try {
      const d = await api.admin.config.update('coverLetter', { values: value, reason, expectedVersion: data.config.version })
      onSaved(d)
      setSaved(d.config.coverLetter)
      setValue(d.config.coverLetter)
      setErrors({})
      toast('Default surat pengantar tersimpan.')
    } catch (e) {
      setErrors(asErrors(e))
      throw e
    }
  }
  return (
    <Panel>
      <PanelTitle sub="Isian awal surat pengantar baru. Surat yang sudah disimpan tidak ikut berubah.">Surat pengantar</PanelTitle>
      {OFFICE_LABELS.map(([k, label]) => (
        <TextField key={k} label={label} value={value[k]} onChange={(v) => setValue((x) => ({ ...x, [k]: v }))} error={errors[k]} maxLength={160} />
      ))}
      <Button className="w-fit" disabled={!dirty} onClick={() => setConfirming(true)}>
        Simpan default surat
      </Button>
      <ReasonDialog open={confirming} onOpenChange={setConfirming} title="Simpan default surat pengantar?" body="Dipakai untuk surat yang dibuat setelah ini." confirmLabel="Ya, simpan" onConfirm={save} />
    </Panel>
  )
}
```
In `ConfigurationPage`, inside the right column `<div className="flex min-w-0 flex-col gap-6">`, add `<CoverLetterPanel data={data} onSaved={setData} />` right after `<UploadPanel data={data} onSaved={setData} />`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/domains/admin/ConfigurationPage.jsx
git commit -m "feat(admin): cover letter office defaults in Configuration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end journey and final checks

**Files:**
- Create: `tests/e2e/admin-cover-letter.spec.js`

**Interfaces:**
- Consumes: labels and names produced by Tasks 4 and 5; `useScenario` from `tests/e2e/helpers.js`.

- [ ] **Step 1: Write the e2e test**

`tests/e2e/admin-cover-letter.spec.js`:
```js
import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

test('admin sets office defaults, then prints a prefilled cover letter for an application at the bank', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/configuration')
  await page.getByLabel('Kantor RE/MAX').fill('RE/MAX Eagle Citraland')
  await page.getByLabel('Nama MA default').fill('Like')
  await page.getByLabel('No. ID RE/MAX MA default').fill('R230021')
  await page.getByLabel('Nama Business Owner').fill('Budiono Yuwono')
  await page.getByLabel('Rekening marketing fee').fill('Rek. Bank BCA 511.010.6060 a/n PT. BUANA JAYA MAPAN')
  await page.getByRole('button', { name: 'Simpan default surat' }).click()
  await page.getByRole('alertdialog').getByLabel('Alasan').fill('Data kantor RE/MAX')
  await page.getByRole('button', { name: 'Ya, simpan' }).click()
  await expect(page.getByText('Default surat pengantar tersimpan.')).toBeVisible()

  await page.goto('/admin/applications')
  await page.getByRole('link', { name: 'Firdi Audi' }).click()
  await page.getByRole('link', { name: 'Surat pengantar' }).click()
  const sheet = page.getByRole('article', { name: 'Pratinjau surat pengantar' })
  await expect(sheet).toContainText('Mengajukan aplikasi KPR – Bank ABC untuk :')
  await expect(sheet).toContainText('Rp. 400.000.000,00')
  await expect(sheet).toContainText('(Empat Ratus Juta Rupiah)')
  await expect(sheet).toContainText('RE/MAX Eagle Citraland')
  await expect(page.getByRole('checkbox', { name: 'Copy NPWP / SPT PPh 21 Pribadi — Pegawai' })).toBeChecked()

  await page.getByLabel('Sales Officer bank').fill('Hilda')
  await expect(sheet).toContainText('Pengajuan ke Sales Officer Bank ABC : Hilda')
  await page.evaluate(() => {
    window.printed = 0
    window.print = () => {
      window.printed += 1
    }
  })
  await page.getByRole('button', { name: 'Cetak' }).click()
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1)

  await page.reload()
  await expect(page.getByLabel('Sales Officer bank')).toHaveValue('Hilda')
  await expect(page.getByRole('button', { name: 'Simpan' })).toBeDisabled()
})

test('an application not yet at the bank has no cover letter', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin/applications')
  await page.getByRole('link', { name: 'Rina Hartati' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Rina Hartati' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Surat pengantar' })).toHaveCount(0)
  await page.goto('/admin/applications/app_sample_01/surat-pengantar')
  await expect(page.getByText('Surat pengantar tersedia setelah pengajuan diteruskan ke bank.')).toBeVisible()
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/admin-cover-letter.spec.js`
Expected: 2 passed. Then run the neighbouring admin journeys to catch regressions: `npx playwright test tests/e2e/admin-applications.spec.js tests/e2e/admin-configuration.spec.js tests/e2e/admin-audit.spec.js` — all pass.

- [ ] **Step 3: Full checks (Definition of Done)**

Run, in order:
- `npm run lint` → clean
- `npx vitest run` → all pass
- `npm run build` → succeeds
Record the pgTAP status from Task 3 Step 7 (run, or not run and why).

- [ ] **Step 4: Review the diff**

Run: `git diff main --stat` and read the diff of this branch's changes; remove leftovers (scratch files, unused imports, debug output).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/admin-cover-letter.spec.js
git commit -m "test(e2e): admin prints the KPR cover letter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
