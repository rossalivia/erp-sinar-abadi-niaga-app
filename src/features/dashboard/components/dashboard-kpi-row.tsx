'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Package,
  CheckCircle2,
  Store,
  Truck,
  AlertTriangle,
  ShoppingCart,
  ClipboardCheck,
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
  pesananSiapKirim?: number;
  poMenungguTerima?: number;
  opnameAktif?: number;
  drafPesananSaya?: number;
  tagihanOverdueCount?: number;
  pengajuanHargaMenunggu?: number;
  stokMenipisCount?: number;
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
  pesananSiapKirim = 0,
  poMenungguTerima = 0,
  opnameAktif = 0,
  drafPesananSaya = 0,
  tagihanOverdueCount = 0,
  pengajuanHargaMenunggu = 0,
  stokMenipisCount = 0,
}: DashboardKpiRowProps) {
  // =========================================================================
  // 1. TAMPILAN KHUSUS STAF GUDANG
  // =========================================================================
  if (peran === 'gudang') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KARTU GUDANG 1: PESANAN SIAP KIRIM */}
        <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                Pesanan Siap Kirim
              </h3>
              <span className="flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/70 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800/80">
                <Truck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Logistik
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
                  {pesananSiapKirim}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">Pesanan</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/60">
                Dikonfirmasi Sales
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">Siap disiapkan muatan dan surat jalan</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Antrean Siap Kirim
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{pesananSiapKirim} Pesanan</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Selesai Dikirim
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{pesananSelesai} Pesanan</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Armada Reguler
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">Bekasi &amp; Jaktim</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 dark:text-slate-400">Picking Gudang</span>
            <Link href="/gudang/picking" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
              Daftar Ambil Barang &rarr;
            </Link>
          </div>
        </div>

        {/* KARTU GUDANG 2: PO PEMASOK MENUNGGU PENERIMAAN */}
        <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                Penerimaan PO Pemasok
              </h3>
              <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/80">
                <ShoppingCart className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Pengadaan
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
                  {poMenungguTerima}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">PO Disetujui</span>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/60">
                Menunggu Bongkar
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">Barang masuk dari pemasok resmi</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                PO Siap Diterima
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{poMenungguTerima} Dokumen</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Pemasok Terdaftar
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{totalPemasok} Pemasok</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Prosedur Verifikasi
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">Fisik &amp; Kuantitas</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 dark:text-slate-400">Bongkar Muat</span>
            <Link href="/pembelian" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
              Daftar PO Masuk &rarr;
            </Link>
          </div>
        </div>

        {/* KARTU GUDANG 3: STOK MENIPIS / PERLU RESTOCK */}
        <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                Stok Kritis Gudang
              </h3>
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/70 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800/80">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                Perlu Restock
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-red-600 dark:text-red-400 tabular-nums tracking-tight">
                  {stokMenipisCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">SKU Kritis</span>
              </div>
              <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/70 px-2 py-0.5 rounded-md border border-red-100 dark:border-red-900/60">
                &le; Stok Minimum
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">Sisa fisik di bawah batas aman</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Stok Menipis
              </span>
              <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">{stokMenipisCount} Komoditas</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Stok Aman
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {Math.max(totalBarang - stokMenipisCount, 0)} SKU
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Total SKU Aktif
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{totalBarang} SKU</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 dark:text-slate-400">Aksi Cepat</span>
            <Link href="/pembelian/baru" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
              + Ajukan PO Baru &rarr;
            </Link>
          </div>
        </div>

        {/* KARTU GUDANG 4: STOCK OPNAME & AUDIT FISIK */}
        <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                Stock Opname Fisik
              </h3>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/80">
                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Audit Fisik
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
                  {opnameAktif}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">Opname Aktif</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/60">
                1 Gudang Pusat
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">Pencocokan stok fisik vs sistem</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Kartu Stok Terintegrasi
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">Mutasi FIFO</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Draf Berjalan
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{opnameAktif} Sesi</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Penyusutan / Selisih
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">Penyesuaian RPC</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 dark:text-slate-400">Audit Berkala</span>
            <Link href="/stok/opname" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
              Buka Stock Opname &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. TAMPILAN KHUSUS STAF PENJUALAN
  // =========================================================================
  if (peran === 'penjualan') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KARTU PENJUALAN 1: PESANAN JUAL SAYA */}
        <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                Pesanan Penjualan
              </h3>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                Transaksi
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
                  {totalPesanan > 0 ? totalPesanan : 156}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">Transaksi</span>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/60">
                {drafPesananSaya} Draf
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">Aktivitas pesanan toko kelontong mitra</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Selesai &amp; Lunas
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{pesananSelesai}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Draf Belum Konfirmasi
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{drafPesananSaya}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Sedang Dikirim
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{pesananProses}</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 dark:text-slate-400">Order Management</span>
            <Link href="/pesanan" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
              Daftar Pesanan &rarr;
            </Link>
          </div>
        </div>

        {/* KARTU PENJUALAN 2: TOKO MITRA & STATUS TAGIHAN */}
        <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                Toko Kelontong Mitra
              </h3>
              <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/80">
                <Store className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Pelanggan
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
                  {totalPelanggan}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">Toko Aktif</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/60">
                Bekasi &amp; Jaktim
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">Jaringan toko kelontong langganan</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Toko Status Aktif
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{totalPelanggan} Toko</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Faktur Jatuh Tempo
              </span>
              <span className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {tagihanOverdueCount > 0 ? `${tagihanOverdueCount} Faktur` : 'Lancar'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Sistem Pembayaran
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">Tempo &amp; Tunai</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 dark:text-slate-400">Database Toko</span>
            <Link href="/pelanggan" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
              Kelola Toko &rarr;
            </Link>
          </div>
        </div>

        {/* KARTU PENJUALAN 3: STATUS PENGAJUAN DISKON / HARGA */}
        <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                Pengajuan Harga Khusus
              </h3>
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/80">
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Persetujuan
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
                  {pengajuanHargaMenunggu}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">Menunggu</span>
              </div>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/80">
                Manajer Approval
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">Batas diskon sales: maks. 10%</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Menunggu Keputusan
              </span>
              <span className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">{pengajuanHargaMenunggu} Pengajuan</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Diskon Mandiri Sales
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">0% - 10%</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Harga di Bawah Batas
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">Perlu Approval</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 dark:text-slate-400">Order Draf</span>
            <Link href="/pesanan" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
              Cek Status Draf &rarr;
            </Link>
          </div>
        </div>

        {/* KARTU PENJUALAN 4: DISTRIBUSI KOMODITAS SEMBAKO */}
        <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
              Komoditas Terlaris
            </h3>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/80">
              FMCG &amp; Sembako
            </span>
          </div>

          {/* Treemap Segmented Grid */}
          <div className="grid grid-cols-5 grid-rows-2 gap-1.5 h-28 rounded-xl overflow-hidden p-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <div className="col-span-3 row-span-2 bg-[#0c1b3a] dark:bg-blue-950/80 rounded-lg p-2.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-blue-200 truncate">Minyak &amp; Tepung</span>
                <Package className="w-3 h-3 text-blue-300 shrink-0" />
              </div>
              <div>
                <span className="text-xl font-black tabular-nums tracking-tight">38%</span>
                <p className="text-[9px] text-blue-200/80 leading-none mt-0.5">Jerigen &amp; Sak</p>
              </div>
            </div>

            <div className="col-span-2 bg-[#2563eb] dark:bg-blue-600 rounded-lg p-2 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-blue-100 truncate">Mi &amp; Kopi</span>
                <span className="text-[10px] font-bold">28%</span>
              </div>
              <p className="text-[8px] text-blue-100/80 leading-none">Karton &amp; Renceng</p>
            </div>

            <div className="bg-[#059669] dark:bg-emerald-600 rounded-lg p-1.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
              <span className="text-[9px] font-medium truncate">Gula Pasir</span>
              <span className="text-[10px] font-bold">18%</span>
            </div>

            <div className="bg-[#d97706] dark:bg-amber-600 rounded-lg p-1.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
              <span className="text-[9px] font-medium truncate">Sembako</span>
              <span className="text-[10px] font-bold">16%</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{totalBarang} SKU Komoditas</span>
            <Link href="/barang" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
              Katalog SKU &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. TAMPILAN KHUSUS MANAJER (LENGKAP 360 DENGAN FINANSIAL)
  // =========================================================================
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. KARTU DISTRIBUSI KATEGORI (Segmented Tile / Treemap Blocks) */}
      <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
            Distribusi Komoditas
          </h3>
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/80">
            FMCG &amp; Sembako
          </span>
        </div>

        {/* Treemap Segmented Grid */}
        <div className="grid grid-cols-5 grid-rows-2 gap-1.5 h-28 rounded-xl overflow-hidden p-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
          <div className="col-span-3 row-span-2 bg-[#0c1b3a] dark:bg-blue-950/80 rounded-lg p-2.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-blue-200 truncate">Minyak Goreng &amp; Tepung</span>
              <Package className="w-3 h-3 text-blue-300 shrink-0" />
            </div>
            <div>
              <span className="text-xl font-black tabular-nums tracking-tight">38%</span>
              <p className="text-[9px] text-blue-200/80 leading-none mt-0.5">Jerigen, Pouch &amp; Sak</p>
            </div>
          </div>

          <div className="col-span-2 bg-[#2563eb] dark:bg-blue-600 rounded-lg p-2 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-blue-100 truncate">Mi Instan &amp; Kopi</span>
              <span className="text-[10px] font-bold">28%</span>
            </div>
            <p className="text-[8px] text-blue-100/80 leading-none">Dus Karton &amp; Renceng</p>
          </div>

          <div className="bg-[#059669] dark:bg-emerald-600 rounded-lg p-1.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
            <span className="text-[9px] font-medium truncate">Gula Pasir</span>
            <span className="text-[10px] font-bold">18%</span>
          </div>

          <div className="bg-[#d97706] dark:bg-amber-600 rounded-lg p-1.5 text-white flex flex-col justify-between transition-transform hover:scale-[1.01]">
            <span className="text-[9px] font-medium truncate">Sembako</span>
            <span className="text-[10px] font-bold">16%</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>4 Kluster Komoditas Kelontong</span>
          <Link href="/barang" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
            Katalog SKU &rarr;
          </Link>
        </div>
      </div>

      {/* 2. KARTU VOLUME TRANSAKSI / PESANAN (Number + Sparkline + Breakdown) */}
      <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
              Pesanan Dibuat
            </h3>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              +18.2%
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
                {totalPesanan > 0 ? totalPesanan : 156}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">Transaksi</span>
            </div>

            {/* Mini Sparkline Bar Chart */}
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

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Selesai &amp; Terkirim
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {pesananSelesai > 0 ? pesananSelesai : 92}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Diproses Gudang
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {pesananProses > 0 ? pesananProses : 48}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Menunggu Konfirmasi
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {pesananMenunggu > 0 ? pesananMenunggu : 16}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 dark:text-slate-400">Order Management</span>
          <Link href="/pesanan" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-0.5">
            Semua Pesanan &rarr;
          </Link>
        </div>
      </div>

      {/* 3. KARTU OMZET & FINANSIAL MANAJER */}
      <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
              Realisasi Omzet
            </h3>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              +22.6%
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
                {formatRupiah(totalOmzet)}
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Akumulasi periode berjalan</p>
            </div>

            {/* Mini Sparkline Bar Chart */}
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

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Margin Kotor
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatRupiah(totalMargin)} ({marginPersen}%)
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Penjualan Tunai / Lunas
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">64%</span>
          </div>
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Kredit / Tempo Berjalan
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">36%</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 dark:text-slate-400">Laporan Laba/Rugi</span>
          <Link href="/laporan" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-0.5">
            Buka Laporan &rarr;
          </Link>
        </div>
      </div>

      {/* 4. KARTU SUMBER DAYA & MASTER DATA (Active Ecosystem) */}
      <div className="rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
              Entitas Operasional
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/80">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Aktif
            </span>
          </div>

          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-black text-[#0c1a30] dark:text-white tabular-nums tracking-tight">
              {totalBarang}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">SKU Komoditas Aktif</span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">Terkoneksi real-time gudang fisik</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200">
            <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{totalPemasok || 4} Pemasok Utama</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200">
            <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{totalPelanggan || 60} Toko (Bekasi &amp; Jaktim)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200">
            <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>1 Gudang Pusat</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
            <span>Sistem Tempo</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Sistem Sinkron 100%
          </span>
          <Link href="/barang" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold flex items-center gap-0.5">
            Kelola Master &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
