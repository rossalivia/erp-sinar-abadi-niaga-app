'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import {
  pelangganCreateSchema,
  pelangganUpdateSchema,
  batasKreditSchema,
  terminSchema,
} from './schemas';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

export async function buatPelangganAction(
  prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const rawData = {
    kode: formData.get('kode'),
    nama_toko: formData.get('nama_toko'),
    telepon: formData.get('telepon') || undefined,
    alamat: formData.get('alamat') || undefined,
    termin_hari: formData.get('termin_hari') ? Number(formData.get('termin_hari')) : 0,
    batas_kredit: formData.get('batas_kredit') ? Number(formData.get('batas_kredit')) : 0,
  };

  const parsed = pelangganCreateSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi gagal, periksa isian formulir.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('peran')
    .single();

  const isManajer = userProfile?.peran === 'manajer';
  const batasKreditKirim = isManajer ? parsed.data.batas_kredit : 0;

  const { data, error } = await supabase.rpc('rpc_buat_pelanggan', {
    p_kode: parsed.data.kode,
    p_nama_toko: parsed.data.nama_toko,
    p_telepon: parsed.data.telepon || undefined,
    p_alamat: parsed.data.alamat || undefined,
    p_termin_hari: parsed.data.termin_hari,
    p_batas_kredit: batasKreditKirim,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pelanggan');
  const resData = data as { id: string } | null;
  return {
    success: true,
    message: 'Pelanggan berhasil ditambahkan',
    data: { id: resData?.id || '' },
  };
}

export async function ubahPelangganAction(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    nama_toko: formData.get('nama_toko'),
    telepon: formData.get('telepon') || undefined,
    alamat: formData.get('alamat') || undefined,
    aktif: formData.get('aktif') === 'true' || formData.get('aktif') === 'on',
  };

  const parsed = pelangganUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi gagal, periksa isian formulir.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('pelanggan')
    .update({
      nama_toko: parsed.data.nama_toko,
      telepon: parsed.data.telepon || null,
      alamat: parsed.data.alamat || null,
      aktif: parsed.data.aktif,
    })
    .eq('id', id);

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pelanggan');
  revalidatePath(`/pelanggan/${id}`);
  return {
    success: true,
    message: 'Data pelanggan berhasil diperbarui',
  };
}

export async function ubahBatasKreditAction(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    batas_kredit: formData.get('batas_kredit'),
  };

  const parsed = batasKreditSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Nilai batas kredit tidak valid',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('rpc_set_batas_kredit', {
    p_pelanggan_id: id,
    p_batas: parsed.data.batas_kredit,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pelanggan');
  revalidatePath(`/pelanggan/${id}`);
  return {
    success: true,
    message: 'Batas kredit berhasil diperbarui',
  };
}

export async function ubahTerminAction(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    termin_hari: formData.get('termin_hari'),
  };

  const parsed = terminSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Termin hari harus 0, 7, 14, atau 30 hari',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('rpc_set_termin', {
    p_pelanggan_id: id,
    p_termin: parsed.data.termin_hari,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pelanggan');
  revalidatePath(`/pelanggan/${id}`);
  return {
    success: true,
    message: 'Termin bayar berhasil diperbarui',
  };
}
