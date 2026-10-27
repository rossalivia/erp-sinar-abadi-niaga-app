import * as React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, ReceiptText } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { PeriodePicker } from '@/features/laporan/components/periode-picker';
import { KpiCards } from '@/features/laporan/components/kpi-cards';
import { GrafikMingguan } from '@/features/laporan/components/grafik-mingguan';
import { TopBarangTable } from '@/features/laporan/components/top-barang-table';
import { BottomBarangTable } from '@/features/laporan/components/bottom-barang-table';
import { TopPelangganTable } from '@/features/laporan/components/top-pelanggan-table';
import type {
  BottomBarangItem,
  LaporanMarginMingguanItem,
  LaporanRingkasan,
  TopBarangItem,
  TopPelangganItem,
} from '@/features/laporan/types';

interface PageProps {
  searchParams: Promise<{
    preset?: string;
    dari?: string;
    sampai?: string;
  }>;
}

export default async function LaporanOmzetMarginPage({ searchParams }: PageProps) {
  const profil = await getProfil();

  // Lapis 2: Pemeriksaan Otorisasi Server Component
  if (!profil || profil.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const params = await searchParams;
  const preset = params.preset || (params.dari ? '' : '8');

  // Hitung tanggal rentang (default 27 Oktober 2026)
  const systemDateOverride = process.env.SYSTEM_DATE || process.env.NEXT_PUBLIC_SYSTEM_DATE || '2026-10-27T21:45:00+07:00';
  const now = systemDateOverride ? new Date(systemDateOverride) : new Date();
  const todayStr = '2026-10-27';

  let dari = params.dari;
  const sampai = params.sampai || todayStr;

  if (preset) {
    const weeks = parseInt(preset, 10) || 8;
    const startDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    dari = startDate.toISOString().split('T')[0];
  } else if (!dari) {
    const startDate = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    dari = startDate.toISOString().split('T')[0];
  }

  const supabase = await createServerClient();

  // Ambil data laporan secara paralel via RPC
  const [marginRes, ringkasanRes, topBarangRes, bottomBarangRes, topPelangganRes] = await Promise.all([
    supabase.rpc('rpc_laporan_margin_mingguan', { p_dari: dari, p_sampai: sampai }),
    supabase.rpc('rpc_laporan_ringkasan', { p_dari: dari, p_sampai: sampai }),
    supabase.rpc('rpc_laporan_top_barang', { p_dari: dari, p_sampai: sampai, p_limit: 10 }),
    supabase.rpc('rpc_laporan_bottom_barang', { p_dari: dari, p_sampai: sampai, p_limit: 5 }),
    supabase.rpc('rpc_laporan_top_pelanggan', { p_dari: dari, p_sampai: sampai, p_limit: 10 }),
  ]);

  const marginData = (marginRes.data || []) as LaporanMarginMingguanItem[];
  const ringkasanRaw = Array.isArray(ringkasanRes.data) ? ringkasanRes.data[0] : ringkasanRes.data;
  const ringkasan: LaporanRingkasan = {
    total_omzet: Number(ringkasanRaw?.total_omzet) || 0,
    total_hpp: Number(ringkasanRaw?.total_hpp) || 0,
    total_margin: Number(ringkasanRaw?.total_margin) || 0,
    margin_persen: Number(ringkasanRaw?.margin_persen) || 0,
    jumlah_pesanan: Number(ringkasanRaw?.jumlah_pesanan) || 0,
    pesanan_dikirim: Number(ringkasanRaw?.pesanan_dikirim) || 0,
    pesanan_lunas: Number(ringkasanRaw?.pesanan_lunas) || 0,
  };

  const topBarang = ((topBarangRes.data || []) as Record<string, unknown>[]).map((b) => ({
    barang_id: String(b.barang_id || ''),
    kode: String(b.kode || ''),
    nama: String(b.nama || ''),
    satuan: String(b.satuan || ''),
    jumlah_terjual: Number(b.jumlah_terjual) || 0,
    total_omzet: Number(b.total_omzet) || 0,
    total_hpp: Number(b.total_hpp) || 0,
    total_margin: Number(b.total_margin) || 0,
    margin_persen: Number(b.margin_persen) || 0,
  })) as TopBarangItem[];

  const bottomBarang = ((bottomBarangRes.data || []) as Record<string, unknown>[]).map((b) => ({
    barang_id: String(b.barang_id || ''),
    kode: String(b.kode || ''),
    nama: String(b.nama || ''),
    satuan: String(b.satuan || ''),
    jumlah_terjual: Number(b.jumlah_terjual) || 0,
    total_omzet: Number(b.total_omzet) || 0,
    total_hpp: Number(b.total_hpp) || 0,
    total_margin: Number(b.total_margin) || 0,
    margin_persen: Number(b.margin_persen) || 0,
  })) as BottomBarangItem[];

  const topPelanggan = ((topPelangganRes.data || []) as Record<string, unknown>[]).map((p) => ({
    pelanggan_id: String(p.pelanggan_id || ''),
    kode: String(p.kode || ''),
    nama_toko: String(p.nama_toko || ''),
    jumlah_pesanan: Number(p.jumlah_pesanan) || 0,
    total_omzet: Number(p.total_omzet) || 0,
    total_margin: Number(p.total_margin) || 0,
  })) as TopPelangganItem[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title="Laporan Keuangan & Penjualan"
        description="Analisis performa omzet, HPP, dan margin CV Sinar Abadi Niaga — Distributor Kebutuhan Toko Kelontong (Bekasi & Jakarta Timur)."
      />

      {/* Tab Navigasi Sub-Modul Laporan */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200/60 shadow-neu-inset w-fit">
        <Link
          href="/laporan"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-neu-sm"
        >
          <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
          Omzet &amp; Margin
        </Link>
        <Link
          href="/laporan/piutang"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/50 transition-colors"
        >
          <ReceiptText className="h-3.5 w-3.5" />
          Piutang Pelanggan
        </Link>
      </div>

      {/* Pemilih Periode & Ekspor CSV */}
      <PeriodePicker dari={dari} sampai={sampai} preset={preset} />

      {/* Kartu KPI */}
      <KpiCards ringkasan={ringkasan} />

      {/* Grafik Mingguan */}
      <GrafikMingguan data={marginData} />

      {/* Tabel 10 Barang Margin Terbesar & 5 Barang Margin Terkecil Berdampingan (PRD Bab 9 §3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopBarangTable items={topBarang} />
        <BottomBarangTable items={bottomBarang} />
      </div>

      {/* Tabel 10 Pelanggan dengan Omzet Terbesar */}
      <TopPelangganTable items={topPelanggan} />
    </div>
  );
}
