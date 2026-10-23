import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Klien Supabase dengan hak akses service_role untuk eksekusi tugas sistem latar belakang.
 * 
 * ATURAN KEAMANAN KETAT (PRD 11.1 / E5):
 * 1. Diimpor eksklusif hanya pada environment server (dilindungi 'server-only').
 * 2. Hanya membaca variabel lingkungan SUPABASE_SERVICE_ROLE_KEY (tidak pernah NEXT_PUBLIC_).
 * 3. HANYA digunakan oleh endpoint sistem (cron notifikasi stok menipis dan webhook transaksi).
 * 4. DILARANG melakukan kueri tabel langsung; HANYA boleh memanggil fungsi RPC sistem rpc_sistem_*.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Variabel lingkungan NEXT_PUBLIC_SUPABASE_URL belum dikonfigurasi');
  }

  if (!serviceRoleKey) {
    throw new Error('Variabel lingkungan SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
