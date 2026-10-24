export type KelasKredit = 'A' | 'B' | 'C' | 'D' | 'Data belum cukup';

export type StatusRekomendasi = 'Naikkan' | 'Pertahankan' | 'Tinjau penurunan';

export type StatusTinjau = 'normal' | 'perlu_tinjau' | 'terlambat';

export interface AnalisisKredit {
  pelanggan_id: string;
  data_cukup: boolean;
  alasan_data_kurang: string | null;
  faktur_lunas: number;
  tepat_waktu: number;
  persen_tepat_waktu: number;
  rata_hari_terlambat: number;
  faktur_overdue_sekarang: number;
  hari_overdue_terlama: number;
  lama_pelanggan_hari: number;
  faktur_lunas_terbesar: number;
  rata_nilai_pesanan: number;
  rata_belanja_per_30_hari: number;
  piutang_berjalan: number;
  pemakaian_limit_persen: number;
  skor_tepat_waktu: number | null;
  skor_keterlambatan: number | null;
  skor_kondisi_sekarang: number | null;
  skor_kedalaman: number | null;
  skor_total: number | null;
  kelas: KelasKredit;
  kebutuhan_limit: number | null;
  rekomendasi_limit: number | null;
  selisih_limit: number | null;
  pembatas_mengikat: string | null;
  status_rekomendasi: StatusRekomendasi | null;
  hari_sejak_tinjau_limit: number;
  status_tinjau: StatusTinjau;
}

export interface ItemPemantauanKredit {
  pelanggan_id: string;
  kode: string;
  nama_toko: string;
  batas_kredit: number;
  piutang_berjalan: number;
  pemakaian_limit_persen: number;
  hari_overdue_terlama: number;
  faktur_overdue_sekarang: number;
  kelas: KelasKredit;
  skor_total: number | null;
  rekomendasi_limit: number | null;
  selisih_limit: number | null;
  pembatas_mengikat: string | null;
  status_rekomendasi: StatusRekomendasi | null;
  hari_sejak_tinjau_limit: number;
  status_tinjau: StatusTinjau;
  data_cukup: boolean;
}

export interface SimulasiLimitHasil {
  limit_sekarang: number;
  limit_hipotetik: number;
  piutang_berjalan: number;
  pemakaian_persen_sekarang: number;
  pemakaian_persen_hipotetik: number;
  kebutuhan_rekomendasi: number | null;
  rekomendasi_resmi: number | null;
  selisih_terhadap_rekomendasi: number;
  total_limit_semua_sebelum: number;
  total_limit_semua_sesudah: number;
}

export interface PeringatanEditor {
  jenis: 'mendekati_limit' | 'kebiasaan_belanja';
  level: 'warning' | 'info';
  pesan: string;
}

export interface RingkasanEksekutifKredit {
  distribusiKelas: {
    A: number;
    B: number;
    C: number;
    D: number;
    belumCukup: number;
  };
  totalPlafonLimit: number;
  totalPiutangBerjalan: number;
  rasioUtilisasiPortofolio: number;
  totalPerluTinjau: number;
}
