import { describe, it, expect } from 'vitest';
import type { AnalisisKredit } from '../types';

describe('Pemantauan dan Rekomendasi Kredit — Kontrak Tipe & Integritas', () => {
  it('TC-196 (Frontend): Memetakan struktur AnalisisKredit sesuai Skenario 2 (Hitung Tangan)', () => {
    const skenario2: AnalisisKredit = {
      pelanggan_id: '11111111-2222-3333-4444-555555555555',
      data_cukup: true,
      alasan_data_kurang: null,
      faktur_lunas: 6,
      tepat_waktu: 4,
      persen_tepat_waktu: 66.67,
      rata_hari_terlambat: 1.00,
      faktur_overdue_sekarang: 0,
      hari_overdue_terlama: 0,
      lama_pelanggan_hari: 101,
      faktur_lunas_terbesar: 2500000,
      rata_nilai_pesanan: 2166667,
      rata_belanja_per_30_hari: 4000000,
      piutang_berjalan: 0,
      pemakaian_limit_persen: 0.00,
      skor_tepat_waktu: 33.33,
      skor_keterlambatan: 18.57,
      skor_kondisi_sekarang: 20.00,
      skor_kedalaman: 6.00,
      skor_total: 78,
      kelas: 'B',
      kebutuhan_limit: 2833333,
      rekomendasi_limit: 2800000,
      selisih_limit: 800000,
      pembatas_mengikat: 'Kebutuhan Riwayat Belanja',
      status_rekomendasi: 'Naikkan',
      hari_sejak_tinjau_limit: 45,
      status_tinjau: 'normal',
    };

    expect(skenario2.skor_total).toBe(78);
    expect(skenario2.kelas).toBe('B');
    expect(skenario2.rekomendasi_limit).toBe(2800000);
    expect(skenario2.pembatas_mengikat).toBe('Kebutuhan Riwayat Belanja');
    expect(skenario2.status_rekomendasi).toBe('Naikkan');
  });

  it('TC-193 (Frontend): Memetakan pelanggan dengan data belum cukup', () => {
    const skenario1: AnalisisKredit = {
      pelanggan_id: '22222222-3333-4444-5555-666666666666',
      data_cukup: false,
      alasan_data_kurang: 'Minimal 3 faktur lunas dan 28 hari riwayat belanja',
      faktur_lunas: 2,
      tepat_waktu: 2,
      persen_tepat_waktu: 100.00,
      rata_hari_terlambat: 0.00,
      faktur_overdue_sekarang: 0,
      hari_overdue_terlama: 0,
      lama_pelanggan_hari: 14,
      faktur_lunas_terbesar: 700000,
      rata_nilai_pesanan: 600000,
      rata_belanja_per_30_hari: 1200000,
      piutang_berjalan: 0,
      pemakaian_limit_persen: 0.00,
      skor_tepat_waktu: null,
      skor_keterlambatan: null,
      skor_kondisi_sekarang: null,
      skor_kedalaman: null,
      skor_total: null,
      kelas: 'Data belum cukup',
      kebutuhan_limit: null,
      rekomendasi_limit: null,
      selisih_limit: null,
      pembatas_mengikat: null,
      status_rekomendasi: null,
      hari_sejak_tinjau_limit: 14,
      status_tinjau: 'normal',
    };

    expect(skenario1.data_cukup).toBe(false);
    expect(skenario1.skor_total).toBeNull();
    expect(skenario1.rekomendasi_limit).toBeNull();
    expect(skenario1.kelas).toBe('Data belum cukup');
  });

  it('TC-198 (Frontend): Memetakan pelanggan Kelas D dengan override overdue > 30 hari', () => {
    const skenario3: AnalisisKredit = {
      pelanggan_id: '33333333-4444-5555-6666-777777777777',
      data_cukup: true,
      alasan_data_kurang: null,
      faktur_lunas: 5,
      tepat_waktu: 0,
      persen_tepat_waktu: 0.00,
      rata_hari_terlambat: 10.00,
      faktur_overdue_sekarang: 1,
      hari_overdue_terlama: 35,
      lama_pelanggan_hari: 265,
      faktur_lunas_terbesar: 3000000,
      rata_nilai_pesanan: 1400000,
      rata_belanja_per_30_hari: 2000000,
      piutang_berjalan: 1500000,
      pemakaian_limit_persen: 30.00,
      skor_tepat_waktu: 0.00,
      skor_keterlambatan: 5.71,
      skor_kondisi_sekarang: 0.00,
      skor_kedalaman: 5.00,
      skor_total: 11,
      kelas: 'D',
      kebutuhan_limit: 0,
      rekomendasi_limit: 5000000,
      selisih_limit: 0,
      pembatas_mengikat: 'Kebijakan Kelas D (Tidak Ada Kenaikan)',
      status_rekomendasi: 'Tinjau penurunan',
      hari_sejak_tinjau_limit: 265,
      status_tinjau: 'terlambat',
    };

    expect(skenario3.kelas).toBe('D');
    expect(skenario3.status_rekomendasi).toBe('Tinjau penurunan');
    expect(skenario3.pembatas_mengikat).toBe('Kebijakan Kelas D (Tidak Ada Kenaikan)');
    expect(skenario3.status_tinjau).toBe('terlambat');
  });
});
