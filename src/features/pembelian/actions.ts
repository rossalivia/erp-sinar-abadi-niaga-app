'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import {
  ajukanPembelianSchema,
  setujuiPembelianSchema,
  tolakPembelianSchema,
  terimaPembelianSchema,
  batalkanPembelianSchema,
  type AjukanPembelianInput,
  type SetujuiPembelianInput,
  type TolakPembelianInput,
  type TerimaPembelianInput,
  type BatalkanPembelianInput,
} from './schemas';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Mengajukan PO baru oleh Gudang atau Manajer.
 * Memanggil rpc_ajukan_pembelian.
 */
export async function ajukanPembelianAction(
  payload: AjukanPembelianInput
): Promise<ActionResult<{ id: string; nomor: string }>> {
  const parsed = ajukanPembelianSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Validasi pengajuan pembelian gagal',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_ajukan_pembelian', {
    p_pemasok_id: parsed.data.pemasok_id,
    p_barang_id: parsed.data.barang_id,
    p_jumlah: parsed.data.jumlah,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pembelian');
  revalidatePath('/stok');
  revalidatePath('/');

  const res = data as { id: string; nomor: string; status: string };
  return {
    success: true,
    message: `PO ${res?.nomor || ''} berhasil diajukan`,
    data: res,
  };
}

/**
 * Menyetujui PO oleh Manajer dengan memasukkan harga beli satuan.
 * Memanggil rpc_setujui_pembelian.
 */
export async function setujuiPembelianAction(
  payload: SetujuiPembelianInput
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = setujuiPembelianSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Harga beli harus lebih dari 0',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_setujui_pembelian', {
    p_pembelian_id: parsed.data.pembelian_id,
    p_harga_beli_satuan: parsed.data.harga_beli_satuan,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pembelian');
  revalidatePath(`/pembelian/${parsed.data.pembelian_id}`);

  const res = data as { id: string; status: string };
  return {
    success: true,
    message: 'PO berhasil disetujui',
    data: res,
  };
}

/**
 * Menolak pengajuan PO oleh Manajer dengan alasan >= 10 karakter.
 * Memanggil rpc_tolak_pembelian.
 */
export async function tolakPembelianAction(
  payload: TolakPembelianInput
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = tolakPembelianSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Alasan minimal 10 karakter',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_tolak_pembelian', {
    p_pembelian_id: parsed.data.pembelian_id,
    p_alasan: parsed.data.alasan,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pembelian');
  revalidatePath(`/pembelian/${parsed.data.pembelian_id}`);

  const res = data as { id: string; status: string };
  return {
    success: true,
    message: 'PO berhasil ditolak',
    data: res,
  };
}

/**
 * Menerima barang fisik dari PO disetujui oleh Gudang atau Manajer.
 * Memanggil rpc_terima_pembelian.
 * Menambah stok, mencatat kartu stok jenis masuk, dan memperbarui HPP barang.
 */
export async function terimaPembelianAction(
  payload: TerimaPembelianInput
): Promise<ActionResult<{ id: string; status: string; stok_sesudah: number }>> {
  const parsed = terimaPembelianSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Jumlah diterima tidak valid',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_terima_pembelian', {
    p_pembelian_id: parsed.data.pembelian_id,
    p_jumlah_diterima: parsed.data.jumlah_diterima,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pembelian');
  revalidatePath(`/pembelian/${parsed.data.pembelian_id}`);
  revalidatePath('/stok');
  revalidatePath('/barang');
  revalidatePath('/');

  const res = data as { id: string; status: string; stok_sesudah: number };
  return {
    success: true,
    message: 'Barang berhasil diterima, stok bertambah dan harga pokok diperbarui',
    data: res,
  };
}

/**
 * Membatalkan PO (Pengaju untuk status diajukan, Manajer untuk status disetujui).
 * Memanggil rpc_batalkan_pembelian.
 */
export async function batalkanPembelianAction(
  payload: BatalkanPembelianInput
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = batalkanPembelianSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Data pembatalan tidak valid',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_batalkan_pembelian', {
    p_pembelian_id: parsed.data.pembelian_id,
    p_alasan: parsed.data.alasan || null,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pembelian');
  revalidatePath(`/pembelian/${parsed.data.pembelian_id}`);
  revalidatePath('/stok');
  revalidatePath('/');

  const res = data as { id: string; status: string };
  return {
    success: true,
    message: 'Pembelian berhasil dibatalkan',
    data: res,
  };
}
