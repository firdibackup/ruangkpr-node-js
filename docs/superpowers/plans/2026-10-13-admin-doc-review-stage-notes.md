# Verifikasi Dokumen per File & Info Tahap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin memeriksa setiap dokumen (Sesuai/Tolak + alasan) dan mengirim penolakan sekaligus; admin menulis info per tahap (Appraisal: jadwal hasil WhatsApp) yang bisa diedit; user melihat keduanya di Home dan tracker.

**Architecture:** Semua logika di `mockApi.js` (berjalan di atas `localStore` untuk test dan `supabaseStore` untuk data asli). Data baru tinggal di JSON pengajuan: `documents[t].review` (draf penolakan) dan `stageNotes[status]`. Dua aturan baru di trigger `private.applications_write()`: syarat Proses Bank dan batas upload ulang user. UI memakai komponen bersama yang ada.

**Tech Stack:** React 19 + Vite, Vitest, Playwright (mode mock), Postgres 17 (plpgsql trigger) + pgTAP lewat `/pg/query` di VPS.

**Spec:** `docs/superpowers/specs/2026-10-13-admin-doc-review-stage-notes-design.md`

## Global Constraints
- **Jangan commit per task.** Hampir semua file target (`mockApi.js`, `mockApi.test.js`, `seed.js`, `live.test.js`, `ApplicationsPages.jsx`, `HomePage.jsx`, `labels.js`, `shared.jsx`, `primary-flow.spec.js`) sudah membawa perubahan sesi lain yang belum di-commit (±2.800 baris). Langkah "Checkpoint" = jalankan test + `git diff --stat` saja. Cara commit diputuskan user di akhir.
- Sesi lain bisa mengedit repo bersamaan: pakai edit exact-match; jangan pernah memulihkan file utuh dari salinan.
- UI tidak pernah melewati `src/data/api.js`; konstanta boleh diimpor dari `src/data/documentRules.js` dan `src/domains/applications/meta.js` (sudah ada presedennya).
- Tanpa dependency baru. Pakai `Panel`, `PanelTitle`, `Chip`, `Notice`, `SummaryRows`, `FormDialog`, `Spinner`, field bersama (`TextField`, `DateField`, `SelectField`, `TextAreaField`). Tombol aksi baris pakai `size="sm"` (h-11 = 44px).
- Teks UI bahasa Indonesia, persis seperti spec: alasan penolakan `Buram / tidak terbaca`, `Terpotong / tidak lengkap`, `Kedaluwarsa`, `Tidak sesuai data pengajuan`, `Bukan dokumen yang diminta`, `Lainnya`.
- Status yang boleh diberi info tahap: `docs_verification`, `bank_processing`, `appraisal`, `approved`, `old_mortgage_settlement`, `akad`.
- VPS: dry-run migration + pgTAP lewat `/pg/query` boleh (selalu rollback). **Menerapkan migration ke VPS wajib izin eksplisit user** (Task 7).
- Definition of Done (CLAUDE.md): `npm run lint`, Vitest relevan, `npm run build`, Playwright relevan, review diff, laporkan check yang tidak bisa dijalankan.

## Review Focus
1. **Dua klik "Sesuai" cepat di baris berbeda** → yang kedua memakai `version` lama. Harapan: semua tombol baris nonaktif selama simpan; bila tetap bentrok, `CONFLICT_VERSION` → toast + muat ulang. Test: Task 1 `stale review conflicts`.
2. **Dokumen opsional ditolak (draf) sementara semua dokumen wajib sudah Sesuai** → "Teruskan ke bank" tetap ditolak sampai draf dikirim atau dibatalkan. Test: Task 1 `an unsent rejection on an optional document`.
3. **Upload ulang user yang sah lewat Supabase setelah trigger diganti** (objek dokumen berisi `path`, `contentType`, `invalidReason: null`, riwayat + `docs_verification`) → tetap diterima. Test: Task 3 pgTAP `the user re-uploads the asked document…` + Task 7 live test.
4. **Admin memindah tahap saat panel info masih berisi ketikan** → panel tahap baru mulai kosong, teks lama tidak tersimpan ke tahap baru (`key={app.status}`). Test: Task 6 e2e memeriksa hint "Belum diisi…" setelah masuk Appraisal.
5. **Jadwal appraisal diedit setelah user dinotifikasi** → user melihat jadwal terbaru; Activity lama tidak menyimpan isi pesan. Test: Task 2 `the team keeps one editable note per stage`.

---

## File map
| File | Perubahan |
|---|---|
| `src/data/documentRules.js` | `DOC_REJECT_REASONS`, `rejectMessage()` |
| `src/domains/applications/meta.js` | `STAGE_NOTE_STATUSES` |
| `src/data/mockApi.js` | `applyReview()`, transisi `additional_docs_requested` dari draf, syarat Proses Bank, `reviewDocument`, `stageNoteOf()`, `saveStageNote`, `stageNotes` di detail admin, dev controls, teks "tim RuangKPR" |
| `src/data/seed.js` | judul Activity seed "Dokumen perlu diunggah ulang" |
| `src/data/mockApi.test.js` | test baru di `describe('admin applications')` |
| `supabase/migrations/20261013120000_document_review.sql` | `private.reupload_ok()`, `private.applications_write()` baru |
| `supabase/tests/008_document_review.test.sql` | pgTAP aturan 1 & 2 |
| `src/domains/admin/ApplicationsPages.jsx` | `DocumentsPanel`, `RejectDialog`, `StageNotePanel`, `NextStep`, `TransitionDialog` |
| `src/domains/admin/labels.js`, `src/domains/admin/shared.jsx` | label & ringkasan audit baru |
| `src/domains/applications/ApplicationTracker.jsx` | `StageNoteCard`, `PendingDocs` (diekspor), kartu permintaan |
| `src/domains/home/HomePage.jsx` | kartu Perlu Tindakan + `StageNoteCard` |
| `tests/e2e/admin-applications.spec.js`, `tests/e2e/primary-flow.spec.js` | journey baru, teks baru |
| `src/data/supabase/live.test.js` | review + info tahap di data asli |
| `supabase/README.md` | daftar migration & hasil pgTAP |

---

### Task 1: Review dokumen per file di `mockApi`

**Files:**
- Modify: `src/data/documentRules.js` (setelah `DOC_LABELS`)
- Modify: `src/data/mockApi.js` (import baris 17; `transitionApplication` ±baris 496–525; `recordDocument` ±baris 1004; `admin.applications` ±baris 1977; `mockControls` ±baris 2085–2114)
- Modify: `src/data/seed.js:589`
- Test: `src/data/mockApi.test.js` (`describe('admin applications')`, ganti test `a revision request flags the documents…`)

**Interfaces:**
- Produces: `DOC_REJECT_REASONS: Array<{ value, label }>`, `rejectMessage({ reasonCode, note }) → string` (dari `documentRules.js`).
- Produces: `api.admin.applications.reviewDocument(id, { documentType, result: 'ok'|'rejected', reasonCode?, note?, expectedVersion }) → Promise<AdminApplicationDetail>`; `file.review = { reasonCode, note, at }` pada dokumen ber-draf.
- Changes: `api.admin.applications.transition(id, { toStatus: 'additional_docs_requested', reason, expectedVersion })` — `metadata` tidak dipakai lagi.

- [ ] **Step 1: Tulis test yang gagal**

Di `src/data/mockApi.test.js`, di dalam `describe('admin applications', …)` tepat di bawah `const move = …`, tambahkan helper:

```js
  const review = (id, documentType, expectedVersion, verdict = { result: 'ok' }) => api.admin.applications.reviewDocument(id, { documentType, expectedVersion, ...verdict })
  const fileOf = (d, type) => d.application.documents.find((x) => x.type === type).file
```

Ganti seluruh test `it('a revision request flags the documents and reaches the user; re-uploading returns it to verification', …)` dengan empat test ini:

```js
  it('documents are reviewed one by one while verifying; a rejection stays a draft the user cannot see', async () => {
    mockControls.reset('admin_ops')
    await expectCode(review('app_sample_01', 'ktp', 3), 'INVALID_STATE_TRANSITION') // still submitted
    let d = await move('app_sample_01', 'docs_verification', 3)
    d = await review('app_sample_01', 'ktp', d.application.version)
    expect(fileOf(d, 'ktp').status).toBe('verified')
    await expectCode(review('app_sample_01', 'npwp', d.application.version, { result: 'rejected', reasonCode: 'other', note: ' ' }), 'VALIDATION_FAILED')
    await expectCode(review('app_sample_01', 'npwp', d.application.version, { result: 'rejected', reasonCode: 'tidak_ada' }), 'VALIDATION_FAILED')
    await expectCode(review('app_sample_01', 'additional', d.application.version), 'INVALID_STATE_TRANSITION') // no file
    d = await review('app_sample_01', 'npwp', d.application.version, { result: 'rejected', reasonCode: 'blurry', note: ' angka NPWP tidak terbaca ' })
    expect(fileOf(d, 'npwp')).toMatchObject({ status: 'uploaded', review: { reasonCode: 'blurry', note: 'angka NPWP tidak terbaca' } })
    d = await review('app_sample_01', 'ktp', d.application.version, { result: 'rejected', reasonCode: 'expired' })
    expect(fileOf(d, 'ktp')).toMatchObject({ status: 'uploaded', review: { reasonCode: 'expired', note: '' } })
    d = await review('app_sample_01', 'ktp', d.application.version)
    expect(fileOf(d, 'ktp').status).toBe('verified')
    expect(fileOf(d, 'ktp').review).toBeUndefined()
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'application.document_review', after: { document: 'KTP', result: 'Sesuai' } })
    await signIn('Rina Hartati', 'rina.hartati@example.com')
    expect((await api.dashboard.getSnapshot()).applications[0].pendingActions).toEqual([])
    expect((await api.activities.list()).some((a) => a.type === 'additional_document_requested')).toBe(false)
  })

  it('stale review conflicts', async () => {
    mockControls.reset('admin_ops')
    const d = await move('app_sample_01', 'docs_verification', 3)
    await review('app_sample_01', 'ktp', d.application.version)
    await expectCode(review('app_sample_01', 'npwp', d.application.version), 'CONFLICT_VERSION')
  })

  it('sending turns every drafted rejection into one request the user sees per document; the bank waits for all verified', async () => {
    mockControls.reset('admin_ops')
    let d = await move('app_sample_01', 'docs_verification', 3)
    await expectCode(move('app_sample_01', 'additional_docs_requested', d.application.version), 'VALIDATION_FAILED') // nothing rejected yet
    for (const t of ['ktp', 'property_document']) d = await review('app_sample_01', t, d.application.version)
    await expectCode(move('app_sample_01', 'bank_processing', d.application.version), 'INVALID_STATE_TRANSITION')
    d = await review('app_sample_01', 'npwp', d.application.version, { result: 'rejected', reasonCode: 'blurry', note: 'angka NPWP tidak terbaca' })
    d = await review('app_sample_01', 'income_proof', d.application.version, { result: 'rejected', reasonCode: 'expired' })
    d = await move('app_sample_01', 'additional_docs_requested', d.application.version)
    expect(fileOf(d, 'npwp')).toMatchObject({ status: 'needs_update', invalidReason: 'Buram / tidak terbaca: angka NPWP tidak terbaca' })
    expect(fileOf(d, 'npwp').review).toBeUndefined()
    expect(d.application.pendingActions.map((p) => [p.documentType, p.message])).toEqual([
      ['npwp', 'Buram / tidak terbaca: angka NPWP tidak terbaca'],
      ['income_proof', 'Kedaluwarsa'],
    ])

    await signIn('Rina Hartati', 'rina.hartati@example.com')
    expect((await api.activities.list()).filter((a) => a.type === 'additional_document_requested')).toEqual([
      expect.objectContaining({ title: 'Dokumen perlu diunggah ulang', body: 'NPWP, Slip Gaji / Bukti Penghasilan perlu diperbarui.' }),
    ])
    const [app] = (await api.dashboard.getSnapshot()).applications
    expect((await api.applications.uploadDocument(app.id, { documentType: 'npwp', file: file('npwp-baru.pdf', 200_000, 'application/pdf') })).status).toBe('additional_docs_requested')
    const back = await api.applications.uploadDocument(app.id, { documentType: 'income_proof', file: file('slip-baru.pdf', 200_000, 'application/pdf') })
    expect(back.status).toBe('docs_verification')
    expect(back.documents.npwp).toMatchObject({ status: 'uploaded', invalidReason: null })
    expect((await api.activities.list())[0]).toMatchObject({ type: 'document_replaced', body: 'Menunggu verifikasi dari tim RuangKPR.' })

    await signIn('Admin RuangKPR', 'admin@ruangkpr.id')
    d = await api.admin.applications.get('app_sample_01')
    for (const t of ['npwp', 'income_proof']) d = await review('app_sample_01', t, d.application.version)
    d = await move('app_sample_01', 'bank_processing', d.application.version)
    expect(d.application.status).toBe('bank_processing')
  })

  it('an unsent rejection on an optional document also holds the application back from the bank', async () => {
    mockControls.reset('admin_ops')
    const db = loadDb()
    db.accounts.flatMap((a) => a.applications).find((x) => x.id === 'app_sample_01').documents.additional = { status: 'uploaded', fileName: 'kk.pdf', sizeBytes: 1000, contentType: 'application/pdf', uploadedAt: '2026-09-18', invalidReason: null }
    saveDb(db)
    let d = await move('app_sample_01', 'docs_verification', 3)
    for (const t of ['ktp', 'npwp', 'income_proof', 'property_document']) d = await review('app_sample_01', t, d.application.version)
    d = await review('app_sample_01', 'additional', d.application.version, { result: 'rejected', reasonCode: 'cropped' })
    await expectCode(move('app_sample_01', 'bank_processing', d.application.version), 'INVALID_STATE_TRANSITION')
    d = await review('app_sample_01', 'additional', d.application.version)
    expect((await move('app_sample_01', 'bank_processing', d.application.version)).application.status).toBe('bank_processing')
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/data/mockApi.test.js -t "admin applications"`
Expected: FAIL — `api.admin.applications.reviewDocument is not a function`.

- [ ] **Step 3: Tambah konstanta alasan di `src/data/documentRules.js`**

Tepat di bawah blok `export const DOC_LABELS = { … }`:

```js
// Why the team turns a document back (admin document review). `other` needs a note.
export const DOC_REJECT_REASONS = [
  { value: 'blurry', label: 'Buram / tidak terbaca' },
  { value: 'cropped', label: 'Terpotong / tidak lengkap' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'mismatch', label: 'Tidak sesuai data pengajuan' },
  { value: 'wrong_document', label: 'Bukan dokumen yang diminta' },
  { value: 'other', label: 'Lainnya' },
]
// What the user reads for one turned-back document: "Buram / tidak terbaca: angka NPWP tidak terbaca".
export function rejectMessage({ reasonCode, note }) {
  const label = DOC_REJECT_REASONS.find((r) => r.value === reasonCode)?.label ?? reasonCode
  return note ? `${label}: ${note}` : label
}
```

- [ ] **Step 4: Implementasi di `src/data/mockApi.js`**

4a. Import baris 17 menjadi:

```js
import { DEFAULT_UPLOAD, DOC_LABELS, DOC_REJECT_REASONS, UPLOAD_FORMATS, rejectMessage, requiredDocuments, uploadProblem } from './documentRules'
```

4b. Tepat di atas komentar `// One status move with every side effect the user sees…` (sebelum `function transitionApplication`), tambahkan:

```js
// Admin document review (spec 2026-10-13 §1.1): "ok" verifies at once; a rejection waits on the document as a draft
// the user does not see until the team sends the revision request (transition to additional_docs_requested).
function applyReview(app, { documentType, result, reasonCode, note }, at) {
  if (app.status !== 'docs_verification') fail('INVALID_STATE_TRANSITION', 'Dokumen hanya bisa diperiksa saat verifikasi dokumen.', 409)
  const current = app.documents[documentType]
  if (!current || !['uploaded', 'verified'].includes(current.status)) fail('INVALID_STATE_TRANSITION', 'Dokumen ini belum diunggah.', 409)
  const { review: _draft, ...doc } = current
  if (result === 'ok') {
    app.documents[documentType] = { ...doc, status: 'verified' }
    return
  }
  if (result !== 'rejected') fail('VALIDATION_FAILED', 'Pilih Sesuai atau Tolak.', 400)
  const text = String(note ?? '').trim()
  failOnFields(
    {
      ...(!DOC_REJECT_REASONS.some((r) => r.value === reasonCode) && { reasonCode: 'Pilih alasan penolakan.' }),
      ...(reasonCode === 'other' && !text && { note: 'Tulis catatan untuk alasan Lainnya.' }),
      ...(text.length > 300 && { note: 'Catatan maksimal 300 karakter.' }),
    },
    'Lengkapi alasan penolakan.',
  )
  app.documents[documentType] = { ...doc, status: 'uploaded', review: { reasonCode, note: text, at } }
}
```

4c. Di `transitionApplication`, ganti baris

```js
  if (toStatus === 'bank_processing' && app.pendingActions.length) fail('INVALID_STATE_TRANSITION', 'Masih ada dokumen yang menunggu diunggah ulang user.', 409)
```

dengan

```js
  if (toStatus === 'bank_processing') {
    if (app.pendingActions.length) fail('INVALID_STATE_TRANSITION', 'Masih ada dokumen yang menunggu diunggah ulang user.', 409)
    if (requiredDocuments(app).some((d) => d.required && app.documents[d.type]?.status !== 'verified')) fail('INVALID_STATE_TRANSITION', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.', 409)
    if (Object.values(app.documents).some((d) => d.review)) fail('INVALID_STATE_TRANSITION', 'Masih ada dokumen ditolak yang belum dikirim ke user.', 409)
  }
```

4d. Di `transitionApplication`, ganti seluruh cabang `if (toStatus === 'additional_docs_requested') { … }` (sampai sebelum `} else if (toStatus === 'rejected')`) dengan:

```js
  if (toStatus === 'additional_docs_requested') {
    const rejected = Object.entries(app.documents).filter(([, d]) => d.review)
    if (!rejected.length) fail('VALIDATION_FAILED', 'Tolak minimal satu dokumen dulu.', 400)
    for (const [t, { review, ...doc }] of rejected) {
      const message = rejectMessage(review)
      app.documents[t] = { ...doc, status: 'needs_update', invalidReason: message }
      app.pendingActions.push({ id: nextId(db, 'pa'), type: 'document_update', documentType: t, message, requestedAt: at })
    }
    pushActivity(db, { type: 'additional_document_requested', category: 'application', title: 'Dokumen perlu diunggah ulang', body: `${rejected.map(([t]) => DOC_LABELS[t]).join(', ')} perlu diperbarui.`, action: { label: 'Upload sekarang', route: '/my-kpr/application' } }, owner)
```

4e. Di `recordDocument`, ubah body Activity `'Menunggu verifikasi dari bank.'` menjadi `'Menunggu verifikasi dari tim RuangKPR.'`.

4f. Di `admin.applications`, tepat setelah blok `transition: call(…),` tambahkan:

```js
        reviewDocument: call(
          'admin.applications.reviewDocument',
          (db, id, { documentType, result, reasonCode, note, expectedVersion }) => {
            const { owner, app } = findUserApp(db, id)
            checkVersion(app, expectedVersion)
            applyReview(app, { documentType, result, reasonCode, note }, nowIso(db))
            const draft = app.documents[documentType].review
            audit(db, { action: 'application.document_review', resource: { type: 'application', id, label: owner.user.name }, after: { document: DOC_LABELS[documentType], result: draft ? rejectMessage(draft) : 'Sesuai' } })
            touch(db, app)
            return applicationDetail(db, owner, app)
          },
          { admin: true },
        ),
```

4g. `mockControls.advanceApplication`: ganti blok

```js
    if (app.status === 'additional_docs_requested') {
      // The bank takes the documents as they are.
      app.status = 'docs_verification'
      app.pendingActions = []
    }
```

dengan

```js
    if (app.status === 'additional_docs_requested') {
      app.status = 'docs_verification'
      app.pendingActions = []
    }
    // The team takes the documents as they are.
    if (app.status === 'docs_verification') {
      for (const [t, { review: _draft, ...doc }] of Object.entries(app.documents)) app.documents[t] = { ...doc, status: 'verified', invalidReason: null }
    }
```

4h. `mockControls.requestDocument`: ganti baris `transitionApplication(db, db, app, { toStatus: 'additional_docs_requested', metadata: { documentTypes: [type], message: … } })` dengan

```js
    app.documents[type] = { ...app.documents[type], status: 'uploaded', review: { reasonCode: 'expired', note: 'Unggah versi terbaru.', at: nowIso(db) } }
    transitionApplication(db, db, app, { toStatus: 'additional_docs_requested' })
```

4i. `src/data/seed.js:589`: ganti judul Activity `'Bank minta dokumen tambahan'` menjadi `'Dokumen perlu diunggah ulang'`.

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run src/data/mockApi.test.js`
Expected: PASS semua (termasuk test lama yang memakai `mockControls.advanceApplication` ±baris 553/579).

- [ ] **Step 6: Checkpoint**

Run: `npm run lint` lalu `git diff --stat -- src/data/documentRules.js src/data/mockApi.js src/data/seed.js src/data/mockApi.test.js`. Jangan commit.

---

### Task 2: Info tahap (`saveStageNote`) di `mockApi`

**Files:**
- Modify: `src/domains/applications/meta.js` (sebelum `export const STATUS_LABEL`)
- Modify: `src/data/mockApi.js` (import; konstanta dekat `STATUS_COPY`; `applicationDetail`; `admin.applications`)
- Modify: `src/domains/admin/labels.js` (`ACTION_LABEL`), `src/domains/admin/shared.jsx` (`auditDetail`)
- Test: `src/data/mockApi.test.js`

**Interfaces:**
- Consumes: `checkVersion`, `touch`, `audit`, `pushActivity`, `applicationDetail` (ada).
- Produces: `STAGE_NOTE_STATUSES: string[]` (dari `meta.js`); `api.admin.applications.saveStageNote(id, { message, schedule: { date, time, location } | null, expectedVersion }) → Promise<AdminApplicationDetail>`; `detail.application.stageNotes: { [status]: { message, schedule, updatedAt } }`; snapshot user `app.stageNotes` (objek pengajuan apa adanya).

- [ ] **Step 1: Tulis test yang gagal** — tambahkan di `describe('admin applications')`:

```js
  it('the team keeps one editable note per stage for the user; appraisal needs the agreed schedule', async () => {
    mockControls.reset('admin_ops')
    const id = 'app_01J8Z19RZ4VE4Q2AB7M5N8XKCF' // Firdi Audi, bank_processing
    const save = (expectedVersion, note) => api.admin.applications.saveStageNote(id, { expectedVersion, ...note })
    await expectCode(api.admin.applications.saveStageNote('app_sample_01', { message: 'Pesan untuk tahap diajukan.', expectedVersion: 3 }), 'INVALID_STATE_TRANSITION')
    let d = await api.admin.applications.get(id)
    await expectCode(save(d.application.version, { message: 'ok' }), 'VALIDATION_FAILED')
    d = await save(d.application.version, { message: 'Bank minta 5 hari kerja untuk analisis.' })
    expect(d.application.stageNotes.bank_processing).toMatchObject({ message: 'Bank minta 5 hari kerja untuk analisis.', schedule: null })
    d = await move(id, 'appraisal', d.application.version)
    expect(d.application.stageNotes.appraisal).toBeUndefined()
    await expectCode(save(d.application.version, { message: '', schedule: { date: '2026-10-18', time: '25:00', location: 'Jl. Melati 12' } }), 'VALIDATION_FAILED')
    d = await save(d.application.version, { message: 'Siapkan IMB/PBG asli.', schedule: { date: '2026-10-18', time: '10:00', location: 'Jl. Melati 12, Bekasi' } })
    d = await save(d.application.version, { message: 'Siapkan IMB/PBG asli.', schedule: { date: '2026-10-19', time: '09:30', location: 'Jl. Melati 12, Bekasi' } })
    await expectCode(save(1, { message: 'Versi lama.' }), 'CONFLICT_VERSION')
    expect((await api.admin.audit.list()).items[0]).toMatchObject({ action: 'application.stage_note', after: { status: 'appraisal', schedule: { date: '2026-10-19', time: '09:30' } } })

    await signIn('Firdi Audi', 'firdi.audi@email.com')
    const app = (await api.dashboard.getSnapshot()).applications.find((x) => x.id === id)
    expect(app.stageNotes.appraisal).toMatchObject({ message: 'Siapkan IMB/PBG asli.', schedule: { date: '2026-10-19', time: '09:30', location: 'Jl. Melati 12, Bekasi' } })
    const activity = await api.activities.list()
    expect(activity.filter((a) => a.type === 'application_stage_note').map((a) => a.title)).toEqual(['Info Appraisal diperbarui', 'Info baru dari tim · Appraisal', 'Info baru dari tim · Proses Bank'])
    expect(JSON.stringify(activity)).not.toContain('Siapkan IMB')
  })
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run src/data/mockApi.test.js -t "editable note per stage"`
Expected: FAIL — `saveStageNote is not a function`.

- [ ] **Step 3: Implementasi**

3a. `src/domains/applications/meta.js`, tepat di atas `export const STATUS_LABEL = {`:

```js
// Stages where the team can leave the user a note (spec 2026-10-13 §1.2); appraisal carries the agreed schedule.
export const STAGE_NOTE_STATUSES = ["docs_verification", "bank_processing", "appraisal", "approved", "old_mortgage_settlement", "akad"];
```

3b. `src/data/mockApi.js` — tambah import (di bawah import `@/domains/applications/validation`):

```js
import { STAGE_NOTE_STATUSES, STATUS_LABEL } from '@/domains/applications/meta'
```

3c. Tepat di bawah blok `const STATUS_COPY = { … }`:

```js
// The team's note for the user in the current stage (spec 2026-10-13 §1.2). Appraisal records the schedule agreed on
// WhatsApp; the other stages a message.
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
function stageNoteOf(status, { message, schedule }) {
  const text = String(message ?? '').trim()
  if (status === 'appraisal') {
    const s = schedule ?? {}
    const location = String(s.location ?? '').trim()
    failOnFields(
      {
        ...(!parseIsoDate(s.date) && { date: 'Pilih tanggal appraisal.' }),
        ...(!TIME.test(s.time ?? '') && { time: 'Isi jam appraisal.' }),
        ...((location.length < 3 || location.length > 200) && { location: 'Isi lokasi appraisal (3–200 karakter).' }),
        ...(text.length > 500 && { message: 'Catatan maksimal 500 karakter.' }),
      },
      'Lengkapi jadwal appraisal.',
    )
    return { message: text, schedule: { date: s.date, time: s.time, location } }
  }
  failOnFields(text.length < 5 || text.length > 500 ? { message: 'Tulis pesan untuk user (5–500 karakter).' } : {}, 'Lengkapi pesan untuk user.')
  return { message: text, schedule: null }
}
```

(`failOnFields` didefinisikan lebih bawah sebagai `const`; pemanggilan terjadi saat runtime, jadi aman.)

3d. Di `applicationDetail`, tepat setelah `finalTerms: app.finalTerms ?? null,` tambahkan:

```js
      stageNotes: app.stageNotes ?? {},
```

3e. Di `admin.applications`, setelah blok `reviewDocument: call(…),`:

```js
        saveStageNote: call(
          'admin.applications.saveStageNote',
          (db, id, { message, schedule, expectedVersion }) => {
            const { owner, app } = findUserApp(db, id)
            checkVersion(app, expectedVersion)
            if (!STAGE_NOTE_STATUSES.includes(app.status)) fail('INVALID_STATE_TRANSITION', 'Info untuk user hanya bisa diisi saat pengajuan sedang diproses.', 409)
            const before = app.stageNotes?.[app.status] ?? null
            const note = { ...stageNoteOf(app.status, { message, schedule }), updatedAt: nowIso(db) }
            app.stageNotes = { ...app.stageNotes, [app.status]: note }
            const stage = STATUS_LABEL[app.status]
            // The text stays out of the Activity, so an older notification never shows a note that was edited since.
            pushActivity(db, { type: 'application_stage_note', category: 'application', title: before ? `Info ${stage} diperbarui` : `Info baru dari tim · ${stage}`, body: app.status === 'appraisal' ? 'Jadwal appraisal sudah dikonfirmasi.' : 'Buka detail pengajuan untuk membaca pesannya.', action: { label: 'Lihat status', route: '/my-kpr/application' } }, owner)
            audit(db, { action: 'application.stage_note', resource: { type: 'application', id, label: owner.user.name }, before: before && { message: before.message, schedule: before.schedule }, after: { status: app.status, message: note.message, schedule: note.schedule } })
            touch(db, app)
            return applicationDetail(db, owner, app)
          },
          { admin: true },
        ),
```

3f. `src/domains/admin/labels.js`, di `ACTION_LABEL` setelah `'application.note': 'Catatan internal',`:

```js
  'application.document_review': 'Periksa dokumen',
  'application.stage_note': 'Info untuk user',
```

3g. `src/domains/admin/shared.jsx`, ganti `auditDetail` dengan:

```js
const auditDetail = (e) =>
  e.action.startsWith('health.')
    ? `v${e.before.version} → v${e.after.version}`
    : e.action === 'application.transition'
    ? `${STATUS_LABEL[e.before?.status] ?? e.before?.status} → ${STATUS_LABEL[e.after?.status] ?? e.after?.status}`
    : e.action === 'application.document_review'
      ? `${e.after.document}: ${e.after.result}`
      : e.action === 'application.stage_note'
        ? `Tahap ${STATUS_LABEL[e.after.status] ?? e.after.status}`
        : e.action === 'report.export'
          ? `${dateShort(e.after.from)} – ${dateShort(e.after.to)} · ${e.after.rows} pengajuan`
          : e.after
            ? fieldList(Object.keys(e.after))
            : null
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run src/data/mockApi.test.js`
Expected: PASS semua.

- [ ] **Step 5: Checkpoint** — `npm run lint`; jangan commit.

---

### Task 3: Aturan database + pgTAP (dry-run di VPS)

**Files:**
- Create: `supabase/migrations/20261013120000_document_review.sql`
- Create: `supabase/tests/008_document_review.test.sql`
- Create (scratchpad, bukan repo): `<scratchpad>/pgtap-vps.mjs`

**Interfaces:**
- Produces: `private.reupload_ok(p_old jsonb, p_new jsonb) → boolean`; `private.applications_write()` dengan aturan 1 & 2. Kode error tetap `INVALID_STATE_TRANSITION` (pesan "Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.").

- [ ] **Step 1: Tulis pgTAP yang gagal** — `supabase/tests/008_document_review.test.sql` (setiap assertion **satu baris**, runner membungkus per baris):

```sql
-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Users: A (consented applicant), S (super_admin). A's KPR Primary application starts in document verification.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000008a1', 'a8@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008c1', 's8@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents (user_id, type, version) values
  ('00000000-0000-4000-8000-0000000008a1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000008a1', 'privacy', '2026-09-01');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000008c1', 'super_admin');
insert into public.applications (id, user_id, doc) values ('app_t8', '00000000-0000-4000-8000-0000000008a1',
  '{"status":"docs_verification","productType":"primary","pendingActions":[],
    "statusHistory":[{"status":"submitted","at":"2026-10-01T02:00:00Z"},{"status":"docs_verification","at":"2026-10-02T02:00:00Z"}],
    "documents":{"ktp":{"status":"uploaded","fileName":"ktp.pdf"},"npwp":{"status":"uploaded","fileName":"npwp.pdf"},
                 "income_proof":{"status":"uploaded","fileName":"slip.pdf"},"property_document":{"status":"uploaded","fileName":"ppjb.pdf"}}}');

-- ---------- super admin S verifies and turns NPWP back ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008c1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = doc || '{"status":"bank_processing"}' where id = 'app_t8'$$, 'P0001', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.', 'staff cannot forward unverified documents to the bank');
select lives_ok($$update public.applications set doc = jsonb_set(jsonb_set(jsonb_set(jsonb_set(doc, '{documents,ktp,status}', '"verified"'), '{documents,income_proof,status}', '"verified"'), '{documents,property_document,status}', '"verified"'), '{documents,npwp,review}', '{"reasonCode":"blurry","note":"","at":"2026-10-03T02:00:00Z"}') where id = 'app_t8'$$, 'staff verifies documents and drafts a rejection while verifying');
select lives_ok($$update public.applications set doc = jsonb_set(jsonb_set(doc, '{documents,npwp}', '{"status":"needs_update","fileName":"npwp.pdf","invalidReason":"Buram / tidak terbaca"}'), '{pendingActions}', '[{"id":"pa_t8","type":"document_update","documentType":"npwp","message":"Buram / tidak terbaca","requestedAt":"2026-10-03T02:00:00Z"}]') || '{"status":"additional_docs_requested"}' where id = 'app_t8'$$, 'staff sends the revision request');

-- ---------- user A re-uploads ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents,npwp,status}', '"verified"') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot verify their own document');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents,ktp}', '{"status":"uploaded","fileName":"ktp-lain.pdf"}') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot replace a document nobody asked for');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents,family_card}', '{"status":"uploaded","fileName":"kk.pdf"}') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot add a document of their own');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{pendingActions}', '[]') || '{"status":"docs_verification"}' where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot drop the request without re-uploading');
select lives_ok($$update public.applications set doc = jsonb_set(jsonb_set(jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"npwp-baru.pdf","sizeBytes":1000,"contentType":"application/pdf","uploadedAt":"2026-10-04T02:00:00Z","invalidReason":null,"path":"x/app_t8/npwp/npwp-baru.pdf"}'), '{pendingActions}', '[]'), '{statusHistory}', (doc -> 'statusHistory') || '[{"status":"docs_verification","at":"2026-10-04T02:00:00Z"}]') || '{"status":"docs_verification"}' where id = 'app_t8'$$, 'the user re-uploads the asked document and the application returns to verification');

-- ---------- S checks the new file, forwards, and leaves a note ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008c1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = doc || '{"status":"bank_processing"}' where id = 'app_t8'$$, 'P0001', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.', 'the re-uploaded document is checked again before the bank');
select lives_ok($$update public.applications set doc = jsonb_set(doc, '{documents,npwp,status}', '"verified"') || '{"status":"bank_processing"}' where id = 'app_t8'$$, 'all required documents verified: staff forwards to the bank');
select lives_ok($$update public.applications set doc = doc || '{"stageNotes":{"bank_processing":{"message":"Bank minta 5 hari kerja.","schedule":null,"updatedAt":"2026-10-05T02:00:00Z"}}}' where id = 'app_t8'$$, 'staff writes the info for the user in the current stage');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = doc || '{"stageNotes":{}}' where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot change the team note');
reset role;

select is((select doc #>> '{stageNotes,bank_processing,message}' from public.applications where id = 'app_t8'), 'Bank minta 5 hari kerja.', 'the note is stored on the application');

select * from finish();
rollback;
```

- [ ] **Step 2: Buat runner VPS di scratchpad**

`C:\Users\jayac\AppData\Local\Temp\claude\C--Users-jayac-Documents-ruang-kpr-node-js\401aba03-394c-4555-8cdf-b119e586419b\scratchpad\pgtap-vps.mjs` (jalankan dari root repo; membaca `.env.local`):

```js
// Throwaway: runs [migration] + a pgTAP file on the VPS through /pg/query. One implicit transaction that ends in a
// raised error carrying the TAP output, so everything rolls back. Usage: node pgtap-vps.mjs <test.sql> [migration.sql]
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
const [test, migration] = process.argv.slice(2)
const TAP = /^select (plan|is|isnt|ok|throws_ok|lives_ok|results_eq)\(/
const collect = (expr) => `select set_config('tap.out', coalesce(current_setting('tap.out', true), '') || E'\\n' || coalesce((${expr}), ''), true);`
const body = fs.readFileSync(test, 'utf8').split(/\r?\n/)
  .filter((l) => !/^(begin|rollback);\s*$/.test(l.trim()) && !l.startsWith('select * from finish()'))
  .map((l) => (TAP.test(l) ? collect(l.slice('select '.length).replace(/;\s*$/, '')) : l))
  .join('\n')
const query = [migration ? fs.readFileSync(migration, 'utf8') : '', body, collect(`select string_agg(f, E'\\n') from finish() f`), `do $run$ begin raise exception '%', current_setting('tap.out'); end $run$;`].join('\n')
const r = await fetch(`${env.VITE_SUPABASE_URL}/pg/query`, { method: 'POST', headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
const out = (await r.text()).replaceAll('\\n', '\n')
console.log(out)
// No "ok" line at all means the SQL failed before the tests ran (e.g. a syntax error in the migration).
process.exit(!/\nok \d/.test(out) || /not ok|Looks like you failed/.test(out) ? 1 : 0)
```

- [ ] **Step 3: Jalankan test tanpa migration, pastikan gagal**

Run: `node "<scratchpad>/pgtap-vps.mjs" supabase/tests/008_document_review.test.sql`
Expected: output TAP dengan `not ok 1 - staff cannot forward unverified documents to the bank` dan `not ok` pada test user (aturan lama masih menerima), exit 1.

- [ ] **Step 4: Tulis migration** — `supabase/migrations/20261013120000_document_review.sql`:

```sql
-- Admin document review (spec 2026-10-13 §3): the team forwards to the bank only when every required document is
-- verified, and a user's re-upload may touch only the documents the team asked for.

-- What a re-upload the team asked for may change (recordDocument in mockApi.js), beyond the keys applications_write
-- already pins: each asked document stays or becomes a fresh upload, every other document stays as it was, a request
-- only goes away with its document re-uploaded, and the history only gains the return to verification.
create or replace function private.reupload_ok(p_old jsonb, p_new jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select
    not exists (
      select 1
        from (select jsonb_object_keys(coalesce(p_old -> 'documents', '{}'::jsonb)) as t
              union
              select jsonb_object_keys(coalesce(p_new -> 'documents', '{}'::jsonb))) k
       where (p_new -> 'documents' -> k.t) is distinct from (p_old -> 'documents' -> k.t)
         and not coalesce(
               p_old -> 'documents' -> k.t ->> 'status' = 'needs_update'
               and p_new -> 'documents' -> k.t ->> 'status' = 'uploaded'
               and not ((p_new -> 'documents' -> k.t) ? 'review')
               and coalesce(p_new -> 'documents' -> k.t ->> 'invalidReason', '') = '',
               false))
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_new -> 'pendingActions', '[]'::jsonb)) a
       where not (coalesce(p_old -> 'pendingActions', '[]'::jsonb) @> jsonb_build_array(a)))
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_old -> 'pendingActions', '[]'::jsonb)) a
       where not (coalesce(p_new -> 'pendingActions', '[]'::jsonb) @> jsonb_build_array(a))
         and coalesce(p_new -> 'documents' -> (a ->> 'documentType') ->> 'status', '') <> 'uploaded')
    and ((p_new -> 'statusHistory') is not distinct from (p_old -> 'statusHistory')
         or ((p_new -> 'statusHistory') = coalesce(p_old -> 'statusHistory', '[]'::jsonb) || jsonb_build_array((p_new -> 'statusHistory') -> -1)
             and ((p_new -> 'statusHistory') -> -1) ->> 'status' = 'docs_verification'))
$$;

create or replace function private.applications_write()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  -- What a re-upload the bank asked for may touch (recordDocument in mockApi.js).
  v_reupload text[] := array['status', 'statusHistory', 'pendingActions', 'documents', 'updatedAt', 'version'];
  v_flag text[] := array['superseded', 'updatedAt', 'version'];
begin
  new.status := coalesce(new.doc ->> 'status', 'draft');
  new.product_type := coalesce(new.doc ->> 'productType', 'primary');
  new.superseded := coalesce((new.doc ->> 'superseded')::boolean, false);
  new.doc := jsonb_set(new.doc, '{id}', to_jsonb(new.id));
  if private.trusted() then return new; end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from v_uid then perform private.fail('FORBIDDEN', 'Pengajuan hanya bisa dibuat untuk akun sendiri.'); end if;
    if new.status <> 'draft' or new.superseded then perform private.fail('INVALID_STATE_TRANSITION', 'Pengajuan baru selalu dimulai sebagai draft.'); end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
    perform private.fail('FORBIDDEN', 'Pemilik pengajuan tidak bisa diubah.');
  end if;

  if old.user_id = v_uid then
    if old.status = 'draft' and new.status = 'draft' then return new; end if;
    if old.status = 'draft' and new.status = 'submitted' then perform private.check_submit(new.doc); return new; end if;
    if old.status = 'rejected' and not old.superseded and new.status = 'draft' then return new; end if; -- retry at the same bank
    if old.status = 'rejected' and not old.superseded and new.status = 'rejected' and new.superseded
       and (old.doc - v_flag) = (new.doc - v_flag) then return new; end if; -- copied to another bank
    if old.status = 'additional_docs_requested' and (old.doc - v_reupload) = (new.doc - v_reupload)
       and private.reupload_ok(old.doc, new.doc)
       and (new.status = 'additional_docs_requested'
            or (new.status = 'docs_verification' and jsonb_array_length(coalesce(new.doc -> 'pendingActions', '[]'::jsonb)) = 0)) then
      return new;
    end if;
    perform private.fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa diubah.');
  end if;

  -- The team works on submitted applications only; drafts are the user's private work.
  if (select private.has_role('super_admin')) and old.status <> 'draft' then
    if new.status = 'bank_processing' and old.status <> 'bank_processing'
       and exists (select 1 from unnest(private.required_documents(new.doc)) t
                    where coalesce(new.doc #>> array['documents', t, 'status'], '') <> 'verified') then
      perform private.fail('INVALID_STATE_TRANSITION', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.');
    end if;
    if new.status = old.status or private.next_status_ok(old.status, new.status, old.product_type) then return new; end if;
    perform private.fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa dipindah ke status tersebut.');
  end if;
  perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.');
end $$;
```

- [ ] **Step 5: Dry-run migration + test, pastikan lulus**

Run: `node "<scratchpad>/pgtap-vps.mjs" supabase/tests/008_document_review.test.sql supabase/migrations/20261013120000_document_review.sql`
Expected: `1..13`, `ok 1` … `ok 13`, exit 0. Semua di-rollback.

- [ ] **Step 6: Regresi test lama dengan migration baru**

Jalankan test lama yang menyentuh `applications`, masing-masing bersama migration baru:

```bash
node "<scratchpad>/pgtap-vps.mjs" supabase/tests/002_app_data.test.sql supabase/migrations/20261013120000_document_review.sql
node "<scratchpad>/pgtap-vps.mjs" supabase/tests/003_tighten_rules.test.sql supabase/migrations/20261013120000_document_review.sql
```

Expected: `002` 30/30, `003` 10/10.

- [ ] **Step 7: Checkpoint** — jangan commit, jangan terapkan ke VPS (Task 7).

---

### Task 4: Halaman admin — panel Dokumen, dialog Tolak, Langkah berikutnya, panel Info untuk user

**Files:**
- Modify: `src/domains/admin/ApplicationsPages.jsx`

**Interfaces:**
- Consumes: `api.admin.applications.reviewDocument`, `api.admin.applications.saveStageNote`, `transition` (Task 1–2); `DOC_REJECT_REASONS`, `rejectMessage` (`documentRules.js`); `STAGE_NOTE_STATUSES`, `STATUS_LABEL` (`meta.js`); `detail.application.documents[i].file.review`, `detail.application.stageNotes`.

- [ ] **Step 1: Import** — ubah baris import di atas file:

```js
import { DOC_REJECT_REASONS, rejectMessage } from '@/data/documentRules'
import { CheckboxField, DateField, FormGrid, MoneyField, NumberField, RateField, SelectField, TextAreaField, TextField } from '@/components/shared/fields'
import { STAGE_NOTE_STATUSES, STATUS_LABEL, productName } from '@/domains/applications/meta'
```

(`FieldError` dihapus dari import karena hanya dipakai dialog lama.)

- [ ] **Step 2: `ACTIONS`** — ganti `additional_docs_requested: 'Minta revisi dokumen',` menjadi `additional_docs_requested: 'Kirim permintaan revisi ke user',`.

- [ ] **Step 3: Panel Dokumen + dialog Tolak.** Di bawah `const row = …` tambahkan:

```jsx
// [label, chip tone]; a drafted rejection outranks the stored status until it is sent.
const docChip = (f) => (!f ? ['Belum ada', 'mute'] : f.review ? ['Ditolak · belum dikirim', 'bad'] : (DOC_STATUS[f.status] ?? [f.status, 'mute']))

// Per-document review while verifying (spec 2026-10-13 §4.1): Sesuai saves at once; Tolak drafts a reason the user
// only sees once the team sends the revision request.
function DocumentsPanel({ data, onSaved, onReload, onSend }) {
  const { application: app } = data
  const reviewing = app.status === 'docs_verification'
  const [busy, setBusy] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const required = app.documents.filter((d) => d.required)
  const checked = required.filter((d) => d.file?.status === 'verified' || d.file?.review).length
  const drafts = app.documents.filter((d) => d.file?.review).length
  const approve = async (d) => {
    setBusy(d.type)
    try {
      onSaved(await api.admin.applications.reviewDocument(app.id, { documentType: d.type, result: 'ok', expectedVersion: app.version }))
    } catch (e) {
      toast.error(e.message)
      if (e.code === 'CONFLICT_VERSION') onReload()
    } finally {
      setBusy(null)
    }
  }
  return (
    <Panel>
      <PanelTitle sub={isMock ? 'Mode demo menyimpan metadata saja, tanpa file.' : 'Unduh file untuk verifikasi.'}>Dokumen</PanelTitle>
      <ul className="flex flex-col">
        {app.documents.map((d) => {
          const [chip, tone] = docChip(d.file)
          return (
            <li key={d.type} className={`${row} flex-wrap`}>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold">
                  {d.label}
                  {!d.required && <span className="font-semibold text-muted-foreground"> · opsional</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.file ? `${d.file.fileName} · ${Math.round(d.file.sizeBytes / 1024)} KB` : 'Belum diunggah'}
                  {d.file?.invalidReason && ` · ${d.file.invalidReason}`}
                </span>
                {d.file?.review && <span className="text-xs font-semibold text-danger">↳ {rejectMessage(d.file.review)}</span>}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {d.file?.path && <DownloadDocument applicationId={app.id} documentType={d.type} label={d.label} />}
                {reviewing && d.file && (
                  <>
                    <Button type="button" size="sm" variant="outline" onClick={() => approve(d)} disabled={!!busy || d.file.status === 'verified'} aria-busy={busy === d.type} aria-label={`Sesuai ${d.label}`}>
                      {busy === d.type && <Spinner />}
                      Sesuai
                    </Button>
                    <Button type="button" size="sm" variant="destructive-soft" onClick={() => setRejecting(d)} disabled={!!busy} aria-label={`Tolak ${d.label}`}>
                      Tolak
                    </Button>
                  </>
                )}
                <Chip tone={tone} className="whitespace-nowrap">
                  {chip}
                </Chip>
              </span>
            </li>
          )
        })}
      </ul>
      {reviewing && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm font-semibold text-ink-3">
            {checked} dari {required.length} dokumen wajib diperiksa{drafts > 0 && ` · ${drafts} ditolak`}
          </span>
          <Button type="button" size="sm" variant="outline" disabled={!drafts || !!busy} onClick={onSend}>
            Kirim permintaan revisi ke user
          </Button>
        </div>
      )}
      {rejecting && (
        <RejectDialog
          app={app}
          doc={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(next) => {
            onSaved(next)
            setRejecting(null)
          }}
          onReload={() => {
            setRejecting(null)
            onReload()
          }}
        />
      )}
    </Panel>
  )
}

function RejectDialog({ app, doc, onClose, onDone, onReload }) {
  const [reasonCode, setReasonCode] = useState(doc.file.review?.reasonCode ?? '')
  const [note, setNote] = useState(doc.file.review?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldError = (k) => error?.fieldErrors?.find((x) => x.field === k)?.message
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onDone(await api.admin.applications.reviewDocument(app.id, { documentType: doc.type, result: 'rejected', reasonCode, note, expectedVersion: app.version }))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }
  const conflict = error?.code === 'CONFLICT_VERSION'
  return (
    <FormDialog open onOpenChange={(open) => !open && !saving && onClose()} title={`Tolak ${doc.label}`} description="Belum terkirim ke user sampai kamu menekan Kirim permintaan revisi ke user." className="max-w-[520px]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <SelectField label="Alasan" required value={reasonCode} onChange={setReasonCode} options={DOC_REJECT_REASONS} error={fieldError('reasonCode')} />
        <TextAreaField label="Catatan untuk user" required={reasonCode === 'other'} optional={reasonCode !== 'other'} value={note} onChange={setNote} error={fieldError('note')} hint="Tampil di Home dan tracker user setelah dikirim." />
        {error && !error.fieldErrors?.length && (
          <Notice tone="bad" role="alert" action={conflict && <Button size="xs" onClick={onReload}>Muat ulang data</Button>}>
            {conflict ? 'Pengajuan ini sudah berubah sejak halaman dibuka. Muat ulang, lalu ulangi.' : error.message}
          </Notice>
        )}
        <Button type="submit" variant="destructive" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          Simpan penolakan
        </Button>
      </form>
    </FormDialog>
  )
}
```

Di `ApplicationDetailPage`, ganti seluruh `<Panel> … <PanelTitle sub={isMock ? …}>Dokumen</PanelTitle> … </Panel>` dengan:

```jsx
          <DocumentsPanel data={data} onSaved={setData} onReload={reload} onSend={() => setMoving('additional_docs_requested')} />
```

- [ ] **Step 4: `NextStep`** — ganti fungsi dengan:

```jsx
function NextStep({ data, onMove }) {
  const { application: app, allowedTransitions } = data
  const moves = allowedTransitions.filter((to) => to !== 'additional_docs_requested') // sent from the Dokumen panel
  const docsReady = app.documents.every((d) => (!d.required || d.file?.status === 'verified') && !d.file?.review)
  const docLabel = (type) => app.documents.find((d) => d.type === type)?.label ?? type
  return (
    <Panel>
      <PanelTitle>Langkah berikutnya</PanelTitle>
      {app.status === 'additional_docs_requested' && (
        <Notice tone="warn" title="Menunggu user mengunggah ulang dokumen">
          {app.pendingActions.map((p) => `${docLabel(p.documentType)} — ${p.message}`).join(' · ')}
        </Notice>
      )}
      {app.status === 'rejected' && (
        <Notice tone="bad" title="Pengajuan ditolak">
          {app.rejection?.displayReason}
        </Notice>
      )}
      {app.status === 'disbursed' && (
        <Notice tone="ok" title="Pengajuan selesai">
          KPR user sudah aktif dari angka final akad.
        </Notice>
      )}
      {moves.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {moves.map((to) => (
            <Button key={to} size="sm" variant={to === 'rejected' ? 'destructive-soft' : 'default'} onClick={() => onMove(to)} disabled={to === 'bank_processing' && !docsReady} aria-describedby={to === 'bank_processing' && !docsReady ? 'bank-docs-hint' : undefined}>
              {ACTIONS[to]}
            </Button>
          ))}
          {moves.includes('bank_processing') && !docsReady && (
            <span id="bank-docs-hint" className="text-sm text-muted-foreground">
              Semua dokumen wajib harus Sesuai.
            </span>
          )}
        </div>
      )}
    </Panel>
  )
}
```

- [ ] **Step 5: `TransitionDialog`** — hapus state `docs` dan `message`; di objek `metadata` hapus baris `additional_docs_requested: { documentTypes: docs, message },`; ganti blok `{toStatus === 'additional_docs_requested' && ( <> <fieldset …> … </> )}` dengan:

```jsx
        {toStatus === 'additional_docs_requested' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink-2">Dikirim ke user untuk diunggah ulang</span>
            <ul aria-label="Dokumen yang ditolak" className="flex flex-col gap-1.5">
              {app.documents
                .filter((d) => d.file?.review)
                .map((d) => (
                  <li key={d.type} className="text-sm">
                    <span className="font-bold">{d.label}</span> — {rejectMessage(d.file.review)}
                  </li>
                ))}
            </ul>
          </div>
        )}
```

- [ ] **Step 6: Panel Info untuk user.** Tambahkan komponen (di bawah `NotesPanel`):

```jsx
// What the team agreed with the user (on WhatsApp) for the current stage; the user always sees the latest save.
function StageNotePanel({ data, onSaved, onReload }) {
  const { application: app } = data
  const note = app.stageNotes[app.status]
  const appraisal = app.status === 'appraisal'
  const [message, setMessage] = useState(note?.message ?? '')
  const [schedule, setSchedule] = useState(note?.schedule ?? { date: '', time: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const setSlot = (k) => (v) => setSchedule((s) => ({ ...s, [k]: v }))
  const fieldError = (k) => error?.fieldErrors?.find((x) => x.field === k)?.message
  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(await api.admin.applications.saveStageNote(app.id, { message, schedule: appraisal ? schedule : null, expectedVersion: app.version }))
      toast('Info untuk user tersimpan.')
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }
  const conflict = error?.code === 'CONFLICT_VERSION'
  const empty = appraisal ? 'Belum diisi. User melihat: jadwal menunggu konfirmasi tim via WhatsApp.' : 'Belum diisi. User belum melihat info tambahan.'
  return (
    <Panel>
      <PanelTitle sub={note ? `Terakhir diubah ${dateShort(note.updatedAt)}` : empty}>Info untuk user · {STATUS_LABEL[app.status]}</PanelTitle>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        {appraisal && (
          <>
            <DateField label="Tanggal appraisal" required value={schedule.date} onChange={setSlot('date')} error={fieldError('date')} />
            <TextField label="Jam appraisal" type="time" required value={schedule.time} onChange={setSlot('time')} error={fieldError('time')} />
            <TextField label="Lokasi appraisal" required value={schedule.location} onChange={setSlot('location')} error={fieldError('location')} />
          </>
        )}
        <TextAreaField label={appraisal ? 'Catatan untuk user' : 'Pesan untuk user'} required={!appraisal} optional={appraisal} rows={3} value={message} onChange={setMessage} error={fieldError('message')} hint="Hasil kesepakatan dengan user, mis. dari WhatsApp. Tampil di Home dan tracker user." />
        {error && !error.fieldErrors?.length && (
          <Notice tone="bad" role="alert" action={conflict && <Button size="xs" onClick={onReload}>Muat ulang data</Button>}>
            {conflict ? 'Pengajuan ini sudah berubah sejak halaman dibuka. Muat ulang, lalu ulangi.' : error.message}
          </Notice>
        )}
        <Button type="submit" variant="outline" size="sm" className="w-fit" disabled={saving} aria-busy={saving}>
          {saving && <Spinner />}
          Simpan info
        </Button>
      </form>
    </Panel>
  )
}
```

Di `ApplicationDetailPage`, kolom kanan, tepat sebelum `<Panel>` "Riwayat status":

```jsx
          {STAGE_NOTE_STATUSES.includes(app.status) && <StageNotePanel key={app.status} data={data} onSaved={setData} onReload={reload} />}
```

- [ ] **Step 7: Verifikasi**

Run: `npm run lint` lalu `npm run build`
Expected: keduanya bersih. (Journey diuji di Task 6.)

- [ ] **Step 8: Checkpoint** — jangan commit.

---

### Task 5: Sisi user — `StageNoteCard`, `PendingDocs`, Home dan tracker

**Files:**
- Modify: `src/domains/applications/ApplicationTracker.jsx`
- Modify: `src/domains/home/HomePage.jsx`
- Modify: `tests/e2e/primary-flow.spec.js:148`

**Interfaces:**
- Consumes: snapshot `app.stageNotes`, `app.pendingActions` (Task 1–2); `STATUS_LABEL` (`meta.js`); `DOC_LABELS` (`documentRules.js`).
- Produces: `export function StageNoteCard({ app })`, `export function PendingDocs({ app })` dari `ApplicationTracker.jsx`.

- [ ] **Step 1: Komponen bersama di `ApplicationTracker.jsx`**

Tambah import: `import { DOC_LABELS } from "@/data/documentRules";` dan `dateLong` ke import `@/lib/format` (`import { dateLong, dateShort, percentBps, rupiah, tenorLabel } from "@/lib/format";`), serta `PanelTitle` ke import `@/components/shared/ui`.

Tambahkan di bawah `const CANCELLABLE = [...]`:

```jsx
// The team's note for the current stage (spec 2026-10-13 §4.2). Appraisal always shows: the agreed schedule, or that
// the team will confirm it on WhatsApp.
export function StageNoteCard({ app }) {
  const note = app.stageNotes?.[app.status];
  const appraisal = app.status === "appraisal";
  if (!note && !appraisal) return null;
  const s = note?.schedule;
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>Info dari tim RuangKPR</PanelTitle>
        {appraisal && !s ? (
          <Chip tone="warn" icon={ClockIcon}>
            Menunggu konfirmasi
          </Chip>
        ) : (
          <Chip tone="info">{STATUS_LABEL[app.status]}</Chip>
        )}
      </div>
      {appraisal && !s && (
        <p className="text-sm leading-[22px] text-ink-2">
          Jadwal appraisal akan dikonfirmasi tim lewat WhatsApp.
        </p>
      )}
      {s && (
        <SummaryRows
          size="sm"
          rows={[
            { k: "Tanggal", v: dateLong(s.date) },
            { k: "Jam", v: s.time },
            { k: "Lokasi", v: s.location },
          ]}
        />
      )}
      {note?.message && (
        <p className="text-sm leading-[22px] text-ink-2">{note.message}</p>
      )}
      {note && (
        <span className="text-xs text-muted-foreground">
          Diperbarui {dateShort(note.updatedAt)}
        </span>
      )}
    </Panel>
  );
}

// Each document the team asked again, with its reason.
export function PendingDocs({ app }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {(app.pendingActions ?? []).map((p) => (
        <li key={p.id} className="text-sm leading-[21px] text-ink-2">
          <span className="font-bold">{DOC_LABELS[p.documentType] ?? p.documentType}</span> — {p.message}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Tracker** — di `Tracker`, ganti blok `{pending.length > 0 && ( <section …> … </section> )}` dengan:

```jsx
        {pending.length > 0 && (
          <section className="flex flex-col gap-3 rounded-card border border-[#f2d27a] bg-[#fff6dd] p-6">
            <span className="flex items-center gap-2 text-[13px] font-extrabold text-warning">
              <TriangleAlertIcon className="size-4" aria-hidden />
              Permintaan tim RuangKPR · {dateShort(pending[0].requestedAt)}
            </span>
            <PendingDocs app={app} />
            <p className="text-sm text-ink-2">
              Upload ulang langsung di daftar dokumen di bawah.
            </p>
          </section>
        )}
```

dan tepat setelah blok hero (`{hero && !rejected && ( <section …> … </section> )}`) tambahkan:

```jsx
        {!rejected && <StageNoteCard app={app} />}
```

- [ ] **Step 3: Home** — di `HomePage.jsx` tambah import:

```js
import { PendingDocs, StageNoteCard } from "@/domains/applications/ApplicationTracker";
```

Di `InProcessSection`: tepat setelah `</HeroCard>` tambahkan `<StageNoteCard app={app} />`. Lalu di panel `pending.length > 0`, ganti

```jsx
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-extrabold">
                Bank minta dokumen tambahan
              </h2>
              {pending.map((p) => (
                <p key={p.id} className="text-sm leading-[21px] text-ink-3">
                  {p.message}
                </p>
              ))}
            </div>
            <Button asChild size="sm" className="w-fit">
              <Link to="/my-kpr/application">
                Upload sekarang
```

dengan

```jsx
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-extrabold">
                Ada dokumen yang perlu diunggah ulang
              </h2>
              <PendingDocs app={app} />
            </div>
            <Button asChild size="sm" className="w-fit">
              <Link to="/my-kpr/application">
                Upload ulang
```

- [ ] **Step 4: e2e teks lama** — `tests/e2e/primary-flow.spec.js:148`: `'Permintaan Bank'` → `'Permintaan tim RuangKPR'`.

- [ ] **Step 5: Verifikasi**

Run: `npm run lint`, `npm run build`, `npx playwright test tests/e2e/primary-flow.spec.js`
Expected: bersih; primary-flow lulus (termasuk "additional document can be re-uploaded in place").

- [ ] **Step 6: Checkpoint** — jangan commit.

---

### Task 6: Journey e2e admin ↔ user

**Files:**
- Modify: `tests/e2e/admin-applications.spec.js` (ganti test pertama, tambah satu test)

**Interfaces:**
- Consumes: label & tombol dari Task 4–5: `Sesuai {label}`, `Tolak {label}`, `Alasan`, `Catatan untuk user`, `Simpan penolakan`, `Kirim permintaan revisi ke user`, list `Dokumen yang ditolak`, `Tanggal appraisal`, `Jam appraisal`, `Lokasi appraisal`, `Simpan info`; Home `Ada dokumen yang perlu diunggah ulang`, `Upload ulang`, `Menunggu konfirmasi`.

- [ ] **Step 1: Tulis test** — tambah `pdf` ke import helpers: `import { pdf, signIn, useScenario } from './helpers'`. Ganti test `admin verifies, asks for a new KTP, …` dengan:

```js
test('admin reviews each document, sends the rejected one with its reason, and forwards to the bank once all are Sesuai', async ({ page }) => {
  await useScenario(page, 'admin_ops', '/admin')
  await openApplication(page, 'Rina Hartati')
  await move(page, 'Mulai verifikasi dokumen', 'Dokumen awal lengkap')
  await expect(page.getByRole('button', { name: 'Teruskan ke bank' })).toBeDisabled()
  for (const doc of ['KTP', 'Slip Gaji / Bukti Penghasilan', 'Dokumen Properti']) {
    await page.getByRole('button', { name: `Sesuai ${doc}` }).click()
    await expect(page.getByRole('button', { name: `Sesuai ${doc}` })).toBeDisabled()
  }
  await page.getByRole('button', { name: 'Tolak NPWP' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Alasan').selectOption({ label: 'Buram / tidak terbaca' })
  await dialog.getByLabel('Catatan untuk user').fill('angka NPWP tidak terbaca')
  await dialog.getByRole('button', { name: 'Simpan penolakan' }).click()
  await expect(page.getByText('Ditolak · belum dikirim')).toBeVisible()
  await expect(page.getByText('4 dari 4 dokumen wajib diperiksa · 1 ditolak')).toBeVisible()
  await move(page, 'Kirim permintaan revisi ke user', 'NPWP buram', async (d) => {
    await expect(d.getByRole('list', { name: 'Dokumen yang ditolak' })).toContainText('NPWP — Buram / tidak terbaca: angka NPWP tidak terbaca')
  })
  await expect(page.getByText('Perlu Dokumen Tambahan').first()).toBeVisible()

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Rina Hartati', 'rina.hartati@example.com')
  await expect(page.getByRole('heading', { name: 'Ada dokumen yang perlu diunggah ulang' })).toBeVisible()
  await expect(page.getByText('Buram / tidak terbaca: angka NPWP tidak terbaca')).toBeVisible()
  await page.getByRole('link', { name: 'Upload ulang' }).click()
  await page.locator('input[type=file]').nth(1).setInputFiles(pdf('npwp-baru.pdf'))
  await expect(page.getByText('Status: Verifikasi Dokumen')).toBeVisible()

  await page.goto('/profile')
  await page.getByRole('button', { name: 'Keluar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keluar' }).click()
  await signIn(page, 'Admin RuangKPR', 'admin@ruangkpr.id')
  await openApplication(page, 'Rina Hartati')
  await page.getByRole('button', { name: 'Sesuai NPWP' }).click()
  await expect(page.getByRole('button', { name: 'Teruskan ke bank' })).toBeEnabled()
  await move(page, 'Teruskan ke bank', 'Dokumen lengkap dan jelas')
  await expect(page.getByRole('list', { name: 'Riwayat status' })).toContainText('Proses Bank')
})

test('the team records the appraisal agreed on WhatsApp; until then the user sees it waiting for confirmation', async ({ page }) => {
  await useScenario(page, 'application_in_process', '/my-kpr/application')
  await page.getByRole('button', { name: 'Majukan ke: Appraisal' }).click()
  await page.goto('/')
  await expect(page.getByText('Menunggu konfirmasi')).toBeVisible()
  await expect(page.getByText('Jadwal appraisal akan dikonfirmasi tim lewat WhatsApp.')).toBeVisible()

  await useScenario(page, 'admin_ops', '/admin')
  await openApplication(page, 'Firdi Audi')
  await page.getByLabel('Pesan untuk user').fill('Bank sedang menganalisis, estimasi 5 hari kerja.')
  await page.getByRole('button', { name: 'Simpan info' }).click()
  await expect(page.getByText(/Terakhir diubah/)).toBeVisible()
  await move(page, 'Masuk tahap appraisal', 'Bank menjadwalkan appraisal')
  await expect(page.getByText('Belum diisi. User melihat: jadwal menunggu konfirmasi tim via WhatsApp.')).toBeVisible()
  await expect(page.getByLabel('Catatan untuk user')).toHaveValue('')
  await page.getByLabel('Tanggal appraisal').fill('2026-10-18')
  await page.getByLabel('Jam appraisal').fill('10:00')
  await page.getByLabel('Lokasi appraisal').fill('Jl. Melati 12, Bekasi')
  await page.getByLabel('Catatan untuk user').fill('Siapkan IMB/PBG asli.')
  await page.getByRole('button', { name: 'Simpan info' }).click()
  await expect(page.getByText(/Terakhir diubah/)).toBeVisible()

  await page.getByRole('button', { name: 'Keluar admin' }).click()
  await signIn(page, 'Firdi Audi', 'firdi.audi@email.com')
  await expect(page.getByText('Jl. Melati 12, Bekasi')).toBeVisible()
  await expect(page.getByText('Siapkan IMB/PBG asli.')).toBeVisible()
  await expect(page.getByText('Menunggu konfirmasi')).toHaveCount(0)
})
```

- [ ] **Step 2: Jalankan**

Run: `npx playwright test tests/e2e/admin-applications.spec.js`
Expected: 3 test lulus. Jika ada selector yang bentrok (mis. teks muncul dua kali), perbaiki selector di test, bukan perilaku UI, kecuali UI memang salah terhadap spec.

- [ ] **Step 3: Checkpoint** — jangan commit.

---

### Task 7: Terapkan migration ke VPS (dengan izin) + live test

**Files:**
- Modify: `src/data/supabase/live.test.js` (test `the admin opens a document and walks the application to disbursement`)
- Modify: `supabase/README.md` (baris daftar migration & hasil pgTAP)
- Create (scratchpad): `<scratchpad>/apply-migration.mjs`

**Interfaces:**
- Consumes: semua method Task 1–2; migration Task 3.

- [ ] **Step 1: Ubah live test** — ganti isi `it('the admin opens a document and walks the application to disbursement', …)` mulai dari `let detail = …` sampai sebelum `}, 120_000)` dengan:

```js
    let detail = await api.admin.applications.get(ids.app)
    await expect(api.admin.applications.transition(ids.app, { toStatus: 'approved', reason: 'Lompat status', expectedVersion: detail.application.version })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    const finalTerms = { loanAmount: 480_000_000, tenorMonths: 240, fixedRateBps: 550, fixedMonths: 60, floatingRateBps: 1050, akadDate: today }
    const step = async (toStatus, metadata = {}) => {
      detail = await api.admin.applications.transition(ids.app, { toStatus, reason: 'Uji integrasi', expectedVersion: detail.application.version, metadata })
      expect(detail.application.status).toBe(toStatus)
    }
    const review = async (documentType, verdict = { result: 'ok' }) => {
      detail = await api.admin.applications.reviewDocument(ids.app, { documentType, expectedVersion: detail.application.version, ...verdict })
    }
    await step('docs_verification')
    for (const t of ['ktp', 'income_proof', 'property_document']) await review(t)
    await review('npwp', { result: 'rejected', reasonCode: 'blurry', note: 'angka tidak terbaca' })
    await step('additional_docs_requested')

    // The user's re-upload passes the database's re-upload rule.
    await signInAs(people.user)
    expect((await api.applications.uploadDocument(ids.app, { documentType: 'npwp', file: pdf('npwp-baru.pdf') })).status).toBe('docs_verification')

    await signInAs(people.staff)
    detail = await api.admin.applications.get(ids.app)
    await review('npwp')
    await step('bank_processing')
    await step('appraisal')
    detail = await api.admin.applications.saveStageNote(ids.app, { message: 'Siapkan IMB asli.', schedule: { date: shift(5), time: '10:00', location: 'Lokasi uji' }, expectedVersion: detail.application.version })
    expect(detail.application.stageNotes.appraisal.schedule.location).toBe('Lokasi uji')
    await step('approved')
    await step('akad', { finalTerms })
    await step('disbursed')
    const audit = await api.admin.audit.list()
    expect(audit.items.filter((e) => e.action === 'application.transition' && e.resource.id === ids.app)).toHaveLength(7)
```

- [ ] **Step 2: Minta izin user** untuk menerapkan `20261013120000_document_review` ke database VPS (mengganti trigger `applications_write`; tanpa perubahan data). **Berhenti di sini sampai user menjawab ya.** Catatan untuk user: setelah diterapkan, admin di app versi lama (tanpa tombol Sesuai) tidak bisa lagi meneruskan ke bank, jadi kode dan migration harus dipakai bersamaan.

- [ ] **Step 3: Script terapkan** — `<scratchpad>/apply-migration.mjs`:

```js
// Applies one migration on the VPS and records it in supabase_migrations, in one request. Usage: node apply-migration.mjs <file.sql>
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
const file = process.argv[2]
const [, version, name] = /(\d{14})_(.+)\.sql$/.exec(file)
const sql = fs.readFileSync(file, 'utf8')
const query = `${sql}\ninsert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${name}', array[$mig$${sql}$mig$]);\nselect version from supabase_migrations.schema_migrations where version = '${version}';`
const r = await fetch(`${env.VITE_SUPABASE_URL}/pg/query`, { method: 'POST', headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
console.log(r.status, await r.text())
process.exit(r.ok ? 0 : 1)
```

Run: `node "<scratchpad>/apply-migration.mjs" supabase/migrations/20261013120000_document_review.sql`
Expected: `200` dan baris `20261013120000`.

- [ ] **Step 4: pgTAP di VPS tanpa migration** (sekarang sudah terpasang)

Run: `node "<scratchpad>/pgtap-vps.mjs" supabase/tests/008_document_review.test.sql`, lalu `002` dan `003` dengan cara yang sama.
Expected: `008` 13/13, `002` 30/30, `003` 10/10.

- [ ] **Step 5: Live test**

Run: `LIVE=1 npx vitest run src/data/supabase/live.test.js` (PowerShell: `$env:LIVE='1'; npx vitest run src/data/supabase/live.test.js`)
Expected: semua lulus; data uji dibersihkan sendiri.

- [ ] **Step 6: README** — di `supabase/README.md` baris daftar migration, tambahkan `` `20261013120000_document_review` `` ke daftar yang sudah jalan dan `` `008` 13/13 `` ke hasil pgTAP (dengan tanggal cek 2026-10-13).

- [ ] **Step 7: Checkpoint** — jangan commit.

---

### Task 8: Verifikasi akhir

- [ ] **Step 1:** `npm run lint` — bersih.
- [ ] **Step 2:** `npx vitest run` — semua lulus (laporkan jumlah).
- [ ] **Step 3:** `npm run build` — sukses.
- [ ] **Step 4:** `npx playwright test` — semua lulus (laporkan jumlah; test flaky dijalankan ulang sekali dan dilaporkan apa adanya).
- [ ] **Step 5:** Review diff hanya untuk file di File map (`git diff -- <file>`); hapus kode/komentar yang tidak perlu. Pastikan tidak ada sisa `documentTypes`/`'Minta revisi dokumen'`/`'Bank minta dokumen tambahan'` (`git grep -n "documentTypes\|Minta revisi dokumen\|Bank minta dokumen" -- src tests`).
- [ ] **Step 6:** Laporkan ke user (bahasa Indonesia): apa yang berubah, hasil setiap check, status migration VPS, dan tanyakan cara commit (file target juga berisi perubahan sesi lain).
