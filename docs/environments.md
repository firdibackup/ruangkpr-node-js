# Staging dan production

Satu source code menghasilkan dua target deployment. Target dipilih saat build, bukan lewat tombol di browser.

| Target | Backend normal | Mode demo |
| --- | --- | --- |
| Staging | Supabase staging | Tersedia dari halaman login; data simulasi disimpan di browser |
| Production | Supabase production | Tidak tersedia; modul dan konten khusus demo dikeluarkan dari build |

## Menjalankan dan membangun

```sh
npm run dev:staging
npm run dev:production
npm run build:staging
npm run build:production
```

`npm run build` juga selalu membangun production. Hasil default ada di `dist/`; build berikutnya mengganti hasil sebelumnya. Untuk menyimpan keduanya, gunakan `-- --outDir dist/staging` atau `-- --outDir dist/production` pada perintah build. Preview direktori yang sama dengan `npm run preview -- --outDir dist/staging` (atau `dist/production`).

`npm run dev` tetap mendukung pengembangan lokal dan mock untuk tes. Build deployment hanya menerima mode `staging` atau `production`.

## Konfigurasi backend

1. Salin `.env.staging.example` ke `.env.staging.local`, lalu isi URL dan publishable key backend staging.
2. Salin `.env.production.example` ke `.env.production.local`, lalu isi URL dan publishable key backend production.
3. Gunakan instance/database terpisah untuk kedua lingkungan, termasuk konfigurasi Auth dan Storage masing-masing. Daftarkan URL aplikasi masing-masing sebagai redirect Auth yang diizinkan.

File `.local` tidak masuk Git. `.env.staging` dan `.env.production` hanya berisi pilihan adapter, tanpa kredensial. Vite tetap membaca `.env.local` sebagai konfigurasi umum: isi konfigurasi per-mode agar staging tidak tanpa sengaja mewarisi URL backend production. Pemisahan kode tidak membuat database baru secara otomatis.

Di hosting, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, dan bila perlu `VITE_GEOAPIFY_KEY` untuk environment yang sesuai. Pilih build command `npm run build:staging` untuk staging dan `npm run build:production` untuk production. Deploy direktori `dist` dari build tersebut. Variabel hosting memiliki prioritas atas file env; perubahan nilai membutuhkan build ulang.

`VITE_DATA_SOURCE=mock` hanya untuk staging/development/test. Build production menolak nilai tersebut. Flag demo lama di browser tidak dapat mengaktifkan mock pada production. Semua variabel `VITE_` dapat dibaca pengguna browser; gunakan hanya publishable key, bukan secret key.

## Batas kode

- `src/data/api.js` adalah antarmuka untuk UI. Alias `#data-runtime` dipilih di `vite.config.js`.
- `api.production.js` hanya menginisialisasi adapter asli.
- `api.demo.js` menyediakan pilihan backend normal atau demo.
- `applicationApi.js` dan `operation.js` berisi operasi bersama, tanpa akun demo atau autentikasi simulasi.
- `mockApi.js`, `mockAuth.js`, `mockDb.js`, `seed.js`, dan katalog/artikel contoh hanya digunakan oleh demo dan tes.
- Aturan perhitungan/default aplikasi berada di `lendingPolicy.js` dan `defaults.js`.
- Kasus kalibrasi pada pengaturan KPR Health admin tetap tersedia sebagai alat pengecekan rumus, terpisah dari skenario akun demo dan mengikuti tanggal saat ini.

Data kosong dari backend asli tetap kosong. Tidak ada pengisian otomatis dari katalog/artikel contoh. Perubahan ini tidak melakukan pembersihan record yang sudah tersimpan di database; record tersebut perlu diidentifikasi secara terpisah jika ingin dibersihkan.

## Verifikasi

```sh
npm test
npm run lint
npm run e2e:environments
```

Build production memiliki pemeriksaan otomatis pada modul dan penanda konten demo; build gagal jika konten tersebut ikut terbawa. Tes environment menjalankan hasil build staging dan production, termasuk demo Primary/Take Over di staging dan flag demo lama di production. Backend pada tes ini memakai respons terkontrol; tes tersebut tidak mengubah database deployment.
