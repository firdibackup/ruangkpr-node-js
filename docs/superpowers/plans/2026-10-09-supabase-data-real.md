# Supabase Data Asli (Fase 2–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semua halaman B2C dan admin memakai data asli di Supabase VPS. Tidak ada data demo yang tampil ke user.

**Architecture:** `createMockApi` mendapat *store* yang bisa diganti. `localStore` (localStorage) tetap dipakai test. `supabaseStore` memuat akun dari tabel dokumen (`doc jsonb` + kolom terpromosi), menjalankan operasi mock yang sama, lalu menulis hanya baris yang berubah dengan cek `version` (dicoba ulang saat bentrok). Database menegakkan RLS per user/peran dan trigger penjaga transisi. Upload memakai Storage (XHR agar progress asli). Akun dihapus lewat RPC.

**Tech Stack:** supabase-js 2.117.3, Postgres 17 (plpgsql, RLS, triggers), Supabase Storage, pgTAP via `/pg/query`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-supabase-backend-design.md` (termasuk Amandemen sore).

## Global Constraints
- Perilaku UI dan bentuk data yang dikembalikan **identik** dengan mock. 181 unit test + 44 e2e (mode mock) tetap hijau.
- `isMock` = `VITE_DATA_SOURCE === 'mock'`, atau tidak diisi dan `MODE === 'test'`. Default build/dev = Supabase. Playwright memaksa `VITE_DATA_SOURCE=mock`.
- Setiap tabel `public`: RLS aktif, `revoke all from anon, authenticated`, lalu GRANT minimal. Fungsi `public`: `revoke all from public, anon`.
- Kolom terpromosi (`status`, `superseded`, `slug`) **selalu** diturunkan trigger dari `doc`, tidak pernah dipercaya dari client.
- Katalog kosong (tanpa seed). Artikel edukasi di-seed sebagai published.
- Tanggal `db.clock` = hari ini zona Asia/Jakarta. Waktu `nowIso` = waktu nyata (ISO).
- Secret key hanya dipakai skrip lokal (migration/test), tidak pernah oleh `src/`.

## Review Focus
1. **Dua upload paralel pada satu pengajuan** → keduanya tersimpan (cek `version` + coba ulang). Test: T3 `retries the operation when a row changed meanwhile`.
2. **User mencoba submit lewat REST dengan bunga palsu atau produk draft** → ditolak trigger. Test: T2 pgTAP `submit with a forged rate is rejected`.
3. **Operasi baca tidak boleh menulis** (`decorate` menambah `requiredDocuments`) → `planWrites` menormalkan field turunan. Test: T3 `a read writes nothing`.
4. **Staf mencoba mengubah draft user atau melompati status** → ditolak. Test: T2 `staff cannot touch drafts` / `staff must follow the status matrix`.
5. **User onboarding (belum consent) menulis data** → ditolak RLS. Test: T2 `writes need consent`.

---

### Task 1: Store yang bisa diganti di `createMockApi`
**Files:** Modify `src/data/mockApi.js`; Create `src/data/store.test.js`.
**Produces:** `createMockApi({ latencyMs, store })`; `store = { load({ admin }) → db | Promise<db>, save(db, before) → void | Promise }`; hook `db.newId(prefix)` dan `db.now()` (dipakai `nextId`/`nowIso` bila ada); `recordDocument(db, app, documentType, file)` dipakai bersama mock dan Supabase.
- [ ] Test RED: store tiruan di memori → `load` menerima `{ admin: true }` untuk operasi admin, `save` menerima db yang sudah diubah dan snapshot sebelum diubah, id baru memakai `db.newId`.
- [ ] Implementasi: `call` jadi async atas store; `uploadDocument` mock memakai `recordDocument`; `localStore` = `loadDb/saveDb`.
- [ ] `npx vitest run` → semua hijau.

### Task 2: Migration data aplikasi + Storage + hapus akun + seed artikel (dijalankan di VPS)
**Files:** `supabase/migrations/<ts>_app_data.sql`, `supabase/migrations/<ts>_seed_articles.sql` (dibuat dari `src/data/articles.js` oleh skrip), `supabase/tests/002_app_data.test.sql`.
**Produces:** tabel dokumen + trigger penjaga + RLS + bucket `application-documents`/`payment-proofs` + policy Storage + `public.delete_my_account()` + `private.has_consented()`.
- [ ] Test pgTAP RED (dijalankan ke VPS sebelum migration → gagal karena tabel belum ada), mencakup: pemilik CRUD draft sendiri; tidak bisa insert non-draft; tidak bisa set status sembarangan; submit ditolak tanpa produk valid / bunga palsu / dokumen kurang; submit valid lulus; data terkunci setelah submit; user B tidak bisa membaca A; staf tidak bisa menyentuh draft; staf mengikuti matriks; `disbursed` oleh staf boleh membuat KPR aktif untuk pemilik; tulis data butuh consent; katalog: user hanya melihat published + bank aktif; artikel published terlihat; audit hanya bisa ditambah dan actor dipaksa; content_writer tidak bisa membaca pengajuan; Storage: pemilik hanya bisa upload ke foldernya saat draft.
- [ ] Migration, jalankan ke VPS, catat di `supabase_migrations.schema_migrations`.
- [ ] Test pgTAP → semua ok (Fase 1 juga tetap 14/14).

### Task 3: `supabaseStore`
**Files:** `src/data/supabase/store.js`, `src/data/supabase/store.test.js`.
**Produces:** `createSupabaseStore({ client }) → { load({ admin }), save(db, before) }`; fungsi murni `planWrites(before, after) → ops[]`; `ConflictError` untuk dicoba ulang oleh `call`.
- [ ] Test RED `planWrites`: operasi baca tidak menulis apa pun; pengajuan baru → insert; berubah → update dengan versi lama; dihapus → delete; activity baru / readAt berubah; profil dan finance → update kolom; audit/notes/health baru → insert; config berubah → upsert; produk/bank/artikel → upsert.
- [ ] Test RED `load`: menyusun db (user, profile, finance, applications, mortgages, activities, simulation, catalog, articles, config, health; admin: accounts tanpa staf).
- [ ] Implementasi + `call` mencoba ulang hingga 3× saat `ConflictError`.

### Task 4: Adapter Supabase lengkap + mode default
**Files:** `src/data/supabase/index.js`, `src/data/supabase/storage.js`, `src/data/api.js`, `playwright.config.js`, `src/data/supabase/auth.js` (deleteAccount).
- [ ] `createSupabaseApi` = `createMockApi({ store: supabaseStore })`, dengan override `auth`, `applications.uploadDocument` / `removeDocument` (Storage), `mortgages.markPaid` (bukti ke Storage), `auth.deleteAccount` (hapus file → RPC), `admin.applications.documentUrl`.
- [ ] `isMock` baru; Playwright `webServer.env.VITE_DATA_SOURCE = 'mock'`, `reuseExistingServer: false`.

### Task 5: Admin membuka dokumen
**Files:** `src/domains/admin/ApplicationsPages.jsx`, `src/data/mockApi.js` (`admin.applications.documentUrl` mock → error yang jelas).
- [ ] Tombol "Lihat" per dokumen yang sudah diunggah → buka signed URL di tab baru.

### Task 6: Uji integrasi langsung ke VPS
**Files:** `src/data/supabase/live.test.js` (hanya jalan dengan `LIVE=1`), skrip pembantu di scratchpad.
- [ ] User uji sementara dibuat lewat Admin API (secret key), masuk dengan password, lalu menjalankan alur lewat `createSupabaseApi`: profil → buat draft → simpan langkah → upload dokumen → (admin membuat bank + produk) → pilih program → submit → admin memproses → `disbursed` membuat KPR → tandai bayar → hapus akun. Semua data uji dihapus di akhir.

### Task 7: Verifikasi + dokumentasi
- [ ] Lint, unit, build (default = Supabase, tanpa `mockDb` di bundle), e2e mode mock.
- [ ] README, `supabase/README.md`, CLAUDE.md (pengecualian localStorage supabase-js, mode default), `.env.local` `VITE_DATA_SOURCE=supabase`.
