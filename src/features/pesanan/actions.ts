'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import {
  pesananDrafSchema,
  batalTerkonfirmasiSchema,
  type PesananDrafInput,
} from './schemas';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Menyimpan draf pesanan baru atau memperbarui draf yang sudah ada.
 * Memanggil rpc_simpan_draf_pesanan.
 */
export async function simpanDrafPesananAction(
  payload: PesananDrafInput
): Promise<ActionResult<{ id: string; nomor: string; total: number }>> {
  const parsed = pesananDrafSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Validasi formulir pesanan gagal',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_simpan_draf_pesanan', {
    p_pelanggan_id: parsed.data.pelanggan_id,
    p_items: parsed.data.items,
    p_pesanan_id: parsed.data.pesanan_id ?? undefined,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pesanan');
  if (parsed.data.pesanan_id) {
    revalidatePath(`/pesanan/${parsed.data.pesanan_id}`);
    revalidatePath(`/pesanan/${parsed.data.pesanan_id}/ubah`);
  }

  const res = data as { id: string; nomor: string; total: number };
  return {
    success: true,
    message: 'Draf pesanan berhasil disimpan',
    data: res,
  };
}

/**
 * Konfirmasi pesanan draf menjadi status dikonfirmasi.
 * Memanggil rpc_konfirmasi_pesanan.
 * Mengurangi stok barang & mencatat kartu stok serta HPP snapshot.
 */
export async function konfirmasiPesananAction(
  pesananId: string
): Promise<ActionResult<{ id: string; nomor: string; status: string }>> {
  if (!pesananId) {
    return { success: false, message: 'ID pesanan tidak valid' };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_konfirmasi_pesanan', {
    p_pesanan_id: pesananId,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pesanan');
  revalidatePath(`/pesanan/${pesananId}`);
  revalidatePath('/barang');

  const res = data as { id: string; nomor: string; status: string };
  return {
    success: true,
    message: `Pesanan ${res?.nomor || ''} berhasil dikonfirmasi`,
    data: res,
  };
}

/**
 * Membatalkan draf pesanan.
 * Memanggil rpc_batalkan_draf.
 */
export async function batalkanDrafAction(
  pesananId: string
): Promise<ActionResult<{ id: string }>> {
  if (!pesananId) {
    return { success: false, message: 'ID pesanan tidak valid' };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('rpc_batalkan_draf', {
    p_pesanan_id: pesananId,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pesanan');
  revalidatePath(`/pesanan/${pesananId}`);

  return {
    success: true,
    message: 'Draf pesanan berhasil dibatalkan',
    data: { id: pesananId },
  };
}

/**
 * Mengirim pesanan terkonfirmasi.
 * Memanggil rpc_kirim_pesanan (Gudang/Manajer).
 * Mengisi tanggal kirim dan tanggal jatuh tempo.
 */
export async function kirimPesananAction(
  pesananId: string
): Promise<ActionResult<{ id: string; status: string; jatuh_tempo: string }>> {
  if (!pesananId) {
    return { success: false, message: 'ID pesanan tidak valid' };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_kirim_pesanan', {
    p_pesanan_id: pesananId,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pesanan');
  revalidatePath(`/pesanan/${pesananId}`);

  const res = data as { id: string; status: string; jatuh_tempo: string };
  return {
    success: true,
    message: 'Pesanan berhasil dikirim',
    data: res,
  };
}

/**
 * Mencatat pelunasan pesanan berstatus dikirim.
 * Memanggil rpc_catat_pelunasan (Manajer).
 */
export async function catatPelunasanAction(
  pesananId: string
): Promise<ActionResult<{ id: string; status: string }>> {
  if (!pesananId) {
    return { success: false, message: 'ID pesanan tidak valid' };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_catat_pelunasan', {
    p_pesanan_id: pesananId,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pesanan');
  revalidatePath(`/pesanan/${pesananId}`);
  revalidatePath('/pelanggan');

  const res = data as { id: string; status: string };
  return {
    success: true,
    message: 'Pesanan berhasil dilunasi',
    data: res,
  };
}

/**
 * Membatalkan pesanan terkonfirmasi (Manajer only).
 * Memanggil rpc_batalkan_pesanan_terkonfirmasi dengan alasan minimal 10 karakter.
 * Mengembalikan stok ke master barang dan mencatat kartu stok jenis batal.
 */
export async function batalkanPesananTerkonfirmasiAction(
  pesananId: string,
  alasan: string
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = batalTerkonfirmasiSchema.safeParse({
    pesanan_id: pesananId,
    alasan,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Alasan minimal 10 karakter',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_batalkan_pesanan_terkonfirmasi', {
    p_pesanan_id: parsed.data.pesanan_id,
    p_alasan: parsed.data.alasan,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pesanan');
  revalidatePath(`/pesanan/${pesananId}`);
  revalidatePath('/barang');

  const res = data as { id: string; status: string };
  return {
    success: true,
    message: 'Pesanan terkonfirmasi berhasil dibatalkan dan stok telah dikembalikan',
    data: res,
  };
}

export interface KreditPelangganInfo {
  batas_kredit: number;
  piutang_terkonfirmasi: number;
  piutang_terkirim: number;
  piutang_berjalan: number;
  sisa_kredit: number;
  jumlah_faktur_overdue: number;
  hari_terlambat_terlama: number;
  punya_overdue: boolean;
  boleh_transaksi: boolean;
}

/**
 * Mengambil informasi kredit dan status overdue pelanggan untuk validasi UI editor pesanan.
 * Menggunakan RPC rpc_get_kredit_pelanggan.
 */
export async function getKreditPelangganAction(
  pelangganId: string
): Promise<ActionResult<KreditPelangganInfo>> {
  if (!pelangganId) {
    return { success: false, message: 'ID pelanggan tidak valid' };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_get_kredit_pelanggan', {
    p_pelanggan_id: pelangganId,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  return {
    success: true,
    data: data as unknown as KreditPelangganInfo,
  };
}

