import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile, Peran } from '@/types/auth';

/**
 * Mengambil profil pengguna yang sedang login.
 * Ter-cache per request React Server Component via React `cache()`.
 * Menggunakan supabase.auth.getUser() (bukan getSession) untuk keamanan.
 */
export const getProfil = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, nama_lengkap, peran, aktif, dibuat_pada')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    id: profile.id,
    nama_lengkap: profile.nama_lengkap,
    peran: profile.peran as Peran,
    aktif: profile.aktif,
    dibuat_pada: profile.dibuat_pada,
  };
});
