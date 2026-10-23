/**
 * Tipe data fitur Pusat Tugas Harian & Daftar Ambil Barang.
 *
 * Kontrak JSONB mengikuti docs/fitur-pusat-tugas.md §4. Seluruh tipe di sini
 * sengaja tidak memuat kolom finansial/rahasia (harga, diskon, HPP, margin).
 */

export type ToneTugas = 'neutral' | 'info' | 'warning' | 'danger';

export interface TugasHarianPenjualan {
  peran: 'penjualan';
  draf_saya: number;
  menunggu_kirim_saya: number;
  persetujuan_harga_menunggu_saya: number;
  tagihan_tempo_hari_ini_saya: number;
  tagihan_overdue_saya: number;
}

export interface TugasHarianGudang {
  peran: 'gudang';
  pesanan_siap_kirim: number;
  umur_pesanan_tertua_hari: number;
  po_menunggu_penerimaan: number;
  stok_menipis: number;
  opname_draf: number;
}

export interface TugasHarianManajer {
  peran: 'manajer';
  persetujuan_harga_menunggu: number;
  po_menunggu_persetujuan: number;
  opname_menunggu_persetujuan: number;
  tagihan_overdue: number;
  tagihan_tempo_hari_ini: number;
  stok_menipis: number;
}

export type TugasHarianData =
  | TugasHarianPenjualan
  | TugasHarianGudang
  | TugasHarianManajer;

/** Satu kartu widget pada bagian "Tugas Hari Ini". */
export interface WidgetTugas {
  key: string;
  judul: string;
  nilai: number;
  keterangan: string;
  indikator: string;
  tone: ToneTugas;
  href: string;
  satuan?: string;
}

/** Baris pesanan dikonfirmasi pada Langkah 1 halaman picking list. */
export interface PesananTerkonfirmasi {
  id: string;
  nomor: string;
  pelanggan_kode: string;
  pelanggan_nama: string;
  dikonfirmasi_pada: string | null;
  umur_hari: number;
  total_item: number;
}

export interface PickingMetadata {
  total_pesanan: number;
  total_item_barang: number;
  total_kuantitas: number;
  dibuat_pada: string;
  dibuat_oleh_nama: string;
  dibuat_oleh_peran: 'gudang' | 'manajer';
}

export interface PickingRingkasanBarang {
  barang_id: string;
  kode_barang: string;
  nama_barang: string;
  satuan: string;
  total_diambil: number;
  stok_saat_ini: number;
  stok_cukup: boolean;
}

export interface PickingItem {
  barang_id: string;
  kode_barang: string;
  nama_barang: string;
  satuan: string;
  jumlah: number;
}

export interface PickingRincianPesanan {
  pesanan_id: string;
  nomor: string;
  dikonfirmasi_pada: string | null;
  pelanggan_kode: string;
  pelanggan_nama: string;
  items: PickingItem[];
}

export interface PickingListResult {
  metadata: PickingMetadata;
  ringkasan_barang: PickingRingkasanBarang[];
  rincian_pesanan: PickingRincianPesanan[];
}
