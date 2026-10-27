'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  CloudSun,
  Plus,
  ShoppingCart,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTanggal } from '@/lib/format';
import type { UserProfile } from '@/types/auth';
import { LogoIcon } from '@/components/ui/logo';
import {
  ClipboardList,
  FileSpreadsheet,
  Users,
  ReceiptText,
} from 'lucide-react';

export interface DashboardHeroBannerProps {
  user: UserProfile | null;
  totalPesanan?: number;
  totalPelanggan?: number;
  stokMenipisCount?: number;
  pesananSiapKirimCount?: number;
  poMenungguPenerimaanCount?: number;
  drafPesananCount?: number;
  pengajuanHargaMenungguCount?: number;
}

function getGreetingWIB(): string {
  try {
    const now = new Date();
    const hourStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      hour12: false,
    }).format(now);
    const hour = parseInt(hourStr, 10) || now.getHours();

    if (hour >= 4 && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  } catch {
    return 'Selamat Datang';
  }
}

function getTanggalPanjangWIB(): string {
  try {
    const now = new Date();
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  } catch {
    return formatTanggal(new Date());
  }
}

export function DashboardHeroBanner({
  user,
  totalPesanan = 156,
  totalPelanggan = 60,
  stokMenipisCount = 0,
  pesananSiapKirimCount = 0,
  poMenungguPenerimaanCount = 0,
  drafPesananCount = 0,
  pengajuanHargaMenungguCount = 0,
}: DashboardHeroBannerProps) {
  // Hitung sapaan dan tanggal secara sinkron
  const [sapaan] = React.useState(getGreetingWIB);
  const [tanggalText] = React.useState(getTanggalPanjangWIB);

  const namaUser = user?.nama_lengkap || 'Pengguna ERP';
  const peran = user?.peran || 'penjualan';

  // Peran label display
  const peranLabel =
    peran === 'manajer'
      ? 'Manajer Utama'
      : peran === 'gudang'
      ? 'Staf Gudang & Logistik'
      : 'Staf Penjualan';

  const deskripsiKonteks =
    peran === 'manajer'
      ? 'Berikut pantauan komprehensif profitabilitas margin, arus piutang toko kelontong, dan operasional rantai pasok CV Sinar Abadi Niaga hari ini.'
      : peran === 'gudang'
      ? 'Berikut pantauan fisik stok gudang pusat, antrean pesanan siap kirim armada, dan jadwal penerimaan pasokan bahan pokok hari ini.'
      : 'Berikut pantauan aktivitas penjualan, penagihan jatuh tempo toko mitra, dan pengelolaan pesanan sembako Anda hari ini.';

  const aiSummaryText =
    peran === 'gudang'
      ? `${pesananSiapKirimCount} pesanan siap kirim muatan truk. ${poMenungguPenerimaanCount} PO pemasok menunggu terima, dan ${stokMenipisCount} SKU stok menipis.`
      : peran === 'penjualan'
      ? stokMenipisCount > 0
        ? `${stokMenipisCount} SKU menipis. Melayani ${totalPelanggan} toko kelontong aktif (${drafPesananCount} draf pesanan, ${pengajuanHargaMenungguCount} pengajuan harga).`
        : `Semua SKU aman. Melayani ${totalPelanggan} toko kelontong aktif (${drafPesananCount} draf pesanan berjalan).`
      : stokMenipisCount > 0
      ? `${stokMenipisCount} SKU stok menipis perlu PO. Rantai distribusi melayani ${totalPelanggan} toko aktif (${totalPesanan} transaksi).`
      : `Semua 48 SKU aman. Rantai distribusi melayani ${totalPelanggan} toko kelontong aktif lancar (${totalPesanan} total transaksi).`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d6e4f5] dark:border-slate-800 bg-gradient-to-br from-white via-[#f6faff] to-[#eaf3fd] dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-800/80 p-5 sm:p-6 shadow-sm flex-1 flex flex-col justify-between">
      {/* Background Decorative Graphic Elements */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-100/40 dark:bg-blue-900/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 right-1/4 h-56 w-56 rounded-full bg-sky-100/30 dark:bg-sky-900/10 blur-2xl" />

      {/* Top Section: Greeting & Meta Badges */}
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0c1b3a] text-white shadow-xs">
            <LogoIcon size={18} inverted />
            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs font-bold text-white tracking-tight">
                CV Sinar Abadi Niaga
              </span>
              <span className="text-[10px] text-slate-300 font-medium">
                Distributor Kebutuhan Toko Kelontong
              </span>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100/80 dark:bg-blue-950/80 text-[#1e40af] dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase font-mono tracking-wider">
            {peranLabel}
          </span>
        </div>

        {/* Big Greeting Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0c1a30] dark:text-white tracking-tight flex items-center gap-2">
          <span>{sapaan}, {namaUser}!</span>
          <span className="inline-block animate-bounce origin-bottom-right">👋</span>
        </h1>

        {/* Company Context Description */}
        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
          {deskripsiKonteks}
        </p>

        {/* Meta Info Bar: Date, Weather, Live Status */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
          {/* Tanggal */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#dce7f5] dark:border-slate-700 shadow-2xs text-slate-700 dark:text-slate-200 font-medium">
            <CalendarIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{tanggalText}</span>
          </div>

          {/* Cuaca */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-[#dce7f5] dark:border-slate-700 shadow-2xs text-slate-700 dark:text-slate-200 font-medium">
            <CloudSun className="w-3.5 h-3.5 text-amber-500" />
            <span>28&deg;C Sebagian Berawan &bull; Bekasi</span>
          </div>

          {/* Live Data Pulse */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs text-emerald-800 dark:text-emerald-300 font-semibold text-[11px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            <span>Data Sistem Real-Time</span>
          </div>
        </div>
      </div>

      {/* Middle/Bottom Grid: AI ERP Operational Insights + Quick Actions */}
      <div className="relative z-10 mt-5 pt-4 border-t border-[#e2ebf6]/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* AI Operational Health Card (BuildAxis AI Insights style) */}
        <div className="flex items-center gap-3.5 p-3 bg-white/80 dark:bg-slate-800/90 backdrop-blur-xs rounded-xl border border-[#dce7f5] dark:border-slate-700 shadow-2xs max-w-xl">
          {/* Circular Score Gauge */}
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-[#f0f6ff] dark:bg-slate-900 border-2 border-blue-500 shrink-0">
            <div className="text-center leading-none">
              <span className="text-sm font-black text-[#0c1a30] dark:text-white">
                {peran === 'gudang' ? '96' : peran === 'penjualan' ? '92' : '94'}
              </span>
              <span className="block text-[8px] font-bold text-slate-400 dark:text-slate-400">/100</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-[#0c1a30] dark:text-slate-100">
                {peran === 'gudang'
                  ? 'Kesiapan Logistik: Siap Muat'
                  : peran === 'penjualan'
                  ? 'Target Toko: Aktif Berjalan'
                  : 'Kesehatan Operasional: Prima'}
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded font-semibold border border-emerald-200 dark:border-emerald-800/80">
                Stabil
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {aiSummaryText}
            </p>
          </div>

          <Link
            href="/pusat-tugas"
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors shrink-0 pl-1"
          >
            Pusat Tugas
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Quick Action Buttons per Role */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {peran === 'penjualan' && (
            <>
              <Button
                asChild
                size="sm"
                className="h-9 px-3.5 text-xs bg-[#0c1b3a] hover:bg-[#152a54] text-white rounded-xl shadow-xs gap-1.5 font-medium transition-all"
              >
                <Link href="/pesanan/baru">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pesanan Jual</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs bg-white border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl gap-1.5 font-medium shadow-2xs transition-all"
              >
                <Link href="/pelanggan/baru">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Toko Baru</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-50 rounded-xl gap-1.5 font-medium shadow-2xs transition-all"
              >
                <Link href="/penagihan">
                  <ReceiptText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Penagihan</span>
                </Link>
              </Button>
            </>
          )}

          {peran === 'gudang' && (
            <>
              <Button
                asChild
                size="sm"
                className="h-9 px-3.5 text-xs bg-[#0c1b3a] hover:bg-[#152a54] text-white rounded-xl shadow-xs gap-1.5 font-medium transition-all"
              >
                <Link href="/gudang/picking">
                  <ClipboardList className="w-3.5 h-3.5 text-sky-300" />
                  <span>Ambil Barang</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs bg-white border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl gap-1.5 font-medium shadow-2xs transition-all"
              >
                <Link href="/pembelian/baru">
                  <ShoppingCart className="w-3.5 h-3.5 text-slate-600" />
                  <span>+ Ajukan PO</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs bg-white border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl gap-1.5 font-medium shadow-2xs transition-all"
              >
                <Link href="/stok/opname">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Stock Opname</span>
                </Link>
              </Button>
            </>
          )}

          {peran === 'manajer' && (
            <>
              <Button
                asChild
                size="sm"
                className="h-9 px-3.5 text-xs bg-[#0c1b3a] hover:bg-[#152a54] text-white rounded-xl shadow-xs gap-1.5 font-medium transition-all"
              >
                <Link href="/pesanan/baru">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pesanan Jual</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs bg-white border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl gap-1.5 font-medium shadow-2xs transition-all"
              >
                <Link href="/pembelian/baru">
                  <ShoppingCart className="w-3.5 h-3.5 text-slate-600" />
                  <span>+ Ajukan PO</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100 rounded-xl gap-1.5 font-medium shadow-2xs transition-all"
              >
                <Link href="/laporan">
                  <span>Laporan Bisnis &rarr;</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
