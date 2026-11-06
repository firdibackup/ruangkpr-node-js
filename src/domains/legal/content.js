import { brand } from '@/brand/brand'

export const LEGAL_VERSION = '2026-11-06'
export const RETENTION_NOTICE = 'Dokumen digunakan hingga akad atau pengajuan selesai, lalu tetap tersimpan sebagai arsip. Selesainya pengajuan tidak berarti dokumen otomatis dihapus.'

export const legalDocuments = {
  legalitas: {
    title: 'Legalitas',
    summary: 'Kenali pengelola layanan dan peran platform dalam perjalanan pengajuan kamu.',
    sections: [
      ['Pengelola layanan', `${brand.name} dikelola oleh ${brand.legalOperator}. ${brand.legalOperatorNotice}`],
      ['Peran platform', 'Platform membantu kamu memahami, memantau, dan menyiapkan pengajuan pembiayaan. Keputusan persetujuan, syarat kredit, biaya, dan pencairan mengikuti penilaian serta perjanjian dengan bank atau lembaga pembiayaan yang kamu pilih. Simulasi bukan persetujuan kredit.'],
      ['Hubungi pengelola', `Pertanyaan layanan dan permintaan terkait data pribadi dapat disampaikan ke ${brand.supportEmail}. Sertakan jenis permintaan dan identitas akun secukupnya; jangan mengirim password, PIN, atau OTP perbankan.`],
    ],
  },
  'kebijakan-privasi': {
    title: 'Kebijakan Privasi',
    summary: 'Ketahui data yang diproses, tujuannya, pihak penerima, serta pilihan kamu atas data tersebut.',
    sections: [
      ['Pengelola dan cakupan', `Kebijakan ini menjelaskan pemrosesan data pada ${brand.name}, yang dikelola oleh ${brand.legalOperator}. ${brand.legalOperatorNotice} Pelindungan data mengacu pada UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi dan ketentuan yang berlaku.`],
      ['Data yang diproses', 'Data akun meliputi nama, email, serta informasi autentikasi. Sesuai layanan yang kamu gunakan, kami memproses identitas dan kontak, NIK/KTP, data pekerjaan dan penghasilan, informasi KPR, rekening, serta dokumen properti dan pendukung yang kamu kirim. Data keuangan pribadi memerlukan perlindungan khusus. Berikan hanya data yang relevan; dokumen opsional ditandai pada formulir.'],
      ['Tujuan dan dasar pemrosesan', 'Data akun digunakan untuk menyediakan akses layanan. Data KPR dipakai untuk analisis, simulasi, pemantauan, dan pengingat yang kamu pilih. Dokumen digunakan untuk verifikasi dan pemrosesan pengajuan. Dasar pemrosesan disesuaikan dengan tujuannya, termasuk pelaksanaan layanan yang kamu minta, persetujuan yang diberikan secara spesifik, atau kewajiban hukum yang berlaku. Persetujuan pengajuan bukan persetujuan pemasaran.'],
      ['Penerima data', 'Pengiriman pengajuan ke bank memerlukan pilihan bank/program dan persetujuan kamu pada ringkasan pengajuan. Tim yang menangani layanan dan penyedia infrastruktur dapat memproses data sesuai kebutuhan tugasnya. Pengungkapan kepada otoritas hanya dilakukan berdasarkan kewajiban atau permintaan yang sah. Data tidak boleh digunakan untuk tujuan lain tanpa dasar pemrosesan yang sesuai.'],
      ['Dokumen orang lain', 'Jika dokumen memuat data pasangan, keluarga, atau pihak lain, pastikan kamu memiliki kewenangan dan dasar yang sesuai untuk menyerahkannya. Persetujuan pemilik akun tidak otomatis menggantikan hak orang yang datanya tercantum.'],
      ['Penyimpanan dan arsip', `${RETENTION_NOTICE} Akses arsip dibatasi berdasarkan kewenangan. Jangka waktu arsip setelah proses selesai masih dalam penetapan pengelola; kebijakan ini tidak menjanjikan penghapusan otomatis pada tanggal tertentu. Hubungi layanan dukungan untuk meminta penjelasan, pembatasan pemrosesan, atau penghapusan. Permintaan ditinjau sesuai dasar pemrosesan dan kewajiban penyimpanan yang benar-benar berlaku.`],
      ['Hak dan pilihan kamu', `Kamu dapat mengajukan akses atau salinan data, koreksi, penarikan persetujuan untuk pemrosesan berbasis persetujuan, penghentian atau pembatasan pemrosesan, serta penghapusan sesuai ketentuan yang berlaku melalui ${brand.supportEmail}. Kami perlu memverifikasi identitas pemohon untuk melindungi data. Penarikan izin yang diperlukan untuk suatu pengajuan dapat menghentikan proses tersebut; kami menjelaskan dampaknya dan dasar penyimpanan yang masih berlaku.`],
      ['Keamanan dan insiden', 'Kami membatasi akses dokumen sesuai kebutuhan layanan dan menggunakan kontrol akses pada sistem. Tidak ada sistem yang bebas risiko sepenuhnya. Dugaan akses tidak sah dapat dilaporkan melalui kontak dukungan. Penanganan dan pemberitahuan insiden mengikuti kewajiban hukum yang berlaku.'],
      ['Sesi dan perubahan kebijakan', 'Penyimpanan sesi diperlukan agar kamu dapat masuk dan menggunakan layanan. Pilihan pemasaran atau pelacakan tambahan, bila disediakan, harus dijelaskan terpisah. Perubahan material kebijakan akan diberitahukan; persetujuan baru diminta bila diperlukan. Versi yang disetujui dicatat agar dapat ditelusuri.'],
    ],
  },
  'syarat-dan-ketentuan': {
    title: 'Syarat & Ketentuan',
    summary: 'Aturan penggunaan akun, kebenaran data, dan pengajuan kepada bank yang kamu pilih.',
    sections: [
      ['Penggunaan layanan', `Ketentuan ini mengatur layanan ${brand.name} yang dikelola oleh ${brand.legalOperator}. Gunakan layanan hanya jika kamu memiliki kecakapan dan kewenangan untuk tindakan yang dilakukan. Kebijakan Privasi menjelaskan pemrosesan data terkait layanan.`],
      ['Akun dan keamanan akses', 'Gunakan identitas yang benar, jaga kerahasiaan akses akun, dan laporkan dugaan penyalahgunaan. Jangan membagikan password, PIN, atau OTP perbankan. Pengelola tetap bertanggung jawab menjalankan kewajibannya; ketentuan ini tidak menghapus hak pengguna yang dilindungi hukum.'],
      ['Kebenaran data dan kewenangan', 'Pastikan data dan dokumen yang kamu berikan benar, terkini, tidak menyesatkan, serta diserahkan dengan kewenangan yang sesuai. Gunakan fitur edit sebelum mengirim. Jika terdapat kekeliruan setelah pengajuan, hubungi tim layanan untuk proses koreksi.'],
      ['Simulasi dan pengajuan', 'Simulasi, estimasi cicilan, dan informasi program bukan janji persetujuan atau pencairan. Menyimpan KPR untuk pemantauan tidak membuat pengajuan ke bank. Pengajuan dikirim setelah kamu meninjau data, memilih bank/program, dan memberikan persetujuan pengiriman. Bank menentukan hasil serta syarat pembiayaan.'],
      ['Biaya dan perjanjian pembiayaan', 'Periksa bunga, biaya, tenor, dan ketentuan pada penawaran serta perjanjian resmi sebelum menyetujuinya. Biaya layanan yang berlaku harus diinformasikan sebelum tindakan yang menimbulkan biaya. Ketentuan platform tidak menggantikan perjanjian pembiayaan dengan bank.'],
      ['Larangan penyalahgunaan', 'Dilarang menyerahkan dokumen palsu, menggunakan identitas tanpa kewenangan, mengakses data orang lain, mengganggu sistem, atau menggunakan layanan untuk kegiatan melawan hukum. Akses dapat dibatasi untuk menangani pelanggaran dengan tetap memperhatikan hak pengguna.'],
      ['Penghentian dan penyelesaian keluhan', `Kamu dapat menghentikan penggunaan layanan dan menyampaikan pembatalan, koreksi, atau keluhan melalui ${brand.supportEmail}. Pembatalan pengajuan dan penghapusan data adalah tindakan berbeda. ${RETENTION_NOTICE} Sengketa ditangani terlebih dahulu melalui pengaduan dan musyawarah, tanpa menghilangkan hak menempuh mekanisme yang tersedia menurut hukum Indonesia.`],
    ],
  },
  'kebijakan-keamanan-informasi': {
    title: 'Kebijakan Keamanan Informasi',
    summary: 'Cara menjaga akses akun dan dokumen, serta melaporkan masalah keamanan.',
    sections: [
      ['Prinsip pelindungan', 'Pelindungan informasi mencakup kerahasiaan, keutuhan, dan ketersediaan data. Akses harus sesuai peran dan kebutuhan layanan; pengguna tidak boleh mengakses dokumen milik pengguna lain.'],
      ['Dokumen dan akses', 'Dokumen pengajuan disimpan pada penyimpanan privat dan akses unduh memerlukan otorisasi. Pemeriksaan jenis dan ukuran berkas membantu membatasi unggahan yang tidak sesuai. Pratinjau dokumen tidak ditampilkan pada daftar unggahan pengguna.'],
      ['Penggunaan dan arsip', `${RETENTION_NOTICE} Arsip harus tetap tunduk pada pembatasan akses, tujuan pemrosesan, dan penanganan permintaan hak data. Menyembunyikan berkas dari layar bukan penghapusan dari sistem.`],
      ['Keamanan akun', 'Gunakan password yang unik, keluar setelah menggunakan perangkat bersama, dan waspadai tautan yang meminta kredensial perbankan. Tim layanan tidak memerlukan PIN atau OTP perbankan untuk menjelaskan layanan.'],
      ['Pelaporan masalah', `Laporkan dugaan akses tidak sah atau penyalahgunaan melalui ${brand.supportEmail}, dengan waktu kejadian dan penjelasan singkat. Hindari mengirim dokumen pribadi penuh atau kredensial dalam laporan awal. Penanganan insiden dan pemberitahuan mengikuti ketentuan yang berlaku.`],
    ],
  },
}
