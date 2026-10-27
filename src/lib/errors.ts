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
  E0023: 'Alasan penyesuaian stok minimal 10 karakter',
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
  E0074: 'Hanya pengaju yang berwenang membatalkan pengajuan pembelian',
  E0075: 'Hanya Manajer yang berwenang membatalkan pembelian yang disetujui',
  E0076: 'Pembelian dengan status ini tidak dapat dibatalkan',
  E0077: 'Pembelian yang sudah diterima barangnya tidak dapat dibatalkan',
  E0078: 'Hanya Manajer yang berwenang mencatat pelunasan',
};

export const PG_STANDARD_ERRORS: Record<string, string> = {
  '23503': 'Data terkait tidak ditemukan atau sedang digunakan oleh transaksi lain',
  '23505': 'Data sudah terdaftar atau kode telah digunakan',
  '23514': 'Nilai yang dimasukkan tidak memenuhi batasan validasi sistem',
  '23502': 'Kolom wajib belum diisi dengan lengkap',
  '42501': 'Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini',
  '40001': 'Sistem sedang memproses transaksi bersamaan, silakan coba beberapa saat lagi',
  '55P03': 'Data sedang dikunci oleh proses lain, silakan coba beberapa saat lagi',
};

interface SupabasePostgresError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Mencegat dan menerjemahkan pola pesan teknis database mentah PostgreSQL ke Bahasa Indonesia.
 * Mencegah munculnya pesan seperti "violates foreign key constraint", "violates check constraint", dll.
 */
function mapPostgresRawMessage(rawMessage: string): string | null {
  const lower = rawMessage.toLowerCase();

  // 1. Kasus bisnis spesifik utama (prioritas tinggi)
  if (lower.includes('harga di bawah batas') || lower.includes('minta persetujuan manajer')) {
    return 'Harga di bawah batas, minta persetujuan Manajer';
  }
  if (lower.includes('batas kredit')) {
    return 'Batas kredit pelanggan terlampaui';
  }
  if (lower.includes('lewat jatuh tempo') || lower.includes('faktur lewat') || lower.includes('tagihan lewat')) {
    return 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir';
  }
  if (lower.includes('25%')) {
    return 'Diskon harus 0% sampai 25%';
  }
  if (lower.includes('10%') && lower.includes('diskon')) {
    return 'Diskon harus 0% sampai 10%';
  }
  if (lower.includes('alasan minimal 10') || lower.includes('alasan penyesuaian stok minimal 10')) {
    return 'Alasan penyesuaian stok minimal 10 karakter';
  }
  if (lower.includes('item dengan selisih stok wajib memiliki keterangan')) {
    return 'Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter';
  }

  // 2. Mencegah pesan mentah teknis Postgres berbahasa Inggris (Zero Raw DB Leaks)
  if (lower.includes('violates foreign key constraint') || lower.includes('foreign key')) {
    return 'Data terkait tidak ditemukan atau sedang digunakan oleh transaksi lain';
  }
  if (lower.includes('violates unique constraint') || lower.includes('duplicate key value')) {
    return 'Data sudah terdaftar atau kode telah digunakan';
  }
  if (lower.includes('violates check constraint')) {
    if (lower.includes('stok')) {
      return 'Stok barang tidak mencukupi atau hasil penyesuaian tidak boleh negatif';
    }
    if (lower.includes('diskon')) {
      return 'Nilai diskon tidak valid';
    }
    if (lower.includes('harga')) {
      return 'Harga jual harus lebih dari 0';
    }
    return 'Nilai yang dimasukkan tidak memenuhi batasan validasi sistem';
  }
  if (lower.includes('violates not-null constraint') || lower.includes('null value in column')) {
    return 'Kolom wajib belum diisi dengan lengkap';
  }
  if (lower.includes('permission denied')) {
    return 'Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini';
  }
  if (lower.includes('deadlock detected') || lower.includes('could not serialize access')) {
    return 'Sistem sedang memproses transaksi bersamaan, silakan coba beberapa saat lagi';
  }

  // 3. Pesan bawaan auth
  if (lower.includes('invalid login credentials')) {
    return 'Email atau kata sandi salah';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi';
  }

  return null;
}

/**
 * Mengubah objek error dari Supabase / Postgres / JS menjadi pesan Bahasa Indonesia ramah pengguna.
 * Menjamin bahwa pesan teknis Postgres mentah diterjemahkan dan pesan bisnis BR-04, BR-05, dll.
 * diteruskan persis sesuai kamus error aplikasi.
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Terjadi kesalahan sistem';

  if (typeof error === 'string') {
    const mapped = mapPostgresRawMessage(error);
    if (mapped) return mapped;
    return error.replace(/^E\d{4}:\s*/, '');
  }

  const pgError = error as SupabasePostgresError;

  // 1. Cek kode error kustom E00xx (Kamus Error Resmi Aplikasi)
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

    // Jika ada pesan dinamis Bahasa Indonesia dari RAISE EXCEPTION yang relevan (misal "Stok tidak cukup untuk barang BRG-001")
    if (pgError.message && pgError.message.trim().length > 0) {
      const lower = pgError.message.toLowerCase();
      if (!lower.includes('violates') && !lower.includes('constraint') && !lower.includes('foreign key')) {
        return pgError.message.replace(/^E\d{4}:\s*/, '');
      }
    }
    return ERROR_MESSAGES[pgError.code];
  }

  // 2. Cek kode error SQLSTATE Postgres standar (misal 23503, 23505, 23514)
  if (pgError.code && PG_STANDARD_ERRORS[pgError.code]) {
    if (pgError.message) {
      const mapped = mapPostgresRawMessage(pgError.message);
      if (mapped) return mapped;
    }
    return PG_STANDARD_ERRORS[pgError.code];
  }

  // 3. Periksa pesan teks bawaan dari database
  if (pgError.message) {
    const mapped = mapPostgresRawMessage(pgError.message);
    if (mapped) return mapped;

    // Bersihkan prefix E00xx: bila ada
    const cleaned = pgError.message.replace(/^E\d{4}:\s*/, '');

    // Jika pesan masih mengandung kata-kata teknis SQL mentah bahasa Inggris, ubah ke pesan ramah
    const lower = cleaned.toLowerCase();
    if (
      lower.includes('relation') ||
      lower.includes('column') ||
      lower.includes('constraint') ||
      lower.includes('syntax error') ||
      lower.includes('function')
    ) {
      return 'Terjadi kesalahan pada validasi database sistem';
    }

    return cleaned;
  }

  if (error instanceof Error) {
    const mapped = mapPostgresRawMessage(error.message);
    if (mapped) return mapped;
    return error.message.replace(/^E\d{4}:\s*/, '');
  }

  return 'Terjadi kesalahan yang tidak terduga';
}
