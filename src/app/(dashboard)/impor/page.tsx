import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { History, Package, Users } from 'lucide-react';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { TabImporBarang } from '@/features/impor/components/TabImporBarang';
import { TabImporPelanggan } from '@/features/impor/components/TabImporPelanggan';
import { cn } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<{
    tab?: string;
  }>;
}

export default async function ImporPage({ searchParams }: PageProps) {
  const profile = await getProfil();
  if (!profile) {
    redirect('/login');
  }

  if (profile.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab === 'pelanggan' ? 'pelanggan' : 'barang';

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Impor Data Master"
        description="Masukkan data awal katalog barang dan pelanggan secara massal melalui berkas CSV."
        action={
          <Link
            href="/impor/riwayat"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/80 bg-white/90 shadow-neu-sm hover:bg-white text-slate-700 transition-colors"
          >
            <History className="h-4 w-4" />
            <span>Lihat Riwayat Impor</span>
          </Link>
        }
      />

      {/* Tab Navigasi */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200/60 shadow-neu-inset w-fit">
        <Link
          href="/impor?tab=barang"
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all',
            activeTab === 'barang'
              ? 'bg-white text-slate-900 font-semibold shadow-neu-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          )}
        >
          <Package className={cn('h-4 w-4', activeTab === 'barang' && 'text-indigo-600')} />
          <span>Impor Barang</span>
        </Link>
        <Link
          href="/impor?tab=pelanggan"
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all',
            activeTab === 'pelanggan'
              ? 'bg-white text-slate-900 font-semibold shadow-neu-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          )}
        >
          <Users className={cn('h-4 w-4', activeTab === 'pelanggan' && 'text-indigo-600')} />
          <span>Impor Pelanggan</span>
        </Link>
      </div>

      {/* Konten Tab */}
      <div className="pt-1">
        {activeTab === 'barang' ? <TabImporBarang /> : <TabImporPelanggan />}
      </div>
    </div>
  );
}
