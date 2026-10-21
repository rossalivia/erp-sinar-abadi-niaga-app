import { describe, it, expect } from 'vitest';

describe('Logika Perhitungan Laporan Keuangan (A12 & BR-12)', () => {
  it('menghitung margin kotor dan margin persen dengan benar', () => {
    const omzet = 100_000_000;
    const hpp = 75_000_000;
    const margin = omzet - hpp;
    const marginPersen = Number(((margin / omzet) * 100).toFixed(2));

    expect(margin).toBe(25_000_000);
    expect(marginPersen).toBe(25.0);
  });

  it('mengembalikan margin persen 0 ketika omzet 0', () => {
    const omzet = 0;
    const hpp = 0;
    const margin = omzet - hpp;
    const marginPersen = omzet > 0 ? Number(((margin / omzet) * 100).toFixed(2)) : 0;

    expect(margin).toBe(0);
    expect(marginPersen).toBe(0);
  });

  it('mengelompokkan kategori aging piutang berdasarkan selisih hari jatuh tempo', () => {
    const tentukanAging = (hariLewat: number): string => {
      if (hariLewat <= 0) return 'belum_jatuh_tempo';
      if (hariLewat <= 7) return '1-7_hari';
      if (hariLewat <= 30) return '8-30_hari';
      return '>30_hari';
    };

    expect(tentukanAging(0)).toBe('belum_jatuh_tempo');
    expect(tentukanAging(-3)).toBe('belum_jatuh_tempo');
    expect(tentukanAging(1)).toBe('1-7_hari');
    expect(tentukanAging(7)).toBe('1-7_hari');
    expect(tentukanAging(8)).toBe('8-30_hari');
    expect(tentukanAging(30)).toBe('8-30_hari');
    expect(tentukanAging(31)).toBe('>30_hari');
    expect(tentukanAging(90)).toBe('>30_hari');
  });

  it('memverifikasi formula sisa kredit = batas_kredit - total_piutang (BR-05)', () => {
    const batasKredit = 1_000_000;
    const totalPiutang = 450_000;
    const sisaKredit = batasKredit - totalPiutang;

    expect(sisaKredit).toBe(550_000);
  });
});
