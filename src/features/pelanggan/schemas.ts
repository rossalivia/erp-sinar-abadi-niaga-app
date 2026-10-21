import { z } from 'zod';

export const terminHariEnum = z.union([
  z.literal(0),
  z.literal(7),
  z.literal(14),
  z.literal(30),
]);

export const pelangganCreateSchema = z.object({
  kode: z
    .string()
    .trim()
    .min(2, 'Kode pelanggan minimal 2 karakter')
    .max(20, 'Kode pelanggan maksimal 20 karakter')
    .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya boleh alfanumerik, strip, atau garis bawah'),
  nama_toko: z
    .string()
    .trim()
    .min(2, 'Nama toko minimal 2 karakter')
    .max(100, 'Nama toko maksimal 100 karakter'),
  telepon: z
    .string()
    .trim()
    .max(20, 'Nomor telepon maksimal 20 karakter')
    .optional()
    .or(z.literal('')),
  alamat: z
    .string()
    .trim()
    .max(255, 'Alamat maksimal 255 karakter')
    .optional()
    .or(z.literal('')),
  termin_hari: z.coerce
    .number()
    .refine((val): val is 0 | 7 | 14 | 30 => [0, 7, 14, 30].includes(val), {
      message: 'Termin hari harus 0, 7, 14, atau 30 hari',
    })
    .default(0),
  batas_kredit: z.coerce
    .number()
    .min(0, 'Batas kredit minimal Rp0')
    .default(0),
});

export const pelangganUpdateSchema = z.object({
  nama_toko: z
    .string()
    .trim()
    .min(2, 'Nama toko minimal 2 karakter')
    .max(100, 'Nama toko maksimal 100 karakter'),
  telepon: z
    .string()
    .trim()
    .max(20, 'Nomor telepon maksimal 20 karakter')
    .optional()
    .or(z.literal('')),
  alamat: z
    .string()
    .trim()
    .max(255, 'Alamat maksimal 255 karakter')
    .optional()
    .or(z.literal('')),
  aktif: z.boolean().default(true),
});

export const batasKreditSchema = z.object({
  batas_kredit: z.coerce
    .number()
    .min(0, 'Batas kredit minimal Rp0'),
});

export const terminSchema = z.object({
  termin_hari: z.coerce
    .number()
    .refine((val): val is 0 | 7 | 14 | 30 => [0, 7, 14, 30].includes(val), {
      message: 'Termin hari harus 0, 7, 14, atau 30 hari',
    }),
});

export type PelangganCreateInput = z.infer<typeof pelangganCreateSchema>;
export type PelangganUpdateInput = z.infer<typeof pelangganUpdateSchema>;
export type BatasKreditInput = z.infer<typeof batasKreditSchema>;
export type TerminInput = z.infer<typeof terminSchema>;
