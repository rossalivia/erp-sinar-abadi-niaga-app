import * as React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getProfil } from '@/lib/profil';
import { createServerClient } from '@/lib/supabase/server';
import { AnalitikTabs } from '@/features/analitik/components/analitik-tabs';
import { FilterBar } from '@/features/analitik/components/filter-bar';
import { PerformaSalesView } from '@/features/analitik/components/performa-sales-view';
import { TopPelangganView } from '@/features/analitik/components/top-pelanggan-view';
import { PelangganTidakAktifView } from '@/features/analitik/components/pelanggan-tidak-aktif-view';
import { BarangTidakBergerakView } from '@/features/analitik/components/barang-tidak-bergerak-view';
import type {
  BarangTidakBergerakItem,
  PelangganTidakAktifItem,
  PerformaSalesItem,
  TabAnalitik,
  TopPelangganItem,
} from '@/features/analitik/types';

export const metadata: Metadata = {
  title: 'Analitik Pelanggan & Sales — CV Sinar Abadi Niaga',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    preset?: string;
    dari?: string;
    sampai?: string;
    ambang?: string;
  }>;
}

export default async function AnalitikPage({ searchParams }: PageProps) {
  // LAPISAN 2: Proteksi Akses Server Component (Hanya Manajer)
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const params = await searchParams;
  const activeTab: TabAnalitik = (['sales', 'pelanggan', 'dormant', 'deadstock'].includes(
    params.tab || ''
  )
    ? params.tab
    : 'sales') as TabAnalitik;

  const preset = params.preset || (params.dari ? '' : '8');
  const ambang = Math.max(7, parseInt(params.ambang || '30', 10));

  // Hitung rentang tanggal (Asia/Jakarta)
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  let dari = params.dari;
  const sampai = params.sampai || todayStr;

  if (preset) {
    const weeks = parseInt(preset, 10) || 8;
    const startDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    dari = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(startDate);
  } else if (!dari) {
    const startDate = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    dari = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(startDate);
  }

  const supabase = await createServerClient();

  // Ekspor CSV Link Query
  const csvParams = new URLSearchParams();
  csvParams.set('tipe', activeTab);
  if (activeTab === 'sales' || activeTab === 'pelanggan') {
    if (dari) csvParams.set('dari', dari);
    if (sampai) csvParams.set('sampai', sampai);
  } else {
    csvParams.set('ambang', ambang.toString());
  }

  let salesData: PerformaSalesItem[] = [];
  let topPelangganData: TopPelangganItem[] = [];
  let dormantData: PelangganTidakAktifItem[] = [];
  let deadstockData: BarangTidakBergerakItem[] = [];

  if (activeTab === 'sales') {
    const { data } = await supabase.rpc('rpc_analitik_performa_sales', {
      p_dari: dari,
      p_sampai: sampai,
    });
    salesData = (data || []) as PerformaSalesItem[];
  } else if (activeTab === 'pelanggan') {
    const { data } = await supabase.rpc('rpc_analitik_top_pelanggan', {
      p_dari: dari,
      p_sampai: sampai,
      p_limit: 20,
    });
    topPelangganData = (data || []) as TopPelangganItem[];
  } else if (activeTab === 'dormant') {
    const { data } = await supabase.rpc('rpc_analitik_pelanggan_tidak_aktif', {
      p_ambang_hari: ambang,
    });
    dormantData = (data || []) as PelangganTidakAktifItem[];
  } else if (activeTab === 'deadstock') {
    const { data } = await supabase.rpc('rpc_analitik_barang_tidak_bergerak', {
      p_ambang_hari: ambang,
    });
    deadstockData = (data || []) as BarangTidakBergerakItem[];
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analitik Pelanggan & Performa Sales"
        description="Evaluasi produktivitas sales, kontribusi pelanggan utama, akun pasif, dan modal tertahan pada persediaan tidak bergerak."
        action={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 shadow-none border-slate-200"
          >
            <Link href={`/api/analitik/csv?${csvParams.toString()}`}>
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV
            </Link>
          </Button>
        }
      />

      {/* Tabs Navigasi */}
      <AnalitikTabs activeTab={activeTab} />

      {/* Filter Bar */}
      <FilterBar
        tab={activeTab}
        preset={preset}
        dari={dari}
        sampai={sampai}
        ambang={ambang}
      />

      {/* Konten Tab Aktif */}
      {activeTab === 'sales' && <PerformaSalesView data={salesData} />}
      {activeTab === 'pelanggan' && <TopPelangganView data={topPelangganData} />}
      {activeTab === 'dormant' && <PelangganTidakAktifView data={dormantData} ambang={ambang} />}
      {activeTab === 'deadstock' && <BarangTidakBergerakView data={deadstockData} ambang={ambang} />}
    </div>
  );
}
