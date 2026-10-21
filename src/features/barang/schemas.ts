import { z } from 'zod';

export const barangCreateSchema = z.object({
  kode: z
    .string()
    .trim()
    .min(2, 'Kode barang minimal 2 karakter')
    .max(20, 'Kode barang maksimal 20 karakter')
    .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya boleh alfanumerik, strip, atau garis bawah'),
  nama: z
    .string()
    .trim()
    .min(2, 'Nama barang minimal 2 karakter')
    .max(100, 'Nama barang maksimal 100 karakter'),
  satuan: z
    .string()
    .trim()
    .min(1, 'Satuan wajib diisi')
    .max(20, 'Satuan maksimal 20 karakter'),
  harga_jual: z.coerce
    .number()
    .positive('Harga jual harus lebih dari 0'),
  stok_minimum: z.coerce
    .number()
    .int('Stok minimum harus bilangan bulat')
    .min(0, 'Stok minimum minimal 0')
    .default(0),
  harga_pokok: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().min(0, 'Harga pokok minimal Rp0').optional()
  ),
});

export const barangUpdateGudangSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(2, 'Nama barang minimal 2 karakter')
    .max(100, 'Nama barang maksimal 100 karakter'),
  satuan: z
    .string()
    .trim()
    .min(1, 'Satuan wajib diisi')
    .max(20, 'Satuan maksimal 20 karakter'),
  stok_minimum: z.coerce
    .number()
    .int('Stok minimum harus bilangan bulat')
    .min(0, 'Stok minimum minimal 0'),
  aktif: z.boolean().default(true),
});

export const barangUpdateHargaJualSchema = z.object({
  harga_jual: z.coerce
    .number()
    .positive('Harga jual harus lebih dari 0'),
});

export const barangUpdateHargaPokokSchema = z.object({
  harga_pokok: z.coerce
    .number()
    .min(0, 'Harga pokok minimal Rp0'),
});

export type BarangCreateInput = z.infer<typeof barangCreateSchema>;
export type BarangUpdateGudangInput = z.infer<typeof barangUpdateGudangSchema>;
export type BarangUpdateHargaJualInput = z.infer<typeof barangUpdateHargaJualSchema>;
export type BarangUpdateHargaPokokInput = z.infer<typeof barangUpdateHargaPokokSchema>;
