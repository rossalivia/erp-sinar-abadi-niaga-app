import { describe, it, expect } from 'vitest';
import { escapeCsvCell, buildSafeCsv, formatTanggalWib } from '../utils';

describe('Analitik Utils & CSV Sanitization (TC-145)', () => {
  it('harus mencegah spreadsheet formula injection pada karakter berbahaya', () => {
    expect(escapeCsvCell('=1+1')).toBe(`"'=1+1"`);
    expect(escapeCsvCell('+SUM(A1:A10)')).toBe(`"'+SUM(A1:A10)"`);
    expect(escapeCsvCell('-2000')).toBe(`"'-2000"`);
    expect(escapeCsvCell('@cmd|')).toBe(`"'@cmd|"`);
    expect(escapeCsvCell('\tmalicious')).toBe(`"'\tmalicious"`);
    expect(escapeCsvCell('\rmalicious')).toBe(`"'\rmalicious"`);
  });

  it('harus meng-escape tanda kutip ganda secara tepat', () => {
    expect(escapeCsvCell('Toko "Berkah"')).toBe(`"Toko ""Berkah"""`);
  });

  it('harus menangani nilai null dan undefined dengan aman', () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it('harus membuat berkas CSV lengkap berawalan UTF-8 BOM', () => {
    const headers = ['Nama Toko', 'Total Omzet'];
    const rows = [
      ['Toko Berkah', 500000],
      ['=SUM(A1:A2)', 200000],
    ];

    const csv = buildSafeCsv(headers, rows);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain(`"Toko Berkah","500000"`);
    expect(csv).toContain(`"'=SUM(A1:A2)","200000"`);
  });

  it('harus memformat tanggal WIB dengan benar atau mengembalikan dash jika null', () => {
    expect(formatTanggalWib(null)).toBe('-');
    expect(formatTanggalWib('')).toBe('-');
    expect(formatTanggalWib('invalid-date')).toBe('-');
    const formatted = formatTanggalWib('2026-10-23T10:00:00Z');
    expect(formatted).toContain('2026');
  });
});
