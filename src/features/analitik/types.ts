export type TabAnalitik = 'sales' | 'pelanggan' | 'dormant' | 'deadstock';

export interface PerformaSalesItem {
  sales_id: string;
  nama_sales: string;
  email: string;
  aktif: boolean;
  jumlah_pesanan: number;
  pesanan_dikirim: number;
  pesanan_lunas: number;
  total_omzet: number;
  total_hpp: number;
  total_margin: number;
  margin_persen: number;
  piutang_berjalan: number;
  jumlah_draf: number;
}

export interface TopPelangganItem {
  pelanggan_id: string;
  kode: string;
  nama_toko: string;
  telepon: string;
  jumlah_pesanan: number;
  total_omzet: number;
  total_hpp: number;
  total_margin: number;
  margin_persen: number;
  kontribusi_omzet_persen: number;
  batas_kredit: number;
  sisa_kredit: number;
  status_kredit: 'lancar' | 'overdue' | 'overlimit' | string;
}

export interface PelangganTidakAktifItem {
  pelanggan_id: string;
  kode: string;
  nama_toko: string;
  telepon: string;
  alamat: string;
  terdaftar_pada: string;
  pesanan_terakhir_pada: string | null;
  nomor_pesanan_terakhir: string | null;
  hari_tidak_aktif: number;
  total_pesanan_historis: number;
  total_omzet_historis: number;
  piutang_berjalan: number;
}

export interface BarangTidakBergerakItem {
  barang_id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok_saat_ini: number;
  stok_minimum: number;
  harga_pokok: number;
  harga_jual: number;
  nilai_stok_mengendap: number;
  penjualan_terakhir_pada: string | null;
  nomor_pesanan_terakhir: string | null;
  hari_mengendap: number;
}
