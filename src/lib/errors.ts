/**
 * Pemetaan kode error RPC Postgres (Tahap 3) ke pesan Bahasa Indonesia
 * Menjamin konsistensi pesan bisnis di UI dan menjaga kerahasiaan data internal.
 */

export const ERROR_MESSAGES: Record<string, string> = {
  E0001: 'Akses ditolak',
  E0002: 'Data tidak ditemukan',
  E0003: 'Pesanan harus berisi 1 sampai 20 baris',
  E0004: 'Jumlah minimal 1',
  E0005: 'Barang sudah ada di pesanan ini',
  E0006: 'Barang tidak aktif atau tidak ditemukan',
  E0007: 'Pelanggan atau pemasok tidak aktif',
  E0008: 'Pesanan hanya bisa diubah saat berstatus draf',
  E0009: 'Diskon harus 0% sampai 10%',
  E0010: 'Diskon harus 0% sampai 25%',
  E0011: 'Harga di bawah batas, minta persetujuan Manajer', // BR-04 PERSIS
  E0012: 'Batas kredit pelanggan terlampaui',
  E0013: 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir',
  E0014: 'Stok barang tidak mencukupi untuk memenuhi pesanan',
  E0015: 'Perpindahan status atau tindakan tidak diizinkan',
  E0016: 'Alasan minimal 10 karakter',
  E0017: 'Jumlah pembelian harus 1 sampai 10.000',
  E0018: 'Harga beli harus lebih dari 0',
  E0019: 'Pembelian tidak dalam status disetujui',
  E0020: 'Jumlah diterima harus 1 sampai jumlah dipesan',
  E0021: 'Stok hasil penyesuaian tidak boleh negatif',
  E0024: 'Termin hari harus 0, 7, 14, atau 30',
  E0025: 'Peran tidak valid',
  E0026: 'Minimal harus ada satu Manajer aktif',
  E0027: 'Kode barang sudah digunakan',
  E0028: 'Harga jual harus lebih dari 0',
  E0029: 'Stok minimum harus bilangan bulat >= 0',
  E0031: 'Sesi opname harus berisi minimal 1 item barang',
  E0032: 'Sesi opname hanya dapat diubah saat berstatus draf',
  E0033: 'Stok fisik riil tidak boleh bernilai negatif',
  E0034: 'Sesi opname hanya dapat disetujui atau ditolak pada status diajukan',
  E0035: 'Barang sudah ada di sesi opname ini',
  E0036: 'Hanya Manajer yang berwenang menyetujui stock opname',
  E0037: 'Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter',
  E0038: 'Stok sistem telah berubah sejak sesi dibuat. Batalkan sesi lalu hitung ulang.',
  E0039: 'Hanya Staf Penjualan yang dapat mengajukan persetujuan harga',
  E0040: 'Pengajuan hanya dapat dilakukan pada pesanan berstatus draf',
  E0041: 'Pesanan sudah memiliki pengajuan persetujuan yang aktif',
  E0042: 'Tidak ada harga yang memerlukan persetujuan',
  E0043: 'Persetujuan hanya dapat diputuskan saat berstatus menunggu',
  E0044: 'Alasan penolakan minimal 10 karakter',
  E0045: 'Hanya pengajuan berstatus menunggu yang dapat dibatalkan',
  E0046: 'Pelanggan tidak memiliki tagihan aktif yang dapat ditagih',
  E0047: 'Catatan penagihan minimal 3 karakter dan maksimal 500 karakter',
  E0048: 'Tanggal janji bayar wajib diisi untuk jenis penagihan janji bayar',
  E0049: 'Tanggal janji bayar tidak boleh di masa lalu',
  E0050: 'Anda tidak memiliki wewenang menagih pelanggan ini',
  E0051: 'Catatan penagihan bersifat permanen dan tidak dapat diubah atau dihapus',
  E0052: 'Faktur tidak valid untuk penagihan pelanggan ini',
  E0053: 'Header berkas CSV tidak sesuai dengan templat resmi',
  E0054: 'Berkas CSV kosong, tidak ada data untuk diimpor',
  E0055: 'Berkas CSV melebihi batas maksimal 1.000 baris data',
  E0056: 'Ukuran berkas CSV melebihi batas maksimal 1 MB',
  E0057: 'Kode barang atau pelanggan sudah terdaftar di sistem',
  E0058: 'Nilai harus berupa bilangan bulat tanpa pecahan desimal',
  E0059: 'Kode barang atau pelanggan duplikat di dalam berkas CSV',
  E0060: 'Gagal memproses impor data, seluruh transaksi dibatalkan',
  E0061: 'Format berkas tidak didukung, harap unggah berkas berekstensi .csv',
  E0062: 'Data impor tidak valid',
  E0063: 'Pilih minimal satu pesanan untuk membuat daftar ambil barang',
  E0064: 'Terdapat pesanan yang tidak valid atau bukan berstatus dikonfirmasi',
  E0065: 'Hanya Staf Gudang dan Manajer yang berwenang mengakses daftar ambil barang',
  E0066: 'Tagihan Mayar hanya dapat dibuat untuk pesanan berstatus dikirim',
  E0067: 'Pesanan sudah memiliki tagihan Mayar aktif',
  E0068: 'Total pesanan harus lebih besar dari 0 untuk membuat tagihan',
  E0069: 'Email pelanggan wajib diisi dengan format valid',
  E0070: 'Masa berlaku tagihan harus antara 1 sampai 30 hari',
  E0071: 'Tagihan Mayar tidak ditemukan atau bukan berstatus aktif',
  E0072: 'Jumlah tagihan tidak sesuai dengan total pesanan',
  E0073: 'Hanya Manajer yang berwenang mengelola tagihan Mayar',
};

interface SupabasePostgresError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Mengubah objek error dari Supabase / Postgres / JS menjadi pesan Bahasa Indonesia.
 * Pesan BR-04 ("Harga di bawah batas, minta persetujuan Manajer") diteruskan PERSIS.
 * Pesan K2 kredit & overdue diteruskan PERSIS tanpa awalan yang bertabrakan.
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Terjadi kesalahan sistem';

  if (typeof error === 'string') {
    return error.replace(/^E\d{4}:\s*/, '');
  }

  const pgError = error as SupabasePostgresError;

  // 1. Cek kode error kustom E00xx
  if (pgError.code && ERROR_MESSAGES[pgError.code]) {
    // Khusus E0011 (BR-04) wajib persis
    if (pgError.code === 'E0011') {
      return 'Harga di bawah batas, minta persetujuan Manajer';
    }
    // K2: Kredit dan Overdue wajib persis
    if (pgError.code === 'E0012') {
      return 'Batas kredit pelanggan terlampaui';
    }
    if (pgError.code === 'E0013') {
      return 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir';
    }
    if (pgError.code === 'E0037') {
      return 'Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter';
    }
    // Jika ada message dinamis dari database (misal: "Stok tidak cukup untuk barang BRG-001" atau E0038)
    if (pgError.message && pgError.message.trim().length > 0) {
      return pgError.message.replace(/^E\d{4}:\s*/, '');
    }
    return ERROR_MESSAGES[pgError.code];
  }

  // 2. Jika ada pesan bawaan RAISE EXCEPTION dari Postgres dalam Bahasa Indonesia
  if (pgError.message) {
    if (pgError.message.includes('Batas kredit pelanggan terlampaui')) {
      return 'Batas kredit pelanggan terlampaui';
    }
    if (pgError.message.includes('faktur lewat jatuh tempo') || pgError.message.includes('tagihan lewat jatuh tempo')) {
      return 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir';
    }
    if (pgError.message.includes('Harga di bawah batas, minta persetujuan Manajer')) {
      return 'Harga di bawah batas, minta persetujuan Manajer';
    }
    if (pgError.message.includes('Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter')) {
      return 'Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter';
    }
    if (pgError.message.includes('Stok barang') && pgError.message.includes('telah berubah')) {
      return pgError.message.replace(/^E\d{4}:\s*/, '');
    }
    // Tangani error auth bawaan Supabase
    if (pgError.message.toLowerCase().includes('invalid login credentials')) {
      return 'Email atau kata sandi salah';
    }
    if (pgError.message.toLowerCase().includes('email not confirmed')) {
      return 'Email belum dikonfirmasi';
    }
    return pgError.message.replace(/^E\d{4}:\s*/, '');
  }

  if (error instanceof Error) {
    return error.message.replace(/^E\d{4}:\s*/, '');
  }

  return 'Terjadi kesalahan yang tidak terduga';
}
