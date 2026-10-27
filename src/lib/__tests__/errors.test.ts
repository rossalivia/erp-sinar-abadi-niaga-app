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

  it('menerjemahkan error SQLSTATE Postgres standar dan pesan mentah database ke Bahasa Indonesia', () => {
    // Foreign key violation
    expect(
      getErrorMessage({
        code: '23503',
        message: 'insert or update on table "item_pesanan_jual" violates foreign key constraint "fk_barang"',
      })
    ).toBe('Data terkait tidak ditemukan atau sedang digunakan oleh transaksi lain');

    // Unique violation
    expect(
      getErrorMessage({
        code: '23505',
        message: 'duplicate key value violates unique constraint "uq_pelanggan_kode"',
      })
    ).toBe('Data sudah terdaftar atau kode telah digunakan');

    // Check constraint stok
    expect(
      getErrorMessage({
        code: '23514',
        message: 'new row for relation "barang" violates check constraint "barang_stok_check"',
      })
    ).toBe('Stok barang tidak mencukupi atau hasil penyesuaian tidak boleh negatif');

    // Check constraint umum
    expect(
      getErrorMessage({
        code: '23514',
        message: 'violates check constraint "custom_check"',
      })
    ).toBe('Nilai yang dimasukkan tidak memenuhi batasan validasi sistem');

    // Not null violation
    expect(
      getErrorMessage({
        code: '23502',
        message: 'null value in column "nama" violates not-null constraint',
      })
    ).toBe('Kolom wajib belum diisi dengan lengkap');

    // Permission denied
    expect(
      getErrorMessage({
        code: '42501',
        message: 'permission denied for table barang',
      })
    ).toBe('Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini');
  });

  it('memastikan kegagalan bisnis utama (stok, batas kredit, diskon) tampil dalam Bahasa Indonesia', () => {
    // Stok kurang
    expect(getErrorMessage({ code: 'E0014' })).toBe('Stok barang tidak mencukupi untuk memenuhi pesanan');
    expect(getErrorMessage({ message: 'Stok barang tidak mencukupi' })).toBe(
      'Stok barang tidak mencukupi'
    );

    // Batas kredit terlampaui
    expect(getErrorMessage({ code: 'E0012' })).toBe('Batas kredit pelanggan terlampaui');
    expect(getErrorMessage({ message: 'Batas kredit pelanggan terlampaui' })).toBe(
      'Batas kredit pelanggan terlampaui'
    );

    // Diskon melebihi batas
    expect(getErrorMessage({ code: 'E0009' })).toBe('Diskon harus 0% sampai 10%');
    expect(getErrorMessage({ code: 'E0010' })).toBe('Diskon harus 0% sampai 25%');
    expect(getErrorMessage({ message: 'Diskon harus 0% sampai 10%' })).toBe(
      'Diskon harus 0% sampai 10%'
    );
    expect(getErrorMessage({ message: 'Diskon harus 0% sampai 25%' })).toBe(
      'Diskon harus 0% sampai 25%'
    );
  });
});
