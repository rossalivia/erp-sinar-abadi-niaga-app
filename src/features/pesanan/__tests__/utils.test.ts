import { describe, it, expect } from 'vitest';
import { hitungSubtotal, hitungTotalPesanan } from '../utils';

describe('hitungSubtotal (BR-03)', () => {
  it('menghitung kasus pembulatan 3 x 1.999 dengan diskon 7,5%', () => {
    // 3 * 1999 = 5997
    // 5997 * (100 - 7.5) / 100 = 5997 * 92.5 / 100 = 5547.225
    // round(5547.225) = 5547
    const hasil = hitungSubtotal(3, 1999, 7.5);
    expect(hasil).toBe(5547);
  });

  it('menghitung pembulatan half-away-from-zero tepat di .5', () => {
    // 1 * 105 dengan diskon 10% = 94.5 -> dibulatkan ke 95
    expect(hitungSubtotal(1, 105, 10)).toBe(95);

    // 1 * 15 dengan diskon 10% = 13.5 -> dibulatkan ke 14
    expect(hitungSubtotal(1, 15, 10)).toBe(14);
  });

  it('menghitung diskon batas 0% (tanpa diskon)', () => {
    // 5 * 25.000 diskon 0% = 125.000
    expect(hitungSubtotal(5, 25000, 0)).toBe(125000);
  });

  it('menghitung diskon batas 10% (maksimum Staf Penjualan)', () => {
    // 10 * 100.000 diskon 10% = 900.000
    expect(hitungSubtotal(10, 100000, 10)).toBe(900000);

    // 7 * 13.500 diskon 10% = 7 * 13500 * 0.9 = 85.050
    expect(hitungSubtotal(7, 13500, 10)).toBe(85050);
  });

  it('menghitung diskon batas 25% (maksimum Manajer)', () => {
    // 4 * 50.000 diskon 25% = 150.000
    expect(hitungSubtotal(4, 50000, 25)).toBe(150000);

    // 3 * 15.250 diskon 25% = 45.750 * 0.75 = 34312.5 -> dibulatkan ke 34313
    expect(hitungSubtotal(3, 15250, 25)).toBe(34313);
  });

  it('menghitung kasus jumlah besar', () => {
    // 10.000 * 5.000.000 diskon 15%
    // 50.000.000.000 * 0.85 = 42.500.000.000
    expect(hitungSubtotal(10000, 5000000, 15)).toBe(42500000000);
  });

  it('menangani input tidak valid atau 0', () => {
    expect(hitungSubtotal(0, 10000, 0)).toBe(0);
    expect(hitungSubtotal(5, 0, 0)).toBe(0);
    expect(hitungSubtotal(-1, 10000, 0)).toBe(0);
  });

  it('menghitung total pesanan dari beberapa baris', () => {
    const items = [
      { jumlah: 3, harga_satuan: 1999, diskon_persen: 7.5 }, // 5547
      { jumlah: 5, harga_satuan: 25000, diskon_persen: 0 },  // 125000
      { jumlah: 4, harga_satuan: 50000, diskon_persen: 25 }, // 150000
    ];
    // 5547 + 125000 + 150000 = 280547
    expect(hitungTotalPesanan(items)).toBe(280547);
  });
});
