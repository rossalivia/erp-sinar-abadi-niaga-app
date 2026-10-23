export type JenisNotifikasi = 'stok_menipis' | 'uji';
export type StatusNotifikasi = 'diklaim' | 'terkirim' | 'dilewati' | 'gagal';
export type EmailMode = 'sandbox' | 'live';

export interface BarangStokMenipis {
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  selisih: number;
}

export interface PenerimaNotifikasi {
  email: string;
  nama_lengkap: string;
  peran: string;
}

export interface NotifikasiEmailLog {
  id: string;
  jenis: JenisNotifikasi;
  tanggal_bisnis: string;
  status: StatusNotifikasi;
  jumlah_barang: number;
  jumlah_penerima: number;
  galat_singkat: string | null;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export interface KirimNotifikasiResult {
  success: boolean;
  message: string;
  logId?: string;
  status?: StatusNotifikasi;
  jumlahBarang?: number;
  jumlahPenerima?: number;
}
