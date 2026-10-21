import { describe, it, expect } from 'vitest';
import {
  setPeranSchema,
  ubahProfilSchema,
  gantiPasswordSchema,
} from '../schemas';

describe('Akun & Profil Schemas Validation', () => {
  describe('setPeranSchema', () => {
    it('menerima peran valid (penjualan, gudang, manajer)', () => {
      expect(setPeranSchema.safeParse({ peran: 'penjualan', aktif: true }).success).toBe(true);
      expect(setPeranSchema.safeParse({ peran: 'gudang', aktif: true }).success).toBe(true);
      expect(setPeranSchema.safeParse({ peran: 'manajer', aktif: false }).success).toBe(true);
    });

    it('menolak peran tidak valid', () => {
      expect(setPeranSchema.safeParse({ peran: 'admin', aktif: true }).success).toBe(false);
      expect(setPeranSchema.safeParse({ peran: 'owner', aktif: true }).success).toBe(false);
    });
  });

  describe('ubahProfilSchema', () => {
    it('memvalidasi nama lengkap minimal 3 karakter', () => {
      expect(ubahProfilSchema.safeParse({ nama_lengkap: 'Budi Santoso' }).success).toBe(true);
      expect(ubahProfilSchema.safeParse({ nama_lengkap: 'Al' }).success).toBe(false);
      expect(ubahProfilSchema.safeParse({ nama_lengkap: '   ' }).success).toBe(false);
    });
  });

  describe('gantiPasswordSchema', () => {
    it('menerima kata sandi baru yang cocok dan memenuhi panjang minimal', () => {
      const valid = {
        password_baru: 'Rahasia123',
        konfirmasi_password: 'Rahasia123',
      };
      expect(gantiPasswordSchema.safeParse(valid).success).toBe(true);
    });

    it('menolak kata sandi yang kurang dari 6 karakter', () => {
      const pendek = {
        password_baru: '12345',
        konfirmasi_password: '12345',
      };
      expect(gantiPasswordSchema.safeParse(pendek).success).toBe(false);
    });

    it('menolak jika konfirmasi kata sandi tidak cocok', () => {
      const beda = {
        password_baru: 'Rahasia123',
        konfirmasi_password: 'RahasiaBeda',
      };
      const res = gantiPasswordSchema.safeParse(beda);
      expect(res.success).toBe(false);
    });
  });
});
