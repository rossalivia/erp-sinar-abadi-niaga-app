import * as React from 'react';
import { CheckCircle2, AlertCircle, Layers } from 'lucide-react';

interface RingkasanValidasiProps {
  totalBaris: number;
  totalValid: number;
  totalGalat: number;
}

export function RingkasanValidasi({
  totalBaris,
  totalValid,
  totalGalat,
}: RingkasanValidasiProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="p-2 bg-slate-100 text-slate-700 rounded-md">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Baris</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{totalBaris}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Baris Valid</p>
          <p className="text-lg font-bold text-emerald-800 tabular-nums">{totalValid}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="p-2 bg-red-50 text-red-700 rounded-md">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-red-700 uppercase tracking-wider">Baris Galat</p>
          <p className="text-lg font-bold text-red-800 tabular-nums">{totalGalat}</p>
        </div>
      </div>
    </div>
  );
}
