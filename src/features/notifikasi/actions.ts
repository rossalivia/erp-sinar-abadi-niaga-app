'use server';

import { revalidatePath } from 'next/cache';
import { getProfil } from '@/lib/profil';
import { prosesNotifikasiStokHarian } from './service';
import type { KirimNotifikasiResult } from './types';

/**
 * Server Action: Kirim Notifikasi Email Uji Coba Sekarang.
 * Khusus untuk peran Manajer (E10).
 * Menguji seluruh alur pengiriman dengan jenis 'uji' dan rate limit 1 kali per menit.
 */
export async function kirimNotifikasiUjiAction(): Promise<KirimNotifikasiResult> {
  const user = await getProfil();

  if (!user || !user.aktif || user.peran !== 'manajer') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Manajer yang dapat menjalankan pengujian email',
    };
  }

  const result = await prosesNotifikasiStokHarian({
    jenis: 'uji',
  });

  revalidatePath('/notifikasi');
  return result;
}
