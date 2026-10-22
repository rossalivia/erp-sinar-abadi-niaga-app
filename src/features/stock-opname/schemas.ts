import { z } from 'zod';

export const itemOpnameInputSchema = z
  .object({
    barang_id: z.string().uuid('Barang tidak valid'),
    stok_fisik: z.coerce
      .number()
      .int('Stok fisik harus berupa bilangan bulat')
      .min(0, 'Stok fisik riil tidak boleh bernilai negatif'),
    stok_sistem: z.coerce.number().int().min(0).optional(),
    keterangan: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.stok_sistem !== undefined && data.stok_fisik !== data.stok_sistem) {
        return typeof data.keterangan === 'string' && data.keterangan.trim().length >= 10;
      }
      return true;
    },
    {
      message: 'Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter',
      path: ['keterangan'],
    }
  );

export const buatOpnameSchema = z.object({
  catatan: z.string().trim().optional(),
  items: z
    .array(itemOpnameInputSchema)
    .min(1, 'Sesi opname harus berisi minimal 1 item barang')
    .refine(
      (items) => {
        const ids = items.map((i) => i.barang_id);
        return new Set(ids).size === ids.length;
      },
      { message: 'Barang tidak boleh duplikat dalam satu sesi opname' }
    ),
  langsung_ajukan: z.boolean().default(false),
});

export const ubahDrafOpnameSchema = z.object({
  id: z.string().uuid('ID sesi tidak valid'),
  catatan: z.string().trim().optional(),
  items: z
    .array(itemOpnameInputSchema)
    .min(1, 'Sesi opname harus berisi minimal 1 item barang')
    .refine(
      (items) => {
        const ids = items.map((i) => i.barang_id);
        return new Set(ids).size === ids.length;
      },
      { message: 'Barang tidak boleh duplikat dalam satu sesi opname' }
    ),
});

export const batalkanOpnameSchema = z.object({
  id: z.string().uuid('ID sesi tidak valid'),
  alasan: z
    .string()
    .trim()
    .min(10, 'Alasan minimal 10 karakter'),
});

export type ItemOpnameInput = z.infer<typeof itemOpnameInputSchema>;
export type BuatOpnameInput = z.infer<typeof buatOpnameSchema>;
export type UbahDrafOpnameInput = z.infer<typeof ubahDrafOpnameSchema>;
export type BatalkanOpnameInput = z.infer<typeof batalkanOpnameSchema>;
