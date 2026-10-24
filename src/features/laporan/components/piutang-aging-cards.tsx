import * as React from 'react';
import { Clock, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatRupiah } from '@/lib/format';
import type { LaporanAgingPiutang } from '../types';

interface PiutangAgingCardsProps {
  aging: LaporanAgingPiutang;
}

export function PiutangAgingCards({ aging }: PiutangAgingCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Total Piutang Belum Lunas */}
      <Card className="shadow-neu-sm">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 uppercase tracking-wider">
            <span>Total Tagihan Dikirim</span>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 tabular-nums">
            {formatRupiah(aging.total_piutang_dikirim)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {aging.total_pesanan_dikirim} pesanan belum lunas
          </p>
        </CardContent>
      </Card>

      {/* 2. Belum Jatuh Tempo */}
      <Card className="shadow-neu-sm">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 uppercase tracking-wider">
            <span>Belum Jatuh Tempo</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-emerald-700 tabular-nums">
            {formatRupiah(aging.belum_jatuh_tempo)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Dalam batas termin wajar
          </p>
        </CardContent>
      </Card>

      {/* 3. Lewat 1-7 Hari */}
      <Card className="shadow-neu-sm">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 uppercase tracking-wider">
            <span>Lewat 1–7 Hari</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-lg font-bold text-amber-700 tabular-nums">
            {formatRupiah(aging.lewat_1_7_hari)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Keterlambatan baru
          </p>
        </CardContent>
      </Card>

      {/* 4. Lewat 8-30 Hari */}
      <Card className="shadow-neu-sm">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 uppercase tracking-wider">
            <span>Lewat 8–30 Hari</span>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
          <div className="mt-2 text-lg font-bold text-orange-700 tabular-nums">
            {formatRupiah(aging.lewat_8_30_hari)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Perlu konfirmasi penagihan
          </p>
        </CardContent>
      </Card>

      {/* 5. Lewat > 30 Hari */}
      <Card className="border-red-200/80 bg-red-50/50 shadow-neu-sm">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-red-700 uppercase tracking-wider">
            <span>Lewat &gt; 30 Hari</span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-red-700 tabular-nums">
            {formatRupiah(aging.lewat_gt_30_hari)}
          </div>
          <p className="mt-1 text-[11px] text-red-600 font-medium">
            Kritis: blokir pesanan baru
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
