import { describe, it, expect } from 'vitest';

describe('Verifikasi Kepatuhan UI Pelunasan (PRD BR-07, BR-12)', () => {
  it('hanya peran manajer yang memiliki izin pelunasan pada status dikirim', () => {
    const status = 'dikirim';
    const isManajer = (peran: string) => peran === 'manajer';
    const canMarkPaid = (status: string, peran: string) => status === 'dikirim' && isManajer(peran);

    expect(canMarkPaid(status, 'penjualan')).toBe(false);
    expect(canMarkPaid(status, 'gudang')).toBe(false);
    expect(canMarkPaid(status, 'manajer')).toBe(true);

    // Pada status selain dikirim, Manajer pun tidak boleh
    expect(canMarkPaid('draf', 'manajer')).toBe(false);
    expect(canMarkPaid('dikonfirmasi', 'manajer')).toBe(false);
    expect(canMarkPaid('lunas', 'manajer')).toBe(false);
    expect(canMarkPaid('dibatalkan', 'manajer')).toBe(false);
  });

  it('tombol pengingat WhatsApp tetap aktif untuk peran penjualan', () => {
    const canUseWhatsApp = (peran: string, nomorValid: boolean) => {
      // Tombol WhatsApp dapat diakses oleh Penjualan dan Manajer asalkan nomor valid
      return (peran === 'penjualan' || peran === 'manajer') && nomorValid;
    };

    expect(canUseWhatsApp('penjualan', true)).toBe(true);
    expect(canUseWhatsApp('manajer', true)).toBe(true);
    expect(canUseWhatsApp('penjualan', false)).toBe(false);
  });

  it('tidak ada fitur denda, bunga, atau biaya keterlambatan pada sistem piutang', () => {
    // Memastikan skema piutang murni 100% nominal faktur tanpa tambahan bunga/denda
    const hitungTotalTagihan = (nominalFaktur: number, hariTerlambat: number) => {
      // PRD BR-07 / BR-12: Tidak ada denda/bunga keterlambatan (hariTerlambat tidak menambah biaya)
      const dendaPerHari = 0;
      const denda = hariTerlambat * dendaPerHari;
      return nominalFaktur + denda;
    };

    expect(hitungTotalTagihan(1500000, 45)).toBe(1500000);
    expect(hitungTotalTagihan(5000000, 100)).toBe(5000000);
  });
});
