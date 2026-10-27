'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import {
  setPeranSchema,
  ubahProfilSchema,
  gantiPasswordSchema,
} from './schemas';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

export async function setPeranAction(
  profileId: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    peran: formData.get('peran'),
    aktif: formData.get('aktif') === 'true' || formData.get('aktif') === 'on',
  };

  const parsed = setPeranSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Peran atau status tidak valid',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc('rpc_set_peran', {
    p_profile_id: profileId,
    p_peran: parsed.data.peran,
    p_aktif: parsed.data.aktif,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/akun');
  return {
    success: true,
    message: 'Peran dan status pengguna berhasil diperbarui',
  };
}

export async function ubahProfilAction(
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    nama_lengkap: formData.get('nama_lengkap'),
  };

  const parsed = ubahProfilSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi gagal, periksa nama lengkap.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'Sesi pengguna tidak ditemukan. Silakan login kembali.',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      nama_lengkap: parsed.data.nama_lengkap,
    })
    .eq('id', user.id);

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/profil');
  revalidatePath('/', 'layout');
  return {
    success: true,
    message: 'Nama profil berhasil diperbarui',
  };
}

export async function gantiPasswordAction(
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    password_baru: formData.get('password_baru'),
    konfirmasi_password: formData.get('konfirmasi_password'),
  };

  const parsed = gantiPasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validasi kata sandi gagal.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password_baru,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  return {
    success: true,
    message: 'Kata sandi berhasil diperbarui',
  };
}

export async function logoutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

