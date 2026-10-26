import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../errors';

describe('Error Mapping & Katalog Pesan', () => {
  it('memetakan kode error E0001 sampai E0038 ke Bahasa Indonesia', () => {
    expect(getErrorMessage({ code: 'E0001' })).toBe('Akses ditolak');
    expect(getErrorMessage({ code: 'E0012' })).toBe('Batas kredit pelanggan terlampaui');
    expect(getErrorMessage({ code: 'E0013' })).toBe('Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir');
    expect(getErrorMessage({ code: 'E0037' })).toBe('Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter');
    expect(getErrorMessage({ code: 'E0038' })).toBe('Stok sistem telah berubah sejak sesi dibuat. Batalkan sesi lalu hitung ulang.');
    expect(getErrorMessage({ code: 'E0078' })).toBe('Hanya Manajer yang berwenang mencatat pelunasan');
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
