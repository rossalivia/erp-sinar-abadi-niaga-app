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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            <History className="h-4 w-4" />
            <span>Lihat Riwayat Impor</span>
          </Link>
        }
      />

      {/* Tab Navigasi */}
      <div className="flex border-b border-slate-200">
        <Link
          href="/impor?tab=barang"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'barang'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          )}
        >
          <Package className="h-4 w-4" />
          <span>Impor Barang</span>
        </Link>
        <Link
          href="/impor?tab=pelanggan"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'pelanggan'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          )}
        >
          <Users className="h-4 w-4" />
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
