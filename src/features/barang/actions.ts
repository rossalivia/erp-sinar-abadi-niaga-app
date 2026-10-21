'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import {
  barangCreateSchema,
  barangUpdateGudangSchema,
  barangUpdateHargaJualSchema,
  barangUpdateHargaPokokSchema,
} from './schemas';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

export async function buatBarangAction(
  prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const rawData = {
    kode: formData.get('kode'),
    nama: formData.get('nama'),
    satuan: formData.get('satuan'),
    harga_jual: formData.get('harga_jual'),
    stok_minimum: formData.get('stok_minimum') || 0,
    harga_pokok: formData.get('harga_pokok') || undefined,
  };

  const parsed = barangCreateSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi gagal, periksa isian formulir.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_buat_barang', {
    p_kode: parsed.data.kode,
    p_nama: parsed.data.nama,
    p_satuan: parsed.data.satuan,
    p_harga_jual: parsed.data.harga_jual,
    p_stok_minimum: parsed.data.stok_minimum,
    p_harga_pokok: parsed.data.harga_pokok ?? undefined,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/barang');
  const resData = data as { id: string } | null;
  return {
    success: true,
    message: 'Barang berhasil ditambahkan',
    data: { id: resData?.id || '' },
  };
}

export async function ubahBarangAction(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    nama: formData.get('nama'),
    satuan: formData.get('satuan'),
    stok_minimum: formData.get('stok_minimum'),
    aktif: formData.get('aktif') === 'true' || formData.get('aktif') === 'on',
  };

  const parsed = barangUpdateGudangSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi gagal, periksa isian formulir.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('barang')
    .update({
      nama: parsed.data.nama,
      satuan: parsed.data.satuan,
      stok_minimum: parsed.data.stok_minimum,
      aktif: parsed.data.aktif,
      diperbarui_pada: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/barang');
  revalidatePath(`/barang/${id}`);
  return {
    success: true,
    message: 'Data barang berhasil diperbarui',
  };
}

export async function ubahHargaJualAction(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    harga_jual: formData.get('harga_jual'),
  };

  const parsed = barangUpdateHargaJualSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Harga jual harus lebih dari 0',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('rpc_set_harga_jual', {
    p_barang_id: id,
    p_nilai: parsed.data.harga_jual,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/barang');
  revalidatePath(`/barang/${id}`);
  return {
    success: true,
    message: 'Harga jual berhasil diperbarui',
  };
}

export async function ubahHargaPokokAction(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    harga_pokok: formData.get('harga_pokok'),
  };

  const parsed = barangUpdateHargaPokokSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Harga pokok minimal Rp0',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('rpc_set_harga_pokok', {
    p_barang_id: id,
    p_nilai: parsed.data.harga_pokok,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/barang');
  revalidatePath(`/barang/${id}`);
  return {
    success: true,
    message: 'Harga pokok berhasil diperbarui',
  };
}
