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
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTanggal } from '@/lib/format';
import type { UserProfile } from '@/types/auth';

interface DashboardHeroBannerProps {
  user: UserProfile | null;
  totalPesanan?: number;
  totalPelanggan?: number;
  stokMenipisCount?: number;
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

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d6e4f5] bg-gradient-to-br from-white via-[#f6faff] to-[#eaf3fd] p-5 sm:p-6 shadow-sm flex-1 flex flex-col justify-between">
      {/* Background Decorative Graphic Elements */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-100/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 right-1/4 h-56 w-56 rounded-full bg-sky-100/30 blur-2xl" />

      {/* Top Section: Greeting & Meta Badges */}
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0c1b3a] text-white shadow-xs tracking-wide">
            <Building2 className="w-3 h-3 text-sky-400" />
            CV Sinar Abadi Niaga
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/80 text-[#1e40af] border border-blue-200 uppercase font-mono tracking-wider">
            {peranLabel}
          </span>
        </div>

        {/* Big Greeting Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0c1a30] tracking-tight flex items-center gap-2">
          <span>{sapaan}, {namaUser}!</span>
          <span className="inline-block animate-bounce origin-bottom-right">👋</span>
        </h1>

        {/* Company Context Description */}
        <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
          Berikut pantauan operasional distribusi sembako, stok gudang, dan aktivitas pesanan toko kelontong CV Sinar Abadi Niaga hari ini.
        </p>

        {/* Meta Info Bar: Date, Weather, Live Status */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
          {/* Tanggal */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#dce7f5] shadow-2xs text-slate-700 font-medium">
            <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>{tanggalText}</span>
          </div>

          {/* Cuaca */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#dce7f5] shadow-2xs text-slate-700 font-medium">
            <CloudSun className="w-3.5 h-3.5 text-amber-500" />
            <span>28&deg;C Sebagian Berawan &bull; Bekasi</span>
          </div>

          {/* Live Data Pulse */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200 shadow-2xs text-emerald-800 font-semibold text-[11px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            <span>Data Sistem Real-Time</span>
          </div>
        </div>
      </div>

      {/* Middle/Bottom Grid: AI ERP Operational Insights + Quick Actions */}
      <div className="relative z-10 mt-5 pt-4 border-t border-[#e2ebf6]/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* AI Operational Health Card (BuildAxis AI Insights style) */}
        <div className="flex items-center gap-3.5 p-3 bg-white/80 backdrop-blur-xs rounded-xl border border-[#dce7f5] shadow-2xs max-w-xl">
          {/* Circular Score Gauge */}
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-[#f0f6ff] border-2 border-blue-500 shrink-0">
            <div className="text-center leading-none">
              <span className="text-sm font-black text-[#0c1a30]">94</span>
              <span className="block text-[8px] font-bold text-slate-400">/100</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-bold text-[#0c1a30]">
                Kesehatan Operasional: Prima
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded font-semibold">
                Stabil
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              {stokMenipisCount > 0
                ? `${stokMenipisCount} SKU stok menipis perlu PO. Rantai distribusi 60 toko kelontong aktif lancar (${totalPesanan} total pesanan).`
                : `Semua 48 SKU aman. Rantai distribusi melayani ${totalPelanggan} toko kelontong aktif lancar (${totalPesanan} total pesanan).`}
            </p>
          </div>

          <Link
            href="/pusat-tugas"
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors shrink-0 pl-1"
          >
            Pusat Tugas
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {(peran === 'manajer' || peran === 'penjualan') && (
            <Button
              asChild
              size="sm"
              className="h-9 px-3.5 text-xs bg-[#0c1b3a] hover:bg-[#152a54] text-white rounded-xl shadow-xs gap-1.5 font-medium transition-all"
            >
              <Link href="/pesanan/baru">
                <Plus className="w-3.5 h-3.5" />
                <span>+ Pesanan Jual</span>
              </Link>
            </Button>
          )}

          {(peran === 'manajer' || peran === 'gudang') && (
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
          )}
        </div>
      </div>
    </div>
  );
}
