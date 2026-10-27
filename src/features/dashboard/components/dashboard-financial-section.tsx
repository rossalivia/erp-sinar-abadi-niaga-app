'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  ReceiptText,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { formatTanggal, formatRupiah } from '@/lib/format';
import type {
  LaporanRingkasan,
  LaporanAgingPiutang,
  LaporanMarginMingguanItem,
} from '@/features/laporan/types';
import type { Peran } from '@/types/auth';
import { DashboardDateFilter } from './dashboard-date-filter';
import { DashboardFinanceChart } from './dashboard-finance-chart';
import { getDashboardFinansialAction } from '../actions';
import { toast } from 'sonner';

export interface DashboardFinancialSectionProps {
  peran: Peran | string;
  initialKpi: LaporanRingkasan | null;
  initialMarginData: LaporanMarginMingguanItem[];
  initialAgingPiutang: LaporanAgingPiutang | null;
  initialPreset: string;
  initialDari: string;
  initialSampai: string;
  initialPeriodeJudul: string;
  jumlahPersetujuanMenunggu: number;
}

export function DashboardFinancialSection({
  peran,
  initialKpi,
  initialMarginData,
  initialAgingPiutang,
  initialPreset,
  initialDari,
  initialSampai,
  initialPeriodeJudul,
  jumlahPersetujuanMenunggu,
}: DashboardFinancialSectionProps) {
  const [kpiFinansial, setKpiFinansial] = React.useState<LaporanRingkasan | null>(initialKpi);
  const [marginData, setMarginData] = React.useState<LaporanMarginMingguanItem[]>(initialMarginData);
  const [agingPiutang, setAgingPiutang] = React.useState<LaporanAgingPiutang | null>(initialAgingPiutang);
  const [preset, setPreset] = React.useState(initialPreset);
  const [dari, setDari] = React.useState(initialDari);
  const [sampai, setSampai] = React.useState(initialSampai);
  const [periodeJudul, setPeriodeJudul] = React.useState(initialPeriodeJudul);
  const [isLoading, setIsLoading] = React.useState(false);

  // 1. Proteksi Akses Ketat BR-12 (Hanya Manajer yang dapat merender widget analitik finansial)
  if (peran !== 'manajer') {
    return null;
  }

  // Reaktif fetcher saat filter tanggal berubah
  const handleFilterChange = async (newPreset: string, newDari?: string, newSampai?: string) => {
    setIsLoading(true);
    try {
      const res = await getDashboardFinansialAction({
        preset: newPreset,
        dari: newDari,
        sampai: newSampai,
      });

      if (res.success && res.data) {
        setKpiFinansial(res.data.kpiFinansial);
        setMarginData(res.data.marginData);
        setAgingPiutang(res.data.agingPiutang);
        setPeriodeJudul(res.data.periodeJudul);
        setPreset(newPreset);
        setDari(res.data.dari);
        setSampai(res.data.sampai);
      } else {
        toast.error(res.message || 'Gagal memuat data finansial untuk periode tersebut.');
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan saat memperbarui data finansial.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4" aria-label="Keuangan Manajer">
      {/* Filter Tanggal Dinamis Dashboard */}
      <DashboardDateFilter
        dari={dari}
        sampai={sampai}
        preset={preset}
        periodeLabel={periodeJudul}
        onFilterChange={handleFilterChange}
        isLoading={isLoading}
      />

      {/* Header Analisis Finansial */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-[#2563eb] rounded-full" />
          <h2 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
            Analisis Finansial Mendalam — {periodeJudul}
          </h2>
          {isLoading && (
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 animate-pulse">
              (Memuat data...)
            </span>
          )}
        </div>
        <Link
          href="/laporan"
          className="text-xs font-semibold text-[#2563eb] dark:text-blue-400 hover:text-[#1d4ed8] dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          Lihat Laporan Lengkap
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Bento Grid 4 Cards */}
      <div
        className={`grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3.5 transition-opacity duration-200 ${
          isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Bento Card 1: Hero Omzet & Margin (Lebar 2 Kolom di Desktop) */}
        <div className="md:col-span-2 surface-raised rounded-2xl p-5 flex flex-col justify-between border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors duration-150">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-[#e5f0fd] dark:bg-blue-950/60 text-[#1e40af] dark:text-blue-300 border border-[#bfdbfe] dark:border-blue-900 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[#0c1a30] dark:text-slate-100">
                  Omzet &amp; Margin Kotor
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                {formatTanggal(dari)} s.d. {formatTanggal(sampai)}
              </span>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Omzet</span>
                <div className="text-2xl font-extrabold text-[#0c1a30] dark:text-slate-100 tabular-nums">
                  {formatRupiah(kpiFinansial?.total_omzet || 0)}
                </div>
              </div>

              <div className="sm:border-l sm:border-[#eef4fb] dark:sm:border-slate-800 sm:pl-6">
                <span className="text-xs text-[#1e40af] dark:text-blue-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Margin Kotor ({kpiFinansial?.margin_persen || 0}%)
                </span>
                <div className="text-2xl font-extrabold text-[#1e40af] dark:text-blue-400 tabular-nums">
                  {formatRupiah(kpiFinansial?.total_margin || 0)}
                </div>
              </div>
            </div>

            {/* Progress Bar Visual Margin */}
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span>{kpiFinansial?.jumlah_pesanan || 0} pesanan selesai</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Rasio Margin: {kpiFinansial?.margin_persen || 0}%
                </span>
              </div>
              <div className="h-2 w-full bg-[#f0f5fa] dark:bg-slate-800 rounded-full overflow-hidden border border-[#e2ebf6] dark:border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-[#2563eb] to-[#0284c7] rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Math.max(kpiFinansial?.margin_persen || 0, 0), 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bento Card 2: Total Piutang Berjalan */}
        <div className="surface-raised rounded-2xl p-5 flex flex-col justify-between border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors duration-150">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="text-[#0c1a30] dark:text-slate-200">Piutang Berjalan</span>
              <ReceiptText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="mt-2 text-xl font-extrabold text-[#0c1a30] dark:text-slate-100 tabular-nums">
              {formatRupiah(
                agingPiutang?.total_piutang_berjalan ?? agingPiutang?.total_piutang_dikirim ?? 0
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {(agingPiutang?.total_pesanan_berjalan ?? agingPiutang?.total_pesanan_dikirim) || 0} pesanan berjalan
            </p>
          </div>

          <Link
            href="/laporan/piutang"
            className="mt-3 text-xs font-semibold text-[#2563eb] dark:text-blue-400 hover:text-[#1d4ed8] dark:hover:text-blue-300 flex items-center gap-1"
          >
            Lihat aging piutang &rarr;
          </Link>
        </div>

        {/* Bento Card 3: Tagihan Lewat Tempo & Persetujuan Menunggu */}
        <div className="surface-raised rounded-2xl p-5 flex flex-col justify-between border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors duration-150">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="text-[#0c1a30] dark:text-slate-200">Tagihan Lewat Tempo</span>
              <AlertTriangle
                className={`h-4 w-4 ${
                  (agingPiutang?.jumlah_pesanan_lewat_tempo || 0) > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
            </div>
            <div
              className={`mt-2 text-xl font-extrabold tabular-nums ${
                (agingPiutang?.jumlah_pesanan_lewat_tempo || 0) > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-[#0c1a30] dark:text-slate-100'
              }`}
            >
              {agingPiutang?.jumlah_pesanan_lewat_tempo || 0}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">faktur</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {jumlahPersetujuanMenunggu} persetujuan harga menunggu
            </p>
          </div>

          <Link
            href="/persetujuan"
            className="mt-3 text-xs font-semibold text-[#92400e] dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 flex items-center gap-1"
          >
            Tinjau pengajuan &rarr;
          </Link>
        </div>
      </div>

      {/* Grafik Visual Tren Omzet & Margin Finansial Dashboard */}
      <DashboardFinanceChart
        data={marginData}
        ringkasan={kpiFinansial}
        periodeLabel={
          preset === 'hari_ini' || preset === '7h' || preset === 'minggu_ini'
            ? '8 Minggu Terakhir'
            : periodeJudul
        }
      />
    </div>
  );
}
