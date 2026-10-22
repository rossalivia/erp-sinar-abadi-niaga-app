import { describe, it, expect } from 'vitest';
import {
  buatOpnameSchema,
  batalkanOpnameSchema,
  itemOpnameInputSchema,
} from '../schemas';

describe('Stock Opname Schemas', () => {
  const validUuid1 = '11111111-1111-4111-8111-111111111111';
  const validUuid2 = '22222222-2222-4222-8222-222222222222';

  describe('itemOpnameInputSchema', () => {
    it('menerima item dengan stok fisik >= 0', () => {
      const res = itemOpnameInputSchema.safeParse({
        barang_id: validUuid1,
        stok_fisik: 10,
        keterangan: 'Rak A',
      });
      expect(res.success).toBe(true);
    });

    it('menolak item dengan stok fisik negatif', () => {
      const res = itemOpnameInputSchema.safeParse({
        barang_id: validUuid1,
        stok_fisik: -1,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Stok fisik riil tidak boleh bernilai negatif');
      }
    });

    it('TC-49 (K3): menolak item berselisih jika keterangan kurang dari 10 karakter', () => {
      const res = itemOpnameInputSchema.safeParse({
        barang_id: validUuid1,
        stok_sistem: 10,
        stok_fisik: 15, // selisih +5
        keterangan: '123456789', // 9 karakter
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter');
      }
    });

    it('TC-49 (K3): menerima item berselisih jika keterangan minimal 10 karakter', () => {
      const res = itemOpnameInputSchema.safeParse({
        barang_id: validUuid1,
        stok_sistem: 10,
        stok_fisik: 15, // selisih +5
        keterangan: '1234567890', // 10 karakter
      });
      expect(res.success).toBe(true);
    });

    it('TC-49 (K3): menerima item tanpa selisih meski keterangan kosong', () => {
      const res = itemOpnameInputSchema.safeParse({
        barang_id: validUuid1,
        stok_sistem: 10,
        stok_fisik: 10, // selisih 0
        keterangan: '',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('buatOpnameSchema', () => {
    it('menerima sesi opname dengan minimal 1 item', () => {
      const res = buatOpnameSchema.safeParse({
        catatan: 'Audit Rutin',
        items: [
          { barang_id: validUuid1, stok_fisik: 25 },
          { barang_id: validUuid2, stok_fisik: 50 },
        ],
        langsung_ajukan: false,
      });
      expect(res.success).toBe(true);
    });

    it('menolak sesi opname tanpa item (kosong)', () => {
      const res = buatOpnameSchema.safeParse({
        catatan: 'Audit Kosong',
        items: [],
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Sesi opname harus berisi minimal 1 item barang');
      }
    });

    it('menolak barang duplikat dalam satu sesi opname', () => {
      const res = buatOpnameSchema.safeParse({
        items: [
          { barang_id: validUuid1, stok_fisik: 10 },
          { barang_id: validUuid1, stok_fisik: 12 },
        ],
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Barang tidak boleh duplikat');
      }
    });
  });

  describe('batalkanOpnameSchema', () => {
    it('menerima alasan minimal 10 karakter', () => {
      const res = batalkanOpnameSchema.safeParse({
        id: validUuid1,
        alasan: 'Kesalahan teknis penghitungan di rak',
      });
      expect(res.success).toBe(true);
    });

    it('menolak alasan kurang dari 10 karakter', () => {
      const res = batalkanOpnameSchema.safeParse({
        id: validUuid1,
        alasan: 'Batal',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Alasan minimal 10 karakter');
      }
    });
  });
});
