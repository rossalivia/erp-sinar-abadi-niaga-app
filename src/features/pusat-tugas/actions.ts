'use server';

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { ERROR_MESSAGES, getErrorMessage } from '@/lib/errors';
import { parsePickingListResult } from './utils';
import type { PickingListResult } from './types';

export interface AmbilDaftarPickingActionResult {
  success: boolean;
  message?: string;
  data?: PickingListResult;
  fieldErrors?: Record<string, string[]>;
}

const ambilDaftarPickingSchema = z.object({
  p_pesanan_ids: z
    .array(z.string().uuid('ID pesanan tidak valid'))
    .min(1, ERROR_MESSAGES.E0063),
});

/**
 * Membuat daftar ambil barang (picking list) dari pesanan terkonfirmasi.
 * Validasi otoritatif tetap dilakukan di RPC; action ini hanya memvalidasi
 * bentuk input dan menyaring keluaran agar tidak ada field rahasia yang lolos.
 */
export async function ambilDaftarPickingAction(
  pesananIds: string[]
): Promise<AmbilDaftarPickingActionResult> {
  const parsed = ambilDaftarPickingSchema.safeParse({
    p_pesanan_ids: pesananIds,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: ERROR_MESSAGES.E0063,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const profil = await getProfil();
  if (!profil || (profil.peran !== 'gudang' && profil.peran !== 'manajer')) {
    return { success: false, message: ERROR_MESSAGES.E0065 };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_ambil_daftar_picking', {
    p_pesanan_ids: parsed.data.p_pesanan_ids,
  });

  if (error) {
    return { success: false, message: getErrorMessage(error) };
  }

  const hasil = parsePickingListResult(data);
  if (!hasil) {
    return {
      success: false,
      message: 'Daftar ambil barang tidak dapat dibuat. Silakan coba lagi.',
    };
  }

  return { success: true, data: hasil };
}
