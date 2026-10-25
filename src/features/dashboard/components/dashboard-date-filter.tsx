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
}: DashboardDateFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [inputDari, setInputDari] = React.useState(dari);
  const [inputSampai, setInputSampai] = React.useState(sampai);
  const [showCustomRange, setShowCustomRange] = React.useState(
    preset === 'custom' || (!PRESET_OPTIONS.some((p) => p.id === preset) && Boolean(dari))
  );
  const [isPending, startTransition] = React.useTransition();

  // Sinkronkan input lokal jika props berubah
  React.useEffect(() => {
    setInputDari(dari);
    setInputSampai(sampai);
  }, [dari, sampai]);

  const handleApplyPreset = (selectedPreset: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', selectedPreset);
    params.delete('dari');
    params.delete('sampai');

    setShowCustomRange(false);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDari || !inputSampai) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', 'custom');
    params.set('dari', inputDari);
    params.set('sampai', inputSampai);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleResetToDefault = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('preset');
    params.delete('dari');
    params.delete('sampai');
    setShowCustomRange(false);
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  };

  return (
    <div className="surface-raised rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Label & Status Periode Aktif */}
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 tracking-tight">
                Filter Jangka Waktu Dashboard
              </span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60">
                {periodeLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
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
                disabled={isPending}
                onClick={() => handleApplyPreset(opt.id)}
                className={cn(
                  'h-7 text-xs px-2.5 rounded-lg transition-all',
                  isActive
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
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
            disabled={isPending}
            onClick={() => setShowCustomRange((prev) => !prev)}
            className="h-7 text-xs px-2.5 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
          >
            <Filter className="h-3 w-3" />
            Pilih Tanggal...
          </Button>

          {(preset !== 'minggu_ini' || searchParams.has('dari')) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={handleResetToDefault}
              className="h-7 text-xs px-2 text-slate-500 hover:text-slate-800"
              title="Reset ke Minggu Ini"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Form Input Custom Jangka Waktu Tanggal (Dari s/d Sampai) */}
      {showCustomRange && (
        <form
          onSubmit={handleCustomSubmit}
          className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-slate-500 font-medium">Rentang Tanggal:</span>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={inputDari}
              onChange={(e) => setInputDari(e.target.value)}
              className="h-7 text-xs w-36 px-2 border-slate-200 rounded-lg"
              required
            />
            <span className="text-slate-400">s/d</span>
            <Input
              type="date"
              value={inputSampai}
              onChange={(e) => setInputSampai(e.target.value)}
              className="h-7 text-xs w-36 px-2 border-slate-200 rounded-lg"
              required
            />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isPending || !inputDari || !inputSampai}
            className="h-7 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1"
          >
            <Check className="h-3 w-3" />
            Terapkan Filter
          </Button>
          <span className="text-[11px] text-slate-400 italic ml-1">
            (Bisa pilih tanggal hari ini atau periode bulan/tahun lalu)
          </span>
        </form>
      )}
    </div>
  );
}
