export type StatusOpname = 'draf' | 'diajukan' | 'disetujui' | 'dibatalkan';

export interface OpnameStokHeader {
  id: string;
  nomor: string;
  status: StatusOpname;
  catatan: string | null;
  total_item: number;
  total_selisih_unit: number;
  dibuat_oleh: string;
  pembuat_nama?: string | null;
  dibuat_pada: string;
  diajukan_pada: string | null;
  disetujui_oleh: string | null;
  penyetuju_nama?: string | null;
  disetujui_pada: string | null;
  dibatalkan_oleh: string | null;
  pembatal_nama?: string | null;
  dibatalkan_pada: string | null;
  alasan_batal: string | null;
  estimasi_nilai_selisih?: number | null;
}

export interface ItemOpnameStok {
  id?: string;
  opname_stok_id?: string;
  barang_id: string;
  kode_barang?: string;
  nama_barang?: string;
  satuan?: string;
  stok_sistem: number;
  stok_fisik: number;
  selisih: number;
  keterangan: string | null;
  harga_pokok?: number | null;
}

export interface BarangKatalogOpname {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  harga_pokok?: number | null;
}
