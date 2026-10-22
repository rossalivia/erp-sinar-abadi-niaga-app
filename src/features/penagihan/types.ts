// Types untuk modul Penagihan Piutang dan Monitoring Jatuh Tempo

export type KlasifikasiTagihan =
  | 'belum_jatuh_tempo'
  | 'segera'
  | 'hari_ini'
  | 'overdue_1_7'
  | 'overdue_8_30'
  | 'overdue_lebih_30';

export type StatusJanjiBayar = 'tidak_ada' | 'aktif' | 'terlewat';

export type JenisCatatanPenagihan =
  | 'pengingat_wa'
  | 'telepon'
  | 'kunjungan'
  | 'janji_bayar'
  | 'catatan';

export interface TagihanItem {
  pesanan_id: string;
  nomor_pesanan: string;
  pelanggan_id: string;
  kode_pelanggan: string;
  nama_toko: string;
  telepon: string | null;
  alamat: string | null;
  termin_hari: number;
  batas_kredit: number;
  total: number;
  dibuat_oleh: string;
  nama_sales: string;
  dibuat_pada: string;
  dikirim_pada: string | null;
  jatuh_tempo: string;
  hari_terlambat: number;
  hari_menuju: number;
  klasifikasi: KlasifikasiTagihan;
  janji_bayar_tanggal: string | null;
  janji_catatan: string | null;
  status_janji: StatusJanjiBayar;
}

export interface CatatanPenagihanItem {
  id: string;
  pelanggan_id: string;
  pesanan_jual_id: string | null;
  nomor_pesanan: string | null;
  jenis: JenisCatatanPenagihan;
  isi: string;
  janji_bayar_tanggal: string | null;
  status_janji: StatusJanjiBayar;
  dibuat_oleh: string;
  nama_pembuat: string;
  dibuat_pada: string;
}

export interface RingkasanPenagihan {
  totalTertagih: number;
  totalOverdue: number;
  jumlahHariIni: number;
  jumlahSegera: number;
  jumlahOverdue: number;
  totalFaktur: number;
}

export interface TemplatWaFaktur {
  nomor: string;
  total: number;
  jatuhTempo: string;
}

export interface TemplatWaParams {
  namaToko: string;
  fakturList: TemplatWaFaktur[];
  totalTertagih: number;
}
