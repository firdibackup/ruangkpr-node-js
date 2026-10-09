# RuangKPR — Mock API JSON Contract

**Versi:** 1.0  
**Tanggal kontrak:** 2026-09-28  
**Status:** kontrak frontend/mock; backend-agnostic  
**Bahasa payload display:** Indonesia  
**Target:** Vite + React JavaScript + shadcn/ui

> Kontrak ini adalah batas stabil antara UI dan data. Komponen React hanya memanggil `api` melalui adapter dengan method dan return shape di dokumen ini. `mockApi` dan `httpApi` wajib memenuhi kontrak yang sama sehingga pergantian adapter tidak mengubah komponen, route, state UI, atau mapper view-model.

---

## 1. Prinsip dan batas scope

1. Satu `application` mewakili tepat satu bank dan satu program (`bank_product_id`).
2. `primary` mencakup rumah baru dan rumah bekas; tidak ada enum, endpoint, fixture, atau flow `secondary`.
3. Setup KPR yang sudah berjalan membuat `mortgage`, bukan `application`.
4. Simulasi tidak membuat `application` sampai user menekan **Ajukan Sekarang**.
5. Angka simulasi, eligibility, nilai properti, bunga floating, dan health score adalah estimasi, bukan approval/appraisal/skor kredit.
6. Pembayaran MVP dicatat manual dan tidak diklaim tersinkron dengan bank.
7. Jadwal amortisasi dihitung dari input; bukan daftar row yang dianggap persisted.
8. Kontrak tidak menentukan database, auth vendor, storage, notification provider, atau bank integration.
9. Nilai yang tidak ada memakai `null`; field yang dijanjikan kontrak tidak dihilangkan. Array kosong memakai `[]`.
10. Nama field JSON memakai `snake_case`; enum memakai lowercase `snake_case`.

### 1.1 Base path dan media type

```text
Base path HTTP: /api/v1
Content-Type: application/json
Accept: application/json
Timezone default fixture: Asia/Jakarta
```

Upload binary sengaja di luar payload JSON. API hanya mengurus metadata/intensi upload dan konfirmasi hasil upload. Implementasi mock dapat mensimulasikan upload tanpa object storage.

---

## 2. Adapter boundary (wajib)

Komponen tidak boleh memanggil `fetch`, membaca status HTTP, mengakses fixture, atau menambahkan delay sendiri.

```js
// src/lib/api/index.js
export const api = import.meta.env.VITE_API_MODE === 'http' ? httpApi : mockApi

// Kedua adapter:
// - menerima object argumen yang sama
// - resolve ke `data` domain yang sama
// - throw ApiError yang sama
// - mendukung AbortSignal
// - tidak mengembalikan Response/fetch internals
```

Interface minimum:

```js
api.auth.register(input, { signal })
api.auth.verifyOtp(input, { signal })
api.auth.resendOtp(input, { signal })
api.auth.getSession({ signal })
api.auth.logout({ signal })
api.profile.get({ signal })
api.profile.update(input, { signal })
api.applications.list(query, { signal })
api.applications.create(input, { signal })
api.applications.get(id, { signal })
api.applications.saveStep(id, input, { signal })
api.applications.submit(id, input, { signal })
api.applications.cancel(id, input, { signal })
api.applications.retry(id, input, { signal })
api.applications.cloneToBank(id, input, { signal })
api.documents.list(owner, { signal })
api.documents.createUpload(input, { signal })
api.documents.completeUpload(id, input, { signal })
api.documents.replace(id, input, { signal })
api.bankProducts.list(query, { signal })
api.bankProducts.get(id, { signal })
api.bankProducts.compare(input, { signal })
api.mortgages.createSetup(input, { signal })
api.mortgages.get(id, { signal })
api.mortgages.saveSetupStep(id, input, { signal })
api.mortgages.activate(id, input, { signal })
api.mortgages.update(id, input, { signal })
api.ratePeriods.replace(mortgageId, input, { signal })
api.properties.get(mortgageId, { signal })
api.properties.update(mortgageId, input, { signal })
api.finance.get({ signal })
api.finance.update(input, { signal })
api.reminders.get(mortgageId, { signal })
api.reminders.update(mortgageId, input, { signal })
api.payments.list(mortgageId, query, { signal })
api.payments.markPaid(mortgageId, input, { signal })
api.amortization.get(mortgageId, query, { signal })
api.explore.get({ signal })
api.simulations.run(input, { signal })
api.simulations.save(input, { signal })
api.simulations.apply(simulationId, input, { signal })
api.activities.list(query, { signal })
api.activities.markRead(id, { signal })
```

`httpApi` membuka envelope dan melempar `ApiError`; `mockApi` menghasilkan hasil domain identik. Contoh normalizer tunggal:

```js
export class ApiError extends Error {
  constructor(error, meta = {}) {
    super(error.message)
    this.name = 'ApiError'
    this.code = error.code
    this.status = meta.status ?? 500
    this.details = error.details ?? null
    this.fieldErrors = error.field_errors ?? []
    this.requestId = meta.request_id ?? null
    this.retryable = Boolean(error.retryable)
  }
}

export function unwrap(envelope, status = 200) {
  if (!envelope.ok) throw new ApiError(envelope.error, { ...envelope.meta, status })
  return envelope.data
}
```

---

## 3. Konvensi tipe JSON

### 3.1 ID

ID opaque string; UI tidak mem-parsing prefix atau urutan.

| Entitas | Contoh |
|---|---|
| user | `usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE` |
| application | `app_01J8Z19RZ4VE4Q2AB7M5N8XKCF` |
| document | `doc_01J8Z1CK8MP3R7D5FQ2A9VTN6H` |
| bank/product | `bnk_abc`, `bpr_abc_primary_fix5_v3` |
| mortgage | `mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT` |
| rate period | `rtp_01J8Z20CN6HE8V3Y4M5F7K2QAW` |
| property | `pty_01J8Z24F6K3S9N2H5W7M4C8QVA` |
| payment | `pay_01J8Z28N4H2F6K7Q9M3C5VTWAE` |
| simulation | `sim_01J8Z2DR7A4M9K3F5Q6N2CVWHE` |
| activity | `act_01J8Z2H9W5R3K7M4F6Q2CNVTAE` |

Client-generated idempotency key adalah UUID/string opaque, contoh `idem_7cdbed0d-65bb-45de-8601-ae2cc74ae052`.

### 3.2 Timestamp, tanggal, dan zona waktu

- Timestamp: RFC 3339 UTC, contoh `2026-09-28T07:30:00.000Z`.
- Date-only: ISO `YYYY-MM-DD`, contoh `2026-12-22`; jangan diberi suffix zona waktu.
- Year-month: `YYYY-MM`.
- Zona waktu: IANA, contoh `Asia/Jakarta`.
- Due day: integer `1..31`; untuk bulan pendek jatuh pada hari terakhir bulan.
- Durasi tenor: integer bulan, bukan string tahun.

### 3.3 Money

Semua uang memakai minor unit integer agar aman dari binary float.

```json
{
  "amount": 425000000,
  "currency": "IDR",
  "scale": 2
}
```

Makna contoh: `425000000 / 10^2 = Rp4.250.000`. IDR tetap memakai `scale: 2` demi kontrak lintas currency. UI wajib format dari `amount`, `currency`, `scale`; tidak menerima string `"Rp4.250.000"` sebagai nilai domain.

### 3.4 Rate dan ratio

Rate disimpan sebagai integer basis points (`bps`).

```json
{
  "value_bps": 550,
  "display_percent": "5,50%",
  "is_estimate": false
}
```

`550 bps = 5,50%`. Ratio kalkulasi juga memakai bps: DTI `3833` = `38,33%`, LTV `4882` = `48,82%`. `display_percent` convenience field; keputusan/logika memakai `value_bps`.

### 3.5 Boolean, null, enum

- Boolean selalu `true/false`, tidak memakai `0/1`.
- Unknown/not supplied: `null`; zero tetap `0`.
- Enum yang tidak dikenal client harus dirender sebagai fallback aman, tidak menyebabkan crash.
- Field `is_estimate` wajib pada angka yang dapat disalahartikan sebagai angka resmi.

### 3.6 Version dan concurrency

Resource mutable mempunyai `version` integer. Update mengirim `expected_version`; mismatch menghasilkan `CONFLICT_VERSION`.

---

## 4. Envelope, pagination, dan request metadata

### 4.1 Success tunggal

```json
{
  "ok": true,
  "data": {
    "id": "usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE",
    "name": "Firdi Audi"
  },
  "meta": {
    "request_id": "req_01J8Z2Q8M4C7V5N3H6K9FWTADE",
    "server_time": "2026-09-28T07:30:00.000Z",
    "api_version": "v1"
  },
  "error": null
}
```

### 4.2 Success koleksi cursor-based

```json
{
  "ok": true,
  "data": {
    "items": [],
    "page": {
      "next_cursor": null,
      "previous_cursor": null,
      "has_more": false,
      "limit": 20,
      "total": 0
    }
  },
  "meta": {
    "request_id": "req_01J8Z2Q8M4C7V5N3H6K9FWTADE",
    "server_time": "2026-09-28T07:30:00.000Z",
    "api_version": "v1"
  },
  "error": null
}
```

Query: `?limit=20&cursor=opaque&sort=-created_at`. Default `limit=20`, maksimum `100`. `total` dapat `null` jika backend tidak menghitungnya; `has_more` dan cursor tetap otoritatif.

### 4.3 Error

```json
{
  "ok": false,
  "data": null,
  "meta": {
    "request_id": "req_01J8Z31A8M4C7V5N3H6K9FWTDE",
    "server_time": "2026-09-28T07:31:00.000Z",
    "api_version": "v1"
  },
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Periksa kembali data yang kamu isi.",
    "retryable": false,
    "details": null,
    "field_errors": [
      {
        "field": "loan.dp.amount",
        "code": "DP_EXCEEDS_PROPERTY_PRICE",
        "message": "Uang muka tidak boleh melebihi harga properti."
      }
    ]
  }
}
```

### 4.4 Header semantik HTTP

- `Authorization: Bearer <token>` hanya concern `httpApi`.
- `Idempotency-Key` wajib untuk create, submit, activate, mark-paid, simulation apply.
- `X-Request-Id` opsional dari client.
- `Accept-Language: id-ID`.
- GET tidak mempunyai side effect.
- DELETE sukses boleh `200` dengan body hasil, bukan `204`, agar adapter mock/HTTP seragam.

---

## 5. Katalog error

| HTTP | Code | Retry | Arti/UI |
|---:|---|:---:|---|
| 400 | `INVALID_JSON` | tidak | payload rusak |
| 400 | `VALIDATION_FAILED` | tidak | tampilkan field errors |
| 400 | `INVALID_STATE_TRANSITION` | tidak | refresh resource, tampilkan pesan |
| 400 | `RATE_PERIOD_GAP` | tidak | koreksi rentang bunga |
| 400 | `RATE_PERIOD_OVERLAP` | tidak | koreksi rentang bunga |
| 400 | `CALCULATION_INPUT_INCOMPLETE` | tidak | partial state + CTA lengkapi data |
| 400 | `CALCULATION_FAILED` | mungkin | koreksi input/retry |
| 400 | `PAYMENT_INSUFFICIENT_FOR_INTEREST` | tidak | input tidak valid |
| 401 | `AUTH_REQUIRED` | tidak | kembali ke auth |
| 401 | `SESSION_EXPIRED` | tidak | clear session, login ulang |
| 401 | `OTP_INVALID` | tidak | error inline |
| 401 | `OTP_EXPIRED` | tidak | tawarkan resend |
| 403 | `FORBIDDEN` | tidak | jangan bocorkan resource |
| 404 | `RESOURCE_NOT_FOUND` | tidak | empty/not-found |
| 409 | `CONFLICT_VERSION` | ya | refetch lalu minta user ulangi |
| 409 | `ACTIVE_DRAFT_EXISTS` | tidak | arahkan resume/hapus draft |
| 409 | `APPLICATION_ALREADY_SUBMITTED` | tidak | buka tracker |
| 409 | `DUPLICATE_PAYMENT_RECORD` | tidak | refetch payment |
| 410 | `BANK_PRODUCT_EXPIRED` | tidak | kembali compare |
| 413 | `FILE_TOO_LARGE` | tidak | pilih file ≤ batas |
| 415 | `FILE_TYPE_UNSUPPORTED` | tidak | JPG/PNG/PDF |
| 422 | `DOCUMENTS_INCOMPLETE` | tidak | buka dokumen wajib |
| 422 | `CONSENT_REQUIRED` | tidak | checkbox consent |
| 422 | `OFFICIAL_OUTSTANDING_REQUIRED` | tidak | payment pernah berubah |
| 422 | `NO_ELIGIBLE_PRODUCTS` | tidak | no-match state; izinkan edit input |
| 429 | `RATE_LIMITED` | ya | hormati `retry_after_seconds` |
| 500 | `INTERNAL_ERROR` | ya | generic error + retry |
| 503 | `SERVICE_UNAVAILABLE` | ya | retry/backoff |
| 503 | `PRODUCT_CATALOG_UNAVAILABLE` | ya | jangan fabricate program |

Error upload tambahan: `UPLOAD_EXPIRED`, `UPLOAD_CHECKSUM_MISMATCH`, `FILE_SCAN_FAILED`. Error finansial tambahan: `BREAK_EVEN_NOT_REACHED`, `STALE_PRODUCT_DATA`, `AMORTIZATION_UNAVAILABLE`.

---

## 6. Endpoint index

| Method | Path | Adapter method |
|---|---|---|
| POST | `/auth/register` | `auth.register` |
| POST | `/auth/verify-otp` | `auth.verifyOtp` |
| POST | `/auth/resend-otp` | `auth.resendOtp` |
| GET | `/auth/session` | `auth.getSession` |
| POST | `/auth/logout` | `auth.logout` |
| GET/PATCH | `/profile` | `profile.get/update` |
| GET/POST | `/applications` | `applications.list/create` |
| GET | `/applications/{id}` | `applications.get` |
| PATCH | `/applications/{id}/steps/{step}` | `applications.saveStep` |
| POST | `/applications/{id}/submit` | `applications.submit` |
| DELETE | `/applications/{id}` | `applications.cancel` |
| POST | `/applications/{id}/retry` | `applications.retry` |
| POST | `/applications/{id}/clone-to-bank` | `applications.cloneToBank` |
| GET | `/documents` | `documents.list` |
| POST | `/documents/uploads` | `documents.createUpload` |
| POST | `/documents/{id}/complete` | `documents.completeUpload` |
| POST | `/documents/{id}/replace` | `documents.replace` |
| GET | `/bank-products` | `bankProducts.list` |
| GET | `/bank-products/{id}` | `bankProducts.get` |
| POST | `/bank-products/compare` | `bankProducts.compare` |
| POST | `/mortgages` | `mortgages.createSetup` |
| GET/PATCH | `/mortgages/{id}` | `mortgages.get/update` |
| PATCH | `/mortgages/{id}/setup/{step}` | `mortgages.saveSetupStep` |
| POST | `/mortgages/{id}/activate` | `mortgages.activate` |
| PUT | `/mortgages/{id}/rate-periods` | `ratePeriods.replace` |
| GET/PATCH | `/mortgages/{id}/property` | `properties.get/update` |
| GET/PATCH | `/finance-profile` | `finance.get/update` |
| GET/PUT | `/mortgages/{id}/reminders` | `reminders.get/update` |
| GET | `/mortgages/{id}/payments` | `payments.list` |
| POST | `/mortgages/{id}/payments/mark-paid` | `payments.markPaid` |
| GET | `/mortgages/{id}/amortization` | `amortization.get` |
| GET | `/explore` | `explore.get` |
| POST | `/simulations` | `simulations.run` |
| POST | `/simulations/{id}/save` | `simulations.save` |
| POST | `/simulations/{id}/apply` | `simulations.apply` |
| GET | `/activities` | `activities.list` |
| POST | `/activities/{id}/read` | `activities.markRead` |
| GET | `/admin/users` | `admin.users.list` (khusus `super_admin`; endpoint admin lain di §28) |

---

## 7. Auth mock

### 7.1 Register

`POST /auth/register`

Request:

```json
{
  "name": "Firdi Audi",
  "contact": { "type": "phone", "value": "+6281234567890" },
  "consents": [
    { "type": "terms", "version": "2026-09-01", "accepted": true },
    { "type": "privacy", "version": "2026-09-01", "accepted": true }
  ]
}
```

Response `201` data:

```json
{
  "verification_id": "ver_01J8Z3BK5M7N2Q4C9V6FWAHTDE",
  "masked_destination": "+62 812 **** 7890",
  "expires_at": "2026-09-28T07:35:00.000Z",
  "resend_available_at": "2026-09-28T07:31:00.000Z",
  "attempts_remaining": 5
}
```

### 7.2 Verify OTP

`POST /auth/verify-otp`

```json
{
  "verification_id": "ver_01J8Z3BK5M7N2Q4C9V6FWAHTDE",
  "otp": "148260"
}
```

Response data:

```json
{
  "session": {
    "access_token": "mock_access_token",
    "expires_at": "2026-09-28T15:30:00.000Z"
  },
  "user": {
    "id": "usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE",
    "name": "Firdi Audi",
    "auth_status": "verified",
    "timezone": "Asia/Jakarta"
  },
  "next_route": "/home"
}
```

Mock OTP fixture: `148260` sukses, `000000` → `OTP_INVALID`, `999999` → `OTP_EXPIRED`. Ini hanya mock dan tidak boleh dibawa sebagai bypass production.

### 7.3 Session/logout

`GET /auth/session` mengembalikan `{ "authenticated": true, "role": "user", "user": {...} }`. `role` melekat pada akun (`user | super_admin`) dan bernilai `null` bila belum login (§28.1).  
`POST /auth/logout` mengembalikan `{ "logged_out": true }` dan mock menghapus session state.

---

## 8. Profile

### 8.1 GET `/profile`

```json
{
  "id": "prf_01J8Z3M8K2N6V5Q9F4C7WATDHE",
  "user_id": "usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE",
  "full_name": "Firdi Audi",
  "nik_masked": "3174********1234",
  "birth_place": "Bekasi",
  "birth_date": "1994-08-12",
  "gender": "male",
  "marital_status": "single",
  "phone": "+6281234567890",
  "phone_verified": true,
  "email": "firdi@example.com",
  "email_verified": true,
  "identity_address": {
    "line1": "Jl. Melati No. 12",
    "city": "Kota Bekasi",
    "province": "Jawa Barat",
    "postal_code": "17100"
  },
  "employment": {
    "type": "private_employee",
    "company_name": "PT Nusantara Digital",
    "job_title": "Software Engineer",
    "duration_months": 54
  },
  "joint_income_enabled": false,
  "consents": [
    { "type": "privacy", "version": "2026-09-01", "accepted_at": "2026-09-28T07:30:00.000Z" }
  ],
  "version": 3,
  "updated_at": "2026-09-28T07:30:00.000Z"
}
```

### 8.2 PATCH `/profile`

Request hanya mutable field, tetapi response selalu resource penuh.

```json
{
  "expected_version": 3,
  "email": "firdi.audi@example.com",
  "employment": {
    "type": "private_employee",
    "company_name": "PT Nusantara Digital",
    "job_title": "Senior Software Engineer",
    "duration_months": 55
  }
}
```

---

## 9. Applications

### 9.1 Enum dan state transition

`product_type`: `primary | takeover | refinancing | multiguna`.

```text
draft
  → submitted
  → docs_verification
  ↔ additional_docs_requested
  → bank_processing
  → appraisal
  → approved
  → akad
  → disbursed
```

Cabang terminal: `bank_processing|appraisal → rejected`. Takeover: `approved → old_mortgage_settlement → akad → disbursed`.

Rules:

- `draft` editable dan dapat hard delete.
- Setelah `submitted`, snapshot field/program read-only; hanya dokumen `needs_update` dapat diganti.
- `rejected → draft` hanya melalui retry pada row sama.
- Clone bank lain membuat row baru `draft`; row rejected lama tidak berubah.
- Cancel pre-akad mock melakukan hard delete. Production wajib validasi retention/compliance.
- `disbursed` otomatis membuat/mengaktifkan mortgage dari angka akad final, bukan simulasi.

### 9.2 Create draft

`POST /applications`

```json
{
  "product_type": "primary",
  "purchase_type": "new_from_developer",
  "source": "home_product_card"
}
```

Response `201`:

```json
{
  "id": "app_01J8Z19RZ4VE4Q2AB7M5N8XKCF",
  "user_id": "usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE",
  "product_type": "primary",
  "purchase_type": "new_from_developer",
  "status": "draft",
  "current_step": "product",
  "step_number": 1,
  "step_count": 5,
  "bank_id": null,
  "bank_product_id": null,
  "available_actions": ["save_step", "cancel"],
  "version": 1,
  "created_at": "2026-09-28T08:00:00.000Z",
  "updated_at": "2026-09-28T08:00:00.000Z"
}
```

### 9.3 Save Primary step

`PATCH /applications/{id}/steps/details`

```json
{
  "expected_version": 1,
  "personal": {
    "full_name": "Firdi Audi",
    "birth_place": "Bekasi",
    "birth_date": "1994-08-12",
    "gender": "male",
    "marital_status": "single"
  },
  "property": {
    "purchase_type": "new_from_developer",
    "property_type": "landed_house",
    "developer_name": "PT Griya Asri",
    "seller_name": null,
    "address": { "line1": "Griya Asri Blok C2", "city": "Kota Bekasi", "province": "Jawa Barat" },
    "price": { "amount": 75000000000, "currency": "IDR", "scale": 2 }
  },
  "loan": {
    "down_payment": { "amount": 15000000000, "currency": "IDR", "scale": 2 },
    "requested_amount": { "amount": 60000000000, "currency": "IDR", "scale": 2 },
    "tenor_months": 240
  },
  "employment": {
    "type": "private_employee",
    "company_name": "PT Nusantara Digital",
    "job_title": "Software Engineer",
    "duration_months": 54,
    "monthly_gross_income": { "amount": 1500000000, "currency": "IDR", "scale": 2 }
  },
  "debts": {
    "vehicle": { "amount": 100000000, "currency": "IDR", "scale": 2 },
    "credit_card_paylater": { "amount": 50000000, "currency": "IDR", "scale": 2 },
    "other": { "amount": 0, "currency": "IDR", "scale": 2 }
  },
  "next_step": "documents"
}
```

Response memuat application penuh, `current_step: "documents"`, `step_number: 3`, `version: 2`, plus:

```json
{
  "capacity": {
    "policy_ratio_bps": 3500,
    "safe_payment": { "amount": 525000000, "currency": "IDR", "scale": 2 },
    "existing_debt": { "amount": 150000000, "currency": "IDR", "scale": 2 },
    "remaining_capacity": { "amount": 375000000, "currency": "IDR", "scale": 2 },
    "is_estimate": true,
    "disclaimer": "Ini estimasi panduan, bukan keputusan kelayakan bank."
  }
}
```

Untuk rumah bekas gunakan `purchase_type: "used_from_owner"`, `developer_name: null`, dan `seller_name` opsional.

### 9.4 Application detail/tracker

`GET /applications/{id}`

```json
{
  "id": "app_01J8Z19RZ4VE4Q2AB7M5N8XKCF",
  "product_type": "primary",
  "status": "bank_processing",
  "current_step": "completed",
  "step_number": 5,
  "step_count": 5,
  "bank": { "id": "bnk_xyz", "name": "Bank XYZ" },
  "bank_product": { "id": "bpr_xyz_primary_fix5_v3", "name": "KPR Fixed 5 Tahun", "version": 3 },
  "loan_snapshot": {
    "amount": { "amount": 60000000000, "currency": "IDR", "scale": 2 },
    "tenor_months": 240,
    "estimated_payment": { "amount": 412000000, "currency": "IDR", "scale": 2 }
  },
  "tracker": [
    { "status": "submitted", "label": "Diajukan", "state": "completed", "at": "2026-09-28T09:00:00.000Z" },
    { "status": "docs_verification", "label": "Verifikasi Dokumen", "state": "completed", "at": "2026-09-30T03:00:00.000Z" },
    { "status": "bank_processing", "label": "Proses Bank", "state": "current", "at": "2026-10-01T02:00:00.000Z" },
    { "status": "appraisal", "label": "Appraisal", "state": "upcoming", "at": null },
    { "status": "approved", "label": "Disetujui", "state": "upcoming", "at": null },
    { "status": "akad", "label": "Akad", "state": "upcoming", "at": null },
    { "status": "disbursed", "label": "Selesai", "state": "upcoming", "at": null }
  ],
  "pending_actions": [],
  "rejection": null,
  "submitted_at": "2026-09-28T09:00:00.000Z",
  "available_actions": ["contact_support", "cancel"],
  "version": 8,
  "updated_at": "2026-10-01T02:00:00.000Z"
}
```

### 9.5 Submit

`POST /applications/{id}/submit`

```json
{
  "expected_version": 6,
  "bank_product_id": "bpr_xyz_primary_fix5_v3",
  "consents": [
    { "type": "data_accuracy", "version": "2026-09-01", "accepted": true },
    { "type": "send_to_selected_bank", "version": "2026-09-01", "accepted": true }
  ]
}
```

Response status `submitted`; snapshot bank product, profile, property, finance, calculation version, assumptions, dan consent menjadi immutable.

### 9.6 Rejected recovery

Rejected fragment:

```json
{
  "status": "rejected",
  "rejection": {
    "code": "DTI_ABOVE_BANK_POLICY",
    "display_reason": "Rasio cicilan melebihi batas bank.",
    "relevant_fields": ["loan.down_payment", "loan.tenor_months", "finance.monthly_income"],
    "rejected_at": "2026-10-08T04:00:00.000Z"
  },
  "available_actions": ["clone_to_bank", "retry_same_bank"]
}
```

Retry same bank:

```json
{
  "action": "retry_same_bank",
  "return_to_step": "details",
  "expected_version": 9
}
```

Clone:

```json
{
  "bank_product_id": "bpr_abc_primary_fix5_v4",
  "reuse_valid_documents": true
}
```

Response clone memuat `{ "application": {...new draft...}, "reused_document_ids": [...], "required_replacements": [...] }`.

---

## 10. Document upload metadata

### 10.1 State

```text
pending → uploading → uploaded → verified
                     ↘ error
uploaded|verified → needs_update → uploading → uploaded
```

`uploading` boleh menjadi UI-local sebelum complete. Server resource memakai `pending_upload | uploaded | scanning | verified | needs_update | error`.

### 10.2 Create upload intent

`POST /documents/uploads`

```json
{
  "owner": { "type": "application", "id": "app_01J8Z19RZ4VE4Q2AB7M5N8XKCF" },
  "document_type": "ktp",
  "file": {
    "name": "ktp-firdi.jpg",
    "size_bytes": 842115,
    "content_type": "image/jpeg",
    "sha256": "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce"
  }
}
```

Mock response:

```json
{
  "document": {
    "id": "doc_01J8Z1CK8MP3R7D5FQ2A9VTN6H",
    "owner": { "type": "application", "id": "app_01J8Z19RZ4VE4Q2AB7M5N8XKCF" },
    "document_type": "ktp",
    "status": "pending_upload",
    "version_number": 1,
    "required": true,
    "file": { "name": "ktp-firdi.jpg", "size_bytes": 842115, "content_type": "image/jpeg" },
    "invalid_reason": null,
    "uploaded_at": null
  },
  "upload": {
    "method": "PUT",
    "url": "mock://uploads/doc_01J8Z1CK8MP3R7D5FQ2A9VTN6H",
    "headers": { "Content-Type": "image/jpeg" },
    "expires_at": "2026-09-28T08:20:00.000Z"
  }
}
```

HTTP adapter boleh mendapat signed URL asli; mock adapter menerima `mock://` melalui transport mock internal. Komponen tetap memanggil helper upload adapter, bukan melakukan PUT sendiri.

### 10.3 Complete

`POST /documents/{id}/complete`

```json
{
  "upload_token": "mock-upload-ok",
  "sha256": "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce"
}
```

Response document `status: "uploaded"`, `uploaded_at` terisi. Preview memakai endpoint/field short-lived yang hanya diminta saat dibutuhkan; jangan simpan public URL.

Document types minimum: `ktp`, `npwp`, `income_proof`, `property_document`, `additional`, `family_card`, `marriage_document`, `bank_statement`, `old_loan_agreement`, `outstanding_letter`, `latest_payment_proof`, `certificate`, `building_permit`, `land_tax`, `sale_purchase_agreement`.

---

## 11. Bank products dan compare

### 11.1 Product resource

```json
{
  "id": "bpr_xyz_primary_fix5_v3",
  "version": 3,
  "bank": { "id": "bnk_xyz", "name": "Bank XYZ", "logo_url": "/fixtures/banks/xyz.svg" },
  "name": "KPR Fixed 5 Tahun",
  "product_types": ["primary", "takeover"],
  "scheme": "conventional",
  "active": true,
  "effective_from": "2026-09-01",
  "effective_until": "2026-12-31",
  "last_verified_at": "2026-09-27T05:00:00.000Z",
  "stale": false,
  "eligibility": {
    "minimum_income": { "amount": 800000000, "currency": "IDR", "scale": 2 },
    "maximum_dti_bps": 4000,
    "minimum_age": 21,
    "maximum_age_at_maturity": 60,
    "occupations": ["private_employee", "civil_servant", "entrepreneur"],
    "property_types": ["landed_house", "apartment"],
    "maximum_ltv_bps": 8000
  },
  "rate_periods": [
    { "sequence": 1, "type": "fixed", "duration_months": 60, "rate": { "value_bps": 650, "display_percent": "6,50%", "is_estimate": false } },
    { "sequence": 2, "type": "floating", "duration_months": null, "rate": { "value_bps": 900, "display_percent": "9,00%", "is_estimate": true } }
  ],
  "fees": [
    { "type": "provision", "calculation": "percentage", "rate_bps": 100, "amount": null, "is_estimate": false },
    { "type": "admin", "calculation": "fixed", "rate_bps": null, "amount": { "amount": 100000000, "currency": "IDR", "scale": 2 }, "is_estimate": false }
  ],
  "source": { "label": "Katalog produk terverifikasi", "reference": "internal-policy-v3" }
}
```

### 11.2 Compare request

`POST /bank-products/compare`

```json
{
  "product_type": "primary",
  "loan": {
    "amount": { "amount": 60000000000, "currency": "IDR", "scale": 2 },
    "tenor_months": 240,
    "property_price": { "amount": 75000000000, "currency": "IDR", "scale": 2 }
  },
  "applicant": {
    "birth_date": "1994-08-12",
    "occupation": "private_employee",
    "monthly_income": { "amount": 1500000000, "currency": "IDR", "scale": 2 },
    "monthly_debts": { "amount": 150000000, "currency": "IDR", "scale": 2 }
  },
  "property": { "type": "landed_house", "purchase_type": "new_from_developer" },
  "sort": "total_cost_asc"
}
```

Response:

```json
{
  "comparison_id": "cmp_01J8Z4M7H2C6V9N5Q3K8FWTADE",
  "as_of": "2026-09-28T08:30:00.000Z",
  "calculation_version": "calc-1.0.0",
  "capacity": {
    "safe_payment": { "amount": 525000000, "currency": "IDR", "scale": 2 },
    "remaining_capacity": { "amount": 375000000, "currency": "IDR", "scale": 2 }
  },
  "items": [
    {
      "bank_product_id": "bpr_xyz_primary_fix5_v3",
      "eligibility": { "status": "estimated_eligible", "reasons": [] },
      "recommended": true,
      "recommendation_reason": "Biaya total terendah di antara program yang diperkirakan sesuai.",
      "estimated_payment": { "amount": 447355521, "currency": "IDR", "scale": 2 },
      "payment_within_capacity": false,
      "fixed_rate": { "value_bps": 650, "display_percent": "6,50%", "is_estimate": false },
      "fixed_months": 60,
      "floating_rate": { "value_bps": 900, "display_percent": "9,00%", "is_estimate": true },
      "total_fees": { "amount": 750000000, "currency": "IDR", "scale": 2 },
      "total_interest": { "amount": 46722014520, "currency": "IDR", "scale": 2 },
      "total_payment": { "amount": 106722014520, "currency": "IDR", "scale": 2 },
      "assumptions": ["Bunga floating adalah estimasi", "Approval mengikuti analisis bank"]
    }
  ],
  "disclaimer": "Hasil adalah estimasi dan bukan persetujuan kredit."
}
```

Program melebihi kapasitas tetap muncul dengan warning. Produk expired tidak muncul dan draft yang memilihnya mendapat `BANK_PRODUCT_EXPIRED` saat submit.

---

## 12. Mortgage setup dan active

### 12.1 State

```text
draft → active → closed
active → replaced (khusus selesai Take Over)
```

Setup tepat 6 step: `mortgage`, `rate`, `property`, `finance`, `reminders`, `review`. Aktivasi tidak membuat application.

### 12.2 Create setup

`POST /mortgages`

```json
{ "mode": "monitor_existing", "source": "home_monitor_cta" }
```

Response: mortgage `status: "draft"`, `setup_step: "mortgage"`, `setup_step_number: 1`, `setup_step_count: 6`.

### 12.3 Save basic data

`PATCH /mortgages/{id}/setup/mortgage`

```json
{
  "expected_version": 1,
  "bank": { "id": "bnk_abc", "name": "Bank ABC" },
  "product_name": "KPR Fixed 5 Tahun",
  "scheme": "conventional",
  "original_principal": { "amount": 60000000000, "currency": "IDR", "scale": 2 },
  "current_payment": { "amount": 425000000, "currency": "IDR", "scale": 2 },
  "original_tenor_months": 240,
  "start_date": "2021-07-22",
  "due_day": 22,
  "knows_outstanding": true,
  "outstanding_principal": { "amount": 41500000000, "currency": "IDR", "scale": 2 },
  "remaining_tenor_months": 183
}
```

### 12.4 Rate branch

Belum pernah berubah:

```json
{
  "expected_version": 2,
  "payment_ever_changed": false,
  "current_rate": { "value_bps": 550, "display_percent": "5,50%", "is_estimate": false },
  "current_rate_type": "fixed",
  "fixed_until": "2026-12-22",
  "estimated_floating_rate": { "value_bps": 900, "display_percent": "9,00%", "is_estimate": true }
}
```

Jika `payment_ever_changed: true`, `outstanding_principal`, `remaining_tenor_months`, `current_payment`, dan current rate resmi wajib. Server tidak boleh solve satu rate; jika kosong → `OFFICIAL_OUTSTANDING_REQUIRED`.

### 12.5 Activate

`POST /mortgages/{id}/activate`

```json
{
  "expected_version": 6,
  "confirm_data_correct": true
}
```

Response:

```json
{
  "mortgage": {
    "id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT",
    "status": "active",
    "setup_step": "completed",
    "bank": { "id": "bnk_abc", "name": "Bank ABC" },
    "product_name": "KPR Fixed 5 Tahun",
    "scheme": "conventional",
    "original_principal": { "amount": 60000000000, "currency": "IDR", "scale": 2 },
    "outstanding_principal": { "amount": 41500000000, "currency": "IDR", "scale": 2 },
    "current_payment": { "amount": 425000000, "currency": "IDR", "scale": 2 },
    "original_tenor_months": 240,
    "remaining_tenor_months": 183,
    "start_date": "2021-07-22",
    "estimated_end_date": "2041-12-22",
    "due_day": 22,
    "current_rate": { "value_bps": 550, "display_percent": "5,50%", "is_estimate": false },
    "current_rate_type": "fixed",
    "fixed_until": "2026-12-22",
    "data_completeness": { "status": "complete", "missing_fields": [] },
    "version": 7,
    "activated_at": "2026-09-28T09:30:00.000Z"
  },
  "scheduled_reminder_count": 8,
  "application_created": false
}
```

---

## 13. Rate periods

`PUT /mortgages/{id}/rate-periods` mengganti seluruh koleksi secara atomik.

```json
{
  "expected_mortgage_version": 7,
  "items": [
    {
      "sequence": 1,
      "type": "fixed",
      "start_date": "2021-07-22",
      "end_date": "2024-07-21",
      "rate": { "value_bps": 500, "display_percent": "5,00%", "is_estimate": false }
    },
    {
      "sequence": 2,
      "type": "fixed",
      "start_date": "2024-07-22",
      "end_date": "2026-12-22",
      "rate": { "value_bps": 550, "display_percent": "5,50%", "is_estimate": false }
    },
    {
      "sequence": 3,
      "type": "floating",
      "start_date": "2026-12-23",
      "end_date": null,
      "rate": { "value_bps": 900, "display_percent": "9,00%", "is_estimate": true }
    }
  ]
}
```

Validasi: sequence unik/berurutan, rate positif, tidak overlap, gap tidak diizinkan untuk jadwal penuh, end inklusif, periode open-ended hanya terakhir. Response menambahkan ID period dan `coverage: "full" | "partial"`.

---

## 14. Property

`PATCH /mortgages/{id}/property`

```json
{
  "expected_version": 2,
  "type": "landed_house",
  "address": { "line1": "Griya Asri Blok C2", "city": "Kota Bekasi", "province": "Jawa Barat" },
  "land_area_sqm": 72,
  "building_area_sqm": 45,
  "certificate_type": "shm",
  "certificate_owner": "Firdi Audi",
  "estimated_value": { "amount": 85000000000, "currency": "IDR", "scale": 2 },
  "value_as_of": "2026-09-28",
  "disputed": false
}
```

Response computed:

```json
{
  "id": "pty_01J8Z24F6K3S9N2H5W7M4C8QVA",
  "mortgage_id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT",
  "type": "landed_house",
  "estimated_value": { "amount": 85000000000, "currency": "IDR", "scale": 2 },
  "value_as_of": "2026-09-28",
  "outstanding_principal": { "amount": 41500000000, "currency": "IDR", "scale": 2 },
  "estimated_equity": { "amount": 43500000000, "currency": "IDR", "scale": 2 },
  "ltv_bps": 4882,
  "is_official_appraisal": false,
  "disclaimers": ["Nilai properti bukan appraisal resmi.", "Equity bukan otomatis dana tunai."],
  "version": 3,
  "updated_at": "2026-09-28T09:20:00.000Z"
}
```

Jika value null, equity dan LTV null; reminder tetap berfungsi.

---

## 15. Finance profile

`PATCH /finance-profile`

```json
{
  "expected_version": 2,
  "monthly_income": { "amount": 1500000000, "currency": "IDR", "scale": 2 },
  "joint_income_enabled": false,
  "partner_monthly_income": null,
  "debts": {
    "mortgage": { "amount": 425000000, "currency": "IDR", "scale": 2 },
    "vehicle": { "amount": 100000000, "currency": "IDR", "scale": 2 },
    "credit_card_paylater": { "amount": 50000000, "currency": "IDR", "scale": 2 },
    "other": { "amount": 0, "currency": "IDR", "scale": 2 }
  },
  "routine_expenses": { "amount": 500000000, "currency": "IDR", "scale": 2 },
  "emergency_fund": { "amount": 3000000000, "currency": "IDR", "scale": 2 }
}
```

Response computed `total_monthly_debt` Rp5.750.000, `dti_bps: 3833`, `dti_label: "needs_attention"`, dan disclaimer bukan keputusan bank. Zero/negative income menghasilkan `VALIDATION_FAILED` dan DTI tidak dihitung.

---

## 16. Reminders

`PUT /mortgages/{id}/reminders`

```json
{
  "expected_version": 1,
  "enabled": true,
  "payment_offsets_days": [7, 3, 1],
  "fixed_expiry_offsets_days": [90, 60, 30, 14, 7],
  "channels": {
    "in_app": true,
    "email": true,
    "whatsapp": false
  },
  "timezone": "Asia/Jakarta",
  "preferred_hour": 9
}
```

Response:

```json
{
  "mortgage_id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT",
  "enabled": true,
  "payment_offsets_days": [7, 3, 1],
  "fixed_expiry_offsets_days": [90, 60, 30, 14, 7],
  "channels": { "in_app": true, "email": true, "whatsapp": false },
  "channel_availability": {
    "in_app": { "available": true, "reason": null },
    "email": { "available": true, "reason": null },
    "whatsapp": { "available": false, "reason": "coming_soon" }
  },
  "next_scheduled": [
    {
      "type": "payment_due",
      "milestone": "h_7",
      "scheduled_at": "2026-10-15T02:00:00.000Z",
      "dedupe_key": "payment:mtg_01J8:2026-10:h_7:in_app"
    }
  ],
  "version": 2
}
```

Scheduler dedupe per mortgage+event+milestone+channel. Mortgage `closed/replaced`, preference disabled, atau fixed date lewat membatalkan reminder masa depan yang tidak relevan.

---

## 17. Payments

### 17.1 List

`GET /mortgages/{id}/payments?from=2026-09-01&to=2026-11-30`

```json
{
  "items": [
    {
      "id": "pay_01J8Z28N4H2F6K7Q9M3C5VTWAE",
      "mortgage_id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT",
      "due_date": "2026-09-22",
      "amount": { "amount": 425000000, "currency": "IDR", "scale": 2 },
      "status": "paid",
      "paid_at": "2026-09-21T03:12:00.000Z",
      "source": "manual_user_recorded",
      "bank_confirmed": false
    },
    {
      "id": "pay_01J8Z5N4H2F6K7Q9M3C8VTWAE",
      "mortgage_id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT",
      "due_date": "2026-10-22",
      "amount": { "amount": 425000000, "currency": "IDR", "scale": 2 },
      "status": "upcoming",
      "paid_at": null,
      "source": "calculated_schedule",
      "bank_confirmed": false
    }
  ],
  "page": { "next_cursor": null, "previous_cursor": null, "has_more": false, "limit": 20, "total": 2 }
}
```

### 17.2 Mark paid

`POST /mortgages/{id}/payments/mark-paid`

```json
{
  "due_date": "2026-10-22",
  "amount": { "amount": 425000000, "currency": "IDR", "scale": 2 },
  "paid_at": "2026-10-21T03:12:00.000Z",
  "note": "Dicatat manual oleh pengguna",
  "proof": { "file_name": "bukti-transfer.pdf", "size_bytes": 120000, "content_type": "application/pdf" }
}
```

Status hasil `paid`, source `manual_user_recorded`, `bank_confirmed: false`. Idempotency mencegah duplikat. `proof` opsional (JPG/PNG/PDF, maks. 5MB; `FILE_TYPE_UNSUPPORTED` / `FILE_TOO_LARGE`); mock hanya menyimpan metadata, bukan isi file.

---

## 18. Amortization

`GET /mortgages/{id}/amortization?view=yearly` atau `view=monthly&year=2027`.

```json
{
  "mortgage_id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT",
  "source": "active_mortgage_outstanding",
  "generated_at": "2026-09-28T09:40:00.000Z",
  "calculation_version": "calc-1.0.0",
  "view": "yearly",
  "summary": {
    "period_start": "2026-10-22",
    "period_end": "2041-12-22",
    "remaining_tenor_months": 183,
    "method": "annuity",
    "opening_principal": { "amount": 41500000000, "currency": "IDR", "scale": 2 },
    "estimated_total_interest": { "amount": 34625017800, "currency": "IDR", "scale": 2 },
    "estimated_total_payment": { "amount": 76125017800, "currency": "IDR", "scale": 2 },
    "closing_balance": { "amount": 0, "currency": "IDR", "scale": 2 },
    "rounding_adjustment": { "amount": -37, "currency": "IDR", "scale": 2 }
  },
  "rate_assumptions": [
    { "type": "fixed", "rate_bps": 550, "until": "2026-12-22", "is_estimate": false },
    { "type": "floating", "rate_bps": 900, "from": "2026-12-23", "is_estimate": true }
  ],
  "rows": [
    {
      "period": "2027",
      "opening_balance": { "amount": 41131821100, "currency": "IDR", "scale": 2 },
      "payment": { "amount": 6059999996, "currency": "IDR", "scale": 2 },
      "principal": { "amount": 2400194500, "currency": "IDR", "scale": 2 },
      "interest": { "amount": 3659805496, "currency": "IDR", "scale": 2 },
      "closing_balance": { "amount": 38731626600, "currency": "IDR", "scale": 2 },
      "rate_min_bps": 900,
      "rate_max_bps": 900,
      "contains_rate_transition": false,
      "contains_estimate": true
    }
  ],
  "totals": {
    "payment": { "amount": 76125017800, "currency": "IDR", "scale": 2 },
    "principal": { "amount": 41500000000, "currency": "IDR", "scale": 2 },
    "interest": { "amount": 34625017800, "currency": "IDR", "scale": 2 }
  },
  "reconciliation": {
    "principal_matches_opening": true,
    "payment_equals_principal_plus_interest": true,
    "final_balance_zero": true,
    "tolerance_minor_units": 100
  },
  "disclaimer": "Proyeksi berdasarkan data KPR yang kamu masukkan. Bunga floating dan pembayaran aktual dapat berubah mengikuti kebijakan bank."
}
```

Monthly row menambah `payment_date`, `annual_rate_bps`, `opening_balance`, `payment`, `principal`, `interest`, `closing_balance`, `rate_type`, `is_estimate`, `transition_label`. Jika data kurang, error `AMORTIZATION_UNAVAILABLE` dengan `details.missing_fields` dan UI menampilkan partial state—tanpa jadwal palsu.

---

## 19. Explore dan simulations

### 19.1 Explore state

`GET /explore`

Tanpa mortgage aktif:

```json
{
  "has_active_mortgage": false,
  "products": [],
  "education": [
    { "id": "edu_fixed_floating", "title": "Fixed vs Floating", "summary": "Pahami kapan cicilan dapat berubah.", "href": "/learn/fixed-vs-floating" }
  ],
  "message": "Take Over, Refinancing, dan Multiguna aktif setelah KPR kamu aktif."
}
```

Dengan mortgage aktif:

```json
{
  "has_active_mortgage": true,
  "signals": { "floating": true, "opportunity": true, "days_until_fixed_end": 85, "cheaper_program_count": 3 },
  "products": [
    {
      "type": "takeover",
      "title": "Take Over",
      "order": 1,
      "badge": { "type": "warning_opportunity", "text": "Fixed berakhir 85 hari lagi · 3 program lebih murah ditemukan" },
      "enabled": true
    },
    { "type": "refinancing", "title": "Refinancing + Top-up", "order": 2, "badge": null, "enabled": true },
    { "type": "multiguna", "title": "Multiguna", "order": 3, "badge": null, "enabled": true }
  ],
  "education": []
}
```

### 19.2 Run simulation

`POST /simulations`

```json
{
  "source": { "type": "mortgage", "id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT" },
  "product_type": "takeover",
  "goal": "lower_monthly_payment",
  "requested_topup": { "amount": 0, "currency": "IDR", "scale": 2 },
  "desired_tenor_months": 180,
  "comfortable_payment_cap": { "amount": 450000000, "currency": "IDR", "scale": 2 }
}
```

Response:

```json
{
  "id": "sim_01J8Z2DR7A4M9K3F5Q6N2CVWHE",
  "status": "calculated",
  "product_type": "takeover",
  "baseline": {
    "bank_name": "Bank ABC",
    "outstanding": { "amount": 41500000000, "currency": "IDR", "scale": 2 },
    "current_rate_bps": 900,
    "current_payment": { "amount": 505000000, "currency": "IDR", "scale": 2 },
    "remaining_tenor_months": 183,
    "exit_cost": { "amount": 930000000, "currency": "IDR", "scale": 2 }
  },
  "results": [
    {
      "bank_product_id": "bpr_xyz_takeover_fix5_v3",
      "estimated_eligible": true,
      "new_principal": { "amount": 41500000000, "currency": "IDR", "scale": 2 },
      "new_payment": { "amount": 405000000, "currency": "IDR", "scale": 2 },
      "monthly_benefit": { "amount": 100000000, "currency": "IDR", "scale": 2 },
      "moving_cost": { "amount": 2099500000, "currency": "IDR", "scale": 2 },
      "break_even_months": 21,
      "break_even_status": "reached",
      "net_saving": { "amount": 3240000000, "currency": "IDR", "scale": 2 },
      "new_ltv_bps": 4882,
      "assumptions": ["Biaya dan floating adalah estimasi", "Tetap bayar bank lama sampai pelunasan resmi"]
    }
  ],
  "available_actions": ["save", "apply"],
  "created_at": "2026-09-28T10:00:00.000Z"
}
```

Top-up menggunakan `requested_topup.amount > 0` dan hasil wajib memuat `gross_topup`, `deducted_fees`, `net_cash_received`, `requested_amount_gap`, `new_ltv_bps`. Jika monthly benefit ≤ 0: `break_even_months: null`, `break_even_status: "not_reached"`.

### 19.3 Save versus apply

`POST /simulations/{id}/save`:

```json
{ "label": "Opsi Take Over September" }
```

Tidak membuat application. Jika history belum diaktifkan fixture, response dapat `{ "saved": false, "reason": "history_not_enabled" }` tanpa berpura-pura tersimpan.

`POST /simulations/{id}/apply`:

```json
{
  "bank_product_id": "bpr_xyz_takeover_fix5_v3",
  "confirm_single_bank": true
}
```

Response `201` membuat satu application draft prefilled, `current_step: "documents"` untuk existing mortgage yang datanya lengkap. Tidak mengubah mortgage aktif sebelum Take Over selesai.

---

## 20. Activity

`GET /activities?category=all&limit=20&cursor=...`

```json
{
  "items": [
    {
      "id": "act_01J8Z2H9W5R3K7M4F6Q2CNVTAE",
      "type": "payment_reminder_scheduled",
      "category": "reminder",
      "title": "Reminder pembayaran dijadwalkan",
      "body": "Kami akan mengingatkan pembayaran H-7 pada 15 Oktober 2026.",
      "entity": { "type": "mortgage", "id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT" },
      "occurred_at": "2026-09-28T09:30:00.000Z",
      "read_at": null,
      "action": { "label": "Lihat pembayaran", "route": "/mykpr/payment" }
    },
    {
      "id": "act_01J8Z6H9W5R3K7M4F6Q2CNVTAE",
      "type": "fixed_expiry_warning",
      "category": "warning",
      "title": "Fixed rate berakhir dalam 90 hari",
      "body": "Lihat estimasi dampak ke cicilan kamu.",
      "entity": { "type": "mortgage", "id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT" },
      "occurred_at": "2026-09-23T02:00:00.000Z",
      "read_at": "2026-09-23T03:00:00.000Z",
      "action": { "label": "Lihat dampak", "route": "/mykpr/rate" }
    }
  ],
  "page": { "next_cursor": null, "previous_cursor": null, "has_more": false, "limit": 20, "total": 2 }
}
```

Event types minimum: `application_submitted`, `application_status_changed`, `additional_document_requested`, `document_verified`, `document_needs_update`, `application_approved`, `application_rejected`, `mortgage_monitoring_activated`, `payment_reminder_scheduled`, `payment_marked_paid`, `fixed_expiry_warning`, `mortgage_data_updated`.

---

## 21. Aggregate home contract

Agar Home tidak merakit prioritas dari banyak request yang race, adapter boleh menyediakan aggregate `api.home.get()` yang memetakan `GET /home`. Shape stabil:

```json
{
  "state": "mortgage_active_warning",
  "priority_reason": "active_mortgage_fixed_expiry",
  "user": { "first_name": "Firdi" },
  "application": null,
  "mortgage": { "id": "mtg_01J8Z1Q6XWF7NE4M2A9K3D5PVT", "status": "active" },
  "cards": [
    {
      "type": "fixed_warning",
      "priority": 1,
      "data": {
        "days_until_fixed_end": 85,
        "current_rate_bps": 550,
        "estimated_floating_rate_bps": 900,
        "current_payment": { "amount": 425000000, "currency": "IDR", "scale": 2 },
        "estimated_payment": { "amount": 505000000, "currency": "IDR", "scale": 2 },
        "delta": { "amount": 80000000, "currency": "IDR", "scale": 2 }
      },
      "action": { "label": "Lihat Pilihan", "route": "/mykpr/rate" }
    }
  ],
  "generated_at": "2026-09-28T10:10:00.000Z"
}
```

Prioritas state: rejected action → application process → application draft → mortgage setup draft → active warning → active floating → active normal → fresh.

---

## 22. Fixtures dan skenario mock

Fixture disarankan satu file domain JSON, tanpa duplikasi response per layar. Mock handler membaca state dan membentuk response kontrak.

### 22.1 IDs dan clock deterministik

```json
{
  "clock": "2026-09-28T10:00:00.000Z",
  "timezone": "Asia/Jakarta",
  "latency_ms": 250,
  "seed": 28092026,
  "current_user_id": "usr_01J8Z0Y5MA6W2Q9T4P7K3R1CDE"
}
```

### 22.2 Named fixture scenarios

| Scenario | Data utama | Expected home state |
|---|---|---|
| `fresh` | verified user, no draft/mortgage | `fresh` |
| `application_primary_draft_step_2` | primary draft details | `application_draft` |
| `application_in_process` | bank_processing | `application_in_process` |
| `application_additional_docs` | needs action | `application_in_process` |
| `application_rejected_dti` | rejected + reason | `application_rejected` |
| `mortgage_setup_step_3` | draft setup | `mortgage_setup_draft` |
| `mortgage_active_normal` | fixed >90 days | `mortgage_active_normal` |
| `mortgage_active_h90` | fixed 85 days | `mortgage_active_warning` |
| `mortgage_active_floating` | current floating | `mortgage_active_floating` |
| `mortgage_partial_property` | no property value | `mortgage_active_partial` |
| `mortgage_partial_rate` | missing periods | amortization error |
| `takeover_positive` | positive monthly saving | simulation break-even |
| `takeover_no_break_even` | monthly benefit ≤0 | no positive break-even |
| `no_bank_matches` | no eligible programs | `NO_ELIGIBLE_PRODUCTS` |
| `stale_catalog` | product stale/expired | warning/error |
| `upload_failure` | token `mock-upload-fail` | upload retry |
| `otp_invalid` | OTP `000000` | inline error |
| `admin_ops` | login sebagai `super_admin`; Firdi (`bank_processing`) + user contoh di `accounts` | — (layar admin) |

Semua skenario menyertakan akun admin (`admin@ruangkpr.id`) dan delapan user contoh fiktif di `accounts` (§28.6).

### 22.3 Core fixture

```json
{
  "mortgage": {
    "bank_name": "Bank ABC",
    "product_name": "KPR Fixed 5 Tahun",
    "original_principal": { "amount": 60000000000, "currency": "IDR", "scale": 2 },
    "outstanding_principal": { "amount": 41500000000, "currency": "IDR", "scale": 2 },
    "current_payment": { "amount": 425000000, "currency": "IDR", "scale": 2 },
    "original_tenor_months": 240,
    "remaining_tenor_months": 183,
    "start_date": "2021-07-22",
    "due_day": 22,
    "current_rate_bps": 550,
    "fixed_until": "2026-12-22",
    "estimated_floating_rate_bps": 900,
    "estimated_floating_payment": { "amount": 505000000, "currency": "IDR", "scale": 2 }
  },
  "property": {
    "type": "landed_house",
    "address_label": "Griya Asri Blok C2, Bekasi",
    "land_area_sqm": 72,
    "building_area_sqm": 45,
    "certificate_type": "shm",
    "estimated_value": { "amount": 85000000000, "currency": "IDR", "scale": 2 }
  },
  "finance": {
    "monthly_income": { "amount": 1500000000, "currency": "IDR", "scale": 2 },
    "vehicle_debt": { "amount": 100000000, "currency": "IDR", "scale": 2 },
    "credit_debt": { "amount": 50000000, "currency": "IDR", "scale": 2 }
  }
}
```

### 22.4 Mock controls (development-only)

Mock adapter menerima config, bukan query production:

```js
createMockApi({
  scenario: 'mortgage_active_h90',
  latencyMs: 250,
  errorRate: 0,
  now: '2026-09-28T10:00:00.000Z'
})
```

Per-test override:

```js
mockApi.__control.failNext('documents.completeUpload', {
  code: 'FILE_SCAN_FAILED', status: 422
})
```

`__control` tidak termasuk public adapter dan tidak boleh diimport app runtime.

---

## 23. State-transition response dan audit rule

Setiap mutation yang mengubah status mengembalikan resource terkini serta transition:

```json
{
  "resource": { "id": "app_01J8Z19RZ4VE4Q2AB7M5N8XKCF", "status": "submitted", "version": 7 },
  "transition": {
    "from": "draft",
    "to": "submitted",
    "occurred_at": "2026-09-28T09:00:00.000Z",
    "actor": "user",
    "source": "mock_api",
    "idempotent_replay": false
  }
}
```

Aturan:

- Request idempotent yang diulang mengembalikan hasil sama dan `idempotent_replay: true`.
- Transition invalid tidak mengubah fixture state.
- Mutation sukses menambah activity relevan.
- Submit mengunci snapshot.
- Mortgage activation menjadwalkan reminder.
- Mark-paid memperbarui payment dan activity, bukan outstanding bank resmi.
- Disbursement application membuat mortgage berdasarkan final terms dalam satu operasi atomik konseptual.

---

## 24. Validation matrix penting

| Area | Rule |
|---|---|
| auth | nama min 3; contact valid; consent wajib; OTP 6 digit |
| primary | `loan_amount <= property_price - down_payment`; amount positif |
| tenor | 12–360 bulan kecuali policy produk lebih ketat |
| date | start/akad tidak di masa depan pada setup existing |
| due day | 1–31; clamp ke akhir bulan |
| outstanding | ≤ original principal kecuali top-up/special flag |
| changed payment | official current outstanding wajib; no reverse solve |
| rate periods | ordered, positive, no overlap; no gap untuk full schedule |
| property | value optional; jika null equity/LTV null |
| reminders | offset integer nonnegative; WhatsApp unavailable |
| uploads | JPG/PNG/PDF; default max 5 MiB; checksum required |
| submit | one bank product; required docs; current product; consent |
| top-up | new LTV terhadap policy; net cash = new loan − payoff − deducted fees |
| amortization | principal/payment/final balance reconciliation |

---

## 25. Contract tests minimum

Adapter compatibility dianggap lulus jika suite yang sama dijalankan terhadap `mockApi` dan `httpApi` test server:

1. Success envelope di-unwrap ke object domain identik.
2. Validation error menjadi `ApiError` identik (`code`, `fieldErrors`, `retryable`).
3. Abort menghasilkan cancellation yang tidak dirender sebagai business error.
4. Create/submit/mark-paid idempotent.
5. Application tidak dapat memilih lebih dari satu bank product.
6. Tidak ada enum `secondary` di request/response/fixture.
7. Mortgage activation tidak membuat application.
8. Simulation save tidak membuat application; apply membuat tepat satu draft.
9. Changed-payment mortgage menolak solve tanpa official outstanding.
10. Rate overlap/gap ditolak.
11. Amortization totals rekonsiliasi dalam toleransi dan final balance nol.
12. Missing rate/outstanding tidak menghasilkan row palsu.
13. Manual payment selalu `bank_confirmed: false`.
14. Product expired memaksa re-compare.
15. Cursor pagination tidak menduplikasi item.
16. Version conflict tidak menimpa perubahan baru.
17. Upload retry tidak menghapus field/form lain.
18. Home priority konsisten untuk setiap named scenario.
19. Endpoint admin menolak tanpa session (`AUTH_REQUIRED`) dan role selain `super_admin` (`FORBIDDEN`).
20. Mock: mendaftar dengan kontak baru tidak menimpa akun lain; `deleteAccount` hanya menghapus akun yang login.

Contoh assert tanpa framework tertentu:

```js
const result = await mockApi.bankProducts.compare(primaryCompareInput)
console.assert(result.items.length > 0)
console.assert(result.items.every(x => typeof x.bank_product_id === 'string'))
console.assert(!JSON.stringify(result).includes('secondary'))

const schedule = await mockApi.amortization.get(MORTGAGE_ID, { view: 'yearly' })
console.assert(schedule.reconciliation.principal_matches_opening)
console.assert(schedule.reconciliation.payment_equals_principal_plus_interest)
console.assert(schedule.reconciliation.final_balance_zero)
```

---

## 26. Implementasi frontend yang tidak bocor transport

- TanStack Query boleh dipakai jika sudah terpasang; jika tidak, adapter tetap promise biasa. Kontrak tidak mewajibkan dependency.
- Query key memakai domain ID/filter, bukan URL: `['application', id]`.
- UI format uang/tanggal dari typed value; response tidak berisi JSX/icon/component name.
- Route/action display dapat dikonsumsi UI, tetapi permission akhir memakai `available_actions` dari resource.
- Loading berasal dari pending promise; empty dari data kosong; partial dari `data_completeness`; business error dari `ApiError`.
- Optimistic update hanya aman untuk `markRead`; submit/status/financial mutation menunggu response.
- Jangan simpan access token production di fixture committed; `mock_access_token` hanya mode mock.

---

## 27. Deliberate MVP simplifications

- Satu active application/draft dan satu active mortgage per user; tambah multi-record parallel hanya jika kebutuhan nyata muncul.
- Cursor pagination satu pola untuk semua list.
- Simulation history dapat disabled; response menyatakan jujur tidak tersimpan.
- WhatsApp dinyatakan unavailable, bukan disimulasikan sebagai delivered.
- Amortization generated on demand; cache/snapshot ditambah bila audit/performance menuntut.
- Cancel pre-akad hard delete hanya keputusan prototype; production menunggu review retention.
- Tidak ada provider/database/storage choice dalam contract ini.

Dengan batas ini, surface UI dan domain payload tetap stabil sementara implementasi di belakang `httpApi` dapat ditentukan kemudian tanpa mengganti komponen frontend.

---

## 28. Admin (`super_admin`)

Layar, matrix transisi, dan fase ada di `2026-10-07_110428-admin-dashboard.md`. Bagian ini mengunci kontraknya.

### 28.1 Role dan akses

- Role melekat pada akun: `user | super_admin | content_writer`. `GET /auth/session` mengembalikan `role`, `null` bila belum login.
- Staff login lewat alur OTP yang sama (§7). Fixture mock: `admin@ruangkpr.id` dan `sinta@ruangkpr.id` (super admin), `penulis@ruangkpr.id` (content writer), OTP `148260`.
- Semua `/admin/*` butuh session (`401 AUTH_REQUIRED`) dan role staff yang memegang modulnya (`403 FORBIDDEN`, tanpa membocorkan resource): `super_admin` semua modul, `content_writer` hanya `/admin/articles*`.
- Setiap mutation admin wajib `reason` dan `expected_version` (§3.6; mismatch → `409 CONFLICT_VERSION`) serta menulis audit event (§28.5).

### 28.2 Endpoint

| Method | Path | Adapter method | Mock |
|---|---|---|---|
| GET | `/admin/users?query=&in_process=&has_active_mortgage=` | `admin.users.list` | ada |
| GET | `/admin/users/{id}` | `admin.users.get` | ada |
| PATCH | `/admin/users/{id}/profile` | `admin.users.updateProfile` | ada |
| PATCH | `/admin/users/{id}/finance` | `admin.users.updateFinance` | ada |
| GET | `/admin/overview` | `admin.overview.get` | ada |
| GET | `/admin/applications?status=&product_type=&bank_name=&pending_action=&from=&to=&query=` | `admin.applications.list` → `{ items, banks }` | ada |
| GET | `/admin/applications/{id}` | `admin.applications.get` | ada |
| POST | `/admin/applications/{id}/transitions` | `admin.applications.transition` | ada |
| POST | `/admin/applications/{id}/notes` | `admin.applications.addNote` | ada |
| GET/POST/PATCH | `/admin/banks`, `/admin/banks/{id}` | `admin.banks.list/create/update` | ada |
| GET/POST/PATCH | `/admin/products`, `/admin/products/{id}` | `admin.products.list/get/create/update` | ada |
| POST | `/admin/products/{id}/publish`, `…/archive`, `…/preview` | `admin.products.publish/archive/preview` | ada |
| GET/POST/PATCH | `/admin/articles?query=&status=`, `/admin/articles/{id}` | `admin.articles.list/get/create/update` | ada |
| POST | `/admin/articles/{id}/publish`, `…/archive` | `admin.articles.publish/archive` | ada |
| GET | `/admin/reports?from=&to=&product_type=&bank_name=` | `admin.reports.get` | ada |
| GET | `/admin/reports/export.csv?…` (filter sama) | `admin.reports.exportCsv` → `{ filename, csv, rows }` | ada |
| GET/PATCH | `/admin/configuration`, `/admin/configuration/{reminders\|upload}` | `admin.config.get/update(section)` | ada |
| GET/POST | `/admin/health-config`, `…/preview`, `…/publish`, `…/rollback` | `admin.health.get/preview/publish/rollback` | ada |
| GET | `/admin/audit-logs?resource_type=&actor_id=&from=&to=&query=` | `admin.audit.list` (super admin) → `{ items, actors }` | ada |

### 28.3 Admin user row

`GET /admin/users` → koleksi cursor (§4.2); mock mengembalikan array penuh. Akun `super_admin` tidak pernah ikut.

```json
{
  "id": "usr_sample_02",
  "name": "Budi Santoso",
  "contact": "081200000102",
  "contact_type": "phone",
  "created_at": "2026-09-19T02:00:00.000Z",
  "active_application_status": "additional_docs_requested",
  "has_active_mortgage": false
}
```

### 28.4 Application transition oleh admin

Enum tetap §9.1. Body `{ to_status, reason, expected_version, metadata }`; isi `metadata` per tujuan ada di plan admin §4.3 dan §5. Response mengikuti §23 dengan `actor: "admin"` dan menambah `allowed_transitions`. Transition invalid → `INVALID_STATE_TRANSITION` tanpa mengubah state.

Akad menyimpan `final_terms` `{ loan_amount, tenor_months, fixed_rate_bps, fixed_months, floating_rate_bps, akad_date, payment }`; `disbursed` membuat mortgage dari angka itu (tanggal mulai = `akad_date`). Catatan internal (`/notes`) tidak pernah muncul di endpoint B2C.

### 28.4a Produk dan bank

- Produk: `status: draft | published | archived`, `version` (dipin aplikasi lewat `selection.product_version`), `rev` (konkurensi edit admin; `expected_version` dicocokkan ke `rev`). Edit produk terbit tersimpan sebagai `pending_revision` dan baru berlaku setelah publish (`version + 1`).
- Simpan draft/revisi tidak butuh `reason`; publish, archive, dan perubahan bank butuh `reason`.
- Pencocokan B2C hanya membaca produk `published` dari bank `active`.

### 28.4b Artikel

- Shape B2C mengikuti mock (`src/data/articles.js`: `slug, tag, icon, title, summary, minutes, body: string[]`; contoh `education` di §19.1 masih bentuk lama); admin menambah `id`, `status: draft | published | archived`, `rev` (konkurensi; `expected_version` dicocokkan ke `rev`), dan `updated_at`.
- `slug`: `^[a-z0-9]+(-[a-z0-9]+)*$`, unik termasuk artikel yang diarsipkan, dan tidak bisa diubah setelah terbit.
- Simpan draft tidak butuh `reason`. Edit artikel terbit langsung tampil, jadi butuh `reason`; publish dan archive juga. Arsip bersifat final.
- `explore.get`/`explore.article` hanya membaca yang `published`; artikel lain → `404 RESOURCE_NOT_FOUND`.

### 28.4c Laporan

- Satu respons berisi `filters` (default 30 hari terakhir), `banks`, `users { registered, with_application }`, `applications { created, submitted, approved, rejected, disbursed }`, `stages[] { status, count, conversion_bps, avg_days }`, dan `products[] { id, bank_name, product_name, product_type, count }`. Definisi tiap angka ada di plan admin §4.6.
- Rentang tidak valid atau terbalik → `400 VALIDATION_FAILED` dengan `field_errors` `from`/`to`.
- CSV: kolom whitelist tanpa data pribadi; sel yang diawali `= + - @` (atau tab/CR) diberi awalan `'`, lalu dikutip RFC 4180. Setiap ekspor menulis audit `report.export` berisi filter dan jumlah baris.

### 28.4d Konfigurasi dan formula KPR Health

- `GET /admin/configuration` → `{ config: { version, reminders, upload: { max_file_mb, formats } }, health: { version, published_at } }`. `PATCH` per bagian dengan `{ values, reason, expected_version }`. Pengingat default hanya berlaku untuk KPR yang diatur setelahnya.
- Formula KPR Health berupa daftar versi yang hanya bisa ditambah; yang berlaku adalah versi terbaru. `preview { params }` tidak menyimpan apa pun dan mengembalikan skor sebelum/sesudah per contoh. `publish { params, reason, expected_version }` menambah versi. `rollback { to_version, reason, expected_version }` menerbitkan ulang params versi lama sebagai versi baru dengan `rollback_of`. `expected_version` = versi yang sedang berlaku.
- Params: band `{ up_to, score }` dengan batas DTI/LTV dalam bps dan sisa fixed dalam hari, band terakhir `up_to: null`; `rate.floating`, `progress { base, per_paid }`, `weights { dti, ltv, rate, progress }`, `labels { healthy, attention }`.
- `GET /dashboard` (snapshot) membawa `config { health { version, params }, reminders, upload }` untuk halaman B2C.

### 28.5 Audit event

```json
{
  "id": "aud_000001",
  "actor": { "id": "usr_admin_01", "contact": "admin@ruangkpr.id" },
  "action": "application.transition",
  "resource": { "type": "application", "id": "app_sample_01" },
  "reason": "Data awal sudah dicek",
  "before": { "status": "submitted" },
  "after": { "status": "docs_verification" },
  "request_id": "req_000001",
  "occurred_at": "2026-09-28T09:00:00.000Z"
}
```

Nilai sensitif (NIK, nomor rekening, token) dimasking di `before`/`after`. Append-only; tidak ada endpoint ubah atau hapus. `GET /admin/audit-logs` mengembalikan event terbaru di atas; filter `resource_type`, `actor_id`, rentang tanggal `occurred_at`, dan `query` (alasan, label resource, nama admin). `actors` = semua admin yang pernah tercatat (untuk pilihan filter, tidak ikut terfilter). Backend memakai cursor; mock mengembalikan semua.

### 28.6 Akun di mock

Satu browser menyimpan banyak akun di localStorage. Akun yang sedang login ada di top-level state, sehingga endpoint B2C tidak berubah; akun lain menunggu di `accounts` sampai kontaknya lolos OTP lagi. Mendaftar dengan kontak baru membuat akun baru, bukan menimpa akun lama. `auth.deleteAccount` hanya menghapus akun yang login. Seed menyertakan akun admin dan delapan user contoh fiktif. Backend nyata memisahkan data per user id.
