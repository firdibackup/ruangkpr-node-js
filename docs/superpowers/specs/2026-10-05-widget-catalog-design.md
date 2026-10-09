# Katalog Widget & Galeri "Tambah widget" — Design

Tanggal: 2026-10-05 · Status: disetujui per bagian di chat (eksekusi langsung atas permintaan user)

## Tujuan
- Dialog "Tambah widget" menampilkan **overview** tiap widget (preview live dengan data user) sebelum ditambahkan.
- Katalog widget diperluas dari 9 → 23 dengan grafik, pipeline/timeline, dan widget aktivitas, memakai data yang **sudah ada** di app.

## Keputusan
| Topik | Keputusan |
|---|---|
| Grafik vs PRD §11.1 ("No charts on Home") | Grafik **opsional**: hanya lewat "Tambah widget". Susunan default tetap tanpa grafik. PRD §11.1 diberi catatan; e2e jadi "board default tanpa grafik". |
| Cakupan | 14 widget baru, 4 kategori (Grafik, Angka penting, Timeline & Pipeline, Pengingat & Aktivitas). |
| Overview | Galeri kartu: tab kategori + grid kartu, preview live widget asli (diperkecil), tombol [+ Tambah]. |
| Library grafik | **Recharts 3** (`responsive`, warna dari token CSS, animasi `auto` = hormati reduce motion). Widget grafik di-lazy-load. |
| Data kurang | Widget **terkunci 🔒**: tampil "Data belum lengkap" + yang kurang + satu tombol lengkapi. Di galeri kartu terkunci **tidak bisa ditambah**; tombolnya "Lengkapi data". |

## Arsitektur
- `src/domains/home/widgets/`
  - 9 widget yang sudah ada tetap di `src/domains/home/dashboardWidgets.jsx` (file itu sedang dikerjakan sesi lain; hanya `LockedPreview` dan `StatWidget` yang diekspor untuk dipakai ulang).
  - `charts.jsx` — Proyeksi Sisa Pokok, Dampak Floating, Komposisi Cicilan, Pokok vs Bunga per Tahun. Satu chunk lazy (Recharts).
  - `figures.jsx` — Total Bunga Tersisa, Equity Rumah, Rasio Cicilan (gauge setengah lingkaran dengan CSS `conic-gradient`, seperti `HealthRing`, jadi tidak ikut chunk Recharts).
  - `timeline.jsx` — Perjalanan KPR, Hitung Mundur Fixed, Riwayat Pembayaran.
  - `activity.jsx` — Pengingat Aktif, Aktivitas Terbaru, Simulasi Terakhir, Bacaan Untukmu.
  - `LockedWidget.jsx` — tampilan terkunci seragam memakai `LockedPreview` (kartu widget dengan data contoh di bawah kaca buram, judul "Buka …", kalimat yang kurang, satu tombol).
  - `WidgetBody.jsx` — isi satu sel: cek `widgetLock` → `LockedWidget` atau view, dibungkus `Suspense` + error boundary.
  - `index.js` — registry `WIDGET_VIEWS` (widget grafik via `React.lazy`).
  - `widgetData.js` (+ test) — fungsi murni: `widgetLock`, proyeksi saldo, total bunga, komposisi cicilan, langkah perjalanan, tahapan hitung mundur, kalender pembayaran, jadwal reminder, ringkasan simulasi, pemilihan artikel.
- `dashboardLayout.js`: `WIDGETS` mendapat `category`; `CATEGORIES` untuk tab galeri. `DEFAULT_LAYOUT` tidak berubah.
- `WidgetGallery.jsx`: dialog galeri (Tabs + kartu preview).
- `WidgetBoard.jsx`: per sel — cek `widgetLock` → `LockedWidget` atau view; `Suspense` (skeleton) + error boundary ("Widget gagal dimuat · Coba lagi").
- Data tetap lewat `api.js`. `widgetProps` = `{ m, d, clock, simulation, onAskIncome, onAskProperty, onMarkPaid }`. Aktivitas & Bacaan memakai `useResource`.

## Aturan kunci (`widgetLock`)
| Widget | Kunci jika tidak ada | Aksi |
|---|---|---|
| Proyeksi, Komposisi, Pokok vs Bunga, Total Bunga, Jadwal Amortisasi | jadwal (sisa pokok / sisa tenor / bunga) | setup Data KPR |
| Dampak Floating | estimasi floating (fixed) / cicilan fixed terakhir (floating) / jenis bunga | setup Data KPR |
| Hitung Mundur Fixed | jenis bunga | setup Data KPR |
| Equity Rumah | nilai properti | dialog properti |
| Rasio Cicilan, KPR Health | penghasilan | dialog penghasilan |
| Peluang | penghasilan, nilai properti | dialog yang kurang lebih dulu |
| Progres Pelunasan | pinjaman awal / sisa pokok | link dari `progressGap` |

## Ukuran default (12 kolom, baris 30px)
Proyeksi 7×7 · Dampak Floating 5×6 · Komposisi 4×6 · Pokok vs Bunga 7×7 · Total Bunga 4×4 · Equity 4×5 · Rasio Cicilan 4×5 · Perjalanan 5×8 · Hitung Mundur 5×5 · Riwayat 6×5 · Pengingat 5×6 · Aktivitas 5×6 · Simulasi 5×5 · Bacaan 5×6.

## Testing
- Unit: semua fungsi `widgetData.js`; konsistensi katalog (setiap widget punya view & kategori; default tanpa grafik).
- E2E: board default tanpa grafik; galeri (tab, preview, "Sudah ada", kartu terkunci tanpa Tambah → "Lengkapi data"); tambah grafik → tampil & bertahan setelah reload; galeri HP 1 kolom.
