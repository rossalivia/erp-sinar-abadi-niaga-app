'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import { pemasokCreateSchema, pemasokUpdateSchema } from './schemas';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

export async function buatPemasokAction(
  prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const rawData = {
    kode: formData.get('kode'),
    nama: formData.get('nama'),
    telepon: formData.get('telepon') || undefined,
    alamat: formData.get('alamat') || undefined,
  };

  const parsed = pemasokCreateSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi gagal, periksa isian formulir.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const kodeBersih = parsed.data.kode.toUpperCase().trim();

  const { data, error } = await supabase
    .from('pemasok')
    .insert({
      kode: kodeBersih,
      nama: parsed.data.nama,
      telepon: parsed.data.telepon || null,
      alamat: parsed.data.alamat || null,
      aktif: true,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        message: 'Kode pemasok sudah digunakan',
        fieldErrors: { kode: ['Kode pemasok sudah digunakan'] },
      };
    }
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/pemasok');
  return {
    success: true,
    message: 'Pemasok berhasil ditambahkan',
    data: { id: data.id },
  };
}

export async function ubahPemasokAction(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    nama: formData.get('nama'),
    telepon: formData.get('telepon') || undefined,
    alamat: formData.get('alamat') || undefined,
    aktif: formData.get('aktif') === 'true' || formData.get('aktif') === 'on',
  };

  const parsed = pemasokUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi gagal, periksa isian formulir.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('pemasok')
    .update({
      nama: parsed.data.nama,
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

  revalidatePath('/pemasok');
  revalidatePath(`/pemasok/${id}`);
  return {
    success: true,
    message: 'Data pemasok berhasil diperbarui',
  };
}
