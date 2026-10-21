import { z } from 'zod';

export const pemasokCreateSchema = z.object({
  kode: z
    .string()
    .trim()
    .min(2, 'Kode pemasok minimal 2 karakter')
    .max(20, 'Kode pemasok maksimal 20 karakter')
    .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya boleh alfanumerik, strip, atau garis bawah'),
  nama: z
    .string()
    .trim()
    .min(2, 'Nama pemasok minimal 2 karakter')
    .max(100, 'Nama pemasok maksimal 100 karakter'),
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
});

export const pemasokUpdateSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(2, 'Nama pemasok minimal 2 karakter')
    .max(100, 'Nama pemasok maksimal 100 karakter'),
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

export type PemasokCreateInput = z.infer<typeof pemasokCreateSchema>;
export type PemasokUpdateInput = z.infer<typeof pemasokUpdateSchema>;
