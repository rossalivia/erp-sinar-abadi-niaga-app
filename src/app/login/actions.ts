'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
  next: z.string().optional(),
});

export type LoginState = {
  error?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
};

export async function loginAction(
  prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  };

  const validation = loginSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { email, password, next } = validation.data;
  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      error: getErrorMessage(signInError),
    };
  }

  // Verifikasi bahwa user aktif di profiles
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Autentikasi gagal' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('aktif')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.aktif) {
    await supabase.auth.signOut();
    return {
      error: 'Akun Anda tidak aktif atau dinonaktifkan. Hubungi Manajer.',
    };
  }

  // Validasi next path (hanya internal path, cegah open redirect)
  let targetPath = '/';
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('http')) {
    targetPath = next;
  }

  redirect(targetPath);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
