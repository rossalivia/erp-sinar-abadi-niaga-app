import * as React from 'react';
import { redirect } from 'next/navigation';
import { Info } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { AkunTableClient } from '@/features/akun/components/akun-table-client';

export default async function AkunPage() {
  const profile = await getProfil();
  if (!profile || profile.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('dibuat_pada', { ascending: false });

  const userList = users || [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pengaturan Akun & Hak Akses"
        description="Kelola peran hak akses staf dan status keaktifan akun pengguna ERP"
      />

      {/* Informasi Alur Pendaftaran Akun Baru */}
      <div className="flex items-start gap-3 p-4 rounded-md bg-blue-50/70 border border-blue-200 text-blue-900 text-xs leading-relaxed">
        <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
        <div>
          <span className="font-semibold text-blue-950">Catatan Pendaftaran Akun Baru:</span>{' '}
          Untuk alasan keamanan korporat, pendaftaran staf baru dilakukan langsung oleh administrator melalui menu <strong>Authentication &gt; Users &gt; Invite/Add User</strong> pada dashboard Supabase. Setelah email terdaftar dan terkonfirmasi, akun otomatis muncul pada daftar di bawah ini untuk kemudian diatur perannya (Staf Penjualan, Staf Gudang, atau Manajer).
        </div>
      </div>

      <AkunTableClient users={userList} />
    </div>
  );
}
