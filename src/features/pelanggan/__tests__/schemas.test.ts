import { describe, it, expect } from 'vitest';
import {
  pelangganCreateSchema,
  pelangganUpdateSchema,
  batasKreditSchema,
  terminSchema,
} from '../schemas';

describe('Pelanggan Schemas Validation', () => {
  describe('pelangganCreateSchema', () => {
    it('menerima payload pelanggan baru yang valid', () => {
      const valid = {
        kode: 'PLG-001',
        nama_toko: 'Toko Berkah Bersama',
        telepon: '08123456789',
        alamat: 'Jl. Merdeka No. 10',
        termin_hari: 14,
        batas_kredit: 5000000,
      };
      const res = pelangganCreateSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('menolak kode pelanggan yang terlalu pendek atau berkarakter ilegal', () => {
      const invalidKode = {
        kode: 'P',
        nama_toko: 'Toko Berkah',
        termin_hari: 0,
        batas_kredit: 0,
      };
      expect(pelangganCreateSchema.safeParse(invalidKode).success).toBe(false);

      const invalidChar = {
        kode: 'PLG 001@',
        nama_toko: 'Toko Berkah',
        termin_hari: 0,
        batas_kredit: 0,
      };
      expect(pelangganCreateSchema.safeParse(invalidChar).success).toBe(false);
    });

    it('hanya menerima termin_hari 0, 7, 14, 30', () => {
      const invalidTermin = {
        kode: 'PLG-002',
        nama_toko: 'Toko Rejeki',
        termin_hari: 10, // tidak valid
        batas_kredit: 0,
      };
      const res = pelangganCreateSchema.safeParse(invalidTermin);
      expect(res.success).toBe(false);
    });

    it('menolak batas kredit negatif', () => {
      const negatif = {
        kode: 'PLG-003',
        nama_toko: 'Toko Sejahtera',
        termin_hari: 0,
        batas_kredit: -50000,
      };
      expect(pelangganCreateSchema.safeParse(negatif).success).toBe(false);
    });
  });

  describe('pelangganUpdateSchema', () => {
    it('memvalidasi perubahan data dasar toko', () => {
      const valid = {
        nama_toko: 'Toko Rejeki Baru',
        telepon: '08129999888',
        alamat: 'Jl. Ahmad Yani No. 5',
        aktif: true,
      };
      expect(pelangganUpdateSchema.safeParse(valid).success).toBe(true);
    });

    it('menolak nama toko kosong atau kurang dari 2 karakter', () => {
      expect(
        pelangganUpdateSchema.safeParse({ nama_toko: 'A', aktif: true }).success
      ).toBe(false);
    });
  });

  describe('batasKreditSchema & terminSchema', () => {
    it('memvalidasi batas kredit >= 0', () => {
      expect(batasKreditSchema.safeParse({ batas_kredit: 10000000 }).success).toBe(true);
      expect(batasKreditSchema.safeParse({ batas_kredit: 0 }).success).toBe(true);
      expect(batasKreditSchema.safeParse({ batas_kredit: -1 }).success).toBe(false);
    });

    it('memvalidasi termin hari khusus pilihan baku', () => {
      expect(terminSchema.safeParse({ termin_hari: 0 }).success).toBe(true);
      expect(terminSchema.safeParse({ termin_hari: 7 }).success).toBe(true);
      expect(terminSchema.safeParse({ termin_hari: 14 }).success).toBe(true);
      expect(terminSchema.safeParse({ termin_hari: 30 }).success).toBe(true);
      expect(terminSchema.safeParse({ termin_hari: 45 }).success).toBe(false);
    });
  });
});
