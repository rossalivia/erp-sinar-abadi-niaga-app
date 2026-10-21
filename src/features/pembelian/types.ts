export type StatusPembelian = 'diajukan' | 'disetujui' | 'ditolak' | 'diterima';

export interface PembelianListItem {
  id: string;
  nomor: string;
  status: StatusPembelian;
  jumlah_dipesan: number;
  jumlah_diterima: number;
  diajukan_pada: string;
  pemasok: {
    id: string;
    kode: string;
    nama: string;
  } | null;
  barang: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  } | null;
  // Khusus manajer (dari v_pembelian_manajer)
  harga_beli_satuan?: number | null;
  total_estimasi_beli?: number | null;
}

export interface PembelianDetail {
  id: string;
  nomor: string;
  pemasok_id: string;
  barang_id: string;
  jumlah_dipesan: number;
  jumlah_diterima: number;
  status: StatusPembelian;
  alasan_tolak: string | null;
  diajukan_oleh: string;
  diajukan_pada: string;
  diputuskan_oleh: string | null;
  diputuskan_pada: string | null;
  diterima_oleh: string | null;
  diterima_pada: string | null;
  pemasok: {
    id: string;
    kode: string;
    nama: string;
    telepon: string | null;
    alamat: string | null;
  };
  barang: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
    stok: number;
  };
  pengaju?: {
    nama_lengkap: string;
  } | null;
  pemutus?: {
    nama_lengkap: string;
  } | null;
  penerima?: {
    nama_lengkap: string;
  } | null;
  // Khusus manajer
  harga_beli_satuan?: number | null;
  total_estimasi_beli?: number | null;
}

export interface PemasokOption {
  id: string;
  kode: string;
  nama: string;
}

export interface BarangOption {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
}
