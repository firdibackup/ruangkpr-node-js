# Backend Supabase (Auth, Database, Storage) — Design

Tanggal: 2026-10-09 · Status: disetujui per bagian di chat, menunggu review spec tertulis

## Tujuan
- Mengganti backend mock (`localStorage`) dengan **Supabase self-hosted** di VPS (`https://ruang-kpr.firdiaudi.my.id`) untuk **pilot dengan user nyata**: Auth, Database (query), dan Storage seluruhnya di Supabase. Tidak ada PHP atau server lain.
- UI tidak ditulis ulang: `src/data/api.js` tetap satu-satunya pintu data; adapter baru memenuhi nama method dan bentuk return yang sama dengan `mockApi.js`.
- Menggantikan jalur `httpApi`/REST di doc 04 §1 dan doc 05 §17 (kontrak REST snake_case tidak dipakai).

## Keputusan
| Topik | Keputusan |
|---|---|
| Tujuan | Pilot/produksi dengan user nyata (NIK, KTP, slip gaji asli). Keamanan ditegakkan di Supabase, bukan browser. |
| Supabase | Self-hosted (Docker) di VPS milik user. Publishable key format baru sudah tersedia. |
| Login | **Google OAuth + OTP email** (kode 6 digit). OTP WhatsApp tidak dipakai. |
| Letak aturan bisnis | **Pendekatan A — berpusat di database**: RLS untuk operasi sederhana, fungsi Postgres (RPC) untuk transisi/submit/admin, trigger untuk audit. |
| Role | Tabel `user_roles` dibaca langsung oleh RLS dan `getSession`. **Tanpa** Custom Access Token Hook. |
| Reminder | In-app + email, job harian `pg_cron` + Edge Function `send-reminders`. |
| Email | **Nodemailer** (di Edge Function) + **SMTP Resend**. SMTP yang sama dipakai GoTrue untuk OTP. |
| Mock | `mockApi.js` tetap untuk unit test, e2e, dan mode demo (`VITE_DATA_SOURCE=mock`). |
| Kalkulasi | Tetap JS (`src/calculations`). Tidak dihitung ulang di server (lihat §4.1). |
| Rilis | Fase 1–3 dikembangkan di Supabase lokal; rilis ke user nyata sekali di Fase 4. |

## 1. Arsitektur & adapter

```
Halaman UI ──► src/data/api.js ──┬─► mockApi.js          (VITE_DATA_SOURCE=mock)
                                 └─► src/data/supabase/   (VITE_DATA_SOURCE=supabase)
                                       ├─ client.js     createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
                                       ├─ errors.js     error Postgres/PostgREST/Storage/jaringan → ApiError
                                       ├─ auth.js · profile.js · applications.js · mortgages.js
                                       │  simulations.js · explore.js · activities.js · admin.js
                                       └─ index.js      menyusun `api` dengan nama method yang sama dengan mockApi
```

- **Bentuk data**: adapter mengembalikan objek camelCase identik dengan mock. Kolom snake_case dipetakan di adapter; kolom `jsonb` menyimpan key camelCase apa adanya.
- **Logika turunan tetap JS**: `deriveMortgage`, `selectHomeState`, `comparePrimaryPrograms`, `compareTakeoverPrograms`, `requiredDocuments`, `runSimulation`, dll. dipanggil adapter setelah mengambil baris, persis seperti mock.
- **Error**: fungsi SQL melempar `raise exception using message = '<pesan Indonesia>', detail = '<json {code, fieldErrors, details}>', errcode = 'P0001'`. `errors.js` memetakan:
  - `P0001` + detail → `ApiError` dengan `code` domain (`VALIDATION_FAILED`, `INVALID_STATE_TRANSITION`, `FORBIDDEN`, `VERSION_CONFLICT`, `BANK_PRODUCT_EXPIRED`, `DOCUMENTS_INCOMPLETE`, `CONSENT_REQUIRED`, `RESOURCE_NOT_FOUND`, …).
  - `23505` (unique violation) → kode domain menurut nama constraint (mis. `applications_one_active` → `ACTIVE_DRAFT_EXISTS`, `mortgage_payments_due_unique` → `DUPLICATE_PAYMENT_RECORD`).
  - `42501` / RLS kosong → `FORBIDDEN` (403). JWT kedaluwarsa → `AUTH_REQUIRED` (401). Gagal jaringan/5xx → `SERVICE_UNAVAILABLE` (`retryable: true`).
- **Tanggal**: mode Supabase memakai tanggal hari ini zona **Asia/Jakarta** (JS dan SQL); mode mock tetap memakai `CLOCK`. Satu helper `today()` di adapter.
- **Session**: supabase-js menyimpan token di `localStorage` dengan key miliknya (pengecualian tercatat dari aturan "hanya `mockDb.js` menyentuh localStorage"). JWT 1 jam dengan refresh otomatis. `SessionProvider` menambah langganan `onAuthStateChange` untuk refresh.
- **DevPanel** dan `mockControls` hanya dirender di mode mock.
- **Dependency baru**: `@supabase/supabase-js` (versi dikunci persis, lockfile ikut). `supabase` CLI sebagai devDependency (versi dikunci). Edge Function: `npm:nodemailer@<versi dikunci>`.
- **Struktur repo baru**: `supabase/config.toml`, `supabase/migrations/*.sql`, `supabase/seed.sql`, `supabase/tests/*.sql` (pgTAP), `supabase/functions/send-reminders/`, `supabase/functions/delete-account/`, `supabase/templates/` (email OTP).

### 1.1 Pemetaan method → implementasi
| Grup | Langsung ke tabel (RLS) | RPC / Storage / Edge Function |
|---|---|---|
| `auth` | `getSession` (baca `profiles`, `user_roles`, `consents`) | `signInWithGoogle`, `sendEmailOtp`, `verifyEmailOtp`, `resendOtp`, `logout` (supabase-js Auth); `acceptConsents` (RPC `accept_consents`); `deleteAccount` (Edge Function `delete-account`) |
| `dashboard` | `getSnapshot` (gabungan select), `saveLayout`, `markTourSeen` | — |
| `profile` | `get`, `update` | — |
| `applications` | `get`, `create`, `saveStep` (+ sinkron profil), `removeDocument` | `uploadDocument` (Storage + RPC `attach_document`), `selectProgram`, `submit`, `cancel`, `retrySameBank`, `cloneToBank` (RPC) |
| `bankProducts` | `compare`, `affordability` (baca katalog + JS) | — |
| `mortgages` | `createSetup`, `saveSetupStep`, `update`, `dismissRateWarning`, `deleteDraft`, `markPaid` (+ bukti ke Storage), `removePayment` | `activate` (RPC `activate_mortgage`) |
| `simulations` | `run`, `getCurrent` (kolom `profiles.simulation`), `save` (tetap `history_not_enabled`) | `apply` (RPC `apply_simulation`) |
| `explore` | `get`, `article` | — |
| `activities` | `list`, `markRead`, `markAllRead` | — |
| `admin.*` | `*.list`, `*.get`, `audit.list`, `health.get`, `config.get`; `products.preview`, `health.preview` (JS murni) | Semua mutasi lewat RPC `admin_*` (lihat §4.2); `overview.get`, `reports.get`, `reports.exportCsv` lewat RPC agregat; dokumen diunduh dengan `createSignedUrl` |

## 2. Skema (schema `public`)
Prinsip: kolom untuk yang perlu ditegakkan/di-query SQL (pemilik, status, tanggal cron, filter, laporan); `jsonb` (key camelCase) untuk payload formulir yang divalidasi dan diturunkan oleh JS. Uang `bigint` Rupiah, bunga `integer` bps, tanggal `date`, waktu `timestamptz`. Status `text` + `CHECK`. `version integer` dinaikkan trigger `bump_version` pada setiap UPDATE. Setiap tabel: `enable row level security` + `GRANT` eksplisit (wajib karena tabel baru tidak lagi otomatis terekspos ke Data API).

| Tabel | Kolom utama | Akses |
|---|---|---|
| `profiles` | `id uuid` PK = `auth.users.id`, `full_name`, `email`, `phone`, `nik`, `personal jsonb`, `finance jsonb`, `dashboard_layout jsonb`, `tours_seen text[]`, `kept jsonb` (dulu `takeover_kept`; `{primary, takeover, documents}` dari pengajuan yang dibatalkan), `simulation jsonb`, `version`, `created_at`, `updated_at` | Pemilik select/update (kecuali `id`, `email`, `version`); super_admin select |
| `consents` | `id`, `user_id`, `type` (`terms`/`privacy`), `version`, `accepted_at` | Insert lewat RPC; pemilik + super_admin select; tanpa update/delete |
| `user_roles` | `user_id` PK, `role` (`super_admin`/`content_writer`), `created_at` | Pemilik select baris sendiri; tidak ada tulis dari `authenticated` |
| `applications` | `id uuid`, `user_id`, `product_type`, `optimization_mode`, `source`, `mortgage_id`, `status`, `current_step`, `step_count`, `data jsonb`, `selection jsonb`, `consents jsonb`, `snapshot jsonb`, `final_terms jsonb`, `pending_actions jsonb`, `rejection jsonb`, `last_rejection jsonb`, `excluded_product_ids text[]`, `superseded bool`, `submitted_at`, `cancelled_at`, `version`, `created_at`, `updated_at` | Pemilik select + insert (status `draft`), update hanya kolom `data`, `current_step` saat `status='draft'`; super_admin select. Status hanya lewat RPC |
| `application_status_events` | `id`, `application_id`, `status`, `metadata jsonb`, `actor_id`, `at` | Pemilik + super_admin select; tulis hanya oleh RPC |
| `application_documents` | `id`, `application_id`, `document_type`, `status` (`uploaded`/`verified`/`needs_update`), `storage_path`, `file_name`, `size_bytes`, `content_type`, `invalid_reason`, `uploaded_at`; `unique(application_id, document_type)` | Pemilik select + delete saat draft; insert/update via RPC; super_admin select/update status |
| `mortgages` | `id uuid`, `user_id`, `application_id`, `status` (`draft`/`active`/`replaced`/`closed`), `setup_step`, `source`, `due_day`, `fixed_until`, `current_rate_type`, `reminders jsonb`, `details jsonb` (bank, produk, skema, pokok, tenor, bunga, cicilan, sisa pokok, properti, keuangan, riwayat bunga, `rateWarningDismissedMilestone`), `activated_at`, `version`, timestamps | Pemilik select; insert (status `draft`); update kolom selain `status`/`user_id` saat status `draft`/`active`; delete saat `draft`; super_admin select |
| `mortgage_payments` | `id`, `mortgage_id`, `due_date`, `amount bigint`, `paid_at date`, `source` (`manual_user_recorded`), `proof_path`, `created_at`; `unique(mortgage_id, due_date)` | Pemilik (lewat kepemilikan mortgage) |
| `activities` | `id`, `user_id`, `type`, `category`, `title`, `body`, `action jsonb`, `occurred_at`, `read_at`, `dedupe_key`; `unique(user_id, dedupe_key)` | Pemilik select, insert kategori aksi sendiri, update hanya `read_at` |
| `reminder_deliveries` | `id`, `user_id`, `mortgage_id`, `kind` (`payment`/`fixed_expiry`), `target_date`, `offset_days`, `channel` (`in_app`/`email`), `status` (`queued`/`sent`/`failed`), `attempts`, `last_error`, `sent_at`; `unique(mortgage_id, kind, target_date, offset_days, channel)` | Tidak ada akses `authenticated`; hanya cron/Edge Function |
| `banks` | `id text` PK, `name`, `mark`, `active`, `version`, timestamps | `authenticated` select yang aktif; super_admin tulis via RPC |
| `bank_products` | `id text` PK (id yang sudah ada), `bank_id`, `version`, `name`, `product_types text[]`, `scheme`, `status` (`draft`/`published`/`archived`), `effective_from`, `effective_until`, `last_verified_at`, `rate_periods jsonb`, `fees jsonb`, `eligibility jsonb`, `pending_revision jsonb`, `rev`, timestamps | `authenticated` select `published` dari bank aktif; super_admin semua via RPC |
| `articles` | `id uuid`, `slug` unik, `tag`, `icon`, `title`, `summary`, `minutes`, `body jsonb`, `status`, `rev`, `published_at`, timestamps | `authenticated` select `published`; super_admin + content_writer select semua, tulis via RPC |
| `app_config` | `section` PK (`reminders`/`upload`), `values jsonb`, `version`, `updated_at`, `updated_by` | `authenticated` select; super_admin via RPC |
| `health_configs` | `version` PK, `params jsonb`, `reason`, `published_at`, `published_by`, `rollback_of` | `authenticated` select; publish/rollback via RPC; versi tertinggi = aktif |
| `admin_notes` | `id`, `application_id`, `text`, `author_id`, `created_at` | super_admin select; insert via RPC |
| `audit_log` | `id`, `actor_id`, `actor_name`, `action`, `resource_type`, `resource_id`, `resource_label`, `reason`, `before jsonb`, `after jsonb`, `occurred_at` | super_admin select; tulis hanya trigger/RPC; tanpa update/delete |

Constraint yang menggantikan kode:
- `applications_one_active`: partial unique index `(user_id) where status not in ('disbursed','cancelled') and not (status = 'rejected' and superseded)` — sama dengan `activeApplication()`: pengajuan `rejected` yang belum di-retry/clone tetap dihitung aktif. `clone_to_bank` menandai lama `superseded` sebelum insert baru dalam satu transaksi.
- `mortgages_one_active`: partial unique index `(user_id) where status = 'active'`; `mortgages_one_draft` untuk draft setup.
- `mortgage_payments_due_unique`, `activities_dedupe_unique`, `reminder_deliveries_unique`.

Keputusan data:
- **Batal pengajuan**: draft dihapus permanen (beserta file Storage); yang sudah submit menjadi `status='cancelled'` + `cancelled_at`, data dan dokumen disimpan (doc 05 §17.5).
- **Hapus akun**: Edge Function `delete-account` (butuh secret key untuk menghapus user auth dan file Storage). Ditolak bila ada pengajuan berstatus `IN_PROCESS`.
- **Data demo localStorage tidak dimigrasikan.** Seed hanya katalog, artikel, `app_config`, KPR Health v1.

## 3. Auth & role

### 3.1 Alur
```
[Lanjut dengan Google] ──► Google ──► kembali (PKCE, supabase-js detectSessionInUrl) ─┐
[Email] → sendEmailOtp ──► /verify (6 digit, kirim ulang 60 dtk) → verifyEmailOtp ────┤
                                                                                      ▼
                          belum consent versi terbaru? ──ya──► /welcome (nama + S&K + Privasi → accept_consents)
                                       │ tidak
                                       ▼
                                  Home / Admin
```
- Status session: `guest` → `pending` (menunggu kode) → `onboarding` (login, belum consent versi aktif) → `authenticated`. `RequireAuth` mengarahkan `onboarding` ke `/welcome`; `GuestOnly` tetap untuk `/register` dan `/verify`.
- `/register` menjadi "Masuk atau daftar": tombol Google + field email. Field nama dan centang consent pindah ke `/welcome`. Validasi nomor HP/WhatsApp dihapus.
- Email OTP pending disimpan di memori adapter; refresh di `/verify` kembali ke `/register`.
- Satu email = satu akun: GoTrue menautkan identitas Google dan email yang sama. `user.contact` = email, `contactType = 'email'`.
- Versi consent aktif (`'2026-09-01'` sekarang) disimpan di satu konstanta JS + diperiksa di RPC `accept_consents`; menaikkan versi memaksa consent ulang.
- Trigger `private.handle_new_user` (SECURITY DEFINER, `search_path=''`) pada `auth.users` insert → `profiles(id, email, full_name)`; nama dari `raw_user_meta_data` hanya isian awal, tidak pernah untuk otorisasi.

### 3.2 Role
- `getSession` membaca `user_roles` milik sendiri → `role` (`null` = user biasa). `canOpen()` di `roles.js` tetap dipakai UI.
- Policy admin: `exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'super_admin')`; modul artikel juga menerima `content_writer`. Pencabutan role berlaku seketika.
- Super_admin pertama: orangnya login sekali, lalu SQL di Studio: `insert into public.user_roles (user_id, role) select id, 'super_admin' from auth.users where email = '<email>';` UI kelola role tidak dibuat.

### 3.3 Kontrak `api.auth` baru (mock ikut)
`getSession()` · `signInWithGoogle()` · `sendEmailOtp({ email })` · `verifyEmailOtp({ token })` · `resendOtp()` · `acceptConsents({ name, terms, privacy })` · `logout()` · `deleteAccount()`. Mock: `signInWithGoogle` langsung masuk ke akun contoh; OTP mock tetap `148260`.

### 3.4 Konfigurasi GoTrue (env VPS)
- `SITE_URL` = domain app produksi; `ADDITIONAL_REDIRECT_URLS` = `http://localhost:5173/**`, pola preview Vercel.
- `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`, `_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI=https://ruang-kpr.firdiaudi.my.id/auth/v1/callback`.
- SMTP Resend: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS=<API key>`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME=RuangKPR`.
- `MAILER_AUTOCONFIRM=false`, OTP 6 digit berlaku 10 menit, `JWT_EXP=3600`, anonymous sign-in mati, rate limit email ketat.
- Template "Magic Link" dan "Confirm signup" diganti kode `{{ .Token }}` berbahasa Indonesia, disajikan container Caddy internal (`GOTRUE_MAILER_TEMPLATES_MAGIC_LINK`, `GOTRUE_MAILER_TEMPLATES_CONFIRMATION`).

## 4. Aturan bisnis & Storage

### 4.1 Pembagian SQL vs JS
- **SQL menegakkan siapa/kapan/dari status apa**: otorisasi, mesin status, integritas, audit.
- **JS menghitung angka.** Angka dari browser dipercaya hanya untuk data user itu sendiri (proyeksi KPR, sisa pokok, simulasi). Bunga/biaya/masa berlaku produk **dibaca ulang SQL dari `bank_products`**. Angka final akad dihitung JS di browser admin; SQL memvalidasi rentang (sama dengan `finalTermsOf`).
- `ponytail:` tanpa hitung ulang kalkulasi di server; tambah Edge Function parity (memakai `src/calculations`) bila bank mitra memakai angka kita secara resmi.

### 4.2 RPC
- RPC yang hanya menulis kolom yang memang boleh ditulis user (mis. `accept_consents`) memakai `SECURITY INVOKER`, jadi RLS tetap berlaku.
- RPC yang mengubah kolom terlindungi (`status`, `selection`, `snapshot`, dokumen, dan semua mutasi admin) tidak bisa INVOKER karena `authenticated` sengaja tidak punya hak UPDATE kolom itu. Polanya: fungsi `SECURITY DEFINER` di schema `private` (tidak terekspos) yang **selalu** memeriksa `auth.uid()`, kepemilikan baris, status asal, dan role di badan fungsinya, dipanggil lewat wrapper `SECURITY INVOKER` tipis di `public` agar bisa di-`rpc()`. `EXECUTE` dicabut dari `public`/`anon`, hanya diberikan ke `authenticated`.
- Tabel data user (pengajuan, KPR, pembayaran, simulasi) hanya bisa ditulis bila user sudah consent versi aktif: policy INSERT/UPDATE memakai `private.has_consented()`, jadi status `onboarding` ditegakkan di database, bukan hanya di UI.

| RPC | Aturan |
|---|---|
| `accept_consents(name, terms, privacy, version)` | Kedua centang wajib; isi nama profil; insert `consents` versi aktif |
| `select_program(app_id, product_id, loan_amount, tenor_months, estimate jsonb)` | Draft milik sendiri; produk `published`, bank aktif, dalam masa berlaku; `loan_amount ≤ harga − DP`; salin bank/produk/bunga/versi dari katalog, estimasi cicilan dari JS |
| `attach_document(app_id, document_type, path, file_name, size_bytes, content_type)` | Draft, atau dokumen `needs_update`; path diawali `auth.uid()`; penggantian membersihkan `pending_actions` dan bila kosong kembali ke `docs_verification` + activity; mengembalikan path lama untuk dihapus |
| `submit_application(app_id, consents jsonb)` | Draft; produk masih berlaku dan versi sama; `dataAccuracy` + `sendToBank`; NIK 16 digit; semua dokumen wajib berstatus `uploaded`/`verified` menurut `private.required_document_types(app)` — port SQL dari daftar `required: true` di `requiredDocuments()` (Primary: ktp, npwp, income_proof, property_document; Take Over: ktp, family_card, npwp, marriage_document bila menikah, income_proof, bank_statement, old_loan_agreement, outstanding_letter, latest_payment_proof, certificate, building_permit, land_tax); label/hint tetap di JS; parity diuji pgTAP; tulis snapshot, `submitted_at`, status event, activity |
| `cancel_application(app_id)` | Status dalam `CANCELLABLE`; pengajuan dihapus. Default (`keepData`) data Primary/Take Over dan dokumen valid disimpan di `profiles.kept` sehingga draft berikutnya langsung terisi (dokumen hanya tipe yang diminta produknya); user bisa memilih "Hapus juga data & dokumen yang tersimpan" (`kept` dikosongkan). File di Storage hanya dihapus bila tidak lagi dirujuk `kept` atau pengajuan lain (implementasi: `applications.cancel` di `mockApi.js`, migrasi `20261014100000`) |
| `retry_same_bank(app_id)` | Hanya `rejected` dan belum `superseded`; kembali ke draft di `relevantStep`, kosongkan consents/snapshot/`submitted_at`, simpan `last_rejection` |
| `clone_to_bank(app_id)` | Hanya `rejected` dan belum `superseded`; lama → `superseded`; draft baru menyalin `data`, baris dokumen `uploaded`/`verified` (menunjuk file yang sama, tanpa menyalin file), `excluded_product_ids` + produk lama. File hanya dihapus bila path-nya berada di folder pengajuan yang dihapus |
| `apply_simulation(product_id, tenor_months, plafon, selection jsonb)` | Satu pengajuan aktif; produk berlaku; buat/isi draft Take Over atomik |
| `activate_mortgage(mortgage_id, confirm)` | Draft milik sendiri; field wajib ada di `details`; reminder minimal satu jadwal dan satu kanal; activity aktivasi + reminder dijadwalkan + peringatan fixed ≤ 90 hari |
| `admin_transition_application(id, to_status, reason, expected_version, metadata)` | super_admin; matriks `NEXT_STATUS` + `approved` → `akad`/`old_mortgage_settlement`; `additional_docs_requested` menandai dokumen `needs_update`; `bank_processing` hanya bila semua dokumen wajib `verified` (trigger `20261013120000_document_review`); `rejected` butuh kode + alasan; `akad` menyimpan `final_terms` tervalidasi; `disbursed` membuat KPR aktif dari `final_terms` (Take Over: KPR lama → `replaced`); activity untuk user |
| `admin_add_note`, `admin_update_user_profile`, `admin_update_user_finance` | super_admin; `reason` wajib; `expected_version` |
| `admin_upsert_bank`, `admin_save_product`, `admin_publish_product`, `admin_archive_product` | super_admin; revisi `pending_revision`; publish menaikkan `version` |
| `admin_save_article`, `admin_publish_article`, `admin_archive_article` | super_admin atau content_writer |
| `admin_update_config(section, values, reason, expected_version)` | super_admin; `upload` juga memperbarui `storage.buckets` (batas ukuran/MIME) |
| `admin_publish_health`, `admin_rollback_health` | super_admin; versi baru, alasan wajib |
| `admin_overview()`, `admin_report(params)` | super_admin; agregat SQL (funnel dari `application_status_events`), CSV disusun adapter dari baris yang dikembalikan |

- Kolom `status` tidak di-`GRANT UPDATE` ke `authenticated` di tabel mana pun; hanya RPC yang mengubahnya.
- `expected_version` tidak cocok → `VERSION_CONFLICT`.
- Audit: trigger `private.audit_row` di `bank_products`, `banks`, `articles`, `app_config`, `health_configs`, `profiles` (saat pelaku admin), `applications` (transisi admin), `admin_notes`. Alasan dibaca dari `current_setting('app.audit_reason', true)` yang diset RPC (`set_config(..., true)`). NIK dimasking di `before`/`after`.
- `SECURITY DEFINER` hanya di schema `private` (tidak terekspos ke Data API): trigger `handle_new_user`, `audit_row`, job `enqueue_reminders`, dan implementasi RPC yang mengubah kolom terlindungi (§4.2), semuanya dengan `set search_path = ''`.
- Activity dari aksi user sendiri (pembayaran ditandai, data KPR diperbarui) di-insert adapter; activity sistem (status, reminder) hanya oleh RPC/cron.

### 4.3 Storage
- Bucket private `application-documents` dan `payment-proofs`; `file_size_limit` dan `allowed_mime_types` (`image/jpeg`, `image/png`, `application/pdf`) di level bucket, disinkronkan dari `app_config.upload`.
- Path: `{user_id}/{application_id}/{document_type}-{uuid}.{ext}` dan `{user_id}/{mortgage_id}/{due_date}-{uuid}.{ext}`. Nama selalu baru, tanpa upsert → policy INSERT, SELECT, DELETE saja.
- Policy `application-documents`: pemilik INSERT bila `(storage.foldername(name))[1] = auth.uid()::text` dan pengajuan masih draft atau dokumen `needs_update`; pemilik SELECT/DELETE foldernya sendiri; super_admin SELECT semua. content_writer tanpa akses.
- Upload: `uploadProblem` (aturan JS yang sama) → `XMLHttpRequest` ke `/storage/v1/object/{bucket}/{path}` (header `Authorization` + `apikey`) agar progress asli tanpa dependency → `rpc('attach_document')` → hapus file lama bila penggantian.
- Admin mengunduh dokumen via `createSignedUrl(path, 300, { download: fileName })` (Content-Disposition: attachment).

## 5. Reminder
```
pg_cron "0 0 * * *" (07:00 WIB)
  └─ private.enqueue_reminders()
       ├─ KPR active: next_due_date − today ∈ reminders.payment, belum ada pembayaran untuk due_date itu
       ├─ KPR fixed: fixed_until − today ∈ reminders.fixedExpiry
       └─ per kanal aktif → insert reminder_deliveries ON CONFLICT DO NOTHING
            ├─ in_app → insert activities (dedupe_key 'payment:<due_date>:H<n>' / 'fixed:<fixed_until>:H<n>') → sent
            └─ email  → queued
  └─ net.http_post → Edge Function send-reminders (header x-cron-secret)
       └─ ambil queued (maks 3 attempts) → Nodemailer (SMTP Resend, port 465) → sent / failed + last_error
```
- `today` = `(now() at time zone 'Asia/Jakarta')::date`; jatuh tempo tanggal > akhir bulan diklem ke akhir bulan (sama dengan `dates.js`).
- `ponytail:` tanpa catch-up hari yang terlewat (offset berikutnya tetap terkirim); tambahkan bila terbukti perlu.
- Isi email: nama, bank, tanggal jatuh tempo/akhir fixed, tombol "Buka RuangKPR", footer link pengaturan reminder. Tanpa NIK atau nominal sensitif.
- Env functions: `SMTP_HOST/PORT/USER/PASS`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `APP_URL`. Ekstensi: `pg_cron`, `pg_net`.

## 6. Ops & lingkungan
- **Dev**: Supabase lokal (`npx supabase start`, butuh Docker Desktop + WSL2) untuk migration, pgTAP, dan OTP lokal (Mailpit). **VPS hanya produksi.**
- **Env frontend** (`.env.local` / Vercel): `VITE_DATA_SOURCE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. **Secret key tidak pernah di env frontend**; hanya di `.env` VPS untuk Edge Functions.
- **Migration**: `npx supabase db push --db-url <postgres via SSH tunnel>`; alternatif awal: jalankan file bernomor di SQL Editor Studio. `supabase db advisors` wajib bersih sebelum push.
- **VPS**: port publik hanya 443 dan SSH; Postgres tidak publik; Studio berpassword (idealnya allowlist IP); semua secret bawaan sudah diganti; versi stack mendukung publishable key, `pg_cron`, `pg_net`, Edge Functions.
- **Domain/DNS**: `ruang-kpr.firdiaudi.my.id` → API (sudah HTTPS); domain app di Vercel; record Resend (SPF, DKIM, DMARC) untuk alamat pengirim di `firdiaudi.my.id`.
- **Backup**: `pg_dump` harian + salinan volume Storage, terenkripsi, ke luar VPS, retensi 30 hari; uji restore sekali sebelum pilot. `ponytail:` tanpa PITR; tambah saat data ramai.
- **Monitoring**: uptime check `https://ruang-kpr.firdiaudi.my.id/auth/v1/health`; query `reminder_deliveries where status = 'failed'`.

## 7. Testing
| Lapisan | Alat | Cakupan |
|---|---|---|
| Logika & UI lama | Vitest (`mockApi.test.js` dkk.) + Playwright mode mock | Tetap lulus; tes auth disesuaikan ke alur Google/OTP email/`/welcome` |
| Database | pgTAP (`npx supabase test db`, lokal) | Akses silang user A/B ditolak (tabel + Storage); user tidak bisa mengubah `status`; content_writer tidak bisa membaca pengajuan; `audit_log`/`consents`/`status_events` tidak bisa diubah; index unik; matriks transisi; `enqueue_reminders` idempoten |
| Adapter | Vitest `npm run test:supabase` (ke Supabase lokal, env-gated) | Draft → simpan langkah → upload → submit → transisi admin → `disbursed` membuat KPR aktif; KPR setup → aktif → tandai bayar; error mapping |
| Keamanan | `supabase db advisors` | Bersih sebelum setiap push |
| Produksi | Smoke manual + Playwright | Login Google + OTP email asli, upload, reminder masuk inbox |

## 8. Fase
| Fase | Isi | Selesai bila |
|---|---|---|
| 0. Persiapan (user, dengan runbook) | Perbaiki `.env.local` (prefix `VITE_`, hapus secret key); OAuth Client Google; akun Resend + verifikasi domain; env GoTrue + template OTP; backup + uji restore; Docker Desktop di laptop; `git init` + `.gitignore` | Health endpoint OK, email tes masuk inbox, login Google di Studio berhasil |
| 1. Fondasi auth | `supabase/` init; migration `profiles`, `consents`, `user_roles`, trigger; `client.js`, `errors.js`, switch `VITE_DATA_SOURCE`; auth Google + OTP email + `/welcome`; mock ikut kontrak auth baru | Login asli di lokal; pgTAP + e2e auth lulus |
| 2. B2C | Pengajuan + dokumen + RPC submit/batal/retry/clone/select/apply; KPR + pembayaran + bukti; simulasi; katalog/artikel baca; activity; dashboard; seed | Tes adapter + pgTAP B2C lulus; seluruh halaman B2C jalan di mode supabase lokal |
| 3. Admin | RPC admin + trigger audit; laporan/overview; dokumen via signed URL; Edge Function `delete-account` | Semua halaman admin jalan di lokal; tes role lulus |
| 4. Reminder + rilis | `pg_cron` + `send-reminders`; push migration + seed ke VPS; env Vercel; super_admin pertama; perbarui README/CLAUDE.md/PRODUCT.md dan teks UI "data disimpan di browser" | Smoke produksi lulus → pilot dibuka |

## 9. Ditunda (dengan batas yang diketahui)
- Captcha (Turnstile) pada kirim kode OTP — tambah bila ada penyalahgunaan; rate limit GoTrue untuk pilot.
- Pemindaian malware dokumen — tidak tersedia bawaan; sementara pembatasan tipe + signed URL.
- Pembersihan file yatim (upload sukses, RPC gagal) — job berkala nanti.
- Audit "admin membuka dokumen".
- UI kelola role; halaman admin untuk kegagalan reminder.
- Hitung ulang kalkulasi di server (§4.1); PITR backup; catch-up reminder.
- WhatsApp OTP/reminder.

## 10. Keputusan non-kode yang menghambat pilot
- Teks final S&K dan Kebijakan Privasi (UU PDP; teks sekarang placeholder).
- Kebijakan retensi: pengajuan dibatalkan, dokumen, hapus akun.
- Daftar kode penolakan bank (masih 2 kode sementara).
- Lokasi VPS untuk data pribadi warga Indonesia.

## Sumber docs (dicek 2026-10-09)
- Breaking change Data API: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- API keys: https://supabase.com/docs/guides/api/api-keys
- Login Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- OTP email: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Self-hosting Docker: https://supabase.com/docs/guides/self-hosting/docker
- Template email self-hosted: https://supabase.com/docs/guides/self-hosting/custom-email-templates
- Auth hooks self-hosted: https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks

## Amandemen 2026-10-09 (sore): langsung data asli, logika teruji dipakai ulang

Keputusan user setelah Fase 1 jalan di VPS (test pgTAP 14/14 lulus di database asli):

| Topik | Keputusan baru | Menggantikan |
|---|---|---|
| Mode default | Aplikasi memakai Supabase. Mock hanya untuk test otomatis (`VITE_DATA_SOURCE=mock` di Vitest/Playwright). Tombol Demo, kode demo, dan data dummy tidak pernah tampil di mode Supabase. | §1 "mock untuk demo", §8 rilis sekali di Fase 4 |
| Letak logika | Logika `mockApi.js` (yang dijaga 181 unit test) dipakai apa adanya. `createMockApi` menerima *store*: `localStore` (localStorage, untuk test) atau `supabaseStore` (memuat akun dari Supabase per baris, menjalankan operasi yang sama, lalu menulis hanya baris yang berubah dengan cek `version`). | §4.1–4.2: sebagian besar RPC |
| Penegakan di database | Trigger penjaga per tabel: kolom terpromosi (`status`, `superseded`) diturunkan dari `doc`; transisi status per peran (pemilik: `draft→submitted`, `rejected→draft`, `rejected` superseded, `additional_docs_requested→docs_verification` saat tidak ada dokumen tertunda, dan upload ulang hanya mengganti dokumen yang diminta — `20261013120000_document_review`; staf: matriks `NEXT_STATUS`, masuk `bank_processing` hanya bila semua dokumen wajib `verified` — `20261013120000_document_review`); submit divalidasi terhadap katalog (produk published, bank aktif, berlaku hari ini, versi dan bunga sama, dokumen wajib lengkap, NIK 16 digit) dan hanya membawa upload baru: semua dokumen `uploaded` tanpa `review`, `stageNotes` kosong — `20261014090000_submit_fresh_documents`; data pengajuan terkunci setelah submit; draf tidak bisa disentuh staf; audit hanya bisa ditambah dan `actor` dipaksa = `auth.uid()`. | §4.2 RPC per operasi |
| Skema | Baris dokumen: `id text`, `user_id`, kolom terpromosi, `doc jsonb` (bentuk objek persis seperti mock), `version`. Tabel: `applications`, `mortgages`, `activities`, `banks`, `bank_products`, `articles`, `app_config`, `health_configs`, `audit_log`, `admin_notes`. `profiles` (Fase 1) tetap per kolom. | §2 kolom per field |
| Katalog | Kosong. Admin mengisi bank/produk asli. | §2 seed katalog |
| Artikel | Artikel edukasi di-seed sebagai published. | — |
| Batal pengajuan | Tetap perilaku mock (hapus permanen untuk status `CANCELLABLE`) sampai kebijakan retensi diputuskan (§10). | §2 soft-cancel |
| Hapus akun | RPC `delete_my_account()` (SECURITY DEFINER di `private`, wrapper di `public`) setelah client menghapus file miliknya di Storage. Tanpa Edge Function. | Edge Function `delete-account` |
| Dokumen untuk admin | Admin membuka dokumen lewat signed URL 5 menit. | — |

Batas yang diterima (`ponytail:`):
- Aturan formulir dan angka untuk data milik user sendiri berjalan di browser user. Dampaknya hanya ke data user itu sendiri, dan semua yang menyentuh pihak lain dijaga trigger.
- Admin yang sengaja memanggil REST langsung bisa melewati pencatatan audit untuk mutasi katalog, artikel, dan konfigurasi. Transisi pengajuan tetap dijaga matriks di database. Upgrade: pindahkan mutasi admin ke RPC.
- Setiap operasi memuat data akun (admin: semua akun). Ini cukup untuk skala pilot. Upgrade: query agregat SQL saat sudah ribuan user.
- Reminder email (Fase 4) belum termasuk.

## Amandemen 2 (2026-10-09): email dari database, bukan SMTP

Di self-hosted, pengaturan server login hanya bisa diubah lewat env VPS. Supaya urusan VPS seminimal mungkin (keputusan user), email dikirim dari Postgres:

| Topik | Keputusan | Menggantikan |
|---|---|---|
| Email kode OTP | Send Email Hook GoTrue → `public.send_email_hook` (pg-functions) → `private.send_email` → API Resend lewat `pg_net` | SMTP Resend di env GoTrue + template server Caddy |
| Email reminder (Fase 4b) | `private.send_reminder_emails` dijalankan job harian (`private.run_daily_reminders`, setelah `enqueue_reminders`). Email yang harinya (`target_date − offset_days`) sudah lewat ditandai `skipped` | Edge Function `send-reminders` + Nodemailer |
| Key Resend | Supabase Vault (`resend_api_key`, key *Sending access*), dimasukkan user sendiri lewat SQL Editor | env Edge Function |
| VPS | `ENABLE_PHONE_*=false` + 2 baris hook + 2 baris OTP. Google OAuth tetap lewat env bila dipakai | SMTP_* + templates-server + 6 baris template |

Batas (`ponytail:`): `pg_net` mengirim secara asinkron. Kegagalan dari Resend tercatat di `net._http_response`, tidak dilaporkan ke server login atau baris reminder (yang sudah ditandai `sent`). Upgrade: rekonsiliasi status dari `net._http_response` bila perlu.

## Amandemen 3 (2026-10-12, revisi 2026-10-13): login email + password, kode untuk daftar, link untuk lupa password

Keputusan user: login non-Google memakai email + password. Kode 6 digit ke email hanya dipakai saat daftar pertama kali (verifikasi email). Lupa password mengirim link yang membuka halaman app untuk membuat password baru (revisi user 2026-10-13: email reset berisi link, tidak ada kode). Google tetap ada.

| Topik | Keputusan | Menggantikan |
|---|---|---|
| Halaman | `/login` (email + password, link Lupa password), `/register` (nama, email, password + ulangi, centang S&K + Privasi), `/verify` (kode daftar), `/forgot-password` (email → "Cek email kamu") → link email → `/reset-password` (password baru, atau "Link tidak bisa dipakai"), `/welcome` (hanya login Google pertama / versi S&K baru), ubah password di `/profile/password` dan `/admin/password` | `/register` "Masuk atau daftar" + kode OTP di setiap login |
| Status sesi | `guest` → `pending` (menunggu kode daftar) / `recovery` (masuk lewat link reset, wajib membuat password baru) → `onboarding` → `authenticated`; `HOME_OF.guest = '/login'` | `pending` untuk kode login |
| `api.auth` | `signInWithPassword`, `signUp`, `verifySignup`, `requestPasswordReset` (link ke `${origin}/reset-password`), `updatePassword`, `resendOtp`, `changePassword`, `providers` (+ `signInWithGoogle`, `acceptConsents`, `logout`, `deleteAccount`, `onChange`) | `sendEmailOtp`, `verifyEmailOtp` |
| Persetujuan | Dicentang di form Daftar, dicatat lewat `accept_consents` begitu kode benar, jadi pendaftar email langsung ke Home | Selalu lewat `/welcome` |
| Password | Minimal 8 karakter, berisi huruf dan angka (maks 72), dicek app dan GoTrue (`GOTRUE_PASSWORD_MIN_LENGTH`, `GOTRUE_PASSWORD_REQUIRED_CHARACTERS`). Ganti password: login ulang dengan password lama, lalu `updateUser` (`GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=true` aman) | Tidak ada password |
| Email | Tetap SMTP Resend + templates-server: template *confirmation* (kode daftar) dan *recovery* (link, bawaan GoTrue atau `recovery.html`). Wajib di VPS: `SITE_URL` + `ADDITIONAL_REDIRECT_URLS` ke alamat app (runbook langkah 5) | Template *magic link* untuk login |
| Tombol Google | Tampil hanya bila `/auth/v1/settings` → `external.google` | Selalu tampil |

Aturan yang menjaga keamanan:
- **Email yang belum pernah diverifikasi lalu didaftarkan ulang:** GoTrue tidak mengganti password lamanya, tapi tetap mengirim kode baru. Setelah kode benar, app langsung menyimpan password yang baru diketik (`updateUser`), jadi yang dipakai adalah password pemilik inbox, bukan password pendaftar sebelumnya.
- **Login dan lupa password tidak membocorkan email terdaftar:** keduanya memberi jawaban yang sama untuk email yang ada dan yang tidak ada. Halaman Daftar memang memberi tahu "Email ini sudah terdaftar" (GoTrue mengembalikan user tanpa identities), demi kejelasan bagi user.
- **Email terdaftar tapi belum diverifikasi lalu login:** kode baru dikirim, dan `/verify` menyelesaikan akunnya. Persetujuan kemudian diminta di `/welcome`.
- **Data sementara:** email, password, dan nama yang menunggu kode hanya ada di memori tab. Refresh berarti mulai lagi dari `/login`.
- **Link reset:** PKCE, jadi link harus dibuka di browser tempat reset diminta, dan hanya sekali. supabase-js melaporkannya lewat event `PASSWORD_RECOVERY` (didengar `client.js` sejak client dibuat); sesi itu berstatus `recovery` sampai password baru tersimpan. Link gagal → `/reset-password` menawarkan link baru. Batas (`ponytail:`): template dengan `{{ .TokenHash }}` + `verifyOtp({ token_hash })` akan bisa dibuka dari perangkat mana pun.

Mock: akun seed dan staf memakai `DEMO_PASSWORD = 'ruangkpr123'`.

## Amandemen 4 (2026-10-13): riwayat perubahan oleh user sendiri

Keputusan user: admin juga melihat perubahan yang dibuat user sendiri, dengan nilai lama → baru, untuk profil, keuangan, data KPR aktif, dan pembayaran.

| Topik | Keputusan |
|---|---|
| Penyimpanan | Tabel `public.user_changes` (`user_id`, `doc` = `{ action, resource, before, after }`, `occurred_at`). Hanya super admin yang bisa membaca. Tidak ada yang bisa menulis dari app; yang menulis hanya trigger. `audit_log` tetap khusus aksi staf (beserta alasannya), jadi Audit Log dan Overview tidak berubah |
| Siapa yang tercatat | Trigger `AFTER UPDATE` di `profiles` dan `mortgages` (`SECURITY DEFINER`) hanya mencatat bila `auth.uid()` adalah pemilik baris. Edit oleh admin dan job (cron) tidak masuk |
| Yang dicatat | `profile`: nama, NIK (tersamar), data pribadi, pekerjaan. `finance`: penghasilan dan utang. `mortgage.activate`. `mortgage.update`: field inti KPR, `property.*`, `reminders.*` (daftar field eksplisit; salinan `finance` di KPR tidak, karena profil sudah mencatatnya). `payment.mark` / `payment.unmark`. Pengaturan KPR yang masih draft tidak dicatat |
| App | `supabaseStore` memuat tabel ini untuk admin (`db.userChanges`); `admin.users.get` menggabungkannya dengan `audit_log` milik user itu (`actor.role: 'user'`), terbaru di atas. Panel "Riwayat perubahan" di profil dan "Riwayat perubahan KPR" menampilkan nilai lama → baru |
| Mock | Tidak ada database, dan di demo user dan admin tidak pernah berbagi data. Skenario `admin_ops` menyiapkan dua contoh untuk Sari |

Batas (`ponytail:`): setiap pemanggilan admin memuat seluruh `user_changes`. Upgrade: filter per user di query bila tabelnya membesar. Perubahan sebelum migration ini tidak tercatat. Password lain disimpan di `db.passwords`. Kode daftar tetap `148260` (`000000` salah, `999999` kedaluwarsa). Link reset: `openResetLink()` (tombol "Buka link reset (mode demo)") memakai `db.resetLink`. Versi skema mock naik ke 5.
