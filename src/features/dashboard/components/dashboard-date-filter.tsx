'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Calendar, Filter, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DashboardDateFilterProps {
  dari: string;
  sampai: string;
  preset: string;
  periodeLabel: string;
  onFilterChange?: (preset: string, dari?: string, sampai?: string) => void;
  isLoading?: boolean;
}

const PRESET_OPTIONS = [
  { id: 'hari_ini', label: 'Hari Ini' },
  { id: '7h', label: '7 Hari Terakhir' },
  { id: 'minggu_ini', label: 'Minggu Ini' },
  { id: 'bulan_ini', label: 'Bulan Ini' },
  { id: '30h', label: '30 Hari' },
];

export function DashboardDateFilter({
  dari,
  sampai,
  preset,
  periodeLabel,
  onFilterChange,
  isLoading = false,
}: DashboardDateFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [prevProps, setPrevProps] = React.useState({ dari, sampai });
  const [inputDari, setInputDari] = React.useState(dari);
  const [inputSampai, setInputSampai] = React.useState(sampai);
  const [showCustomRange, setShowCustomRange] = React.useState(
    preset === 'custom' || (!PRESET_OPTIONS.some((p) => p.id === preset) && Boolean(dari))
  );
  const [isPending, startTransition] = React.useTransition();

  // Sinkronkan input lokal jika props berubah tanpa cascading render
  if (prevProps.dari !== dari || prevProps.sampai !== sampai) {
    setPrevProps({ dari, sampai });
    setInputDari(dari);
    setInputSampai(sampai);
  }

  const handleApplyPreset = (selectedPreset: string) => {
    setShowCustomRange(false);
    if (onFilterChange) {
      onFilterChange(selectedPreset);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', selectedPreset);
    params.delete('dari');
    params.delete('sampai');

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDari || !inputSampai) return;

    if (onFilterChange) {
      onFilterChange('custom', inputDari, inputSampai);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', 'custom');
    params.set('dari', inputDari);
    params.set('sampai', inputSampai);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleResetToDefault = () => {
    setShowCustomRange(false);
    if (onFilterChange) {
      onFilterChange('bulan_ini');
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('preset');
    params.delete('dari');
    params.delete('sampai');

    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  return (
    <div className="surface-raised rounded-2xl p-3.5 sm:p-4 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3 transition-colors duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Label & Status Periode Aktif */}
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-xl bg-[#e5f0fd] dark:bg-blue-950/60 text-[#1e40af] dark:text-blue-300 flex items-center justify-center shrink-0 border border-[#bfdbfe] dark:border-blue-900">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 tracking-tight">
                Filter Jangka Waktu Dashboard
              </span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#e5f0fd] dark:bg-blue-950/60 text-[#1e40af] dark:text-blue-300 font-semibold border border-[#bfdbfe] dark:border-blue-900">
                {periodeLabel}
              </span>
              {(isPending || isLoading) && (
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 animate-pulse">
                  Memperbarui...
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pilih tanggal atau rentang waktu untuk memantau performa finansial dan transaksi.
            </p>
          </div>
        </div>

        {/* Tombol Opsi Preset Cepat */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_OPTIONS.map((opt) => {
            const isActive = preset === opt.id;
            return (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                disabled={isPending || isLoading}
                onClick={() => handleApplyPreset(opt.id)}
                className={cn(
                  'h-7 text-xs px-2.5 rounded-xl transition-all',
                  isActive
                    ? 'bg-[#0c1b3a] dark:bg-blue-600 text-white hover:bg-[#162d5c] dark:hover:bg-blue-500'
                    : 'border-[#e2ebf6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0c1a30] dark:text-slate-200 hover:bg-[#f0f5fa] dark:hover:bg-slate-700'
                )}
              >
                {opt.label}
              </Button>
            );
          })}

          <Button
            type="button"
            size="sm"
            variant={showCustomRange ? 'secondary' : 'outline'}
            disabled={isPending || isLoading}
            onClick={() => setShowCustomRange((prev) => !prev)}
            className="h-7 text-xs px-2.5 rounded-xl border-[#e2ebf6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0c1a30] dark:text-slate-200 hover:bg-[#f0f5fa] dark:hover:bg-slate-700 gap-1.5"
          >
            <Filter className="h-3 w-3" />
            Pilih Tanggal...
          </Button>

          {(preset !== 'minggu_ini' || searchParams.has('dari')) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending || isLoading}
              onClick={handleResetToDefault}
              className="h-7 text-xs px-2 text-slate-500 dark:text-slate-400 hover:text-[#0c1a30] dark:hover:text-slate-100 rounded-lg"
              title="Reset ke default"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Form Input Custom Jangka Waktu Tanggal (Dari s/d Sampai) */}
      {showCustomRange && (
        <form
          onSubmit={handleCustomSubmit}
          className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-slate-500 dark:text-slate-400 font-medium">Rentang Tanggal:</span>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={inputDari}
              onChange={(e) => setInputDari(e.target.value)}
              className="h-7 text-xs w-36 px-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg"
              required
            />
            <span className="text-slate-400 dark:text-slate-500">s/d</span>
            <Input
              type="date"
              value={inputSampai}
              onChange={(e) => setInputSampai(e.target.value)}
              className="h-7 text-xs w-36 px-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg"
              required
            />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isPending || isLoading || !inputDari || !inputSampai}
            className="h-7 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1"
          >
            <Check className="h-3 w-3" />
            Terapkan Filter
          </Button>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic ml-1">
            (Bisa pilih tanggal hari ini atau periode bulan/tahun lalu)
          </span>
        </form>
      )}
    </div>
  );
}
