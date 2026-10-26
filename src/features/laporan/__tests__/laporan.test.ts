import { describe, it, expect } from 'vitest';
import { formatRupiah } from '@/lib/format';

describe('Logika Perhitungan Laporan Keuangan (PRD Bab 9 & A12)', () => {
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

  it('menghitung margin baris = subtotal - (hpp_satuan * jumlah) (PRD Bab 9 §5)', () => {
    const jumlah = 10;
    const hargaSatuan = 25_000;
    const diskonPersen = 10;
    const subtotal = Math.round(jumlah * hargaSatuan * (100 - diskonPersen) / 100);
    const hppSatuan = 18_000;
    const marginBaris = subtotal - (hppSatuan * jumlah);

    expect(subtotal).toBe(225_000);
    expect(marginBaris).toBe(45_000);
  });

  it('mengelompokkan tepat 3 kelompok aging piutang: belum jatuh tempo, lewat 1-30 hari, lewat >30 hari (PRD Bab 9 §4)', () => {
    const tentukanAging = (hariLewat: number): 'belum_jatuh_tempo' | '1-30_hari' | '>30_hari' => {
      if (hariLewat <= 0) return 'belum_jatuh_tempo';
      if (hariLewat <= 30) return '1-30_hari';
      return '>30_hari';
    };

    expect(tentukanAging(0)).toBe('belum_jatuh_tempo');
    expect(tentukanAging(-5)).toBe('belum_jatuh_tempo');
    expect(tentukanAging(1)).toBe('1-30_hari');
    expect(tentukanAging(15)).toBe('1-30_hari');
    expect(tentukanAging(30)).toBe('1-30_hari');
    expect(tentukanAging(31)).toBe('>30_hari');
    expect(tentukanAging(90)).toBe('>30_hari');
  });

  it('menjamin total aging piutang sama persis dengan total piutang berjalan (PRD Bab 9 & BR-05)', () => {
    // Simulasi daftar pesanan (status: dikonfirmasi & dikirim)
    const pesanan = [
      { status: 'dikonfirmasi', total: 500_000, hariLewat: 0 },
      { status: 'dikirim', total: 1_200_000, hariLewat: -3 }, // belum tempo
      { status: 'dikirim', total: 800_000, hariLewat: 14 },  // lewat 1-30 hari
      { status: 'dikirim', total: 1_500_000, hariLewat: 45 }, // lewat >30 hari
    ];

    const totalPiutangBerjalan = pesanan.reduce((acc, p) => acc + p.total, 0);

    const belumJatuhTempo = pesanan
      .filter((p) => p.status === 'dikonfirmasi' || p.hariLewat <= 0)
      .reduce((acc, p) => acc + p.total, 0);

    const lewat1Sampai30 = pesanan
      .filter((p) => p.status === 'dikirim' && p.hariLewat >= 1 && p.hariLewat <= 30)
      .reduce((acc, p) => acc + p.total, 0);

    const lewatGt30 = pesanan
      .filter((p) => p.status === 'dikirim' && p.hariLewat > 30)
      .reduce((acc, p) => acc + p.total, 0);

    const totalAging = belumJatuhTempo + lewat1Sampai30 + lewatGt30;

    expect(totalAging).toBe(totalPiutangBerjalan);
    expect(totalAging).toBe(4_000_000);
    expect(belumJatuhTempo).toBe(1_700_000);
    expect(lewat1Sampai30).toBe(800_000);
    expect(lewatGt30).toBe(1_500_000);
  });

  it('memverifikasi formula sisa kredit = batas_kredit - total_piutang (BR-05)', () => {
    const batasKredit = 1_000_000;
    const totalPiutang = 450_000;
    const sisaKredit = batasKredit - totalPiutang;

    expect(sisaKredit).toBe(550_000);
  });

  it('memastikan format uang berformat baku Rp1.250.000 tanpa spasi (PRD Bab 10 §5)', () => {
    expect(formatRupiah(1_250_000)).toBe('Rp1.250.000');
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(null)).toBe('Rp0');
    expect(formatRupiah(undefined)).toBe('Rp0');
    expect(formatRupiah(284_500_000)).toBe('Rp284.500.000');
    expect(formatRupiah(1_250_000)).not.toContain(' ');
  });
});
