# Supabase Maxi — runbook

## Arsip akun (2026-10-27)

Terapkan `migrations/20261027044226_account_archives.sql` **sebelum** merilis frontend baru. RPC `delete_my_account` sekarang menyalin data ke `private.account_archives`, melepas kepemilikan berkas privat, lalu menghapus akun Auth beserta data aktif dalam satu transaksi. Dokumen tetap pada path asli; kebijakan Storage menolak token akun yang telah dihapus. Arsip tidak memiliki masa kedaluwarsa dan tidak digunakan saat pendaftaran ulang.

Menu `/admin/account-archives` tersedia untuk `super_admin` dan role baru `admin`. Role `admin` hanya mendapat modul arsip pada rilis ini; tidak otomatis mendapat izin modul lain. Penetapan role tetap melalui pengelolaan database oleh operator. Content writer dan pengguna biasa tidak mendapat akses arsip.

Hapus arsip manual: RPC `begin_delete_account_archive` menandai `deleting` → frontend menghapus semua berkas lewat Storage API dalam batch → `finish_delete_account_archive` memeriksa bahwa berkas sudah tidak ada, kemudian menghapus snapshot. Jika gagal/terputus, admin membuka arsip dan mengulang penghapusan. Jangan menghapus metadata `storage.objects` secara manual: Storage API harus menghapus objek fisik. Audit pembukaan/penghapusan tetap tersimpan tanpa menyalin isi arsip.

Verifikasi deployment: jalankan `tests/015_account_archives.test.sql`, kemudian uji dengan akun uji dan PDF sungguhan: hapus akun, buka arsip dan unduh dokumen sebagai admin, daftar ulang dengan email sama, pastikan profil/pengajuan kosong, hapus arsip manual dan pastikan berkas tidak tersisa. Tautan unduhan yang telah diterbitkan berlaku maksimal 5 menit. Backup infrastruktur mengikuti kebijakan backup terpisah; penghapusan arsip di aplikasi tidak menulis ulang backup lama.

## Rebrand Maxi (2026-10-23)

Migrasi `20261023040319_maxi_brand.sql` mengganti presentasi email (nama pengirim, CTA, isi reminder, warna) serta nama brand pada dua artikel bawaan. Alamat pengirim dan ID job cron tetap memakai konfigurasi lama. Terapkan migrasi ini setelah seluruh migrasi sebelumnya.

Untuk SMTP Auth yang aktif di VPS, pasang ulang `templates/otp.html` dan `templates/recovery.html`, ubah subjek confirmation/recovery menjadi Maxi, serta nama tampilan pengirim SMTP menjadi Maxi. Sesuaikan nama aplikasi di layar consent Google menjadi Maxi. Email CS tetap `cs@ruangkpr.id` selama transisi.

Backend: Supabase self-hosted (Docker) di VPS, API `https://ruang-kpr.firdiaudi.my.id`.
Desain lengkap: `docs/superpowers/specs/2026-10-09-supabase-backend-design.md`.

Isi folder ini:
- `migrations/`: perubahan skema bernomor. Jalankan sesuai urutan nama file.
- `tests/`: test pgTAP (RLS dan aturan). Semua perubahan di-rollback, jadi aman dijalankan di database mana pun.
- `templates/otp.html`: template email kode OTP (dipakai GoTrue).
- `config.toml`: hanya untuk Supabase lokal (`npx supabase start`). VPS memakai `.env` Docker-nya sendiri.

## Status VPS (2026-10-09)

Migration `20261009051240_auth_foundation`, `20261009071328_app_data`, `20261009071331_seed_articles`, `20261009074226_tighten_rules`, `20261009075346_reminders`, `20261009084157_email_via_resend`, `20261013090000_user_changes`, `20261013092729_reminders_first_installment`, `20261013120000_document_review`, `20261014090000_submit_fresh_documents`, dan `20261014100000_kept_application_data` **sudah jalan** dan tercatat di `supabase_migrations.schema_migrations`, jadi `db push` hanya akan menjalankan migration yang lebih baru. Test pgTAP: `001` 14/14, `002` 30/30, `003` 10/10, `004` 16/16, `005` 12/12, `006` 16/16, `007` 6/6, `008` 26/26, `009` 9/9, `010` 4/4 (semua dicek ulang 2026-10-14 setelah tiga migration terakhir; `004` di VPS 15/16: "H-3 reminds r1 and r2 again" dapat 4, harusnya 2, karena job juga menghitung KPR asli di database itu; `007` hanya memeriksa KPR ujinya sendiri). Linter Supabase (splinter) bersih, hanya catatan INFO untuk index yang belum terpakai karena tabelnya masih kosong. Uji live seluruh alur lulus 14/14 (2026-10-14, termasuk review dokumen, upload ulang, dan info tahap appraisal). Migration `20261016090000_cover_letters` (surat pengantar) **belum jalan** di VPS; test pgTAP-nya `011` (11 test).

**Login email + password (2026-10-12):** app sudah memakainya. Dicek 2026-10-13: `ADDITIONAL_REDIRECT_URLS` sudah berisi `http://localhost:5173`, jadi link reset password membuka app lokal, dan login Google sudah aktif. Sisa langkah 5: aturan password di server, dan domain app produksi saat sudah online.

**Email di VPS (dipasang 2026-10-09):** kode OTP dikirim lewat **SMTP Resend + template server** (`volumes/templates/otp.html`, container `templates-server`), jadi hook `send_email_hook` **tidak diaktifkan**. Email reminder tetap dikirim dari database lewat API Resend dan butuh key `resend_api_key` di Vault (langkah 4.2). Tes OTP terkirim, dan user pertama tercipta dengan profil otomatis.

**Reminder in-app (Fase 4a)** berjalan lewat `pg_cron` setiap jam (`ruangkpr-reminders`, `private.run_reminders`), mulai 07:00 WIB. Sebelum jam itu job hanya membaca jawaban Resend, jadi tidak ada pengingat di malam hari. Isinya pengingat H-x sebelum jatuh tempo (kalau bulan itu belum ditandai bayar) dan sebelum masa fixed berakhir, masuk ke Activity user, tanpa dobel. Kalau server mati pagi hari, run berikutnya di hari yang sama menyusul. Email reminder dikirim di job yang sama lewat Resend (langkah 4) dan berstatus `sending` sampai run berikutnya membaca jawaban Resend: berhasil → `sent`, gagal → dicoba lagi tiap jam sampai 3 kali, lalu `failed` dengan alasannya di `last_error`. Email yang harinya sudah lewat dilewati, tidak pernah terkirim terlambat. Cek riwayat job:

```sql
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select channel, status, count(*) from public.reminder_deliveries group by 1, 2;
select id, target_date, attempts, last_error from public.reminder_deliveries where status = 'failed' order by id desc limit 10;
``` Katalog bank/produk masih kosong dan diisi admin. Ada 5 artikel edukasi published.

## Fase 0: persiapan VPS (sekali, oleh pemilik VPS)

Semua env di bawah ada di `.env` dan `docker-compose.yml` folder `supabase/docker` di VPS. Setelah mengubahnya, jalankan `docker compose up -d --force-recreate auth`, atau `sh run.sh recreate auth` di versi yang punya `run.sh`.

### 1. Tutup signup lewat nomor HP (WAJIB, sekarang)
Saat ini provider phone **aktif dengan autoconfirm**, padahal tidak ada SMS provider. Siapa pun bisa membuat akun terverifikasi lewat API memakai nomor HP + password.

```dotenv
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
```

Cek: `curl -s -H "apikey: <publishable key>" https://ruang-kpr.firdiaudi.my.id/auth/v1/settings` → `"phone": false`.

### 2. URL dan sesi
```dotenv
SITE_URL=https://<domain-app-produksi>
ADDITIONAL_REDIRECT_URLS=http://localhost:5173/**,https://*-<akun-vercel>.vercel.app/**
JWT_EXPIRY=3600
```

### 3. Login Google
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → *Web application*.
2. *Authorized JavaScript origins*: domain app produksi dan `http://localhost:5173`.
3. *Authorized redirect URIs*: `https://ruang-kpr.firdiaudi.my.id/auth/v1/callback`.
4. Isi layar consent (nama app Maxi, email dukungan, domain).
5. Tambahkan ke `environment:` service `auth` di `docker-compose.yml`, dengan nilainya di `.env`:

```yaml
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: https://ruang-kpr.firdiaudi.my.id/auth/v1/callback
```

Cek: `/auth/v1/settings` → `"google": true`.

### 4. Email (kode OTP + reminder) lewat Resend, dikirim dari database
Email tidak memakai SMTP. Database mengirimnya lewat API Resend (`pg_net`), dengan key yang disimpan terenkripsi di Supabase Vault. Server login cukup diarahkan ke fungsi `public.send_email_hook`. Tidak perlu file template, container tambahan, atau Edge Function.

1. **Resend:** domain `firdiaudi.my.id` sudah *Verified*. Buat API key baru dengan permission **Sending access**. Hapus key lama berpermission *full access* yang sempat terkirim lewat chat.
2. **Studio → SQL Editor** (key tidak pernah masuk ke kode atau repo):

```sql
select vault.create_secret('re_…', 'resend_api_key', 'Resend sending key for Maxi emails');
-- mengganti key nanti:
-- select vault.update_secret((select id from vault.secrets where name = 'resend_api_key'), 're_…');
-- opsional, untuk tombol "Buka Maxi" di email reminder:
-- select vault.create_secret('https://<domain-app>', 'app_url');
```

3. **`docker-compose.yml` → `auth:` → `environment:`.** Dua baris hook sudah ada sebagai komentar: hapus `#` dan isi seperti ini. Baris `GOTRUE_HOOK_SEND_EMAIL_SECRETS` biarkan tetap komentar, karena tidak dipakai untuk `pg-functions`. Tambahkan juga dua baris OTP:

```yaml
      GOTRUE_HOOK_SEND_EMAIL_ENABLED: "true"
      GOTRUE_HOOK_SEND_EMAIL_URI: "pg-functions://postgres/public/send_email_hook"
      GOTRUE_MAILER_OTP_EXP: 600
      GOTRUE_MAILER_OTP_LENGTH: 6
```

4. Jalankan `docker compose up -d --force-recreate auth`, lalu `docker compose logs auth --tail 30` dan pastikan tidak ada error.

Cek pengiriman (status dari Resend):

```sql
select status_code, left(content, 120), created from net._http_response order by created desc limit 5;
```

`supabase/templates/otp.html` dan `config.toml` hanya dipakai Supabase lokal. Di VPS, isi email ada di fungsi `private.email_html`.

### 5. Login email + password (2026-10-12, reset lewat link 2026-10-13)
Login biasa memakai email + password. **Daftar** memverifikasi email dengan kode 6 digit (template *confirmation*, sudah berupa kode di VPS). **Lupa password** mengirim **link** yang membuka halaman `/reset-password` di app untuk membuat password baru. Template bawaan GoTrue sudah berisi link, jadi yang wajib hanya alamat app-nya.

1. **Wajib: alamat app untuk link** (sudah untuk localhost, dicek 2026-10-13). Link reset dan Google hanya kembali ke alamat yang terdaftar; alamat lain jatuh ke `SITE_URL`, yaitu alamat server ini, dan gagal. Di `.env` VPS:

```dotenv
SITE_URL=http://localhost:5173
ADDITIONAL_REDIRECT_URLS=http://localhost:5173/**
```

   Saat app sudah online, ganti `SITE_URL` dengan domain app dan tambahkan domain itu ke `ADDITIONAL_REDIRECT_URLS` (dipisah koma), misalnya `https://app.ruangkpr.id/**`.

2. **Disarankan: aturan password di server.** `docker-compose.yml` → `auth:` → `environment:`:

```yaml
      GOTRUE_PASSWORD_MIN_LENGTH: 8
      GOTRUE_PASSWORD_REQUIRED_CHARACTERS: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789"
      GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION: "true"
      GOTRUE_MAILER_SUBJECTS_CONFIRMATION: "Kode verifikasi akun Maxi"
```

   Dua baris pertama sama dengan aturan di app: minimal 8 karakter, berisi huruf dan angka. Baris ketiga membuat ganti password lewat API wajib memakai sesi yang baru dibuka. App selalu login ulang atau membuka link reset dulu, jadi alurnya tetap jalan.

3. **Opsional: email reset berbahasa Indonesia.** Salin `supabase/templates/recovery.html` ke folder template di VPS (folder yang sama dengan `otp.html`), lalu tambahkan:

```yaml
      GOTRUE_MAILER_TEMPLATES_RECOVERY: "<alamat recovery.html di templates-server, sama polanya dengan baris GOTRUE_MAILER_TEMPLATES_CONFIRMATION>"
      GOTRUE_MAILER_SUBJECTS_RECOVERY: "Reset password Maxi"
```

4. Jalankan `docker compose up -d --force-recreate auth`, lalu `docker compose logs auth --tail 30` dan pastikan tidak ada error.

Cek: jalankan app di `http://localhost:5173` → **Lupa password** → buka link dari email **di browser yang sama** → halaman "Buat password baru" muncul. Link hanya bisa dipakai sekali; membukanya lagi menampilkan "Link tidak bisa dipakai". Akun yang dibuat sebelum 2026-10-12 lewat kode OTP belum punya password yang diketahui siapa pun, jadi pakai **Lupa password** sekali.

### 6. Jalankan migration
**Cara A (awal, paling mudah): SQL Editor di Studio.** Buka setiap file di `migrations/` sesuai urutan nama, tempel isinya, lalu **Run**. Setelah itu tempel file di `tests/` dan **Run**. Semua baris harus `ok`, dan baris terakhir tidak boleh berisi `Looks like you failed`.

**Cara B (disarankan setelahnya): CLI lewat SSH tunnel.** Migration yang sudah jalan tercatat, jadi tidak ada yang terlewat atau jalan dua kali.

```bash
ssh -N -L 54329:localhost:5432 <user>@<ip-vps>     # terminal 1, port Postgres di VPS
npx supabase db push --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@localhost:54329/postgres"
npx supabase test db --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@localhost:54329/postgres"
```

Kalau migration sebelumnya dijalankan dengan Cara A, tandai dulu sebagai sudah jalan:
`npx supabase migration repair --status applied <versi> --db-url …`. Versi adalah angka di depan nama file, misalnya `20261009051240`.

### 7. Super admin pertama
Orangnya login sekali di app, lalu jalankan di SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin' from auth.users where email = '<email-admin>';
-- content writer: ganti 'super_admin' dengan 'content_writer'
```

### 8. Sebelum pilot dibuka (Fase 4)
- Backup harian: `pg_dump` + salinan `volumes/storage`, dienkripsi, ke luar VPS (R2/Backblaze), disimpan 30 hari. **Uji restore sekali.**
- Port publik hanya 443 dan SSH. Postgres (5432) tidak publik. Studio berpassword.
- Uptime check: `https://ruang-kpr.firdiaudi.my.id/auth/v1/health`.

## Frontend

Aplikasi selalu memakai data asli. Mock hanya dipakai Vitest/Playwright. `.env.local` (jangan di-commit):

```dotenv
VITE_SUPABASE_URL=https://ruang-kpr.firdiaudi.my.id
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

Secret key (`sb_secret_…`) **tidak pernah** diberi prefix `VITE_` dan tidak pernah dipakai kode `src/`.
