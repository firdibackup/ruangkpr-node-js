# Branding

Repo ini bisa di-copy menjadi situs lain. Yang membedakan satu situs dengan situs lain (warna, radius card, logo, font, nama, ilustrasi) hanya ada di tiga tempat, ditambah template email. Komponen tidak perlu disentuh.

| Tempat | Isi |
|---|---|
| `src/brand/tokens.css` | Palet warna, token semantik (peran warna di UI), font, radius card |
| `src/brand/brand.js` | Nama, tagline, theme color, URL Google Fonts, email CS, link booking default |
| `public/brand/` | Logo, favicon, ilustrasi, gambar layanan |
| `supabase/templates/*.html` | Nama dan warna di email OTP dan reset password (diubah manual) |

`npm test` menjalankan `src/brand/brand.test.js`, yang mengecek kontras WCAG, kelengkapan palet, font, file aset, template email, dan memastikan tidak ada warna hex di luar `src/brand/`.

## Langkah membuat situs baru

### 1. Palet (`tokens.css`, bagian 1)

Ganti 88 hex di bagian **Primitive palettes** dengan palet dari desainer (Pencil → Color System). Ada 8 palet, masing-masing 11 step (50–950). Nama variabelnya adalah **peran**, bukan nama warna, jadi namanya jangan diubah:

| Palet | Peran |
|---|---|
| `primary` | Warna utama gelap: tombol utama, teks, hero |
| `secondary` | Warna pendamping: link, tagline, tile "potensi hemat" |
| `accent` | Warna terang untuk CTA di permukaan gelap, focus ring, chart |
| `neutral` | Latar, border, teks sekunder |
| `success` / `danger` / `warning` / `info` | Status (selalu dengan ikon + teks) |

Panduan step: 50–100 surface · 200–300 border halus · 400–500 aksen · 600–700 interaksi · 800–950 teks/permukaan gelap.

### 2. Token semantik (`tokens.css`, bagian 2)

Biarkan saja kalau palet baru berkarakter sama: primary gelap (teks putih di atasnya) dan accent terang (teks gelap di atasnya). Kalau berbeda, misalnya primary brand berwarna terang, pindahkan peran ke step lain, contohnya `--primary: var(--palette-primary-700)`. Jalankan `npm test`, yang akan menyebut pasangan mana yang kontrasnya kurang, misalnya `--cta-foreground on --cta reaches 4.5:1`.

Chart: `--chart-principal` dan `--chart-interest` tampil berdampingan, jadi pastikan keduanya tetap bisa dibedakan oleh pengguna buta warna (cek dengan simulator CVD).

### 3. Font

- `tokens.css`: `--body-font` dan `--heading-font`. Nama family pertama harus diberi tanda kutip, misalnya `"Inter", system-ui, sans-serif`.
- `brand.js`: `fontsUrl` harus memuat setiap family di atas dengan **bobot 400–800** (UI memakai 500/600/700/800).

### 4. Radius card

`--card-radius` di `tokens.css` (sekarang `24px`). Tombol tetap pill dan input tetap memakai radiusnya sendiri.

### 5. Identitas (`brand.js`)

| Field | Keterangan |
|---|---|
| `name` | Nama di shell, judul tab, teks UI, tour, email |
| `tagline` | Di bawah nama di shell pengguna |
| `themeColor` | Sama dengan nilai `--primary` (dicek test), untuk `<meta theme-color>` dan email |
| `fontsUrl` | Link Google Fonts (lihat langkah 3) |
| `supportEmail` | Email CS di halaman masuk dan dialog bantuan |
| `bookingUrl` | Link konsultasi default sebelum admin mengisinya di Konfigurasi |

Nomor WhatsApp CS **tidak** ada di sini, karena diatur admin di halaman Konfigurasi.

### 6. Aset (`public/brand/`)

Ganti file dengan **nama yang sama**. Daftar file wajib ada di `BRAND_FILES` (`brand.js`).

| File | Ukuran sekarang | Dipakai di |
|---|---|---|
| `logo.svg` | persegi, viewBox 64×64 | Shell (tampil 36px), di sebelah nama |
| `favicon.svg` | persegi | Tab browser |
| `cover-auth.webp` | 2752×1536 | Panel kiri halaman masuk/daftar (desktop) |
| `card-kpr.webp` | 500×500, latar transparan, padding ±18% | Kartu "Sudah punya KPR?" di Home |
| `card-overview.webp` | 1672×941 | Siluet di pojok hero, warnanya mengikuti gradien |
| `no-kpr-page.webp` | 1448×1086, latar putih | Empty state My KPR |
| `service/1.webp`, `service/2.webp` | 2752×1536 | Kartu layanan di Explore |
| `icon-service/256/{kpr-primary,take-over,refinancing}.webp` | 256×256 | Ikon layanan di Home |

`HouseIllustration` (SVG di kode) otomatis mengikuti palet, jadi tidak perlu diganti.

### 7. Template email

Di `supabase/templates/otp.html` dan `recovery.html`, ganti nama brand, warna aksen (`themeColor`), latar (`--palette-neutral-50`), dan abu-abu teks (`--palette-neutral-600`). File di repo **tidak** otomatis terpasang di server Supabase. Upload atau deploy ulang ke instance Supabase situs tersebut.

### 8. Cek

```bash
npm test          # brand.test.js + seluruh test
npm run lint
npm run build
npm run e2e
```

Lalu buka dan cek visual: `/login`, `/`, `/my-kpr`, `/my-kpr/application`, `/explore`, `/profile`, `/admin`.

## Mengubah brand dari admin (tanpa deploy)

Super admin bisa mengubah warna, font, radius card, logo, dan favicon di **Admin → Brand** (`/admin/brand`). File di `src/brand/` dan `public/brand/` tetap menjadi **default**: dipakai selama belum ada brand yang dipublish, dan dipakai lagi setelah **Kembalikan ke default**.

- **Warna:** pilih 3 warna dasar (utama, pendamping, aksen CTA). Skala 50–950 dibuat otomatis (OKLCH). Panel **Lanjutan** menerima 11 hex per palet dari desainer, persis seperti bagian 1 `tokens.css`. Kalau warna utama atau aksen terlalu terang untuk teks, editor memakai shade yang lebih gelap dan menyebutkannya di bawah field.
- **Font:** daftar kurasi di `FONTS` (`src/brand/theme.js`). Menambah font cukup satu baris, asal font Google itu punya bobot 400–800.
- **Alur:** Simpan draft → **Pratinjau di seluruh situs** (hanya admin itu, sampai halaman dimuat ulang) → **Publish** dengan alasan (tercatat di Audit Log). Publish ditolak selama ada pasangan warna di bawah WCAG AA.
- **Yang tidak ikut:** nama brand, tagline, ilustrasi, warna status, dan template email Supabase (tetap dari file).

Cara kerjanya:
- `main.jsx` membaca brand yang dipublish sebelum render pertama (timeout 1,5 detik), lalu `src/brand/live.js` memasang variabel CSS-nya inline di `<html>`.
- Data ada di tabel `brand_settings` (baris `draft` dan `published`) dan bucket `brand-assets` (migrasi `20261020090000_brand_settings.sql`).

Untuk clone baru: atur default di file seperti langkah 1–8. Halaman admin hanya untuk penyesuaian setelah situs live.

## Aturan untuk developer

- **Jangan menulis warna (hex) di komponen.** Test akan gagal. Pakai utility token:

  | Kebutuhan | Utility |
  |---|---|
  | Latar halaman / card / subtle | `bg-background`, `bg-card`, `bg-muted` |
  | Teks utama / sekunder | `text-foreground`, `text-muted-foreground` |
  | Border halus / input / checkbox | `border-border`, `border-input`, `border-border-strong` |
  | Aksi utama | `bg-primary` + `text-primary-foreground`, `hover:bg-primary-hover`, `active:bg-primary-pressed` |
  | Aksi lembut | `bg-secondary`, `hover:bg-secondary-hover` |
  | CTA aqua (**hanya di permukaan gelap**) | `Button variant="inverse"` atau `bg-cta text-cta-foreground` |
  | Link / aksen teks brand | `text-link`, `text-highlight` |
  | Permukaan gelap | `bg-inverse`, `text-inverse-foreground` |
  | Status | `text-{s}`, `bg-{s}-bg`, `border-{s}-border`, `bg-{s}-solid` dengan `s` = `success`, `warning`, `danger`, `info` |
  | Radius card, bayangan | `rounded-card`, `shadow-card`, `hover:shadow-card-hover`, `shadow-pop` |

- **Butuh peran warna baru?**
  1. Tambahkan token semantik di `tokens.css` bagian 2 (`--x: var(--palette-…)`).
  2. Petakan di `src/styles/globals.css` (`--color-x: var(--x)`).
  3. Tambahkan pasangan kontrasnya ke `PAIRS` di `brand.test.js`.
- Ilustrasi SVG di kode boleh membaca `var(--palette-…)` langsung, supaya ikut warna brand.
- Peran warna baru yang mengikuti warna pilihan admin (bukan sekadar shade tetap) juga perlu ditambahkan ke `brandVars` di `src/brand/theme.js`. `theme.test.js` memastikan engine dengan setting default tetap sama persis dengan `tokens.css`.
- Jangan pernah menaruh teks putih di atas aqua/teal terang. Pakai `--cta-foreground`.
- Status selalu ikon + teks, tidak boleh warna saja.
