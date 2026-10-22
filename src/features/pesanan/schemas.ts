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

const uuidSchema = (msg: string) =>
  z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, msg);

export const ajukanPersetujuanSchema = z.object({
  pesanan_id: uuidSchema('ID pesanan tidak valid'),
  catatan_pengaju: z.string().optional(),
});

export const putuskanPersetujuanSchema = z
  .object({
    persetujuan_id: uuidSchema('ID persetujuan tidak valid'),
    setuju: z.boolean(),
    catatan_keputusan: z.string().optional(),
    alasan_tolak: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.setuju) {
      const alasan = (data.alasan_tolak ?? '').trim();
      if (alasan.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Alasan penolakan minimal 10 karakter',
          path: ['alasan_tolak'],
        });
      }
    }
  });

export const batalkanPersetujuanSchema = z.object({
  persetujuan_id: uuidSchema('ID persetujuan tidak valid'),
});

export type PesananItemInput = z.infer<typeof pesananItemInputSchema>;
export type PesananDrafInput = z.infer<typeof pesananDrafSchema>;
export type BatalTerkonfirmasiInput = z.infer<typeof batalTerkonfirmasiSchema>;
export type AjukanPersetujuanInput = z.infer<typeof ajukanPersetujuanSchema>;
export type PutuskanPersetujuanInput = z.infer<typeof putuskanPersetujuanSchema>;
export type BatalkanPersetujuanInput = z.infer<typeof batalkanPersetujuanSchema>;

