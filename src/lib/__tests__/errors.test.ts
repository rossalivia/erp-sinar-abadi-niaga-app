import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../errors';

describe('Error Mapping & Katalog Pesan', () => {
  it('memetakan kode error E0001 sampai E0030 ke Bahasa Indonesia', () => {
    expect(getErrorMessage({ code: 'E0001' })).toBe('Akses ditolak');
    expect(getErrorMessage({ code: 'E0012' })).toBe('Batas kredit pelanggan terlampaui');
    expect(getErrorMessage({ code: 'E0013' })).toBe('Pelanggan memiliki tagihan lewat jatuh tempo');
  });

  it('mempertahankan pesan BR-04 secara PERSIS', () => {
    // BR-04 spesifikasi: "Harga di bawah batas, minta persetujuan Manajer"
    expect(getErrorMessage({ code: 'E0011' })).toBe(
      'Harga di bawah batas, minta persetujuan Manajer'
    );
    expect(
      getErrorMessage({
        message: 'Harga di bawah batas, minta persetujuan Manajer',
      })
    ).toBe('Harga di bawah batas, minta persetujuan Manajer');
  });

  it('menggunakan message dinamis dari RAISE EXCEPTION bila tersedia', () => {
    const errorWithCustomMsg = {
      code: 'E0014',
      message: 'Stok tidak cukup untuk barang BRG-001',
    };
    expect(getErrorMessage(errorWithCustomMsg)).toBe(
      'Stok tidak cukup untuk barang BRG-001'
    );
  });

  it('menangani string polos atau error bawaan auth', () => {
    expect(getErrorMessage('Pesan string langsung')).toBe('Pesan string langsung');
    expect(getErrorMessage({ message: 'Invalid login credentials' })).toBe(
      'Email atau kata sandi salah'
    );
  });
});
