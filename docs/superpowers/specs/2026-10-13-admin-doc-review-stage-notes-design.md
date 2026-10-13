# Verifikasi Dokumen per File & Info Tahap untuk User — Design

Tanggal: 2026-10-13 · Status: disetujui per bagian di chat, menunggu review spec tertulis

## Tujuan
- Admin memeriksa **setiap dokumen** pengajuan: **Sesuai** atau **Tolak** dengan alasan (buram, terpotong, kedaluwarsa, …), lalu mengirim semua penolakan ke user sekaligus.
- User melihat di **Home** dan tracker **dokumen mana** yang ditolak dan alasannya, lalu mengunggah ulang.
- Di setiap tahap proses (Verifikasi → Proses Bank → Appraisal → Disetujui → Pelunasan KPR Lama → Akad) admin bisa menulis **pesan untuk user** yang bisa diedit. Koordinasi tetap di **WhatsApp**: admin mencatat hasil kesepakatannya (mis. jadwal appraisal) dan user melihatnya di aplikasi. Belum diisi = "menunggu konfirmasi (TBC)".

## Keputusan
| Topik | Keputusan |
|---|---|
| Aksi dokumen | Per baris di panel Dokumen admin: **Sesuai** (langsung) / **Tolak** (draf, belum terlihat user) → **Kirim permintaan revisi ke user** (satu notifikasi). |
| Syarat Proses Bank | "Teruskan ke bank" hanya bila **semua dokumen wajib `verified`**. Ditegakkan di `mockApi.js` dan trigger database. |
| Interaksi tahap | **Satu arah**. Diskusi di WhatsApp; admin mencatat hasilnya. Tidak ada tombol konfirmasi/chat di aplikasi. |
| Isi pesan tahap | Semua tahap: pesan teks. **Appraisal**: tanggal, jam, lokasi (wajib) + catatan (opsional). Akad memakai tanggal dari "Angka final akad" yang sudah ada. |
| Edit | Admin mengisi/mengedit pesan **tahap yang sedang berjalan**; user selalu melihat versi terakhir. Riwayat versi tidak disimpan (audit log mencatat perubahan). |
| Penyimpanan | **Pendekatan A**: di JSON pengajuan (`documents[t].review`, `stageNotes`), seperti `pendingActions`/`finalTerms`. Tanpa tabel baru; `supabaseStore` tidak berubah. |
| Di luar cakupan | Email notifikasi (tetap Activity in-app), riwayat versi pesan, chat dua arah, konfirmasi user di aplikasi. |

## 1. Data

### 1.1 Review dokumen
`app.documents[type]` mendapat field opsional `review` untuk penolakan yang belum dikirim:

```js
documents.npwp = {
  status: 'uploaded',            // tetap 'uploaded' selama draf
  fileName, sizeBytes, contentType, uploadedAt, path,
  review: { reasonCode: 'blurry', note: 'angka NPWP tidak terbaca', at: '2026-10-13T…' },
}
```

| Aksi admin | Hasil |
|---|---|
| **Sesuai** | `status: 'verified'`, `review` dihapus. |
| **Tolak** | `status: 'uploaded'` (juga bila sebelumnya `verified`), `review` diisi. User belum melihat apa pun. |
| **Kirim permintaan revisi** | Setiap dokumen ber-`review` → `status: 'needs_update'`, `invalidReason` = pesan, `review` dihapus, satu `pendingActions` per dokumen. Status pengajuan → `additional_docs_requested`. |
| User upload ulang | `recordDocument` yang ada menulis objek baru (`status: 'uploaded'`, tanpa `review`/`invalidReason`). Admin memeriksa ulang setelah status kembali ke Verifikasi Dokumen. |

- Sesuai/Tolak hanya saat status **`docs_verification`**, hanya untuk dokumen yang punya file. Dokumen opsional boleh diperiksa, tapi tidak menjadi syarat Proses Bank.
- **Alasan penolakan** (`DOC_REJECT_REASONS` di `src/data/documentRules.js`, dipakai `mockApi.js` dan halaman admin):

  | Kode | Label |
  |---|---|
  | `blurry` | Buram / tidak terbaca |
  | `cropped` | Terpotong / tidak lengkap |
  | `expired` | Kedaluwarsa |
  | `mismatch` | Tidak sesuai data pengajuan |
  | `wrong_document` | Bukan dokumen yang diminta |
  | `other` | Lainnya (catatan **wajib**) |

  Catatan opsional untuk kode lain; maks. 300 karakter.
- **Pesan per dokumen** = `"<label alasan>"` atau `"<label alasan>: <catatan>"`. Bentuk `pendingActions` tidak berubah: `{ id, type: 'document_update', documentType, message, requestedAt }`.

### 1.2 Info tahap
```js
app.stageNotes = {
  appraisal: { message: 'Siapkan IMB/PBG asli', schedule: { date: '2026-10-18', time: '10:00', location: 'Jl. Melati 12, Bekasi' }, updatedAt: '…' },
  bank_processing: { message: 'BCA minta waktu 5 hari kerja untuk analisis.', schedule: null, updatedAt: '…' },
}
```
- Kunci = status. Status yang boleh diberi info: `docs_verification`, `bank_processing`, `appraisal`, `approved`, `old_mortgage_settlement`, `akad` (`STAGE_NOTE_STATUSES`).
- Admin hanya menyimpan info untuk **status yang sedang berjalan**; menyimpan ulang menimpa isi sebelumnya.
- Validasi:
  - `appraisal`: `schedule.date` (tanggal ISO valid), `schedule.time` (`HH:MM`), `schedule.location` (3–200 karakter) wajib; `message` opsional (maks. 500).
  - Status lain: `message` wajib 5–500 karakter; `schedule` selalu `null`.

## 2. Logika (`mockApi.js`) & API

Semua method admin baru memakai `expectedVersion` (konflik → `CONFLICT_VERSION`, sama seperti `transition`) dan mengembalikan bentuk yang sama dengan `admin.applications.get`.

| Method `api` | Perilaku |
|---|---|
| `admin.applications.reviewDocument(id, { documentType, result: 'ok' \| 'rejected', reasonCode, note, expectedVersion })` | Status harus `docs_verification` dan dokumen punya file, selain itu `INVALID_STATE_TRANSITION`. `rejected` memvalidasi `reasonCode`/`note` (`fieldErrors`). Menulis audit `application.document_review` (before/after status dokumen + alasan). |
| `admin.applications.transition(id, { toStatus: 'additional_docs_requested', reason, expectedVersion })` | **Berubah**: tidak lagi menerima `metadata.documentTypes/message`. Mengambil dokumen ber-`review`; tanpa satu pun → `fieldErrors` "Tolak minimal satu dokumen dulu." Satu Activity ke user. |
| `admin.applications.transition(…, toStatus: 'bank_processing')` | Tambahan syarat: semua dokumen wajib (`requiredDocuments`) `verified`, selain itu `INVALID_STATE_TRANSITION` "Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank." |
| `admin.applications.saveStageNote(id, { message, schedule, expectedVersion })` | Menyimpan `stageNotes[app.status]`. Status di luar `STAGE_NOTE_STATUSES` → `INVALID_STATE_TRANSITION`. Audit `application.stage_note`. Activity ke user. |

Halaman admin mengimpor `DOC_REJECT_REASONS` langsung dari `documentRules.js`, seperti `UploadRow.jsx` dan `ConfigurationPage.jsx` sekarang.

- Dev shortcut di tracker (`DemoControls` / dev helper di `mockApi.js` baris ±2110) diubah: menulis `review` dulu, lalu transisi ke `additional_docs_requested`.
- Activity user:

  | Peristiwa | Judul | Isi |
  |---|---|---|
  | Kirim revisi | Dokumen perlu diunggah ulang | "NPWP, Slip Gaji / Bukti Penghasilan perlu diperbarui." |
  | Info tahap pertama kali | Info baru dari tim · {Tahap} | Appraisal: "Jadwal appraisal sudah dikonfirmasi." Lainnya: "Buka detail pengajuan untuk membaca pesannya." |
  | Info tahap diedit | Info {Tahap} diperbarui | sama seperti di atas |

  Semua dengan aksi "Lihat status" → `/my-kpr/application`. Isi pesan **tidak** disalin ke Activity agar notifikasi lama tidak menampilkan teks yang sudah diedit.
- Teks "Bank" untuk pemeriksaan dokumen diganti "tim RuangKPR": Activity `document_replaced` ("Menunggu verifikasi dari tim RuangKPR."), kartu Home, dan tracker (§4).

## 3. Aturan database

Migration baru `supabase/migrations/20261013120000_document_review.sql`, mengganti `private.applications_write()`; test `supabase/tests/008_document_review.test.sql`.

1. **Syarat Proses Bank (cabang admin).** Bila `old.status <> 'bank_processing'` dan `new.status = 'bank_processing'`, setiap `t` di `private.required_documents(new.doc)` harus punya `new.doc #>> {documents,t,status} = 'verified'`; selain itu `INVALID_STATE_TRANSITION`.
2. **Batas upload ulang (cabang user, status `additional_docs_requested`).** Selain syarat yang ada (`doc - v_reupload` tidak berubah):
   - setiap dokumen yang **bukan** `needs_update` di `old` harus identik di `new`;
   - dokumen yang `needs_update` di `old` boleh tetap sama, atau menjadi `status = 'uploaded'` tanpa `review` dan dengan `invalidReason` kosong;
   - `pendingActions` hanya boleh berkurang, dan setiap entri yang hilang harus untuk dokumen yang berubah menjadi `uploaded` di write yang sama;
   - `statusHistory` sama dengan `old`, atau `old` + satu entri `docs_verification` (hanya bila `pendingActions` menjadi kosong).

   Celah yang ditutup: sekarang user bisa menimpa seluruh `documents` (mis. menandai dokumen sendiri `verified`) atau mengosongkan `pendingActions` tanpa upload.
3. `stageNotes` dan `review` tidak bisa ditulis user: `stageNotes` di luar `v_reupload`, `review` dijaga aturan 2. Admin menulis keduanya lewat cabang `new.status = old.status` yang sudah ada.

Catatan: draf `review` tersimpan di data pengajuan milik user. Isinya tidak tampil di aplikasi sebelum dikirim, tapi bisa dibaca pemiliknya lewat API. Ini diterima: dokumen itu milik user sendiri.

Data di VPS tidak perlu dimigrasi: aturan 1 hanya berlaku saat masuk ke Proses Bank; pengajuan yang sudah lewat tahap itu tidak terpengaruh.

## 4. Tampilan

### 4.1 Admin — detail pengajuan (`src/domains/admin/ApplicationsPages.jsx`)
**Panel Dokumen**
- Status `docs_verification`, dokumen punya file: `[Unduh] [Sesuai] [Tolak]` + chip status. Di layar sempit tombol turun ke bawah nama file.
- Chip: Terunggah / Terverifikasi / **Ditolak · belum dikirim** (`bad`) / Perlu diperbarui.
- Draf penolakan tampil di bawah baris: "↳ Buram / tidak terbaca — angka NPWP tidak terbaca".
- **Sesuai** langsung tersimpan (spinner di tombol, `aria-busy`). **Tolak** membuka `FormDialog`: `SelectField` alasan + `TextAreaField` catatan (wajib bila "Lainnya") → "Simpan penolakan".
- Kaki panel (hanya di `docs_verification`): "3 dari 4 dokumen wajib diperiksa · 1 ditolak" + tombol **Kirim permintaan revisi ke user** (aktif bila ada ≥1 draf). Tombol membuka `TransitionDialog` untuk `additional_docs_requested`: daftar dokumen yang ditolak beserta alasannya, lalu "Catatan perubahan status" (internal, wajib) seperti sekarang.
- Error: `CONFLICT_VERSION` → toast + muat ulang; error lain → toast dengan pesan server.

**Panel Langkah berikutnya**
- Tombol "Minta revisi dokumen" dihapus (pindah ke panel Dokumen).
- **Teruskan ke bank** nonaktif dengan keterangan "Semua dokumen wajib harus Sesuai." sampai syarat §2 terpenuhi.

**Panel baru "Info untuk user · {Tahap}"** (kolom kanan, di atas Riwayat status)
- Tampil bila `app.status` ada di `STAGE_NOTE_STATUSES`.
- Appraisal: `DateField` Tanggal, input jam bawaan browser (`type="time"`, lewat `TextField type`), `TextField` Lokasi, `TextAreaField` Catatan (opsional).
- Tahap lain: `TextAreaField` Pesan.
- Belum diisi: hint "Belum diisi. User melihat: jadwal menunggu konfirmasi tim via WhatsApp." (Appraisal) atau "Belum diisi. User belum melihat info tambahan." (lainnya).
- Tombol **Simpan** + "Terakhir diubah {tanggal}". `fieldErrors` tampil per kolom; `CONFLICT_VERSION` memakai `Notice` + "Muat ulang data" seperti `TransitionDialog`.

### 4.2 User — Home (`InProcessSection`) & tracker (`ApplicationTracker.jsx`)
Satu komponen **`StageNoteCard`** (diekspor dari `ApplicationTracker.jsx`, dipakai juga oleh `HomePage.jsx`):
- Tampil bila `app.stageNotes?.[app.status]` ada, **atau** status `appraisal` (selalu tampil).
- Isi: judul "Info dari tim RuangKPR", chip tahap, pesan, dan untuk Appraisal `SummaryRows` Tanggal (`dateLong`) / Jam / Lokasi, lalu "Diperbarui {tanggal}".
- Appraisal tanpa jadwal: chip **"Menunggu konfirmasi"** (`warn`) + "Jadwal appraisal akan dikonfirmasi tim lewat WhatsApp."
- Letak: Home — kolom kiri, di bawah `HeroCard`, sebelum "Tahapan pengajuan". Tracker — di bawah kartu hero.

Kartu **Perlu Tindakan** (Home) & bagian permintaan (tracker):
- Judul Home "Ada dokumen yang perlu diunggah ulang"; label tracker "Permintaan tim RuangKPR · {tanggal}".
- Setiap entri: **{label dokumen}** — {pesan}. Tombol "Upload ulang" (Home) → `/my-kpr/application`.
- Daftar dokumen di tracker tidak berubah: `UploadRow` sudah menampilkan `invalidReason` dan tombol "Upload ulang" untuk `needs_update`, dan chip "Terverifikasi" untuk `verified`.

Semua tampilan memakai komponen yang ada (`Panel`, `Chip`, `Notice`, `SummaryRows`, `FormDialog`, field bersama); tidak ada warna/pola visual baru. Target sentuh ≥44px dan label tombol yang jelas untuk pembaca layar (mis. `aria-label="Tolak NPWP"`).

## 5. Pengujian
- **Vitest — `src/data/mockApi.test.js`:**
  - Sesuai → `verified`; Tolak → draf tanpa mengubah tampilan user; Sesuai setelah Tolak menghapus draf; validasi alasan ("Lainnya" tanpa catatan gagal); di luar `docs_verification` gagal.
  - Kirim revisi: pesan per dokumen, `pendingActions` per dokumen, satu Activity; tanpa draf gagal.
  - Teruskan ke bank gagal bila ada dokumen wajib belum `verified`.
  - Upload ulang menghapus `review`/`invalidReason`; semua terunggah → kembali `docs_verification`.
  - `saveStageNote`: validasi jadwal Appraisal, pesan tahap lain, status tidak diizinkan, edit menimpa + Activity "diperbarui".
- **pgTAP — `supabase/tests/008_document_review.test.sql`:** aturan 1 (admin gagal/berhasil masuk Proses Bank) dan aturan 2 (user gagal menandai `verified`, gagal mengubah dokumen lain, gagal mengosongkan `pendingActions` tanpa upload; upload ulang sah tetap berhasil).
- **Playwright — `e2e/`:** admin menolak NPWP (buram) → kirim → user melihat "NPWP — Buram / tidak terbaca" di Home → upload ulang → admin Sesuai semua → Teruskan ke bank → masuk Appraisal → admin mengisi jadwal → user melihat jadwal di Home; sebelum diisi user melihat "Menunggu konfirmasi".
- **Live (`src/data/supabase/live.test.js`):** alur review + kirim + info tahap terhadap Supabase lokal.
- `npm run lint`, `npm run build`.
