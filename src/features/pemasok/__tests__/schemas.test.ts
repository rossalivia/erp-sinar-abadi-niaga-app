import { describe, it, expect } from 'vitest';
import { pemasokCreateSchema, pemasokUpdateSchema } from '../schemas';

describe('Pemasok Schemas Validation', () => {
  describe('pemasokCreateSchema', () => {
    it('menerima payload pemasok baru yang valid', () => {
      const valid = {
        kode: 'PMS-001',
        nama: 'PT Pangan Sumber Makmur',
        telepon: '021-88997766',
        alamat: 'Kawasan Industri MM2100 Blok C-2',
      };
      expect(pemasokCreateSchema.safeParse(valid).success).toBe(true);
    });

    it('menolak kode pemasok yang tidak valid', () => {
      expect(pemasokCreateSchema.safeParse({ kode: '', nama: 'PT ABC' }).success).toBe(false);
      expect(pemasokCreateSchema.safeParse({ kode: 'P', nama: 'PT ABC' }).success).toBe(false);
    });

    it('menolak nama pemasok kosong', () => {
      expect(pemasokCreateSchema.safeParse({ kode: 'PMS-002', nama: '' }).success).toBe(false);
    });
  });

  describe('pemasokUpdateSchema', () => {
    it('memvalidasi update informasi pemasok dan status aktif', () => {
      const valid = {
        nama: 'PT Pangan Sumber Makmur Perkasa',
        telepon: '021-88997700',
        alamat: 'Kawasan Industri MM2100 Blok C-2, Cikarang',
        aktif: true,
      };
      expect(pemasokUpdateSchema.safeParse(valid).success).toBe(true);
    });
  });
});
