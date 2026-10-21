import { z } from 'zod';

export const penyesuaianStokSchema = z.object({
  barang_id: z.string().uuid('ID barang tidak valid'),
  stok_baru: z.coerce
    .number()
    .int('Stok baru harus berupa bilangan bulat')
    .min(0, 'Stok hasil penyesuaian tidak boleh negatif'),
  alasan: z
    .string()
    .trim()
    .min(10, 'Alasan minimal 10 karakter'),
});

export type PenyesuaianStokInput = z.infer<typeof penyesuaianStokSchema>;
