# Supabase RuangKPR — runbook

Backend: Supabase self-hosted (Docker) di VPS, API `https://ruang-kpr.firdiaudi.my.id`.
Desain lengkap: `docs/superpowers/specs/2026-10-09-supabase-backend-design.md`.

Isi folder ini:
- `migrations/`: perubahan skema bernomor. Jalankan sesuai urutan nama file.
- `tests/`: test pgTAP (RLS dan aturan). Semua perubahan di-rollback, jadi aman dijalankan di database mana pun.
- `templates/otp.html`: template email kode OTP (dipakai GoTrue).
- `config.toml`: hanya untuk Supabase lokal (`npx supabase start`). VPS memakai `.env` Docker-nya sendiri.

## Status VPS (2026-10-09)

Migration `20261009051240_auth_foundation`, `20261009071328_app_data`, `20261009071331_seed_articles`, dan `20261009074226_tighten_rules` **sudah jalan** dan tercatat di `supabase_migrations.schema_migrations`, jadi `db push` hanya akan menjalankan migration yang lebih baru. Test pgTAP: `001` 14/14, `002` 30/30, `003` 10/10. Linter Supabase (splinter) bersih, hanya catatan INFO untuk index yang belum terpakai karena tabelnya masih kosong. Uji live seluruh alur lulus 6/6. Katalog bank/produk masih kosong dan diisi admin. Ada 5 artikel edukasi published.

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
4. Isi layar consent (nama app RuangKPR, email dukungan, domain).
5. Tambahkan ke `environment:` service `auth` di `docker-compose.yml`, dengan nilainya di `.env`:

```yaml
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: https://ruang-kpr.firdiaudi.my.id/auth/v1/callback
```

Cek: `/auth/v1/settings` → `"google": true`.

### 4. Email lewat Resend (OTP sekarang, reminder di Fase 4)
1. Daftar di resend.com → **Domains** → tambah `firdiaudi.my.id` (atau subdomain seperti `mail.firdiaudi.my.id`) → pasang record DNS (SPF, DKIM, MX return-path) yang diberikan → tunggu *Verified*.
2. Tambahkan record DMARC: `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:<email-kamu>`.
3. Buat API key (permission *Sending access*).
4. `.env` VPS:

```dotenv
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<API key Resend>
SMTP_ADMIN_EMAIL=notifikasi@firdiaudi.my.id
SMTP_SENDER_NAME=RuangKPR
```

### 5. Template kode OTP (6 digit, 10 menit)
1. Salin `supabase/templates/otp.html` ke VPS: `volumes/templates/otp.html`.
2. Tambahkan service ke `docker-compose.yml` (tanpa port publik):

```yaml
  templates-server:
    image: caddy:2-alpine
    command: ['caddy', 'file-server', '-r', '/templates', '--listen', ':80']
    volumes:
      - ./volumes/templates:/templates
```

3. Tambahkan ke `environment:` service `auth`:

```yaml
      GOTRUE_MAILER_OTP_EXP: 600
      GOTRUE_MAILER_OTP_LENGTH: 6
      GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: http://templates-server/otp.html
      GOTRUE_MAILER_TEMPLATES_CONFIRMATION: http://templates-server/otp.html
      GOTRUE_MAILER_SUBJECTS_MAGIC_LINK: Kode masuk RuangKPR
      GOTRUE_MAILER_SUBJECTS_CONFIRMATION: Kode masuk RuangKPR
```

4. Jalankan `docker compose up -d templates-server`, lalu recreate `auth`.

Cek: login di app memakai email kamu sendiri. Email yang masuk berisi kode 6 digit (bukan link).

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
