import * as React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, ReceiptText, Download } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { PiutangAgingCards } from '@/features/laporan/components/piutang-aging-cards';
import { PiutangPelangganTable } from '@/features/laporan/components/piutang-pelanggan-table';
import { PiutangPesananTable } from '@/features/laporan/components/piutang-pesanan-table';
import type {
  LaporanAgingPiutang,
  LaporanPiutangPelangganItem,
  LaporanPiutangPesananItem,
} from '@/features/laporan/types';

export default async function LaporanPiutangPage() {
  const profil = await getProfil();

  // Lapis 2: Pemeriksaan Otorisasi Server Component
  if (!profil || profil.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();

  // Ambil data laporan piutang secara paralel
  const [agingRes, piutangRes, pesananRes] = await Promise.all([
    supabase.rpc('rpc_laporan_aging_piutang'),
    supabase.rpc('rpc_laporan_piutang'),
    supabase.rpc('rpc_laporan_piutang_pesanan'),
  ]);

  const agingRaw = Array.isArray(agingRes.data) ? agingRes.data[0] : agingRes.data;
  const aging: LaporanAgingPiutang = {
    total_piutang_berjalan: Number(agingRaw?.total_piutang_berjalan ?? agingRaw?.total_piutang_dikirim) || 0,
    total_piutang_dikirim: Number(agingRaw?.total_piutang_dikirim ?? agingRaw?.total_piutang_berjalan) || 0,
    belum_jatuh_tempo: Number(agingRaw?.belum_jatuh_tempo) || 0,
    lewat_1_30_hari: Number(agingRaw?.lewat_1_30_hari ?? (Number(agingRaw?.lewat_1_7_hari || 0) + Number(agingRaw?.lewat_8_30_hari || 0))) || 0,
    lewat_gt_30_hari: Number(agingRaw?.lewat_gt_30_hari) || 0,
    jumlah_pesanan_lewat_tempo: Number(agingRaw?.jumlah_pesanan_lewat_tempo) || 0,
    total_pesanan: Number(agingRaw?.total_pesanan ?? agingRaw?.total_pesanan_dikirim) || 0,
    total_pesanan_dikirim: Number(agingRaw?.total_pesanan_dikirim ?? agingRaw?.total_pesanan) || 0,
    lewat_1_7_hari: Number(agingRaw?.lewat_1_7_hari) || 0,
    lewat_8_30_hari: Number(agingRaw?.lewat_8_30_hari) || 0,
  };

  const pelangganList = ((piutangRes.data || []) as Record<string, unknown>[]).map((p) => {
    const batasKredit = Number(p.batas_kredit) || 0;
    const totalPiutang = Number(p.total_piutang) || 0;
    return {
      pelanggan_id: String(p.pelanggan_id || ''),
      kode: String(p.kode || ''),
      nama_toko: String(p.nama_toko || ''),
      batas_kredit: batasKredit,
      termin_hari: Number(p.termin_hari) || 0,
      total_piutang: totalPiutang,
      piutang_belum_jatuh_tempo: Number(p.piutang_belum_jatuh_tempo) || 0,
      piutang_lewat_1_30: Number(p.piutang_lewat_1_30) || 0,
      piutang_lewat_gt_30: Number(p.piutang_lewat_gt_30) || 0,
      piutang_lewat_jatuh_tempo: Number(p.piutang_lewat_jatuh_tempo) || 0,
      ada_lewat_jatuh_tempo: Boolean(p.ada_lewat_jatuh_tempo),
      sisa_kredit: batasKredit - totalPiutang,
    };
  }) as LaporanPiutangPelangganItem[];

  const pesananList = ((pesananRes.data || []) as Record<string, unknown>[]).map((ps) => ({
    pesanan_id: String(ps.pesanan_id || ''),
    nomor: String(ps.nomor || ''),
    pelanggan_id: String(ps.pelanggan_id || ''),
    nama_toko: String(ps.nama_toko || ''),
    telepon: String(ps.telepon || ''),
    total: Number(ps.total) || 0,
    dikirim_pada: String(ps.dikirim_pada || ''),
    jatuh_tempo: String(ps.jatuh_tempo || ''),
    hari_lewat: Number(ps.hari_lewat) || 0,
    kategori_aging: (ps.kategori_aging || 'belum_jatuh_tempo') as LaporanPiutangPesananItem['kategori_aging'],
  })) as LaporanPiutangPesananItem[];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader
          title="Laporan Piutang & Aging Tagihan"
          description="Monitoring piutang toko kelontong mitra, analisis umur tagihan, dan pelunasan tempo — CV Sinar Abadi Niaga (Bekasi & Jakarta Timur)."
        />
        <a
          href="/api/laporan/piutang/csv"
          target="_blank"
          rel="noopener noreferrer"
          className="self-start sm:self-auto"
        >
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-3 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            Ekspor CSV Piutang
          </Button>
        </a>
      </div>

      {/* Tab Navigasi Sub-Modul Laporan */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200/60 shadow-neu-inset w-fit">
        <Link
          href="/laporan"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/50 transition-colors"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Omzet &amp; Margin
        </Link>
        <Link
          href="/laporan/piutang"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-neu-sm"
        >
          <ReceiptText className="h-3.5 w-3.5 text-indigo-600" />
          Piutang Pelanggan
        </Link>
      </div>

      {/* Ringkasan Aging Piutang */}
      <PiutangAgingCards aging={aging} />

      {/* Tabel Status Piutang per Pelanggan */}
      <PiutangPelangganTable items={pelangganList} />

      {/* Tabel Daftar Pesanan Belum Lunas dengan Tombol Catat Pelunasan */}
      <PiutangPesananTable items={pesananList} />
    </div>
  );
}
