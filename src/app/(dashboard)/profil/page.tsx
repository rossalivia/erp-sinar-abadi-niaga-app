import * as React from 'react';
import { redirect } from 'next/navigation';
import { UserCheck, Mail, Shield, Calendar, Building2, Store, Truck } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BadgeStatus } from '@/components/shared/badge-status';
import { ProfilForms } from '@/features/akun/components/profil-forms';
import { formatTanggal } from '@/lib/format';

const PERAN_BADGE: Record<string, { label: string; variant: 'secondary' | 'info' | 'default' }> = {
  penjualan: { label: 'Staf Penjualan', variant: 'secondary' },
  gudang: { label: 'Staf Gudang', variant: 'info' },
  manajer: { label: 'Manajer', variant: 'default' },
};

export default async function ProfilPage() {
  const profile = await getProfil();
  if (!profile) {
    redirect('/login');
  }

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const peranInfo = PERAN_BADGE[profile.peran] || {
    label: profile.peran,
    variant: 'secondary' as const,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil & Informasi Perusahaan"
        description="Kelola informasi akun Anda dan tinjau profil resmi entitas CV Sinar Abadi Niaga"
      />

      {/* Profil Resmi Entitas Perusahaan */}
      <Card className="border-slate-200 bg-white">
        <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Identitas Entitas Usaha
          </CardTitle>
          <span className="text-[11px] font-mono text-slate-500">
            Badan Usaha: Persekutuan Komanditer (CV)
          </span>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <Logo size="sm" showSubdeskripsi={true} />
            <div className="text-left sm:text-right text-xs">
              <span className="text-slate-400 block text-[10px]">Basis Operasional</span>
              <span className="font-semibold text-slate-800">Kawasan Pergudangan Niaga, Surabaya</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-mono uppercase">Klasifikasi Usaha</span>
              <span className="font-semibold text-slate-900 mt-0.5 block">Wholesale Groceries &amp; FMCG</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-mono uppercase">Layanan Utama</span>
              <span className="font-semibold text-slate-900 mt-0.5 block">Distribusi Sembako &amp; Toko Kelontong</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-mono uppercase">Komoditas Inti</span>
              <span className="font-semibold text-slate-900 mt-0.5 block">Beras, Minyak, Gula, Tepung, FMCG</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-mono uppercase">Jaringan Pelanggan</span>
              <span className="font-semibold text-slate-900 mt-0.5 block">Toko Kelontong &amp; Ritel Mitra</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ringkasan Identitas Akun */}
      <Card>
        <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Informasi Akun Terdaftar
          </CardTitle>
          <BadgeStatus status={profile.aktif ? 'aktif' : 'nonaktif'} />
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 shadow-neu-sm">
              <UserCheck className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-slate-400 text-[10px] block">Nama Lengkap</span>
                <span className="font-semibold text-slate-900">{profile.nama_lengkap}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-100">
              <Mail className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-slate-400 text-[10px] block">Email Terdaftar</span>
                <span className="font-semibold text-slate-900">{authUser?.email || '-'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-100">
              <Shield className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-slate-400 text-[10px] block">Peran Hak Akses</span>
                <Badge variant={peranInfo.variant} className="text-[10px] mt-0.5">
                  {peranInfo.label}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-100">
              <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-slate-400 text-[10px] block">Terdaftar Pada</span>
                <span className="font-semibold text-slate-900">
                  {formatTanggal(profile.dibuat_pada)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulir Ubah Nama & Kata Sandi */}
      <ProfilForms user={profile} />
    </div>
  );
}
