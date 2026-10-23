'use client';

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Users, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { BadgeStatus } from '@/components/shared/badge-status';
import type { PerformaSalesItem } from '../types';

interface PerformaSalesViewProps {
  data: PerformaSalesItem[];
}

export function PerformaSalesView({ data }: PerformaSalesViewProps) {
  // Hitung KPI Agregat Tim
  const totalOmzet = data.reduce((acc, curr) => acc + Number(curr.total_omzet || 0), 0);
  const totalMargin = data.reduce((acc, curr) => acc + Number(curr.total_margin || 0), 0);
  const totalPiutang = data.reduce((acc, curr) => acc + Number(curr.piutang_berjalan || 0), 0);
  const totalPesanan = data.reduce((acc, curr) => acc + Number(curr.jumlah_pesanan || 0), 0);
  const rataMarginPersen = totalOmzet > 0 ? (totalMargin / totalOmzet) * 100 : 0;

  // Data untuk Grafik Recharts
  const chartData = data.map((s) => ({
    name: s.nama_sales,
    omzet: Number(s.total_omzet || 0),
    margin: Number(s.total_margin || 0),
  }));

  return (
    <div className="space-y-4">
      {/* KPI Cards Ringkasan Tim */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Omzet Tim</span>
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {formatRupiah(totalOmzet)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Dari {totalPesanan} transaksi selesai
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Margin Kotor</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-semibold text-emerald-700 tabular-nums">
            {formatRupiah(totalMargin)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Rata-rata: {rataMarginPersen.toFixed(1)}% margin
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Piutang Berjalan Sales</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-semibold text-amber-700 tabular-nums">
            {formatRupiah(totalPiutang)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Faktur terkirim belum lunas
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Jumlah Staf Sales</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {data.length} Orang
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {data.filter((d) => d.aktif).length} aktif bertugas
          </div>
        </div>
      </div>

      {/* Grafik Recharts: Perbandingan Omzet & Margin per Sales */}
      {data.length > 0 && totalOmzet > 0 && (
        <div className="p-4 bg-white border border-slate-200 rounded-md space-y-3">
          <div className="text-xs font-semibold text-slate-800">
            Perbandingan Omzet & Margin per Staf Penjualan
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={0}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `Rp${(val / 1000000).toFixed(0)}jt`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(val: unknown) => [formatRupiah(Number(val) || 0), '']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => (value === 'omzet' ? 'Total Omzet' : 'Total Margin')}
                />
                <Bar dataKey="omzet" name="omzet" fill="#0f172a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="margin" name="margin" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabel Rincian Data Padat */}
      <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 px-3 font-medium">Staf Penjualan</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium text-right">Pesanan</th>
                <th className="py-2 px-3 font-medium text-right">Total Omzet</th>
                <th className="py-2 px-3 font-medium text-right">Total Margin</th>
                <th className="py-2 px-3 font-medium text-right">Margin %</th>
                <th className="py-2 px-3 font-medium text-right">Piutang Berjalan</th>
                <th className="py-2 px-3 font-medium text-right">Draf</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    Tidak ada data penjualan pada periode terpilih.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.sales_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-900">
                      <div>{row.nama_sales}</div>
                      <div className="text-[10px] text-slate-400">{row.email}</div>
                    </td>
                    <td className="py-2 px-3">
                      <BadgeStatus
                        status={row.aktif ? 'aktif' : 'tidak_aktif'}
                        label={row.aktif ? 'Aktif' : 'Nonaktif'}
                      />
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                      {row.jumlah_pesanan} SO
                      <span className="text-[10px] text-slate-400 block">
                        ({row.pesanan_dikirim} kirim, {row.pesanan_lunas} lunas)
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                      {formatRupiah(row.total_omzet)}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-700 tabular-nums">
                      {formatRupiah(row.total_margin)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-700">
                      {Number(row.margin_persen || 0).toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-700 font-medium">
                      {formatRupiah(row.piutang_berjalan)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                      {row.jumlah_draf}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
