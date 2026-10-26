import * as React from 'react';
import { Clock, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatRupiah } from '@/lib/format';
import type { LaporanAgingPiutang } from '../types';

interface PiutangAgingCardsProps {
  aging: LaporanAgingPiutang;
}

export function PiutangAgingCards({ aging }: PiutangAgingCardsProps) {
  const totalBerjalan = aging.total_piutang_berjalan ?? aging.total_piutang_dikirim;
  const totalPesanan = aging.total_pesanan ?? aging.total_pesanan_dikirim;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Piutang Berjalan (Dikonfirmasi + Dikirim) */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Total Piutang Berjalan</span>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900 tabular-nums">
            {formatRupiah(totalBerjalan)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {totalPesanan} pesanan (dikonfirmasi &amp; dikirim)
          </p>
        </CardContent>
      </Card>

      {/* 2. Kelompok 1: Belum Jatuh Tempo */}
      <Card className="border-emerald-100 bg-emerald-50/20 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            <span>Belum Jatuh Tempo</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-emerald-700 tabular-nums">
            {formatRupiah(aging.belum_jatuh_tempo)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Pesanan dikonfirmasi &amp; dalam batas termin
          </p>
        </CardContent>
      </Card>

      {/* 3. Kelompok 2: Lewat 1–30 Hari */}
      <Card className="border-amber-100 bg-amber-50/20 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800 uppercase tracking-wider">
            <span>Lewat 1–30 Hari</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-amber-700 tabular-nums">
            {formatRupiah(aging.lewat_1_30_hari)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Perlu pengingat penagihan toko mitra
          </p>
        </CardContent>
      </Card>

      {/* 4. Kelompok 3: Lewat > 30 Hari */}
      <Card className="border-red-200 bg-red-50/40 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-red-800 uppercase tracking-wider">
            <span>Lewat &gt; 30 Hari</span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-red-700 tabular-nums">
            {formatRupiah(aging.lewat_gt_30_hari)}
          </div>
          <p className="mt-1 text-[11px] text-red-600 font-medium">
            Kritis: otomatis blokir pesanan baru (BR-05)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
