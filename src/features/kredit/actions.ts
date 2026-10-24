'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { getErrorMessage } from '@/lib/errors';
import { revalidatePath } from 'next/cache';
import type { 
  AnalisisKredit, 
  ItemPemantauanKredit, 
  SimulasiLimitHasil, 
  PeringatanEditor 
} from './types';

export async function ambilAnalisisKreditAction(
  pelangganId: string
): Promise<{ success: boolean; data?: AnalisisKredit; message?: string }> {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return { success: false, message: 'Akses ditolak: hanya Manajer yang dapat mengakses analisis kredit.' };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('fn_analisis_kredit_pelanggan', {
    p_pelanggan_id: pelangganId,
  });

  if (error) {
    return { success: false, message: getErrorMessage(error) };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return { success: true, data: result as unknown as AnalisisKredit };
}

export async function ambilDaftarPemantauanKreditAction(): Promise<{
  success: boolean;
  data?: ItemPemantauanKredit[];
  message?: string;
}> {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return { success: false, message: 'Akses ditolak: hanya Manajer yang dapat mengakses pemantauan kredit.' };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('fn_daftar_pemantauan_kredit');

  if (error) {
    return { success: false, message: getErrorMessage(error) };
  }

  return { success: true, data: (data || []) as unknown as ItemPemantauanKredit[] };
}

export async function simulasiLimitAction(
  pelangganId: string,
  limitHipotetik: number
): Promise<{ success: boolean; data?: SimulasiLimitHasil; message?: string }> {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return { success: false, message: 'Akses ditolak: hanya Manajer yang dapat melakukan simulasi limit.' };
  }

  if (limitHipotetik < 0) {
    return { success: false, message: 'Nilai limit hipotetik harus >= 0' };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('fn_simulasi_limit_kredit', {
    p_pelanggan_id: pelangganId,
    p_limit_hipotetik: limitHipotetik,
  });

  if (error) {
    return { success: false, message: getErrorMessage(error) };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return { success: true, data: result as unknown as SimulasiLimitHasil };
}

export async function ambilPeringatanEditorAction(
  pelangganId: string,
  totalEstimasi: number
): Promise<{ success: boolean; data?: PeringatanEditor[]; message?: string }> {
  const profil = await getProfil();
  if (!profil || (profil.peran !== 'penjualan' && profil.peran !== 'manajer')) {
    return { success: false, message: 'Akses ditolak' };
  }

  if (!pelangganId || totalEstimasi <= 0) {
    return { success: true, data: [] };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('fn_peringatan_editor_pesanan', {
    p_pelanggan_id: pelangganId,
    p_total_estimasi: totalEstimasi,
  });

  if (error) {
    return { success: false, message: getErrorMessage(error) };
  }

  return { success: true, data: (data || []) as unknown as PeringatanEditor[] };
}

export async function terapkanRekomendasiLimitAction(
  pelangganId: string,
  limitBaru: number
): Promise<{ success: boolean; message: string }> {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return { success: false, message: 'Akses ditolak: hanya Manajer yang dapat mengubah batas kredit.' };
  }

  if (limitBaru < 0) {
    return { success: false, message: 'Batas kredit harus >= 0' };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('rpc_set_batas_kredit', {
    p_pelanggan_id: pelangganId,
    p_batas: limitBaru,
  });

  if (error) {
    return { success: false, message: getErrorMessage(error) };
  }

  revalidatePath('/kredit');
  revalidatePath(`/pelanggan/${pelangganId}`);
  revalidatePath('/pelanggan');

  return { success: true, message: 'Rekomendasi batas kredit berhasil diterapkan.' };
}
