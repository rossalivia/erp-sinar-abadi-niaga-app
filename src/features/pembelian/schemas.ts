import { z } from 'zod';

export const ajukanPembelianSchema = z.object({
  pemasok_id: z.string().uuid('Pemasok wajib dipilih'),
  barang_id: z.string().uuid('Barang wajib dipilih'),
  jumlah: z.coerce
    .number()
    .int('Jumlah harus berupa bilangan bulat')
    .min(1, 'Jumlah pembelian harus 1 sampai 10.000')
    .max(10000, 'Jumlah pembelian harus 1 sampai 10.000'),
});

export const setujuiPembelianSchema = z.object({
  pembelian_id: z.string().uuid('ID pembelian tidak valid'),
  harga_beli_satuan: z.coerce
    .number()
    .min(1, 'Harga beli harus lebih dari 0'),
});

export const tolakPembelianSchema = z.object({
  pembelian_id: z.string().uuid('ID pembelian tidak valid'),
  alasan: z
    .string()
    .trim()
    .min(10, 'Alasan minimal 10 karakter'),
});

export const terimaPembelianSchema = z.object({
  pembelian_id: z.string().uuid('ID pembelian tidak valid'),
  jumlah_diterima: z.coerce
    .number()
    .int('Jumlah diterima harus berupa bilangan bulat')
    .min(1, 'Jumlah minimal 1'),
});

export const batalkanPembelianSchema = z.object({
  pembelian_id: z.string().uuid('ID pembelian tidak valid'),
  alasan: z.string().trim().optional(),
});

export type AjukanPembelianInput = z.infer<typeof ajukanPembelianSchema>;
export type SetujuiPembelianInput = z.infer<typeof setujuiPembelianSchema>;
export type TolakPembelianInput = z.infer<typeof tolakPembelianSchema>;
export type TerimaPembelianInput = z.infer<typeof terimaPembelianSchema>;
export type BatalkanPembelianInput = z.infer<typeof batalkanPembelianSchema>;

