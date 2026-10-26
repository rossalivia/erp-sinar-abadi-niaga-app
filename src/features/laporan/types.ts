export interface LaporanMarginMingguanItem {
  minggu: string;
  omzet: number;
  hpp: number;
  margin: number;
  margin_persen: number;
}

export interface LaporanRingkasan {
  total_omzet: number;
  total_hpp: number;
  total_margin: number;
  margin_persen: number;
  jumlah_pesanan: number;
  pesanan_dikirim: number;
  pesanan_lunas: number;
}

export interface TopBarangItem {
  barang_id: string;
  kode: string;
  nama: string;
  satuan: string;
  jumlah_terjual: number;
  total_omzet: number;
  total_hpp: number;
  total_margin: number;
  margin_persen: number;
}

export interface TopPelangganItem {
  pelanggan_id: string;
  kode: string;
  nama_toko: string;
  jumlah_pesanan: number;
  total_omzet: number;
  total_margin: number;
}

export interface LaporanPiutangPelangganItem {
  pelanggan_id: string;
  kode: string;
  nama_toko: string;
  batas_kredit: number;
  termin_hari: number;
  total_piutang: number;
  piutang_belum_jatuh_tempo: number;
  piutang_lewat_1_30?: number;
  piutang_lewat_gt_30?: number;
  piutang_lewat_jatuh_tempo: number;
  ada_lewat_jatuh_tempo: boolean;
  sisa_kredit: number;
}

export interface LaporanAgingPiutang {
  total_piutang_berjalan: number;
  total_piutang_dikirim: number;
  belum_jatuh_tempo: number;
  lewat_1_30_hari: number;
  lewat_gt_30_hari: number;
  jumlah_pesanan_lewat_tempo: number;
  total_pesanan: number;
  total_pesanan_dikirim: number;
  total_pesanan_berjalan?: number;
  lewat_1_7_hari?: number;
  lewat_8_30_hari?: number;
}

export interface LaporanPiutangPesananItem {
  pesanan_id: string;
  nomor: string;
  pelanggan_id: string;
  nama_toko: string;
  telepon: string;
  total: number;
  dikirim_pada: string;
  jatuh_tempo: string;
  hari_lewat: number;
  kategori_aging: 'belum_jatuh_tempo' | '1-30_hari' | '>30_hari' | '1-7_hari' | '8-30_hari';
}

export type BottomBarangItem = TopBarangItem;

