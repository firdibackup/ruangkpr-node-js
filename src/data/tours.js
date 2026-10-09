// Page tours (react-joyride) for first-time users: where things are, plus the KPR terms shown there.
// `target` is a `data-tour` name; PageTour drops steps whose element isn't on screen (hidden widget,
// desktop-only control on a phone). A `center` step has no target and floats mid-screen.
export const TOURS = {
  "home-fresh": [
    {
      placement: "center",
      title: "Selamat datang di RuangKPR",
      content:
        "Kami bantu urus KPR kamu, dari mengajukan sampai memantau cicilan setelah rumah jadi milikmu. Kenalan sebentar, ya.",
    },
    {
      target: "monitoring-entry",
      title: "Sudah punya KPR?",
      content:
        "Sudah mencicil rumah? Mulai dari sini. Kami ingatkan jadwal bayar dan kabari sebelum bunga jadi floating (ikut bank, cicilan bisa naik).",
    },
    {
      target: "products",
      title: "Mau mengajukan?",
      content:
        "Mulai Pengajuan KPR: beli rumah baru atau bekas. Take Over: pindah KPR ke bank lain supaya bunga lebih ringan. Refinancing: pindah bank sekaligus dapat dana tambahan.",
    },
    // {
    //   target: 'how-it-works',
    //   title: 'Simulasi itu gratis',
    //   content: 'Bandingkan program sepuasnya. Data kamu baru dikirim ke bank setelah kamu memilih satu program dan menekan Ajukan.',
    // },
    {
      target: "nav",
      placement: "top",
      title: "Menu utama",
      content:
        "Home: kabar hari ini. My KPR: detail pengajuan atau KPR kamu. Explore: artikel panduan. Activity: notifikasi.",
    },
    {
      target: "tour-button",
      title: "Butuh penjelasan lagi?",
      content:
        "Tekan Panduan kapan saja untuk mengulang penjelasan di halaman ini.",
    },
  ],
  "home-dashboard": [
    {
      target: "myKpr",
      placement: "right",
      title: "Ringkasan KPR kamu",
      content:
        "Sisa pokok adalah utang yang belum kamu bayar, belum termasuk bunga. Sisa tenor adalah berapa lama lagi kamu mencicil.",
    },
    {
      target: "myKpr",
      placement: "right",
      title: "Fixed dan floating",
      content:
        'Bunga fixed tetap sampai "Masa fixed berakhir". Setelah itu jadi floating: ikut bank, dan cicilan bisa naik. Kami ingatkan mulai 90 hari sebelumnya.',
    },
    {
      target: "nextPayment",
      title: "Pembayaran berikutnya",
      content:
        "Cicilan dan jatuh tempo terdekat. Sudah bayar? Tekan Tandai Sudah Dibayar. Ini catatan pribadi kamu, karena RuangKPR tidak terhubung ke rekening bank.",
    },
    {
      target: "amortization",
      title: "Pokok dan bunga",
      content:
        "Tiap cicilan terbagi dua: pokok (mengurangi utang) dan bunga (biaya pinjaman). Di tahun-tahun awal, porsi bunga paling besar.",
    },
    {
      target: "health",
      title: "KPR Health",
      content:
        "Skor 0–100 tentang kesehatan KPR kamu, misalnya apakah cicilan terlalu berat dibanding penghasilan. Masih terkunci? Isi penghasilan untuk membukanya.",
    },
    {
      target: "opportunity",
      title: "Peluang KPR",
      placement: "right",
      content:
        "Kami cek apakah Take Over atau Refinancing bisa lebih hemat, sudah termasuk semua biayanya. Ini hanya simulasi dan tidak otomatis diajukan.",
    },
    {
      target: "arrange-dashboard",
      title: "Atur sesukamu",
      content:
        "Tekan Atur Dashboard untuk menambah, menyembunyikan, atau memindah kotak-kotak ini. Kami pandu saat kamu membukanya.",
    },
  ],
  "home-arrange": [
    {
      target: "arrange-panel",
      title: "Mode Atur Dashboard",
      content:
        "Sekarang kamu bisa mengubah susunan Home. Tenang, belum ada yang tersimpan sampai kamu menekan Simpan.",
    },
    {
      target: "widget-move",
      title: "Pindah dan ubah ukuran",
      content:
        "Tarik ⠿ untuk memindah kotak. Tarik sudut kiri atas atau kanan bawah untuk mengubah ukurannya.",
    },
    {
      target: "widget-menu",
      title: "Lewat menu",
      content:
        "Tidak nyaman menarik? Pakai menu ini untuk menggeser, mengubah ukuran, atau menyembunyikan kotak. Bisa juga dengan keyboard.",
    },
    {
      target: "widget-hide",
      title: "Sembunyikan",
      content:
        "Tidak perlu kotak ini? Sembunyikan. Bisa ditambah lagi kapan saja.",
    },
    {
      target: "arrange-add",
      title: "Tambah widget",
      content:
        "Pilih kotak lain dari katalog: grafik, angka, timeline, dan pengingat. Kalau ada yang terkunci, lengkapi datanya dulu.",
    },
    {
      target: "arrange-actions",
      title: "Simpan atau batal",
      content:
        "Reset: kembali ke susunan awal. Batal: buang perubahan. Simpan: pakai susunan baru.",
    },
  ],
  "my-kpr": [
    {
      target: "tab-overview",
      title: "Overview",
      content:
        "Ringkasan KPR kamu, termasuk berapa banyak pokok yang sudah lunas.",
    },
    {
      target: "tab-payment",
      title: "Payment",
      content:
        "Riwayat dan jadwal cicilan. Di sini kamu bisa menandai pembayaran dan membuka jadwal amortisasi.",
    },
    {
      target: "tab-rate",
      title: "Rate",
      content:
        "Timeline bunga: kapan masa fixed berakhir, perkiraan bunga floating sesudahnya, dan dampaknya ke cicilan.",
    },
    {
      target: "tab-property",
      title: "Property",
      content:
        "Isi perkiraan nilai rumah untuk menghitung equity (bagian rumah yang sudah jadi milikmu) dan LTV (sisa pinjaman dibanding nilai rumah, makin kecil makin baik).",
    },
  ],
  amortization: [
    {
      target: "amort-summary",
      title: "Sisa yang akan dibayar",
      content:
        "Total yang masih akan kamu bayar sampai lunas: pokok ditambah estimasi bunga. Anuitas artinya cicilan per bulan sama selama bunganya sama.",
    },
    {
      target: "amort-rate",
      title: "Asumsi bunga",
      content:
        "Hitungan ini memakai bunga fixed sekarang, lalu perkiraan floating. Kalau bunga floating nanti berbeda, angkanya ikut berubah.",
    },
    {
      target: "amort-chart",
      title: "Pokok vs bunga per tahun",
      content:
        "Porsi bunga makin kecil dan porsi pokok makin besar dari tahun ke tahun. Warnanya sesuai keterangan di atas grafik.",
    },
    {
      target: "amort-full",
      title: "Rincian per bulan",
      content: "Mau lihat cicilan tiap bulan? Buka jadwal lengkap.",
    },
  ],
};
