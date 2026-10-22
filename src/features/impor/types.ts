export interface BarangImportRow {
  kode: string;
  nama: string;
  satuan: string;
  harga_jual: number;
  harga_pokok?: number | null;
  stok_minimum: number;
  stok_awal: number;
  aktif: boolean;
}

export interface PelangganImportRow {
  kode: string;
  nama_toko: string;
  telepon?: string | null;
  alamat?: string | null;
  termin_hari: number;
  batas_kredit: number;
  aktif: boolean;
}

export interface RowError {
  baris: number;
  kolom: string;
  kodeError: string;
  pesan: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  totalBaris: number;
  totalValid: number;
  totalGalat: number;
  galat: RowError[];
  data: T[];
}

export interface ImporDataRow {
  id: string;
  nomor: string;
  jenis: 'barang' | 'pelanggan';
  nama_berkas: string;
  jumlah_baris: number;
  jumlah_dibuat: number;
  status: 'berhasil' | 'gagal';
  ringkasan: Record<string, unknown>;
  dibuat_oleh: string;
  dibuat_pada: string;
  pelaksana_nama?: string;
}
