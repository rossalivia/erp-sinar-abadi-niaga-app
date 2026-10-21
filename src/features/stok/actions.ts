'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import { penyesuaianStokSchema, type PenyesuaianStokInput } from './schemas';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Melakukan penyesuaian stok opname fisik oleh Gudang atau Manajer.
 * Memanggil rpc_penyesuaian_stok.
 */
export async function penyesuaianStokAction(
  payload: PenyesuaianStokInput
): Promise<
  ActionResult<{
    barang_id: string;
    stok_lama: number;
    stok_baru: number;
    delta: number;
    nomor_dokumen: string;
  }>
> {
  const parsed = penyesuaianStokSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Validasi penyesuaian stok gagal',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_penyesuaian_stok', {
    p_barang_id: parsed.data.barang_id,
    p_stok_baru: parsed.data.stok_baru,
    p_alasan: parsed.data.alasan,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/stok');
  revalidatePath(`/stok/${parsed.data.barang_id}`);
  revalidatePath('/barang');
  revalidatePath('/');

  const res = data as {
    barang_id: string;
    stok_lama: number;
    stok_baru: number;
    delta: number;
    nomor_dokumen: string;
  };

  const tandaDelta = res.delta >= 0 ? `+${res.delta}` : `${res.delta}`;
  return {
    success: true,
    message: `Penyesuaian stok berhasil (${tandaDelta}). Dokumen: ${res.nomor_dokumen}`,
    data: res,
  };
}
