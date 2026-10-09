// Education fixture content served through the adapter (Explore / Home insights).
export const ARTICLES = [
  {
    slug: 'fixed-vs-floating',
    tag: 'Bunga',
    icon: 'percent',
    title: 'Fixed vs Floating',
    summary: 'Kapan bunga tetap lebih menguntungkan, dan apa yang terjadi setelah masa fixed berakhir.',
    minutes: 4,
    body: [
      'Bunga fixed berlaku tetap selama periode tertentu, misalnya 3 atau 5 tahun pertama. Selama periode ini cicilan kamu tidak berubah.',
      'Setelah masa fixed berakhir, bunga biasanya berubah menjadi floating: mengikuti suku bunga acuan dan kebijakan bank. Cicilan dihitung ulang dari sisa pokok dan sisa tenor, sehingga bisa naik cukup signifikan.',
      'Karena itu, bandingkan program bukan hanya dari bunga promo, tetapi juga estimasi bunga floating setelahnya dan total pembayaran selama tenor.',
      'Di RuangKPR, kamu akan diingatkan H-90, H-60, H-30, H-14, dan H-7 sebelum masa fixed berakhir, lengkap dengan estimasi dampak ke cicilan.',
    ],
  },
  {
    slug: 'dp-ideal',
    tag: 'Uang muka',
    icon: 'wallet',
    title: 'DP ideal',
    summary: 'Berapa uang muka yang aman tanpa menguras dana darurat.',
    minutes: 3,
    body: [
      'Uang muka (DP) yang lebih besar menurunkan jumlah pinjaman, cicilan bulanan, dan total bunga. Namun jangan sampai DP menghabiskan dana darurat.',
      'Sisihkan dana darurat minimal 3–6 kali pengeluaran bulanan sebelum menentukan besar DP.',
      'Ingat juga biaya awal di luar DP seperti BPHTB, notaris, appraisal, provisi, dan asuransi yang bisa mencapai beberapa persen dari harga rumah.',
    ],
  },
  {
    slug: 'biaya-tersembunyi',
    tag: 'Biaya',
    icon: 'receipt',
    title: 'Biaya tersembunyi beli rumah',
    summary: 'BPHTB, notaris, appraisal, dan asuransi di luar harga rumah.',
    minutes: 4,
    body: [
      'Selain harga rumah dan DP, siapkan biaya transaksi: BPHTB, biaya notaris/PPAT, biaya appraisal, provisi dan administrasi bank, serta asuransi jiwa dan kebakaran.',
      'Besarnya bervariasi antar bank dan daerah. Minta rincian tertulis dari bank sebelum akad.',
      'Pada perbandingan program di RuangKPR, biaya yang tersedia ditampilkan per program dan diberi label estimasi bila belum final.',
    ],
  },
  {
    slug: 'break-even-take-over',
    tag: 'Take Over',
    icon: 'repeat',
    title: 'Cara menghitung break-even',
    summary: 'Kapan biaya pindah bank tertutup oleh penghematan cicilan.',
    minutes: 3,
    body: [
      'Take Over memindahkan KPR ke bank lain. Ada biaya pindah: penalti pelunasan bank lama, provisi, administrasi, appraisal, notaris, dan asuransi.',
      'Break-even adalah bulan saat total penghematan cicilan sudah menutup seluruh biaya pindah. Jika cicilan baru tidak lebih ringan, tidak ada titik impas dari penghematan bulanan.',
      'Perhatikan juga bunga floating setelah masa fixed bank baru: penghematan di awal bisa berkurang setelahnya.',
    ],
  },
  {
    slug: 'refinancing-vs-multiguna',
    tag: 'Dana tambahan',
    icon: 'hand-coins',
    title: 'Beda refinancing dan multiguna',
    summary: 'Dua cara memakai nilai rumah untuk dana tambahan.',
    minutes: 3,
    body: [
      'Refinancing + Top-up mengganti KPR lama dengan pinjaman baru yang lebih besar; selisihnya (setelah biaya) diterima sebagai dana tambahan.',
      'Multiguna adalah pinjaman baru dengan agunan rumah, biasanya untuk rumah yang sudah lunas atau sisa pokoknya kecil.',
      'Keduanya dibatasi nilai properti × LTV bank, dan tetap harus lolos analisis kemampuan bayar serta appraisal resmi.',
    ],
  },
]
