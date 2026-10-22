import { describe, it, expect } from 'vitest';
import {
  ajukanPersetujuanSchema,
  putuskanPersetujuanSchema,
  batalkanPersetujuanSchema,
} from '../schemas';

describe('Persetujuan Harga Zod Schemas (TC-60 & Input Validation)', () => {
  describe('ajukanPersetujuanSchema', () => {
    it('memvalidasi ID pesanan UUID yang valid', () => {
      const res = ajukanPersetujuanSchema.safeParse({
        pesanan_id: '11111111-1111-1111-1111-111111111111',
        catatan_pengaju: 'Mohon persetujuan untuk tender',
      });
      expect(res.success).toBe(true);
    });

    it('menolak ID pesanan bukan UUID', () => {
      const res = ajukanPersetujuanSchema.safeParse({
        pesanan_id: 'invalid-id',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('putuskanPersetujuanSchema (TC-60)', () => {
    it('menerima keputusan setuju dengan catatan opsional', () => {
      const res = putuskanPersetujuanSchema.safeParse({
        persetujuan_id: '11111111-1111-1111-1111-111111111111',
        setuju: true,
        catatan_keputusan: 'Disetujui untuk promo toko',
      });
      expect(res.success).toBe(true);
    });

    it('menerima penolakan dengan alasan >= 10 karakter', () => {
      const res = putuskanPersetujuanSchema.safeParse({
        persetujuan_id: '11111111-1111-1111-1111-111111111111',
        setuju: false,
        alasan_tolak: 'Margin minus terlalu dalam',
      });
      expect(res.success).toBe(true);
    });

    it('menolak penolakan dengan alasan < 10 karakter setelah trim (TC-60: 9 vs 10 char)', () => {
      // 9 karakter
      const res9 = putuskanPersetujuanSchema.safeParse({
        persetujuan_id: '11111111-1111-1111-1111-111111111111',
        setuju: false,
        alasan_tolak: '  123456789  ', // trim length = 9
      });
      expect(res9.success).toBe(false);
      if (!res9.success) {
        expect(res9.error.issues[0].message).toContain('10 karakter');
      }

      // 10 karakter
      const res10 = putuskanPersetujuanSchema.safeParse({
        persetujuan_id: '11111111-1111-1111-1111-111111111111',
        setuju: false,
        alasan_tolak: '  1234567890  ', // trim length = 10
      });
      expect(res10.success).toBe(true);
    });

    it('menolak penolakan tanpa alasan_tolak', () => {
      const res = putuskanPersetujuanSchema.safeParse({
        persetujuan_id: '11111111-1111-1111-1111-111111111111',
        setuju: false,
      });
      expect(res.success).toBe(false);
    });
  });

  describe('batalkanPersetujuanSchema', () => {
    it('memvalidasi ID persetujuan UUID', () => {
      const res = batalkanPersetujuanSchema.safeParse({
        persetujuan_id: '11111111-1111-1111-1111-111111111111',
      });
      expect(res.success).toBe(true);
    });
  });
});
