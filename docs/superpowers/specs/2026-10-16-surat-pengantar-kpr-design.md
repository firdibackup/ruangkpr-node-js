# Surat Pengantar Aplikasi KPR (cetak dari admin) — Design

Tanggal: 2026-10-16 · Status: disetujui per bagian di chat, menunggu review spec tertulis

## Tujuan
- Admin (`super_admin`) mencetak **Surat Pengantar Aplikasi KPR** RE/MAX untuk pengajuan yang sudah diteruskan ke bank, dengan format seperti contoh `SURAT PENGANTAR APLIKASI KPR MayBank _Ruko Citramaja A25 no 527_Like Huang.pdf`.
- Isi surat terisi otomatis dari data pengajuan dan Konfigurasi. Admin mengedit field yang perlu (nama MA, Sales Officer, nominal, checklist, dll.), menyimpannya, lalu mencetak.
- Satu template untuk **KPR Primary**, **Take Over**, dan **Take Over + Top-up**. Kerangkanya sama; baris pengajuan, nominal, dan tabel dokumen rumah menyesuaikan jenis pengajuan.

## Keputusan
| Topik | Keputusan |
|---|---|
| Kapan bisa dicetak | Status `bank_processing`, `appraisal`, `approved`, `old_mortgage_settlement`, `akad`, `disbursed` (`PRINTABLE_STATUSES`). Ditolak atau belum Proses Bank → tidak ada tombol, dan API menolak. |
| Bentuk | Halaman khusus `/admin/applications/:id/surat-pengantar`: form + pratinjau A4. Cetak memakai `window.print()` dan CSS `@media print` (PDF lewat "Save as PDF" browser). Tanpa dependency baru. |
| Penyimpanan isian | **Per pengajuan**, di tabel baru admin-only `cover_letters`. Tidak di JSON pengajuan, karena user bisa membaca JSON itu dan bisa menulisnya saat draft ulang setelah ditolak. |
| Default kantor | Bagian baru **"Surat pengantar"** di halaman Konfigurasi (`config.coverLetter`): nama kantor, MA default, No. ID RE/MAX, nama BO, rekening marketing fee. Seperti bagian lain: perlu alasan dan masuk audit log. `app_config` terbaca oleh user yang login; isinya hanya identitas kantor dan rekening yang memang tercetak di surat ke bank (diterima). |
| Marketing Associate | Teks bebas per surat, prefill dari default Konfigurasi. Tidak ada daftar agen. |
| Kop surat | Logo RE/MAX (file statis di `public/`) di kiri, judul di tengah, nama bank sebagai teks tebal di kanan. Tidak ada logo per bank. |
| Checklist | Otomatis dari dokumen berstatus `verified`, lalu bisa diubah admin. |
| Konkurensi | Simpanan terakhir yang menang (tanpa cek versi); setiap simpan tercatat di audit log. |
| Di luar cakupan | Logo per bank, daftar MA, generate file PDF di server, riwayat versi surat, tanda tangan digital, form khusus per bank. |

## 1. Data

### 1.1 Default kantor — `config.coverLetter`
```js
config.coverLetter = {
  officeName: 'RE/MAX Eagle Citraland',
  maName: 'Like',
  maId: 'R230021',
  boName: 'Budiono Yuwono',
  feeAccount: 'Rek. Bank BCA Cab. KCU Golden City 511.010.6060 a/n PT. BUANA JAYA MAPAN',
}
```
- `DEFAULT_CONFIG.coverLetter`: semua string kosong. Config lama yang belum punya bagian ini dibaca sebagai default kosong (`configOf(db).coverLetter ?? DEFAULT_COVER_LETTER`).
- `configInput('coverLetter', v)`: setiap field di-trim. `configIssues`: setiap field maksimal 160 karakter, boleh kosong.
- `CONFIG_LABEL.coverLetter = 'Surat pengantar'`. Update lewat `admin.config.update('coverLetter', …)` yang sudah ada.

### 1.2 Surat per pengajuan — `db.coverLetters`
Satu entri per pengajuan, `id` = id pengajuan:
```js
{
  id: 'app_…',
  maName, maId, officeName,                 // dari config, bisa diedit
  customerName, propertyAddress, bankName,  // dari pengajuan, bisa diedit
  loanAmount,                               // integer Rupiah
  takeoverAmount, topupAmount,              // hanya varian Top-up; integer Rupiah
  submittedDate: '2026-10-02',              // YYYY-MM-DD
  salesOfficer: '',                         // boleh kosong
  boName, feeAccount,                       // dari config, bisa diedit
  applicantColumn: 'employee' | 'entrepreneur' | 'professional',
  checked: ['app_ktp_kk', 'app_npwp', 'house_certificate', …], // kunci baris yang dicentang
  updatedAt, updatedBy: { id, name },
}
```
Terbilang tidak disimpan; selalu dihitung dari nominal.

### 1.3 Prefill (surat belum pernah disimpan)
Dibangun di `mockApi` dari `app.snapshot?.data ?? app.data`, `app.selection`, dan `config.coverLetter`:

| Field | Sumber |
|---|---|
| `maName`, `maId`, `officeName`, `boName`, `feeAccount` | `config.coverLetter` |
| `customerName` | `data.personal.fullName`, atau nama akun bila kosong |
| `propertyAddress` | `data.property.address` |
| `bankName` | `selection.bankName` |
| `loanAmount` | `selection.loanAmount` |
| `takeoverAmount` (Top-up) | `data.oldLoan.outstanding` |
| `topupAmount` (Top-up) | `selection.loanAmount − data.oldLoan.outstanding` (minimal 0) |
| `submittedDate` | tanggal (zona Asia/Jakarta) entri `statusHistory` pertama ber-status `bank_processing` |
| `salesOfficer` | kosong |
| `applicantColumn` | dari `data.employment.occupation`: `civil_servant`, `private_employee`, `contract_employee` → `employee`; `entrepreneur` → `entrepreneur`; `freelancer` → `professional`; kosong → `employee` |
| `checked` | baris yang dokumen padanannya `verified` (lihat §2) |

Setelah disimpan, surat selalu dibaca dari `db.coverLetters`. Prefill tidak dihitung ulang, sehingga cetak ulang menghasilkan isi yang sama.

### 1.4 Varian
`variant` diturunkan dari pengajuan: `primary` · `takeover` · `topup` (`productType === 'takeover' && optimizationMode === 'topup'`).

## 2. Isi surat dan checklist

### 2.1 Teks surat
- Judul: **SURAT PENGANTAR APLIKASI KPR**.
- "Bersama surat ini kami :" → Nama Marketing Associate, No. ID RE/MAX, Dari kantor RE/MAX.
- Baris pengajuan per varian: "Mengajukan aplikasi **KPR** / **KPR Take Over** / **KPR Take Over + Top-up** – {bankName} untuk :".
- Nama Nasabah, Alamat Properti (Jaminan), Besarnya KPR yang diajukan: `Rp. 400.000.000,00` + baris terbilang `(Empat Ratus Juta Rupiah)`.
  - Varian `topup`: di bawahnya dua baris rincian, "Take over KPR lama : Rp …" dan "Top-up : Rp …".
- Tanggal Pengajuan (format `2 Oktober 2026`), Pengajuan ke Sales Officer {bankName} : {salesOfficer, atau garis kosong untuk ditulis tangan}.
- Tabel checklist (§2.2), catatan `**) untuk pengusaha dengan badan hukum PT`.
- Kotak "Mohon Marketing Fee dikirimkan ke : {feeAccount}".
- Tanda tangan: "Marketing Associate RE/MAX" `({maName} {officeName})` dan "Mengetahui, Business Owner RE/MAX" `({boName})`.
- Kaki statis seperti contoh, dengan nama bank mengikuti pilihan: stempel kantor RE/MAX dan nama jelas BO & MA; serahkan 1 lembar asli ke cabang atau PIC {bankName}; simpan 1 lembar copy; bukti ke RE/MAX Indonesia via `support@remax.co.id` / fax (021) 5151 392 dengan fotokopi KTP.

### 2.2 Baris checklist
Didefinisikan sekali sebagai konstanta (`COVER_LETTER_ROWS`), diberi kunci, label sesuai form, varian, dan padanan dokumen RuangKPR. Satu baris tercentang otomatis bila **semua** padanannya ada dan `verified`.

**Tabel kiri — Dokumen Aplikan** (centang hanya di kolom `applicantColumn`: Pegawai / Pengusaha / Profesional), untuk semua varian:

| Kunci | Label | Padanan |
|---|---|---|
| `app_ktp_kk` | Fotokopi KTP dan Kartu Keluarga (suami dan istri) | `ktp` (+ `family_card` di Take Over) |
| `app_marriage` | Copy Akta Nikah / Cerai / Kematian / Perjanjian Pranikah | `marriage_document` (Take Over); Primary: manual |
| `app_npwp` | Copy NPWP / SPT PPh 21 Pribadi | `npwp` |
| `app_savings` | Copy Rek. Tabungan / Giro terakhir | `bank_statement`; Primary: manual |
| `app_income` | Asli Surat Keterangan Kerja dan Slip Gaji | `income_proof` |
| `app_license` | Copy Surat Izin Praktek | manual |
| `app_company` | Fotokopi Akta Pendirian Perusahaan dan perubahannya, NPWP, SIUP, TDP ** | manual |
| `app_property` | Surat Pemesanan Rumah (rumah baru) atau Sertifikat, IMB, Denah Bangunan, AJB dan PBB (rumah second) | `property_document` (Primary) / `certificate` (Take Over) |

**Tabel kanan — kolom "Rumah Bekas"**

Bagian **Dokumen Rumah** (semua varian):

| Kunci | Label | Padanan |
|---|---|---|
| `house_certificate` | Copy sertifikat HM / HGB | `certificate` (Take Over); Primary: manual |
| `house_permit` | Copy IMB | `building_permit` (Take Over); Primary: manual |
| `house_plan` | Copy Denah Bangunan | manual |
| `house_ajb` | Copy Akte Jual Beli | `sale_purchase_agreement` (Take Over); Primary: manual |
| `house_pbb` | Copy PBB Terakhir | `land_tax` (Take Over); Primary: manual |

Bagian kedua bergantung varian:
- `primary` → **Dokumen Penjual**: Copy KTP Penjual · Copy KTP istri/suami Penjual · Copy Kartu Keluarga Penjual · Copy Akta Nikah Penjual · Copy NPWP Penjual · Copy Akta Kematian dan Keterangan Waris (jika Penjual meninggal). Semua manual.
- `takeover` / `topup` → **Dokumen KPR Lama**: Copy Akad Kredit Lama (`old_loan_agreement`) · Surat Keterangan Sisa Pokok (`outstanding_letter`) · Bukti Angsuran Terakhir (`latest_payment_proof`) · Informasi Pelunasan / Penalti (`payoff_info`).
- `topup` menambah baris **Rencana Penggunaan Dana** (`fund_plan`).

Kunci baris yang tidak ada di varian surat diabaikan saat simpan (lihat §3.2).

## 3. API (`src/data/mockApi.js`, lewat `src/data/api.js`)

### 3.1 `api.admin.applications.coverLetter(id)` — `{ admin: true }`
- Pengajuan tidak ada → `RESOURCE_NOT_FOUND` 404. Status di luar `PRINTABLE_STATUSES` → `INVALID_STATE_TRANSITION` 409 "Surat pengantar tersedia setelah pengajuan diteruskan ke bank."
- Mengembalikan:
```js
{
  application: { id, status, productType, optimizationMode, userName },
  variant: 'primary' | 'takeover' | 'topup',
  rows: { applicant: [...], house: [...], second: { title, rows: [...] } }, // sesuai varian
  letter: { …saved atau prefill },
  saved: true | false,
}
```

### 3.2 `api.admin.applications.saveCoverLetter(id, { values })` — `{ admin: true }`
- Pengecekan status sama seperti §3.1.
- Normalisasi: string di-trim; nominal harus integer; `checked` difilter ke kunci baris varian ini; `applicantColumn` harus salah satu dari tiga nilai.
- Validasi (`VALIDATION_FAILED` 400 + `fieldErrors`): wajib diisi `maName`, `maId`, `officeName`, `customerName`, `propertyAddress`, `bankName`, `boName`, `feeAccount`; `loanAmount` integer > 0; `submittedDate` tanggal valid `YYYY-MM-DD`; varian `topup`: `takeoverAmount` dan `topupAmount` integer ≥ 0. `salesOfficer` boleh kosong. Setiap teks maksimal 160 karakter (alamat 300).
- Menulis `db.coverLetters` (insert atau replace), mengisi `updatedAt` dan `updatedBy`.
- Audit: `action: 'application.cover_letter'`, `resource: { type: 'application', id, label: <nama user> }`, `before`/`after` berisi field yang berubah (memakai helper `changes` yang ada).
- Mengembalikan bentuk yang sama dengan §3.1.

### 3.3 Detail pengajuan
`applicationDetail` tidak berubah. Halaman detail menampilkan tombol dari `app.status` dan `PRINTABLE_STATUSES`. Daftar itu, baris checklist, prefill, dan validasi tinggal di satu modul `src/domains/admin/coverLetter.js` yang dipakai `mockApi` dan UI.

## 4. Supabase

### 4.1 Migration `supabase/migrations/20261016090000_cover_letters.sql`
```sql
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
    select 1 from public.applications a where a.id = cover_letters.id
       and a.status in ('bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed')));
-- cover_letters_update: using = super_admin, with check = sama dengan insert.
```
- Status dicek langsung di policy (tanpa function baru). Tanpa kolom `updated_at` dan tanpa trigger: `updatedAt` sudah ada di `doc`, dan store selalu mengirim `id` yang sama dengan `doc.id`.
- `apply_writes` didefinisikan ulang (salin versi terakhir dari `20261014100000_kept_application_data.sql`) dengan tambahan `"cover_letters": ["id", "doc"]` di `v_allowed`. `cover_letters` tidak masuk `v_versioned`.

### 4.2 `src/data/supabase/store.js`
- `load({ admin: true })`: tambah `sb.from('cover_letters').select('doc')` → `db.coverLetters = docs(rows)`.
- `planWrites`: `diffList('cover_letters', before.coverLetters, after.coverLetters)` (insert + update; nilai `{ id, doc }`).

### 4.3 pgTAP `supabase/tests/011_cover_letters.test.sql`
- User biasa: `select` tidak mengembalikan baris; `insert` ditolak, termasuk untuk pengajuan miliknya.
- `content_writer`: `insert` ditolak.
- `super_admin`: `insert` untuk pengajuan `bank_processing` berhasil; `insert` untuk pengajuan `docs_verification` ditolak; `update` setelah pengajuan pindah ke `rejected` ditolak.
- Menghapus pengajuan ikut menghapus surat.
- `apply_writes` menerima tabel `cover_letters`.

## 5. UI

### 5.1 Tombol di detail pengajuan (`ApplicationsPages.jsx`)
Di `AdminHeader` `actions` (sebelah `StatusChip`): `Button asChild variant="outline" size="sm"` → `<Link to="surat-pengantar">` dengan ikon `PrinterIcon` dan label "Surat pengantar". Hanya tampil bila `PRINTABLE_STATUSES.includes(app.status)`.

### 5.2 Halaman `CoverLetterPage` (file baru `src/domains/admin/CoverLetterPage.jsx`)
- Route di `App.jsx`: `/admin/applications/:applicationId/surat-pengantar`, di bawah guard admin yang sama dengan detail pengajuan.
- `AdminHeader` title "Surat pengantar", subtitle `{nama user} · {productName}`, back ke detail. Actions: **Simpan** (outline) dan **Cetak** (default).
- Layout: `grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]`. Kiri: `Panel` form dengan field dari komponen yang ada di `@/components/shared/fields` (`TextField`, `TextAreaField` untuk alamat dan rekening, `MoneyField`, `DateField`) dalam grup: *Marketing Associate*, *Nasabah & pengajuan*, *Business Owner & fee*. Kanan: `CoverLetterSheet` (pratinjau A4, skala layar). Checklist dicentang langsung di tabel pratinjau: setiap sel adalah `<input type="checkbox">` dengan `aria-label` "{label baris} — {kolom}", target sentuh minimal 44px di layar, dan tercetak sebagai `√`.
- Pemilih kolom pemohon (Pegawai / Pengusaha / Profesional) memakai `RadioCards` di form.
- Pratinjau selalu mengikuti isi form tanpa perlu menyimpan dulu.
- **Simpan** → `saveCoverLetter`, lalu toast "Surat pengantar disimpan."; error field ditampilkan di bawah field. **Cetak** → simpan; bila berhasil, `window.print()`. Bila validasi gagal, tidak mencetak.
- Peringatan tinggalkan halaman tidak dibuat. Tombol Simpan aktif bila ada perubahan (pola `dirty` di ConfigurationPage) atau surat belum pernah disimpan (`saved: false`).
- State: `PageSkeleton` saat memuat; `ErrorPanel` dengan pesan API untuk 404/409 (mis. "Surat pengantar tersedia setelah pengajuan diteruskan ke bank."); tombol disabled + `Spinner` saat menyimpan.

### 5.3 Cetak
- `src/styles/globals.css`: `@page { size: A4; margin: 10mm; }`.
- Bagian yang tidak ikut tercetak diberi `print:hidden` (varian Tailwind): sidebar, header mobile, dan bar akun di `AdminLayout`, juga header halaman dan panel form. `main` mendapat `print:p-0`. Cara ini dipilih daripada trik `visibility: hidden`, karena trik itu menyisakan halaman kosong di belakang surat. Lembar memakai font sans (Arial/Helvetica) dan tabel serif seperti contoh, warna hitam di atas putih; ini dokumen cetak, bukan bagian dari visual language aplikasi.
- Di setiap sel checklist: checkbox ber-kelas `print:hidden`, dan `<span className="hidden print:inline">√</span>` yang dirender hanya bila sel itu tercentang.

### 5.4 Konfigurasi (`ConfigurationPage.jsx`)
Panel baru "Surat pengantar" (pola `RemindersPanel`): lima `TextField` (Nama kantor RE/MAX, MA default, No. ID RE/MAX, Nama Business Owner, Rekening marketing fee), tombol Simpan → `ReasonDialog` → `api.admin.config.update('coverLetter', …)`. Hint: "Dipakai sebagai isian awal surat pengantar baru. Surat yang sudah disimpan tidak berubah."

### 5.5 Logo
`public/remax-logo.png`, diambil dari PDF contoh. Bila hasil ekstraksi tidak tajam, minta file asli ke user. `alt="RE/MAX"`.

## 6. Helper
`terbilang(n)` di `src/lib/format.js`: integer Rupiah ≥ 0 → kata Indonesia dengan huruf kapital di awal kata + " Rupiah" (mis. `400000000` → "Empat Ratus Juta Rupiah", `1500000` → "Satu Juta Lima Ratus Ribu Rupiah", `11000` → "Sebelas Ribu Rupiah"). Mendukung sampai triliun; menangani "Seratus", "Seribu", "Sebelas", dan belasan.

## 7. Pengujian
- **Vitest**
  - `src/lib/format.test.js` (file baru): `terbilang` untuk 0, 11, 100, 1.000, 1.500.000, 400.000.000, 2.750.000.000, 1 triliun.
  - `src/data/mockApi.test.js`:
    - prefill per varian (Primary rumah bekas, Take Over, Top-up), termasuk `submittedDate`, `applicantColumn`, dan checklist otomatis;
    - pengajuan `docs_verification` → 409; user biasa dan `content_writer` → `FORBIDDEN`;
    - simpan → dibaca ulang sama persis; config berubah tidak mengubah surat yang sudah disimpan;
    - validasi field wajib dan nominal;
    - `checked` dengan kunci asing dibuang;
    - audit `application.cover_letter` tercatat;
    - `admin.config.update('coverLetter', …)` tervalidasi dan teraudit.
  - `src/data/supabase/store.test.js`: `planWrites` menghasilkan insert lalu update untuk `cover_letters`.
- **pgTAP**: §4.3.
- **Playwright** (`tests/`): admin membuka pengajuan seed yang sudah Proses Bank → klik "Surat pengantar" → isi Sales Officer → Simpan → reload → nilai tetap ada di form dan pratinjau. `window.print` di-stub, dan tes memastikan stub terpanggil setelah klik Cetak.
- **Definition of Done**: `npm run lint`, Vitest terkait, `npm run build`, Playwright terkait, dan pgTAP pada Supabase lokal bila tersedia. Langkah yang tidak bisa dijalankan dilaporkan apa adanya.
