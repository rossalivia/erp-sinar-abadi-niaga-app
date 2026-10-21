import { describe, it, expect } from 'vitest';
import { formatRupiah, formatTanggal, formatTanggalWaktu } from '../format';

describe('Format Rupiah', () => {
  it('memformat angka normal menjadi Rupiah tanpa spasi', () => {
    expect(formatRupiah(1250000)).toBe('Rp1.250.000');
    expect(formatRupiah(50000)).toBe('Rp50.000');
    expect(formatRupiah(0)).toBe('Rp0');
  });

  it('menangani input null, undefined, atau NaN dengan mengembalikan Rp0', () => {
    expect(formatRupiah(null)).toBe('Rp0');
    expect(formatRupiah(undefined)).toBe('Rp0');
    expect(formatRupiah(NaN)).toBe('Rp0');
  });

  it('memformat nilai desimal dibulatkan sesuai tanpa sen', () => {
    expect(formatRupiah(1250000.75)).toBe('Rp1.250.001');
    expect(formatRupiah(1250000.25)).toBe('Rp1.250.000');
  });
});

describe('Format Tanggal & Waktu', () => {
  it('memformat tanggal Indonesia dengan zona waktu Asia/Jakarta', () => {
    const isoString = '2026-10-21T07:00:00Z'; // 14:00 WIB
    const formatted = formatTanggal(isoString);
    expect(formatted).toBe('21 Oktober 2026');
  });

  it('memformat tanggal dan waktu Indonesia', () => {
    const isoString = '2026-10-21T07:30:00Z'; // 14:30 WIB
    const formatted = formatTanggalWaktu(isoString);
    expect(formatted).toContain('21 Oktober 2026');
    expect(formatted).toContain('14.30');
  });

  it('mengembalikan tanda hubung untuk input tanggal kosong atau invalid', () => {
    expect(formatTanggal(null)).toBe('-');
    expect(formatTanggal(undefined)).toBe('-');
    expect(formatTanggal('invalid-date')).toBe('-');
    expect(formatTanggalWaktu(null)).toBe('-');
    expect(formatTanggalWaktu('invalid-date')).toBe('-');
  });
});
