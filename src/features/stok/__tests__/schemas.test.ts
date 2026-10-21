import { describe, it, expect } from 'vitest';
import { penyesuaianStokSchema } from '../schemas';

describe('penyesuaianStokSchema (BR-11)', () => {
  const validUUID = '44444444-4444-4444-8444-444444444444';

  it('menerima stok baru >= 0 dengan alasan >= 10 karakter', () => {
    const res = penyesuaianStokSchema.safeParse({
      barang_id: validUUID,
      stok_baru: 0,
      alasan: 'Stok fisik habis terverifikasi',
    });
    expect(res.success).toBe(true);
  });

  it('menolak stok baru negatif', () => {
    const res = penyesuaianStokSchema.safeParse({
      barang_id: validUUID,
      stok_baru: -1,
      alasan: 'Penyesuaian fisik bulanan gudang',
    });
    expect(res.success).toBe(false);
  });

  it('menolak alasan kurang dari 10 karakter atau spasi kosong', () => {
    const res1 = penyesuaianStokSchema.safeParse({
      barang_id: validUUID,
      stok_baru: 10,
      alasan: 'hitung', // 6 char
    });
    expect(res1.success).toBe(false);

    const res2 = penyesuaianStokSchema.safeParse({
      barang_id: validUUID,
      stok_baru: 10,
      alasan: '          ', // 10 spasi -> trim = 0
    });
    expect(res2.success).toBe(false);
  });
});
