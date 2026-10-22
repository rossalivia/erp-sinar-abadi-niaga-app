import type { Peran } from '@/types/auth';

export type StatusPesanan = 'draf' | 'dikonfirmasi' | 'dikirim' | 'lunas' | 'dibatalkan';

export interface PesananJualListItem {
  id: string;
  nomor: string;
  status: StatusPesanan;
  total: number;
  dibuat_pada: string;
  jatuh_tempo: string | null;
  dibuat_oleh: string;
  pelanggan: {
    id: string;
    kode: string;
    nama_toko: string;
    telepon: string | null;
  } | null;
}

export interface PesananJualDetail {
  id: string;
  nomor: string;
  status: StatusPesanan;
  total: number;
  dibuat_oleh: string;
  dibuat_pada: string;
  dikonfirmasi_pada: string | null;
  dikirim_pada: string | null;
  jatuh_tempo: string | null;
  dilunasi_pada: string | null;
  dibatalkan_pada: string | null;
  alasan_batal: string | null;
  pelanggan: {
    id: string;
    kode: string;
    nama_toko: string;
    telepon: string | null;
    alamat: string;
    batas_kredit: number;
    termin_hari: number;
  };
  pembuat?: {
    id: string;
    nama_lengkap: string;
    peran: Peran;
  } | null;
}

export interface ItemPesananJualRow {
  id: string;
  pesanan_jual_id: string;
  barang_id: string;
  jumlah: number;
  harga_satuan: number;
  diskon_persen: number;
  subtotal: number;
  barang?: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
    stok: number;
  };
  // Khusus manajer (diisi dari v_item_pesanan_jual_manajer)
  hpp_satuan?: number | null;
  margin?: number | null;
}

export interface BarangOption {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  harga_jual: number;
  stok: number;
}

export interface PelangganOption {
  id: string;
  kode: string;
  nama_toko: string;
  alamat: string;
  termin_hari: number;
  batas_kredit: number;
}

export type StatusPersetujuan =
  | 'menunggu'
  | 'disetujui'
  | 'ditolak'
  | 'terpakai'
  | 'dibatalkan'
  | 'kedaluwarsa';

export interface PersetujuanHargaRow {
  id: string;
  pesanan_jual_id: string;
  nomor_pesanan: string;
  status: StatusPersetujuan;
  diajukan_oleh?: string;
  nama_pengaju?: string | null;
  diajukan_pada: string;
  catatan_pengaju?: string | null;
  keputusan_oleh?: string | null;
  nama_pemutus?: string | null;
  keputusan_pada?: string | null;
  catatan_keputusan?: string | null;
  alasan_tolak?: string | null;
  berlaku_sampai?: string | null;
  dipakai_pada?: string | null;
  nama_toko?: string | null;
  total_pesanan?: number | null;
}
