# Logo Bank — Design

Tanggal: 2026-10-19 · Status: disetujui per bagian di chat (bagian 1–2); bagian 3–5 dilanjutkan atas izin user ("lanjut aja sampai production")

## Tujuan
- Admin (`super_admin`) bisa mengunggah, mengganti, dan menghapus logo per bank di `/admin/banks`.
- Semua fitur yang sudah menampilkan "gambar" bank (kotak kode atau ikon gedung) memakai logo itu.
- Logo yang diganti langsung berlaku di semua layar tanpa ada data yang perlu di-update, dan tidak pernah tampil sebagai gambar rusak.

## Keputusan
| Topik | Keputusan |
|---|---|
| Penyimpanan | Supabase Storage, bucket publik `bank-logos` (1 MB, PNG/JPG). SVG ditolak (bisa membawa script bila URL dibuka langsung). WebP tidak dipakai: `UPLOAD_FORMATS` yang sudah ada dipakai ulang, dan menambah WebP di sana ikut membuka WebP untuk dokumen. |
| Data bank | `logo: { path, url } \| null` di `banks.doc`. Setiap upload memakai nama file baru (`{uuid}.{ext}`), jadi URL berubah dan cache browser tidak pernah menampilkan logo lama. |
| Satu sumber | Logo hanya ada di baris bank. Data lain menyimpan `bankId` dan logo dicari saat dibaca. |
| Fallback | Tanpa logo, gagal dimuat (`onError`), "Bank lainnya", atau ID tidak ditemukan → kotak kode seperti sekarang. |
| KPR berjalan & bank lama | Dropdown memakai daftar bank admin + "Bank lainnya" (pilihan user di chat). Yang disimpan: `bankName` (tetap, untuk teks/email/riwayat) + `bankId`. |
| Nonaktif | Tetap berarti "tidak ikut pencocokan program". Semua user login boleh membaca semua bank, termasuk yang nonaktif (KPR user bisa ada di bank itu). |
| Teks | Nama bank di teks, email reminder, dan surat pengantar tetap memakai `bankName` tersimpan. Fungsi email tidak disentuh. |

## 1. Data & Storage
- Migration `20261019100000_bank_logos.sql`:
  - bucket `bank-logos` (`public = true`, `file_size_limit = 1048576`, `allowed_mime_types = {image/jpeg,image/png}`);
  - policy `storage.objects` untuk bucket ini: insert, select, delete hanya `private.has_role('super_admin')`. Baca publik lewat URL publik bucket. `remove()` butuh select + delete.
  - `banks_select` diganti `using (true)` untuk `authenticated`;
  - backfill `bankId` untuk data lama yang namanya cocok persis: `mortgages.doc.bankId`, `applications.doc.selection.bankId` (lewat `bank_products.bank_id`), `applications.doc.data.oldLoan.bankId`. Dijalankan sebagai `postgres` (`private.trusted()`), jadi trigger status tidak menolak, dan `log_mortgage_change` tidak mencatat apa pun (bukan `auth.uid()`).
- `bankIssues` (mockApi): nama bank harus unik (tanpa beda huruf besar/kecil), karena dropdown dan penautan `bankId` saat simpan memakai nama. `logo` harus `null` atau `{ path: string, url: string }`.

## 2. Jalur baca (mockApi.js)
- `bankFor(db, { bankId, bankName })` → `{ id, name, mark, logoUrl }`. Pencarian per `bankId`, lalu per nama persis (data lama), lalu `{ id: null, name, mark: markOf(name), logoUrl: null }`. `markOf` pindah dari `ProgramPages.jsx` ke `src/lib/format.js`.
- Dipakai di:
  - `productsOf` → `bank` setiap produk dibaca dari daftar bank saat ini (compare KPR Baru, Take Over, milestone);
  - `dashboard.getSnapshot` → field baru `banks` (semua bank, urut nama, bentuk `{ id, name, mark, logoUrl }`) untuk dropdown, dan setiap mortgage mendapat `bank` (hasil `bankFor`);
  - `simulationSource` → `oldBank` mendapat `mark` dan `logoUrl`.
- Saat simpan: `bankId` diisi dari nama yang dipilih (`bankIdFor(db, name)`) di `mortgages.saveSetupStep`/`update` dan di `applications.saveStep` (`oldLoan`). `selectionFrom` menyimpan `bankId: product.bank.id`. KPR yang dibuat dari pengajuan cair mengambil `bankId` dari selection. `takeoverDataFromMortgage` menyalin `bankId`.

## 3. Upload & API admin
- `admin.banks.create({ values: { name, mark, logo }, reason })` dan `update(id, { values: { …, logo }, reason, expectedVersion })`. `logo`: `undefined` = tidak berubah, `null` = hapus, `File` = baru.
- Aturan file: `uploadProblem(file, LOGO_UPLOAD)` dengan `LOGO_UPLOAD = { maxFileMb: 1, formats: ['jpg', 'png'] }` (di `documentRules.js`).
- Mock (`createMockApi`): `File` → `{ path: '{uuid}.{ext}', url: <data URL> }` sebelum transaksi.
- Supabase (`src/data/supabase/index.js`), sama dengan pola dokumen:
  1. upload ke `bank-logos/{uuid}.{ext}`;
  2. simpan bank dengan `{ path, url: getPublicUrl(path) }`; kalau gagal, file baru dihapus;
  3. setelah sukses, file lama (diganti atau dihapus) dihapus.
- Audit `bank.update`/`bank.create` mencatat `logo` sebagai path file (label "Logo").

## 4. UI
- `BankMark({ bank, size, tone })`: kalau ada `bank.logoUrl` dan belum gagal dimuat, tampil `<img alt="">` (`object-contain`) di kotak putih dengan ring tipis. Selain itu kotak kode seperti sekarang. Tetap `aria-hidden`, karena nama bank selalu tertulis di sebelahnya.
- Dipakai di:
  - `ProgramPages` (4 tempat: bank lama dan bank baru);
  - `PrimaryCompare` daftar + detail (mengganti ikon gedung);
  - kartu KPR di Home (`ActiveMortgageMini`, mengganti ikon gedung);
  - widget "KPR Saya" (mengganti kode dari nama);
  - daftar bank admin (logo kecil di samping nama).
- Dialog bank admin: pratinjau logo, tombol "Pilih logo" (`<input type="file" accept="image/png,image/jpeg">`), "Hapus logo", petunjuk "PNG/JPG maks. 1 MB, bentuk persegi, latar putih/transparan". File diperiksa langsung (`uploadProblem`) supaya error muncul sebelum simpan.
- Dropdown "Bank" (setup KPR) dan "Bank asal" (Take Over) memakai `bankOptions(snap.banks)` + "Bank lainnya". `BANKS` di `format.js` dihapus. Nilai awal: nama bank saat ini menurut `bankId`, lalu nama tersimpan bila cocok, lalu "Bank lainnya".
- Teks nama bank lain dan kartu pengajuan tidak diubah (tidak menambah pola visual baru).

## 5. Tes & rilis
- Vitest (`mockApi.test.js`):
  - logo dibuat, diganti, dihapus, plus audit;
  - file salah format atau lebih dari 1 MB ditolak;
  - nama bank duplikat ditolak;
  - ganti logo langsung terlihat di compare dan snapshot tanpa menyentuh produk;
  - snapshot memuat bank nonaktif;
  - `bankId` terisi saat KPR disimpan dan `null` untuk "Bank lainnya";
  - `oldBank` simulasi membawa logo.
- Vitest UI: `BankMark` kembali ke kode saat gambar gagal dimuat.
- Vitest Supabase adapter: urutan upload → simpan → hapus file lama, dan file baru dihapus bila simpan gagal.
- pgTAP `013_bank_logos.test.sql`:
  - bucket publik dengan batas ukuran dan tipe file;
  - user biasa ditolak upload, `super_admin` boleh;
  - user biasa membaca bank nonaktif.
- Playwright (`admin-products.spec.js`): admin mengunggah logo lalu logo tampil di daftar bank. `mortgage-monitoring.spec.js` tetap memilih "Bank ABC".
- Rilis:
  1. dry-run migration + pgTAP 013 di VPS (rollback);
  2. terapkan migration + catat di `supabase_migrations.schema_migrations`;
  3. cek backfill (2 KPR + pengajuan).
