import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatRupiah } from '@/lib/format';
import { RingkasanPenagihan } from '../types';

interface KartuMetrikPenagihanProps {
  ringkasan: RingkasanPenagihan;
}

export function KartuMetrikPenagihan({ ringkasan }: KartuMetrikPenagihanProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Piutang Tertagih */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total Piutang Tertagih
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {formatRupiah(ringkasan.totalTertagih)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dari {ringkasan.totalFaktur} faktur terkirim
          </p>
        </CardContent>
      </Card>

      {/* 2. Total Tagihan Overdue */}
      <Card className="border-red-200/80 bg-red-50/50 shadow-neu-sm">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wider">
            Total Menunggak (Overdue)
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-red-900 tabular-nums">
            {formatRupiah(ringkasan.totalOverdue)}
          </p>
          <p className="mt-1 text-xs text-red-600 font-medium">
            {ringkasan.jumlahOverdue} faktur lewat jatuh tempo
          </p>
        </CardContent>
      </Card>

      {/* 3. Jatuh Tempo Hari Ini */}
      <Card className="border-amber-200/80 bg-amber-50/50 shadow-neu-sm">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">
            Jatuh Tempo Hari Ini
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-950 tabular-nums">
            {ringkasan.jumlahHariIni}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {ringkasan.jumlahHariIni > 0
              ? 'Wajib diingatkan & konfirmasi hari ini'
              : 'Tidak ada tagihan jatuh tempo hari ini'}
          </p>
        </CardContent>
      </Card>

      {/* 4. Segera Jatuh Tempo (1-3 Hari) */}
      <Card className="border-blue-200/80 bg-blue-50/40 shadow-neu-sm">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">
            Segera Tempo (1–3 Hari)
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-950 tabular-nums">
            {ringkasan.jumlahSegera}
          </p>
          <p className="mt-1 text-xs text-blue-600">
            Faktur mendekati batas pembayaran
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
