import { z } from 'zod';

export const catatPenagihanSchema = z
  .object({
    pelangganId: z.string().uuid('ID Pelanggan tidak valid'),
    pesananJualId: z
      .string()
      .uuid('ID Pesanan tidak valid')
      .optional()
      .nullable()
      .or(z.literal('')),
    jenis: z.enum(['pengingat_wa', 'telepon', 'kunjungan', 'janji_bayar', 'catatan']),
    isi: z
      .string()
      .transform((val) => val.trim())
      .pipe(
        z
          .string()
          .min(3, 'Catatan penagihan minimal 3 karakter')
          .max(500, 'Catatan penagihan maksimal 500 karakter')
      ),
    janjiBayarTanggal: z.string().optional().nullable().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.jenis === 'janji_bayar') {
        return !!data.janjiBayarTanggal && data.janjiBayarTanggal.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Tanggal janji bayar wajib diisi untuk jenis penagihan janji bayar',
      path: ['janjiBayarTanggal'],
    }
  );

export type CatatPenagihanInput = z.infer<typeof catatPenagihanSchema>;
