// Examples are guidance only; the admin writes the actual reason saved in the audit log.
const EXAMPLES = {
  additional_docs_requested: 'Hasil verifikasi menunjukkan slip gaji belum terbaca jelas. Pemohon diminta mengunggah ulang dokumen tersebut.',
  bank_processing: 'Dokumen persyaratan sudah lengkap dan sesuai hasil verifikasi. Berkas diteruskan ke bank melalui [referensi pengiriman].',
  appraisal: 'Bank mengonfirmasi pengajuan dapat dilanjutkan ke appraisal, sesuai konfirmasi tanggal [tanggal].',
  approved: 'Bank menyetujui pengajuan setelah analisis kredit, mengacu pada surat persetujuan [referensi].',
  old_mortgage_settlement: 'Persetujuan Take Over diterima. Nilai pelunasan dikonfirmasi oleh bank asal melalui [referensi], sehingga proses pelunasan KPR lama dimulai.',
  akad: 'Penandatanganan akad selesai pada [tanggal]. Plafon, tenor, dan bunga final sudah dicocokkan dengan dokumen akad [referensi].',
  disbursed: 'Bank mengonfirmasi dana telah dicairkan pada [tanggal], sesuai bukti pencairan [referensi].',
  rejected: 'Hasil analisis bank menunjukkan rasio cicilan belum memenuhi ketentuan, sesuai keputusan bank tanggal [tanggal].',
  'user.profile': 'Tanggal lahir dikoreksi setelah dicocokkan dengan KTP terbaru yang dikirim pemohon pada [tanggal].',
  'user.finance': 'Penghasilan bulanan diperbarui setelah pemeriksaan slip gaji periode [periode] yang dikirim pemohon.',
  'bank.create': 'Bank ditambahkan setelah nama dan identitasnya diverifikasi dengan informasi resmi bank pada [tanggal].',
  'bank.update': 'Identitas bank diperbarui setelah dicocokkan dengan informasi resmi terbaru dari bank pada [tanggal].',
  'product.publish': 'Ketentuan bunga, biaya, dan masa berlaku sudah diperiksa sesuai informasi resmi bank [referensi]. Produk siap ditampilkan.',
  'product.archive': 'Masa penawaran produk telah berakhir berdasarkan ketentuan bank [referensi] dan produk tidak menerima pengajuan baru.',
  'product.bulkPublish': 'Ketentuan dan masa berlaku seluruh produk yang dipilih sudah diperiksa sesuai informasi resmi bank [referensi]. Produk siap ditampilkan.',
  'product.bulkArchive': 'Masa penawaran seluruh produk yang dipilih telah berakhir sesuai ketentuan bank [referensi]. Produk tidak menerima pengajuan baru.',
  'article.save': 'Informasi biaya dalam artikel dikoreksi setelah dicocokkan dengan sumber terbaru [referensi].',
  'article.publish': 'Isi dan sumber artikel sudah diperiksa oleh tim editorial. Artikel siap diterbitkan sesuai hasil peninjauan tanggal [tanggal].',
  'article.archive': 'Informasi dalam artikel sudah tidak berlaku berdasarkan hasil peninjauan konten tanggal [tanggal]. Artikel diarsipkan.',
  'config.reminders': 'Jadwal pengingat default disesuaikan berdasarkan evaluasi tim operasional dan sudah dikonfirmasi melalui [referensi].',
  'config.upload': 'Batas ukuran dan format unggahan disesuaikan dengan kebutuhan dokumen. Pengaturan sudah diperiksa sesuai hasil evaluasi [referensi].',
  'config.coverLetter': 'Identitas kantor pada default surat pengantar diperbarui setelah diverifikasi oleh penanggung jawab kantor pada [tanggal].',
  'config.support': 'Kontak CS diperbarui setelah nomor WhatsApp dan link konsultasi diuji serta dikonfirmasi aktif oleh tim layanan pada [tanggal].',
  'brand.publish': 'Identitas visual diperbarui sesuai panduan brand [referensi]. Logo, warna, dan keterbacaan sudah diperiksa melalui pratinjau.',
  'brand.reset': 'Hasil peninjauan menunjukkan tampilan brand terbaru belum sesuai panduan [referensi]. Tampilan dikembalikan ke bawaan Maxi.',
  'health.publish': 'Parameter KPR Health disesuaikan berdasarkan evaluasi [referensi]. Hasil pratinjau dampak sudah diperiksa dan dikonfirmasi oleh tim.',
  'health.rollback': 'Evaluasi [referensi] menemukan parameter pada versi aktif belum sesuai. Versi sebelumnya sudah ditinjau dan dipulihkan sebagai versi baru.',
  'accountArchive.delete': 'Arsip dihapus berdasarkan [dasar penghapusan]. Kelayakan penghapusan telah diperiksa dengan referensi [referensi jika ada].',
}

export function ReasonHint({ action, bulk = false }) {
  return (
    <span className="flex flex-col gap-1">
      <span><span className="font-semibold">Panduan:</span> Tuliskan dasar perubahan, hasil pemeriksaan/konfirmasi, dan referensi jika ada.</span>
      {EXAMPLES[action] && <span><span className="font-semibold">Contoh:</span> “{EXAMPLES[action]}”</span>}
      <span>{bulk ? 'Internal · Tercatat di audit log setiap produk · Minimal 5 karakter.' : 'Internal · Tercatat di audit log · Minimal 5 karakter.'}</span>
    </span>
  )
}
