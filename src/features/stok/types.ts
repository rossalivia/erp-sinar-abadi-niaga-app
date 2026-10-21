export type JenisMutasiStok = 'masuk' | 'keluar' | 'batal' | 'penyesuaian';

export interface MutasiStokItem {
  id: number;
  barang_id: string;
  jenis: JenisMutasiStok;
  jumlah: number; // delta bertanda
  stok_sesudah: number;
  nomor_dokumen: string | null;
  alasan: string | null;
  dibuat_oleh: string;
  dibuat_pada: string;
  pelaku?: {
    nama_lengkap: string;
  } | null;
}

export interface BarangStokItem {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  stok_menipis: boolean;
  diperbarui_pada: string;
}
