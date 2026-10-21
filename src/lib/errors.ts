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
  E0013: 'Pelanggan memiliki tagihan lewat jatuh tempo',
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
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Terjadi kesalahan sistem';

  if (typeof error === 'string') {
    return error;
  }

  const pgError = error as SupabasePostgresError;

  // 1. Cek kode error kustom E00xx
  if (pgError.code && ERROR_MESSAGES[pgError.code]) {
    // Khusus E0011 (BR-04) wajib persis
    if (pgError.code === 'E0011') {
      return 'Harga di bawah batas, minta persetujuan Manajer';
    }
    // Jika ada message dinamis dari database (misal: "Stok tidak cukup untuk barang BRG-001")
    if (pgError.message && pgError.message.trim().length > 0) {
      return pgError.message;
    }
    return ERROR_MESSAGES[pgError.code];
  }

  // 2. Jika ada pesan bawaan RAISE EXCEPTION dari Postgres dalam Bahasa Indonesia
  if (pgError.message) {
    // D6: Batas kredit dan overdue control verbatim
    if (pgError.message.includes('E0006: Batas kredit pelanggan terlampaui')) {
      return 'E0006: Batas kredit pelanggan terlampaui';
    }
    if (pgError.message.includes('E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir')) {
      return 'E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir';
    }
    if (pgError.message.includes('Harga di bawah batas, minta persetujuan Manajer')) {
      return 'Harga di bawah batas, minta persetujuan Manajer';
    }
    // Tangani error auth bawaan Supabase
    if (pgError.message.toLowerCase().includes('invalid login credentials')) {
      return 'Email atau kata sandi salah';
    }
    if (pgError.message.toLowerCase().includes('email not confirmed')) {
      return 'Email belum dikonfirmasi';
    }
    return pgError.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Terjadi kesalahan yang tidak terduga';
}
