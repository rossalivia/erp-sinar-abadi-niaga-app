import * as React from 'react';
import { TrendingUp, DollarSign, ShoppingBag, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatRupiah } from '@/lib/format';
import type { LaporanRingkasan } from '../types';

interface KpiCardsProps {
  ringkasan: LaporanRingkasan;
}

export function KpiCards({ ringkasan }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Omzet Total */}
      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Omzet
            </span>
            <span className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">
              {formatRupiah(ringkasan.total_omzet)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Nilai transaksi pesanan dikirim & lunas
          </p>
        </CardContent>
      </Card>

      {/* 2. Total HPP */}
      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total HPP (Pokok)
            </span>
            <span className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold tracking-tight text-slate-700 tabular-nums">
              {formatRupiah(ringkasan.total_hpp)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Total biaya pokok barang terjual
          </p>
        </CardContent>
      </Card>

      {/* 3. Total Margin & Margin % */}
      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Margin Kotor
            </span>
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
              <Percent className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold tracking-tight text-emerald-700 tabular-nums">
              {formatRupiah(ringkasan.total_margin)}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {ringkasan.margin_persen}%
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Selisih omzet dikurangi total HPP
          </p>
        </CardContent>
      </Card>

      {/* 4. Jumlah Pesanan */}
      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Pesanan Terealisasi
            </span>
            <span className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <ShoppingBag className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">
              {ringkasan.jumlah_pesanan} <span className="text-xs font-normal text-slate-500">pesanan</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {ringkasan.pesanan_dikirim} dikirim, {ringkasan.pesanan_lunas} lunas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
