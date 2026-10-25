'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart2, LineChart as LineIcon, DollarSign, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRupiah } from '@/lib/format';
import type { LaporanMarginMingguanItem, LaporanRingkasan } from '@/features/laporan/types';

export interface DashboardFinanceChartProps {
  data: LaporanMarginMingguanItem[];
  ringkasan: LaporanRingkasan | null;
  periodeLabel: string;
}

export function DashboardFinanceChart({
  data,
  ringkasan,
  periodeLabel,
}: DashboardFinanceChartProps) {
  const [chartType, setChartType] = React.useState<'bar' | 'line'>('bar');

  // Format data untuk label minggu yang terbaca jelas
  const formattedData = React.useMemo(() => {
    return (data || []).map((item) => {
      const tgl = new Date(item.minggu);
      const label = isNaN(tgl.getTime())
        ? item.minggu
        : `${tgl.getDate()} ${tgl.toLocaleDateString('id-ID', { month: 'short' })}`;

      return {
        ...item,
        labelMinggu: label,
      };
    });
  }, [data]);

  // Formatter sumbu Y (singkatan jt/rb)
  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)} jt`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(0)} rb`;
    }
    return String(value);
  };

  const totalOmzet = ringkasan?.total_omzet || 0;
  const totalHpp = ringkasan?.total_hpp || 0;
  const totalMargin = ringkasan?.total_margin || 0;
  const marginPersen = ringkasan?.margin_persen || 0;

  return (
    <div className="surface-raised rounded-2xl p-5 border border-[#e2ebf6] shadow-sm space-y-4">
      {/* Header Grafik & Kontrol Tipe */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#eef4fb]">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 bg-[#2563eb] rounded-full" />
            <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
              Grafik Performa Finansial &amp; Margin
            </h3>
            <span className="text-[10px] text-slate-400">({periodeLabel})</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Perbandingan omzet kotor terhadap margin keuntungan terealisasi.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-[#f0f5fa] p-0.5 rounded-xl border border-[#e2ebf6]">
            <Button
              type="button"
              size="sm"
              variant={chartType === 'bar' ? 'default' : 'ghost'}
              className="h-6 text-[11px] px-2.5 rounded-lg"
              onClick={() => setChartType('bar')}
            >
              <BarChart2 className="h-3 w-3 mr-1" />
              Batang
            </Button>
            <Button
              type="button"
              size="sm"
              variant={chartType === 'line' ? 'default' : 'ghost'}
              className="h-6 text-[11px] px-2.5 rounded-lg"
              onClick={() => setChartType('line')}
            >
              <LineIcon className="h-3 w-3 mr-1" />
              Garis
            </Button>
          </div>
        </div>
      </div>

      {/* Komparasi Nilai Utama (Quick Metrics Strip) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#f0f5fa] p-3.5 rounded-xl border border-[#e2ebf6]">
        <div>
          <span className="text-slate-400 text-[10px] block uppercase font-mono">Omzet Periode Ini</span>
          <span className="font-extrabold text-[#0c1a30] text-sm tabular-nums">
            {formatRupiah(totalOmzet)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] block uppercase font-mono">Beban Pokok (HPP)</span>
          <span className="font-semibold text-slate-600 text-sm tabular-nums">
            {formatRupiah(totalHpp)}
          </span>
        </div>
        <div>
          <span className="text-[#1e40af] text-[10px] font-semibold block uppercase font-mono flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Margin Kotor ({marginPersen}%)
          </span>
          <span className="font-extrabold text-[#1e40af] text-sm tabular-nums">
            {formatRupiah(totalMargin)}
          </span>
        </div>
      </div>

      {/* Visualisasi Recharts */}
      {formattedData.length === 0 || totalOmzet === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-6 bg-slate-50/40">
          <PieChart className="h-8 w-8 text-slate-300 mb-2" />
          <p className="font-medium text-slate-600">Belum ada transaksi selesai pada periode ini</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Coba ganti rentang tanggal atau pilih preset &quot;Bulan Ini&quot; / &quot;30 Hari&quot;.
          </p>
        </div>
      ) : (
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaf1f9" />
                <XAxis
                  dataKey="labelMinggu"
                  stroke="#8ea2c2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2ebf6' }}
                />
                <YAxis
                  stroke="#8ea2c2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2ebf6' }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2ebf6',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 20px -2px rgba(12, 27, 58, 0.08)',
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    const num = typeof value === 'number' ? value : Number(value) || 0;
                    const label = name === 'omzet' ? 'Total Omzet' : 'Margin Kotor';
                    return [formatRupiah(num), label];
                  }}
                  labelFormatter={(label) => `Periode: ${label}`}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                  formatter={(value) => (value === 'omzet' ? 'Total Omzet' : 'Margin Kotor')}
                />
                <Bar dataKey="omzet" fill="#0c1b3a" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="margin" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            ) : (
              <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaf1f9" />
                <XAxis
                  dataKey="labelMinggu"
                  stroke="#8ea2c2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2ebf6' }}
                />
                <YAxis
                  stroke="#8ea2c2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2ebf6' }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2ebf6',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 20px -2px rgba(12, 27, 58, 0.08)',
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    const num = typeof value === 'number' ? value : Number(value) || 0;
                    const label = name === 'omzet' ? 'Total Omzet' : 'Margin Kotor';
                    return [formatRupiah(num), label];
                  }}
                  labelFormatter={(label) => `Periode: ${label}`}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                  formatter={(value) => (value === 'omzet' ? 'Total Omzet' : 'Margin Kotor')}
                />
                <Line
                  type="monotone"
                  dataKey="omzet"
                  stroke="#0c1b3a"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0c1b3a' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="margin"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0284c7' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
