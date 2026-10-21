import { z } from 'zod';

export const pesananItemInputSchema = z.object({
  barang_id: z.string().uuid('ID barang tidak valid'),
  jumlah: z.coerce.number().int('Jumlah harus berupa bilangan bulat').min(1, 'Jumlah minimal 1'),
  diskon_persen: z.coerce
    .number()
    .min(0, 'Diskon minimal 0%')
    .max(25, 'Diskon maksimal 25%')
    .default(0),
});

export const pesananDrafSchema = z.object({
  pelanggan_id: z.string().uuid('Pelanggan harus dipilih'),
  pesanan_id: z.string().uuid().optional().nullable(),
  items: z
    .array(pesananItemInputSchema)
    .min(1, 'Pesanan harus berisi minimal 1 baris')
    .max(20, 'Pesanan maksimal 20 baris')
    .refine(
      (items) => {
        const ids = items.map((i) => i.barang_id);
        return new Set(ids).size === ids.length;
      },
      {
        message: 'Barang tidak boleh duplikat dalam satu pesanan',
      }
    ),
});

export const batalTerkonfirmasiSchema = z.object({
  pesanan_id: z.string().uuid('ID pesanan tidak valid'),
  alasan: z
    .string()
    .trim()
    .min(10, 'Alasan pembatalan minimal 10 karakter'),
});

export type PesananItemInput = z.infer<typeof pesananItemInputSchema>;
export type PesananDrafInput = z.infer<typeof pesananDrafSchema>;
export type BatalTerkonfirmasiInput = z.infer<typeof batalTerkonfirmasiSchema>;
