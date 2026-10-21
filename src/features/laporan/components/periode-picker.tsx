'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PeriodePickerProps {
  dari: string;
  sampai: string;
  preset: string;
}

export function PeriodePicker({ dari, sampai, preset }: PeriodePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [customDari, setCustomDari] = React.useState(dari);
  const [customSampai, setCustomSampai] = React.useState(sampai);
  const [isPending, startTransition] = React.useTransition();

  const applyPreset = (weeks: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('preset', String(weeks));
    params.delete('dari');
    params.delete('sampai');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDari || !customSampai) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('preset');
    params.set('dari', customDari);
    params.set('sampai', customSampai);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleExportCsv = () => {
    const url = `/api/laporan/omzet-margin/csv?dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-md border border-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
          <Calendar className="h-3.5 w-3.5" />
          Periode:
        </span>
        <Button
          type="button"
          size="sm"
          variant={preset === '4' ? 'default' : 'outline'}
          className="h-8 text-xs px-2.5"
          disabled={isPending}
          onClick={() => applyPreset(4)}
        >
          4 Minggu
        </Button>
        <Button
          type="button"
          size="sm"
          variant={preset === '8' ? 'default' : 'outline'}
          className="h-8 text-xs px-2.5"
          disabled={isPending}
          onClick={() => applyPreset(8)}
        >
          8 Minggu (Default)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={preset === '12' ? 'default' : 'outline'}
          className="h-8 text-xs px-2.5"
          disabled={isPending}
          onClick={() => applyPreset(12)}
        >
          12 Minggu
        </Button>

        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 ml-0 sm:ml-2">
          <Input
            type="date"
            value={customDari}
            onChange={(e) => setCustomDari(e.target.value)}
            className="h-8 text-xs w-32 px-2"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <Input
            type="date"
            value={customSampai}
            onChange={(e) => setCustomSampai(e.target.value)}
            className="h-8 text-xs w-32 px-2"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="h-8 text-xs px-2.5 border border-slate-200"
            disabled={isPending}
          >
            {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Terapkan'}
          </Button>
        </form>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs px-3 border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={handleExportCsv}
        >
          <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
          Ekspor CSV
        </Button>
      </div>
    </div>
  );
}
