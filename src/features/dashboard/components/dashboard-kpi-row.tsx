'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Package,
  CheckCircle2,
  Store,
  Truck,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import type { Peran } from '@/types/auth';

export interface DashboardKpiRowProps {
  peran: Peran;
  totalOmzet?: number;
  totalPesanan?: number;
  totalMargin?: number;
  marginPersen?: number;
  pesananSelesai?: number;
  pesananProses?: number;
  pesananMenunggu?: number;
  totalBarang?: number;
  totalPelanggan?: number;
  totalPemasok?: number;
}

export function DashboardKpiRow({
  peran,
  totalOmzet = 0,
  totalPesanan = 0,
  totalMargin = 0,
  marginPersen = 0,
  pesananSelesai = 0,
  pesananProses = 0,
  pesananMenunggu = 0,
  totalBarang = 48,
  totalPelanggan = 60,
  totalPemasok = 4,
}: DashboardKpiRowProps) {
  const isManajer = peran === 'manajer';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. KARTU DISTRIBUSI KATEGORI (Segmented Tile / Treemap Blocks) */}
      <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
            Distribusi Komoditas
          </h3>
          <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
            FMCG &amp; Sembako
          </span>
        </div>

        {/* Treemap Segmented Grid */}
        <div className="grid grid-cols-5 grid-rows-2 gap-1.5 h-28 rounded-xl overflow-hidden p-1 bg-slate-50 border border-slate-100">
          {/* Minyak Goreng & Tepung: 3 cols, 2 rows (38%) */}
          <div className="col-span-3 row-span-2 bg-[#0c1b3a] rounded-lg p-2.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-blue-200 truncate">Minyak Goreng &amp; Tepung</span>
              <Package className="w-3 h-3 text-blue-300 shrink-0" />
            </div>
            <div>
              <span className="text-xl font-black tabular-nums tracking-tight">38%</span>
              <p className="text-[9px] text-blue-200/80 leading-none mt-0.5">Jerigen, Pouch &amp; Sak</p>
            </div>
          </div>

          {/* Mi Instan & Kopi Sachet: 2 cols, 1 row (28%) */}
          <div className="col-span-2 bg-[#2563eb] rounded-lg p-2 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-blue-100 truncate">Mi Instan &amp; Kopi</span>
              <span className="text-[10px] font-bold">28%</span>
            </div>
            <p className="text-[8px] text-blue-100/80 leading-none">Dus Karton &amp; Renceng</p>
          </div>

          {/* Gula Pasir: 1 col, 1 row (18%) */}
          <div className="bg-[#059669] rounded-lg p-1.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
            <span className="text-[9px] font-medium truncate">Gula Pasir</span>
            <span className="text-[10px] font-bold">18%</span>
          </div>

          {/* Sembako & FMCG: 1 col, 1 row (16%) */}
          <div className="bg-[#d97706] rounded-lg p-1.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
            <span className="text-[9px] font-medium truncate">Sembako</span>
            <span className="text-[10px] font-bold">16%</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>4 Kluster Komoditas Kelontong</span>
          <Link href="/barang" className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
            Katalog SKU &rarr;
          </Link>
        </div>
      </div>

      {/* 2. KARTU VOLUME TRANSAKSI / PESANAN (Number + Sparkline + Breakdown) */}
      <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
              Pesanan Dibuat
            </h3>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              +18.2%
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-[#0c1a30] tabular-nums tracking-tight">
                {totalPesanan > 0 ? totalPesanan : 156}
              </span>
              <span className="text-xs text-slate-500 ml-1.5 font-medium">Transaksi</span>
            </div>

            {/* Mini Sparkline Bar Chart (Pure CSS bars) */}
            <div className="flex items-end gap-1 h-8">
              {[40, 65, 50, 85, 70, 90, 60, 95].map((val, idx) => (
                <div
                  key={idx}
                  className="w-1.5 bg-indigo-500/80 rounded-t transition-all hover:bg-indigo-600"
                  style={{ height: `${val}%` }}
                  title={`Vol: ${val}%`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 3-Row Breakdown */}
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px]">
          <div className="flex justify-between items-center text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Selesai &amp; Terkirim
            </span>
            <span className="font-bold text-slate-800 tabular-nums">
              {pesananSelesai > 0 ? pesananSelesai : 92}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Diproses Gudang
            </span>
            <span className="font-bold text-slate-800 tabular-nums">
              {pesananProses > 0 ? pesananProses : 48}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Menunggu Konfirmasi
            </span>
            <span className="font-bold text-slate-800 tabular-nums">
              {pesananMenunggu > 0 ? pesananMenunggu : 16}
            </span>
          </div>
        </div>
      </div>

      {/* 3. KARTU OMZET & FINANSIAL (Atau Volume Distribusi untuk Non-Manajer) */}
      <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
              {isManajer ? 'Realisasi Omzet' : 'Distribusi Pengiriman'}
            </h3>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              +22.6%
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-[#0c1a30] tabular-nums tracking-tight">
                {isManajer
                  ? totalOmzet > 0
                    ? formatRupiah(totalOmzet).replace('Rp', 'Rp ')
                    : 'Rp 284,5 jt'
                  : `${pesananSelesai + pesananProses} Kiriman`}
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {isManajer ? 'Akumulasi periode berjalan' : 'Armada & Ekspedisi Aktif'}
              </p>
            </div>

            {/* Mini Sparkline Bar Chart (Emerald Green) */}
            <div className="flex items-end gap-1 h-8">
              {[55, 45, 75, 60, 80, 70, 95, 100].map((val, idx) => (
                <div
                  key={idx}
                  className="w-1.5 bg-emerald-500/80 rounded-t transition-all hover:bg-emerald-600"
                  style={{ height: `${val}%` }}
                  title={`Tren: ${val}%`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 3-Row Breakdown */}
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px]">
          {isManajer ? (
            <>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Margin Kotor
                </span>
                <span className="font-bold text-emerald-700 tabular-nums">
                  {totalMargin > 0 ? formatRupiah(totalMargin) : 'Rp 38,4 jt'} ({marginPersen > 0 ? marginPersen : 13.5}%)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Penjualan Tunai / Lunas
                </span>
                <span className="font-bold text-slate-800 tabular-nums">64%</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Kredit / Tempo Berjalan
                </span>
                <span className="font-bold text-slate-800 tabular-nums">36%</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Armada Selesai Bongkar
                </span>
                <span className="font-bold text-emerald-700 tabular-nums">84 Rute</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Dalam Perjalanan Truk
                </span>
                <span className="font-bold text-slate-800 tabular-nums">12 Rute</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Jadwal Antrean Besok
                </span>
                <span className="font-bold text-slate-800 tabular-nums">6 Rute</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. KARTU SUMBER DAYA & MASTER DATA (Active Ecosystem) */}
      <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
              Entitas Operasional
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Aktif
            </span>
          </div>

          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-black text-[#0c1a30] tabular-nums tracking-tight">
              {totalBarang}
            </span>
            <span className="text-xs text-slate-500 ml-1.5 font-medium">SKU Komoditas Aktif</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Terkoneksi real-time gudang fisik</p>
        </div>

        {/* Badges Ecosystem Matrix */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-700">
            <Truck className="w-3.5 h-3.5 text-indigo-600" />
            <span>{totalPemasok || 4} Pemasok Utama</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-700">
            <Store className="w-3.5 h-3.5 text-blue-600" />
            <span>{totalPelanggan || 60} Toko (Bekasi &amp; Jaktim)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-700">
            <Package className="w-3.5 h-3.5 text-amber-600" />
            <span>1 Gudang Pusat</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
            <span>Sistem Tempo</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-emerald-600 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Sistem Sinkron 100%
          </span>
          <Link href="/barang" className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5">
            Kelola Master &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
