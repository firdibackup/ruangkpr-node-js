# RuangKPR

Aplikasi web RuangKPR (React 19 + Vite + Tailwind CSS 4) dengan backend **Supabase self-hosted** (Auth, Database, Storage) di `https://ruang-kpr.firdiaudi.my.id`. Data yang tampil adalah data asli. Tidak ada data demo.

Desain backend: `docs/superpowers/specs/2026-10-09-supabase-backend-design.md`. Runbook server (env, migration, super admin): `supabase/README.md`.

## Prasyarat

- **Node.js 22.12+** (cek dengan `node -v`)
- npm

## Menjalankan di lokal

```bash
npm install
npm run dev
```

Buka http://localhost:5173. Isi `.env.local` (jangan di-commit):

```dotenv
VITE_SUPABASE_URL=https://ruang-kpr.firdiaudi.my.id
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
# Hanya untuk skrip lokal (uji live). Jangan pernah diberi prefix VITE_.
SUPABASE_SECRET_KEY=sb_secret_…
```

Masuk dengan **email + password** atau **Google**. Halaman Daftar meminta nama, email, password, dan persetujuan S&K + Kebijakan Privasi; kode 6 digit ke email hanya dipakai untuk verifikasi pendaftaran; **Lupa password** mengirim link yang membuka halaman Buat password baru. Login Google pertama kali meminta nama dan persetujuan di halaman Selamat datang. Password bisa diubah di Profil (staf: tombol Ubah password di admin). Akun admin diberi role lewat SQL (lihat `supabase/README.md` langkah 7).

## Build production

```bash
npm run build       # hasil di dist/
npm run preview     # cek di http://localhost:4173
```

Di Vercel, isi env `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`. Karena aplikasi ini SPA, semua route diarahkan ke `index.html` (`vercel.json`).

## Test

| Perintah | Fungsi |
| --- | --- |
| `npm run lint` | oxlint |
| `npm test` | Unit test (Vitest). Logika aplikasi diuji di atas penyimpanan lokal (`VITE_DATA_SOURCE` otomatis mock di Vitest) |
| `npm run e2e` | Playwright. Selalu memakai data lokal (`VITE_DATA_SOURCE=mock`), jadi tidak pernah menyentuh database asli. Pertama kali: `npx playwright install chromium` |
| `LIVE=1 npx vitest run src/data/supabase/live.test.js` | Uji alur lengkap ke Supabase asli: membuat 2 user sementara lewat secret key, lalu menghapus semuanya |
| `supabase/tests/*.sql` | Test pgTAP untuk RLS dan aturan status (cara menjalankan di `supabase/README.md`) |

## Struktur singkat

- `src/app`: routing, layout, shell aplikasi
- `src/domains`: fitur per domain (applications, mortgages, optimize, admin, dll.)
- `src/data/api.js`: satu-satunya pintu data untuk UI. Default Supabase; mock hanya untuk test
- `src/data/mockApi.js`: logika aplikasi (dipakai Supabase dan test) di atas sebuah *store*
- `src/data/supabase/`: auth, store Supabase (`store.js`), Storage, dan pemetaan error
- `supabase/`: migration SQL, test pgTAP, template email OTP, runbook server
- `tests/e2e`: test Playwright
