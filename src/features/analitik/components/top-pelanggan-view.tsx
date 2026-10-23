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
} from 'recharts';
import { Award, TrendingUp, DollarSign, ShieldAlert } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { BadgeStatus } from '@/components/shared/badge-status';
import type { TopPelangganItem } from '../types';

interface TopPelangganViewProps {
  data: TopPelangganItem[];
}

export function TopPelangganView({ data }: TopPelangganViewProps) {
  const totalOmzetTop = data.reduce((acc, curr) => acc + Number(curr.total_omzet || 0), 0);
  const totalMarginTop = data.reduce((acc, curr) => acc + Number(curr.total_margin || 0), 0);
  const totalKontribusi = data.reduce((acc, curr) => acc + Number(curr.kontribusi_omzet_persen || 0), 0);
  const jumlahBermasalah = data.filter((d) => d.status_kredit === 'overdue' || d.status_kredit === 'overlimit').length;

  const chartData = data.slice(0, 10).map((p) => ({
    name: p.nama_toko.length > 15 ? p.nama_toko.slice(0, 15) + '…' : p.nama_toko,
    omzet: Number(p.total_omzet || 0),
    kontribusi: Number(p.kontribusi_omzet_persen || 0),
  }));

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Omzet Top Pelanggan</span>
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {formatRupiah(totalOmzetTop)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Kontribusi: {totalKontribusi.toFixed(1)}% dari total omzet
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Margin Kotor Top</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-semibold text-emerald-700 tabular-nums">
            {formatRupiah(totalMarginTop)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Rata-rata: {totalOmzetTop > 0 ? ((totalMarginTop / totalOmzetTop) * 100).toFixed(1) : 0}% margin
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Pelanggan Utama</span>
            <Award className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {data.length} Akun
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Mitra bisnis dengan volume tertinggi
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Perhatian Kredit</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {jumlahBermasalah} Akun
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">
            Status overdue / overlimit
          </div>
        </div>
      </div>

      {/* Grafik Recharts: Distribusi Omzet Top 10 */}
      {data.length > 0 && totalOmzetTop > 0 && (
        <div className="p-4 bg-white border border-slate-200 rounded-md space-y-3">
          <div className="text-xs font-semibold text-slate-800">
            Peringkat Omzet 10 Pelanggan Teratas
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `Rp${(val / 1000000).toFixed(0)}jt`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(val: unknown) => [formatRupiah(Number(val) || 0), 'Total Omzet']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="omzet" fill="#3b82f6" radius={[3, 3, 0, 0]} />
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
                <th className="py-2 px-3 font-medium">Pelanggan</th>
                <th className="py-2 px-3 font-medium text-right">Transaksi</th>
                <th className="py-2 px-3 font-medium text-right">Total Omzet</th>
                <th className="py-2 px-3 font-medium text-right">Total Margin</th>
                <th className="py-2 px-3 font-medium text-right">Margin %</th>
                <th className="py-2 px-3 font-medium text-right">Kontribusi %</th>
                <th className="py-2 px-3 font-medium text-right">Sisa Plafon Kredit</th>
                <th className="py-2 px-3 font-medium">Status Kredit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    Tidak ada data pelanggan pada periode terpilih.
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={row.pelanggan_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 w-4 font-mono">#{idx + 1}</span>
                        <span>{row.nama_toko}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pl-5.5 font-mono">
                        {row.kode} • {row.telepon || '-'}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                      {row.jumlah_pesanan} SO
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
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-blue-700">
                      {Number(row.kontribusi_omzet_persen || 0).toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                      {formatRupiah(row.sisa_kredit)}
                      <span className="text-[10px] text-slate-400 block">
                        Limit: {formatRupiah(row.batas_kredit)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <BadgeStatus
                        status={
                          row.status_kredit === 'overdue'
                            ? 'dibatalkan'
                            : row.status_kredit === 'overlimit'
                            ? 'menunggu'
                            : 'lunas'
                        }
                        label={
                          row.status_kredit === 'overdue'
                            ? 'Overdue'
                            : row.status_kredit === 'overlimit'
                            ? 'Overlimit'
                            : 'Lancar'
                        }
                      />
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
