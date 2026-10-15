# Produk Bank Take Over & Take Over + Top-up

Diambil dari tabel `public.bank_products` di Supabase live pada **2026-10-15**. Isinya data yang diinput admin RuangKPR, bukan penawaran resmi bank: bunga floating selalu estimasi, dan biaya appraisal, notaris, serta asuransi juga estimasi.

- **10 produk terbit**, semuanya berjenis Take Over dan Take Over + Top-up.
- **3 produk diarsipkan**, tidak dipakai pencocokan (lihat bagian terakhir).

## Ringkasan produk terbit

| Bank | Produk | Bunga fixed | Floating (estimasi) | Tenor maks | LTV maks | DTI maks | Provisi | Biaya tetap* | Berlaku | Verifikasi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bank Central Asia | KPR BCA Take Over Fixed 3 Tahun | 5,99% · 36 bln | 11,5% | 240 bln | 80% | 40% | 0,5% | Rp8.550.000 | 2026-10-01 s/d 2027-03-31 | 2026-10-10 |
| Bank CIMB Niaga | KPR CIMB Niaga Take Over Fixed 3 Tahun | 6,49% · 36 bln | 11,5% | 240 bln | 80% | 40% | 1% | Rp8.350.000 | 2026-10-01 s/d 2027-03-31 | 2026-10-10 |
| Bank Danamon Indonesia | KPR Danamon Take Over Fixed 2 Tahun | 5,9% · 24 bln | 11,75% | 240 bln | 80% | 40% | 0,5% | Rp7.450.000 | 2026-10-01 s/d 2027-03-31 | 2026-10-13 |
| Bank Mandiri | KPR Mandiri Take Over Fixed 5 Tahun | 6,75% · 60 bln | 11,25% | 240 bln | 80% | 40% | 0,75% | Rp8.800.000 | 2026-10-01 s/d 2027-06-30 | 2026-10-11 |
| Bank Negara Indonesia | KPR BNI Griya Take Over Fixed 5 Tahun | 6,99% · 60 bln | 11% | 240 bln | 80% | 40% | 1% | Rp8.250.000 | 2026-10-01 s/d 2027-06-30 | 2026-10-13 |
| Bank Permata | KPR Permata Take Over Fixed 5 Tahun | 7,25% · 60 bln | 12% | 240 bln | 80% | 40% | 1% | Rp8.000.000 | 2026-10-01 s/d 2027-06-30 | 2026-10-11 |
| Bank Rakyat Indonesia | KPR BRI Take Over Fixed 3 Tahun | 6,25% · 36 bln | 11% | 240 bln | 80% | 40% | 0,5% | Rp8.500.000 | 2026-10-01 s/d 2027-03-31 | 2026-10-12 |
| Bank Syariah Indonesia | KPR BSI Griya Hasanah Take Over | 7,5% · 60 bln | 11,25% | 240 bln | 80% | 40% | 1% | Rp8.550.000 | 2026-10-01 s/d 2027-06-30 | 2026-10-12 |
| Bank Tabungan Negara | KPR BTN Take Over Fixed 2 Tahun | 5,75% · 24 bln | 11,75% | 240 bln | 80% | 40% | 0,5% | Rp6.900.000 | 2026-10-01 s/d 2027-03-31 | 2026-10-14 |
| Maybank Indonesia | KPR Maybank Take Over Fixed 3 Tahun | 6,4% · 36 bln | 11,5% | 240 bln | 80% | 40% | 0,75% | Rp8.200.000 | 2026-10-01 s/d 2027-03-31 | 2026-10-12 |

\* Biaya tetap = administrasi + appraisal + notaris + asuransi. Provisi dihitung terpisah dari plafon.

## Cara aplikasi memakai data ini

Simulasi Take Over dan Top-up (`evaluateTakeoverProduct` di `src/calculations/programs.js`) hanya membaca:

- **Bunga:** masa dan bunga fixed, lalu floating estimasi sampai tenor habis.
- **Biaya:** provisi, administrasi, appraisal, notaris, asuransi. Pada Top-up, biaya dipotong dari pencairan; pada Take Over tanpa dana tambahan, biaya dibayar di awal.
- **Syarat:** DTI maks (cicilan baru + utang lain dibagi penghasilan), LTV maks (plafon dibagi nilai properti), tenor maks, dan tujuan top-up (khusus mode Top-up).
- **Jenis produk:** mode tanpa dana tambahan memakai produk `Take Over`; mode dana tambahan hanya memakai produk `Take Over + Top-up`.

Data ini **tersimpan tetapi tidak dipakai** untuk Take Over: penghasilan minimum, usia minimum, usia maksimal saat lunas, pekerjaan, dan jenis properti. Di aplikasi, field itu hanya dipakai produk KPR Primary.

Tujuan top-up di ke-10 produk terbit diisi lengkap (kelima tujuan) oleh migration `supabase/migrations/20261014120000_topup_product_type.sql` pada 2026-10-14 sebagai titik awal, **bukan dari kebijakan bank**. Sesuaikan per bank di halaman produk admin.

## Detail per produk

### KPR BCA Take Over Fixed 3 Tahun

- **Bank:** Bank Central Asia (BCA)
- **ID produk:** `bpr_bbdc01a9-5912-486c-b90f-deebeb18d1ba` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-03-31 · **Terakhir diverifikasi:** 2026-10-10

| Bunga | Nilai |
| --- | --- |
| Fixed | 5,99% selama 36 bln (3 thn) |
| Floating (estimasi) | 11,5% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 0,5% dari plafon |
| Administrasi | Rp750.000 |
| Appraisal (estimasi) | Rp1.400.000 |
| Notaris (estimasi) | Rp4.500.000 |
| Asuransi (estimasi) | Rp1.900.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR CIMB Niaga Take Over Fixed 3 Tahun

- **Bank:** Bank CIMB Niaga (CIMB)
- **ID produk:** `bpr_820d21e1-3947-4e61-bbb8-0be4cc3d398a` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-03-31 · **Terakhir diverifikasi:** 2026-10-10

| Bunga | Nilai |
| --- | --- |
| Fixed | 6,49% selama 36 bln (3 thn) |
| Floating (estimasi) | 11,5% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 1% dari plafon |
| Administrasi | Rp1.250.000 |
| Appraisal (estimasi) | Rp1.300.000 |
| Notaris (estimasi) | Rp4.100.000 |
| Asuransi (estimasi) | Rp1.700.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR Danamon Take Over Fixed 2 Tahun

- **Bank:** Bank Danamon Indonesia (DNM)
- **ID produk:** `bpr_a8439219-f852-4f7a-856b-9f176e5026f8` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-03-31 · **Terakhir diverifikasi:** 2026-10-13

| Bunga | Nilai |
| --- | --- |
| Fixed | 5,9% selama 24 bln (2 thn) |
| Floating (estimasi) | 11,75% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 0,5% dari plafon |
| Administrasi | Rp750.000 |
| Appraisal (estimasi) | Rp1.100.000 |
| Notaris (estimasi) | Rp3.800.000 |
| Asuransi (estimasi) | Rp1.800.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR Mandiri Take Over Fixed 5 Tahun

- **Bank:** Bank Mandiri (MDR)
- **ID produk:** `bpr_2ad5bf02-752f-4b55-9f23-07f3727189bd` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-06-30 · **Terakhir diverifikasi:** 2026-10-11

| Bunga | Nilai |
| --- | --- |
| Fixed | 6,75% selama 60 bln (5 thn) |
| Floating (estimasi) | 11,25% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 0,75% dari plafon |
| Administrasi | Rp1.000.000 |
| Appraisal (estimasi) | Rp1.200.000 |
| Notaris (estimasi) | Rp4.500.000 |
| Asuransi (estimasi) | Rp2.100.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR BNI Griya Take Over Fixed 5 Tahun

- **Bank:** Bank Negara Indonesia (BNI)
- **ID produk:** `bpr_712ed244-31d8-4311-b6f2-2a77d7b90dad` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-06-30 · **Terakhir diverifikasi:** 2026-10-13

| Bunga | Nilai |
| --- | --- |
| Fixed | 6,99% selama 60 bln (5 thn) |
| Floating (estimasi) | 11% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 1% dari plafon |
| Administrasi | Rp750.000 |
| Appraisal (estimasi) | Rp1.200.000 |
| Notaris (estimasi) | Rp4.500.000 |
| Asuransi (estimasi) | Rp1.800.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR Permata Take Over Fixed 5 Tahun

- **Bank:** Bank Permata (PMT)
- **ID produk:** `bpr_e0f09d50-0079-463c-aae1-0b7685aa9f98` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-06-30 · **Terakhir diverifikasi:** 2026-10-11

| Bunga | Nilai |
| --- | --- |
| Fixed | 7,25% selama 60 bln (5 thn) |
| Floating (estimasi) | 12% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 1% dari plafon |
| Administrasi | Rp1.000.000 |
| Appraisal (estimasi) | Rp1.000.000 |
| Notaris (estimasi) | Rp4.200.000 |
| Asuransi (estimasi) | Rp1.800.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR BRI Take Over Fixed 3 Tahun

- **Bank:** Bank Rakyat Indonesia (BRI)
- **ID produk:** `bpr_f7763e0b-54fe-4a99-8772-b781fc20c129` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-03-31 · **Terakhir diverifikasi:** 2026-10-12

| Bunga | Nilai |
| --- | --- |
| Fixed | 6,25% selama 36 bln (3 thn) |
| Floating (estimasi) | 11% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 0,5% dari plafon |
| Administrasi | Rp500.000 |
| Appraisal (estimasi) | Rp1.100.000 |
| Notaris (estimasi) | Rp4.400.000 |
| Asuransi (estimasi) | Rp2.500.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR BSI Griya Hasanah Take Over

- **Bank:** Bank Syariah Indonesia (BSI)
- **ID produk:** `bpr_27d7523a-2ffc-45d1-8972-34a1abfbd131` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Syariah
- **Berlaku:** 2026-10-01 s/d 2027-06-30 · **Terakhir diverifikasi:** 2026-10-12

| Bunga | Nilai |
| --- | --- |
| Fixed | 7,5% selama 60 bln (5 thn) |
| Floating (estimasi) | 11,25% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 1% dari plafon |
| Administrasi | Rp750.000 |
| Appraisal (estimasi) | Rp1.500.000 |
| Notaris (estimasi) | Rp4.200.000 |
| Asuransi (estimasi) | Rp2.100.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR BTN Take Over Fixed 2 Tahun

- **Bank:** Bank Tabungan Negara (BTN)
- **ID produk:** `bpr_e2265f65-e670-457f-bf9b-d57eb0aff7cf` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-03-31 · **Terakhir diverifikasi:** 2026-10-14

| Bunga | Nilai |
| --- | --- |
| Fixed | 5,75% selama 24 bln (2 thn) |
| Floating (estimasi) | 11,75% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 0,5% dari plafon |
| Administrasi | Rp500.000 |
| Appraisal (estimasi) | Rp1.100.000 |
| Notaris (estimasi) | Rp3.600.000 |
| Asuransi (estimasi) | Rp1.700.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

### KPR Maybank Take Over Fixed 3 Tahun

- **Bank:** Maybank Indonesia (MBI)
- **ID produk:** `bpr_5471e7fb-9e41-4677-adfd-b7c4d6a4f63c` · versi 1
- **Jenis:** Take Over, Take Over + Top-up · **Skema:** Konvensional
- **Berlaku:** 2026-10-01 s/d 2027-03-31 · **Terakhir diverifikasi:** 2026-10-12

| Bunga | Nilai |
| --- | --- |
| Fixed | 6,4% selama 36 bln (3 thn) |
| Floating (estimasi) | 11,5% setelah masa fixed |

| Biaya | Nilai |
| --- | --- |
| Provisi | 0,75% dari plafon |
| Administrasi | Rp1.000.000 |
| Appraisal (estimasi) | Rp1.200.000 |
| Notaris (estimasi) | Rp4.000.000 |
| Asuransi (estimasi) | Rp2.000.000 |

| Syarat yang dipakai hitungan | Nilai |
| --- | --- |
| DTI maksimal | 40% |
| LTV maksimal | 80% |
| Tenor maksimal | 240 bln (20 thn) |
| Tujuan top-up yang diterima | Renovasi Rumah, Pendidikan, Modal Usaha, Konsolidasi Utang, Kebutuhan Lain |

Tersimpan, tidak dipakai untuk Take Over: penghasilan minimum Rp5.000.000, usia minimum 21 tahun, usia maksimal saat lunas 65 tahun, pekerjaan PNS / BUMN / TNI / Polri, Wiraswasta / pengusaha, Karyawan tetap swasta, Profesional (diketik admin), properti Rumah Tapak, Apartemen.

## Produk diarsipkan

Tidak tampil ke user dan tidak dipakai pencocokan. Beberapa nilainya tidak wajar (DTI jutaan persen, LTV 21%), jadi kemungkinan data uji atau salah input.

| Bank | Produk | Jenis | Bunga fixed | Floating | Tenor maks | LTV maks | DTI maks | Tujuan top-up | ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bank Permata | KPR Permata Take Over | Take Over | 6,9% · 36 bln | 10,75% | 65 bln | 21% | 8.000.000% | – | `bpr_a6563dd7-0585-40fa-828c-1c91a24e7b57` |
| Maybank Indonesia | KPR Maybank Fixed 5 Tahun | KPR Primary, Take Over | 7,35% · 60 bln | 11,25% | 60 bln | 21% | 8.000.000% | – | `bpr_0ebe158d-4923-4671-aa28-8295c4dd56a6` |
| Panin Bank | KPR Panin Take Over | Take Over | 7% · 36 bln | 10,8% | 60 bln | 21% | 7.500.000% | – | `bpr_1d7c751c-3fa3-4871-a8aa-5481c788122a` |
