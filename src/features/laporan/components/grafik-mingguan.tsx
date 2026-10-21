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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRupiah } from '@/lib/format';
import type { LaporanMarginMingguanItem } from '../types';

interface GrafikMingguanProps {
  data: LaporanMarginMingguanItem[];
}

export function GrafikMingguan({ data }: GrafikMingguanProps) {
  const [chartType, setChartType] = React.useState<'bar' | 'line'>('bar');

  // Format data untuk label minggu yang jelas
  const formattedData = React.useMemo(() => {
    return data.map((item) => {
      // item.minggu format: YYYY-MM-DD
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

  // Formatter sumbu Y (menyingkat juta/ribu agar tidak makan tempat)
  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)} jt`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(0)} rb`;
    }
    return String(value);
  };

  return (
    <Card className="border-slate-200 shadow-none bg-white">
      <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">
            Tren Mingguan Omzet & Margin
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Dikelompokkan per awal minggu (Senin, Asia/Jakarta) berdasarkan tanggal kirim
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
          <Button
            type="button"
            size="sm"
            variant={chartType === 'bar' ? 'default' : 'ghost'}
            className="h-7 text-xs px-2.5"
            onClick={() => setChartType('bar')}
          >
            Batang
          </Button>
          <Button
            type="button"
            size="sm"
            variant={chartType === 'line' ? 'default' : 'ghost'}
            className="h-7 text-xs px-2.5"
            onClick={() => setChartType('line')}
          >
            Garis
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {formattedData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-slate-400">
            Tidak ada transaksi dalam rentang periode yang dipilih
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="labelMinggu"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={formatYAxis}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      boxShadow: 'none',
                    }}
                    formatter={(value: unknown, name: unknown) => {
                      const num = typeof value === 'number' ? value : Number(value) || 0;
                      const label = name === 'omzet' ? 'Omzet' : 'Margin';
                      return [formatRupiah(num), label];
                    }}
                    labelFormatter={(label) => `Minggu: ${label}`}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                    formatter={(value) => (value === 'omzet' ? 'Omzet' : 'Margin')}
                  />
                  <Bar dataKey="omzet" fill="#1e293b" radius={[2, 2, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="margin" fill="#059669" radius={[2, 2, 0, 0]} maxBarSize={32} />
                </BarChart>
              ) : (
                <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="labelMinggu"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={formatYAxis}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      boxShadow: 'none',
                    }}
                    formatter={(value: unknown, name: unknown) => {
                      const num = typeof value === 'number' ? value : Number(value) || 0;
                      const label = name === 'omzet' ? 'Omzet' : 'Margin';
                      return [formatRupiah(num), label];
                    }}
                    labelFormatter={(label) => `Minggu: ${label}`}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                    formatter={(value) => (value === 'omzet' ? 'Omzet' : 'Margin')}
                  />
                  <Line
                    type="monotone"
                    dataKey="omzet"
                    stroke="#1e293b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#1e293b' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="margin"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#059669' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
