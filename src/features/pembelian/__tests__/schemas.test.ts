import { describe, it, expect } from 'vitest';
import {
  ajukanPembelianSchema,
  setujuiPembelianSchema,
  tolakPembelianSchema,
  terimaPembelianSchema,
} from '../schemas';

describe('ajukanPembelianSchema (BR-09)', () => {
  const validUUID = '11111111-1111-4111-8111-111111111111';

  it('menerima jumlah pembelian valid (1 s.d. 10.000)', () => {
    const res1 = ajukanPembelianSchema.safeParse({
      pemasok_id: validUUID,
      barang_id: validUUID,
      jumlah: 1,
    });
    expect(res1.success).toBe(true);

    const res2 = ajukanPembelianSchema.safeParse({
      pemasok_id: validUUID,
      barang_id: validUUID,
      jumlah: 10000,
    });
    expect(res2.success).toBe(true);
  });

  it('menolak jumlah pembelian 0 dan negatif', () => {
    const res = ajukanPembelianSchema.safeParse({
      pemasok_id: validUUID,
      barang_id: validUUID,
      jumlah: 0,
    });
    expect(res.success).toBe(false);
  });

  it('menolak jumlah pembelian melebihi 10.000 (contoh 10.001)', () => {
    const res = ajukanPembelianSchema.safeParse({
      pemasok_id: validUUID,
      barang_id: validUUID,
      jumlah: 10001,
    });
    expect(res.success).toBe(false);
  });
});

describe('setujuiPembelianSchema & tolakPembelianSchema (BR-09)', () => {
  const validUUID = '22222222-2222-4222-8222-222222222222';

  it('menyetujui dengan harga beli > 0', () => {
    const res = setujuiPembelianSchema.safeParse({
      pembelian_id: validUUID,
      harga_beli_satuan: 9500,
    });
    expect(res.success).toBe(true);
  });

  it('menolak harga beli <= 0', () => {
    const res = setujuiPembelianSchema.safeParse({
      pembelian_id: validUUID,
      harga_beli_satuan: 0,
    });
    expect(res.success).toBe(false);
  });

  it('menolak tolak PO dengan alasan kurang dari 10 karakter', () => {
    const res = tolakPembelianSchema.safeParse({
      pembelian_id: validUUID,
      alasan: 'mahal aja', // 9 char
    });
    expect(res.success).toBe(false);
  });

  it('menerima tolak PO dengan alasan >= 10 karakter', () => {
    const res = tolakPembelianSchema.safeParse({
      pembelian_id: validUUID,
      alasan: 'Harga pemasok terlalu tinggi dibanding pasaran',
    });
    expect(res.success).toBe(true);
  });
});

describe('terimaPembelianSchema (BR-10)', () => {
  const validUUID = '33333333-3333-4333-8333-333333333333';

  it('menerima jumlah diterima >= 1', () => {
    const res = terimaPembelianSchema.safeParse({
      pembelian_id: validUUID,
      jumlah_diterima: 50,
    });
    expect(res.success).toBe(true);
  });

  it('menolak jumlah diterima < 1', () => {
    const res = terimaPembelianSchema.safeParse({
      pembelian_id: validUUID,
      jumlah_diterima: 0,
    });
    expect(res.success).toBe(false);
  });
});
