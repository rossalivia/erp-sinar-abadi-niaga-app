'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import {
  buatOpnameSchema,
  ubahDrafOpnameSchema,
  batalkanOpnameSchema,
  type BuatOpnameInput,
  type UbahDrafOpnameInput,
  type BatalkanOpnameInput,
} from './schemas';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

interface CustomRpcClient {
  rpc: (
    name: string,
    params: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>;
}

/**
 * Membuat sesi stock opname baru (draf atau langsung diajukan).
 * Memanggil rpc_buat_opname_stok.
 */
export async function buatOpnameAction(
  payload: BuatOpnameInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = buatOpnameSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Validasi sesi opname gagal',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const client = supabase as unknown as CustomRpcClient;
  const { data, error } = await client.rpc('rpc_buat_opname_stok', {
    p_catatan: parsed.data.catatan || null,
    p_items: parsed.data.items,
    p_langsung_ajukan: parsed.data.langsung_ajukan,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/stok/opname');
  revalidatePath('/stok');
  revalidatePath('/');

  return {
    success: true,
    data: { id: data as string },
  };
}

/**
 * Mengubah item dan hitungan fisik sesi opname berstatus draf.
 * Memanggil rpc_ubah_draf_opname.
 */
export async function ubahDrafOpnameAction(
  payload: UbahDrafOpnameInput
): Promise<ActionResult> {
  const parsed = ubahDrafOpnameSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Validasi pengubahan draf gagal',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const client = supabase as unknown as CustomRpcClient;
  const { error } = await client.rpc('rpc_ubah_draf_opname', {
    p_id: parsed.data.id,
    p_catatan: parsed.data.catatan || null,
    p_items: parsed.data.items,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/stok/opname');
  revalidatePath(`/stok/opname/${parsed.data.id}`);

  return {
    success: true,
  };
}

/**
 * Mengajukan sesi opname dari draf ke status diajukan (menunggu persetujuan Manajer).
 * Memanggil rpc_ajukan_opname_stok.
 */
export async function ajukanOpnameAction(id: string): Promise<ActionResult> {
  if (!id || typeof id !== 'string') {
    return { success: false, message: 'ID sesi tidak valid' };
  }

  const supabase = await createServerClient();
  const client = supabase as unknown as CustomRpcClient;
  const { error } = await client.rpc('rpc_ajukan_opname_stok', {
    p_id: id,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/stok/opname');
  revalidatePath(`/stok/opname/${id}`);

  return {
    success: true,
  };
}

/**
 * Menyetujui sesi opname dan mengeksekusi koreksi fisik stok barang.
 * Khusus peran Manajer. Memanggil rpc_setujui_opname_stok.
 */
export async function setujuiOpnameAction(id: string): Promise<ActionResult> {
  if (!id || typeof id !== 'string') {
    return { success: false, message: 'ID sesi tidak valid' };
  }

  const supabase = await createServerClient();
  const client = supabase as unknown as CustomRpcClient;
  const { error } = await client.rpc('rpc_setujui_opname_stok', {
    p_id: id,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/stok/opname');
  revalidatePath(`/stok/opname/${id}`);
  revalidatePath('/stok');
  revalidatePath('/barang');
  revalidatePath('/');

  return {
    success: true,
  };
}

/**
 * Membatalkan atau menolak sesi opname dengan mengisi alasan pembatalan.
 * Memanggil rpc_batalkan_opname_stok.
 */
export async function batalkanOpnameAction(
  payload: BatalkanOpnameInput
): Promise<ActionResult> {
  const parsed = batalkanOpnameSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Alasan minimal 10 karakter',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const client = supabase as unknown as CustomRpcClient;
  const { error } = await client.rpc('rpc_batalkan_opname_stok', {
    p_id: parsed.data.id,
    p_alasan: parsed.data.alasan,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/stok/opname');
  revalidatePath(`/stok/opname/${parsed.data.id}`);

  return {
    success: true,
  };
}
