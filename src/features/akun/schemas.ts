import { z } from 'zod';

export const peranEnum = z.enum(['penjualan', 'gudang', 'manajer']);

export const setPeranSchema = z.object({
  peran: peranEnum,
  aktif: z.boolean(),
});

export const ubahProfilSchema = z.object({
  nama_lengkap: z
    .string()
    .trim()
    .min(3, 'Nama lengkap minimal 3 karakter')
    .max(100, 'Nama lengkap maksimal 100 karakter'),
});

export const gantiPasswordSchema = z
  .object({
    password_baru: z
      .string()
      .min(6, 'Kata sandi baru minimal 6 karakter'),
    konfirmasi_password: z
      .string()
      .min(6, 'Konfirmasi kata sandi minimal 6 karakter'),
  })
  .refine((data) => data.password_baru === data.konfirmasi_password, {
    message: 'Konfirmasi kata sandi tidak cocok',
    path: ['konfirmasi_password'],
  });

export type SetPeranInput = z.infer<typeof setPeranSchema>;
export type UbahProfilInput = z.infer<typeof ubahProfilSchema>;
export type GantiPasswordInput = z.infer<typeof gantiPasswordSchema>;
