import { describe, it, expect } from 'vitest';
import {
  barangCreateSchema,
  barangUpdateGudangSchema,
  barangUpdateHargaJualSchema,
  barangUpdateHargaPokokSchema,
} from '../schemas';

describe('Barang Schemas Validation', () => {
  describe('barangCreateSchema', () => {
    it('menerima data barang baru lengkap dan valid', () => {
      const valid = {
        kode: 'BRG-101',
        nama: 'Kecap Manis 600ml',
        satuan: 'Botol',
        harga_jual: 22000,
        stok_minimum: 10,
        harga_pokok: 18000,
      };
      expect(barangCreateSchema.safeParse(valid).success).toBe(true);
    });

    it('mengizinkan harga_pokok kosong/opsional saat barang baru dibuat', () => {
      const tanpaHpp = {
        kode: 'BRG-102',
        nama: 'Saus Tomat 500g',
        satuan: 'Pcs',
        harga_jual: 15000,
        stok_minimum: 5,
      };
      expect(barangCreateSchema.safeParse(tanpaHpp).success).toBe(true);
    });

    it('menolak harga jual <= 0', () => {
      const nol = {
        kode: 'BRG-103',
        nama: 'Barang Gratis',
        satuan: 'Pcs',
        harga_jual: 0,
      };
      expect(barangCreateSchema.safeParse(nol).success).toBe(false);

      const negatif = {
        kode: 'BRG-104',
        nama: 'Barang Minus',
        satuan: 'Pcs',
        harga_jual: -500,
      };
      expect(barangCreateSchema.safeParse(negatif).success).toBe(false);
    });

    it('menolak stok minimum negatif', () => {
      const invalid = {
        kode: 'BRG-105',
        nama: 'Barang X',
        satuan: 'Pcs',
        harga_jual: 10000,
        stok_minimum: -2,
      };
      expect(barangCreateSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('barangUpdateGudangSchema', () => {
    it('memvalidasi kolom yang boleh diubah Gudang (nama, satuan, stok_minimum, aktif)', () => {
      const valid = {
        nama: 'Minyak Goreng Sawit 2L Reffil',
        satuan: 'Pcs',
        stok_minimum: 12,
        aktif: true,
      };
      expect(barangUpdateGudangSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe('barangUpdateHargaJualSchema & barangUpdateHargaPokokSchema', () => {
    it('memvalidasi harga jual harus > 0', () => {
      expect(barangUpdateHargaJualSchema.safeParse({ harga_jual: 25000 }).success).toBe(true);
      expect(barangUpdateHargaJualSchema.safeParse({ harga_jual: 0 }).success).toBe(false);
      expect(barangUpdateHargaJualSchema.safeParse({ harga_jual: -100 }).success).toBe(false);
    });

    it('memvalidasi harga pokok harus >= 0', () => {
      expect(barangUpdateHargaPokokSchema.safeParse({ harga_pokok: 20000 }).success).toBe(true);
      expect(barangUpdateHargaPokokSchema.safeParse({ harga_pokok: 0 }).success).toBe(true);
      expect(barangUpdateHargaPokokSchema.safeParse({ harga_pokok: -1 }).success).toBe(false);
    });
  });
});
