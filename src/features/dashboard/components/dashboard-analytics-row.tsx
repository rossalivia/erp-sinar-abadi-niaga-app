'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileText,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  Printer,
  FileSpreadsheet,
  FileCheck,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Peran } from '@/types/auth';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

interface CommodityActivity {
  category: string;
  // Intensity 0 - 4
  values: number[];
}

const COMMODITY_MATRIX: CommodityActivity[] = [
  {
    category: 'Beras & Sembako',
    values: [2, 3, 4, 4, 3, 2, 3, 4, 4, 4, 3, 4],
  },
  {
    category: 'Minyak Goreng',
    values: [3, 2, 3, 4, 4, 3, 2, 3, 3, 4, 3, 4],
  },
  {
    category: 'Gula & Bumbu',
    values: [1, 2, 2, 4, 3, 1, 2, 2, 3, 3, 2, 3],
  },
  {
    category: 'Minuman FMCG',
    values: [2, 2, 3, 4, 4, 3, 3, 2, 2, 3, 3, 4],
  },
  {
    category: 'Tepung & Lainnya',
    values: [1, 1, 2, 3, 2, 1, 1, 2, 2, 2, 2, 3],
  },
];

const INTENSITY_COLORS: Record<number, string> = {
  0: 'bg-slate-100',
  1: 'bg-blue-100',
  2: 'bg-blue-300',
  3: 'bg-blue-500',
  4: 'bg-[#0c1b3a]',
};

interface RecentExport {
  id: string;
  title: string;
  type: 'PDF' | 'XLSX' | 'CSV';
  timestamp: string;
  author: string;
  href: string;
}

const RECENT_EXPORTS: RecentExport[] = [
  {
    id: 'e1',
    title: 'Faktur Penjualan #PJ-2026-0042',
    type: 'PDF',
    timestamp: '2 mnt lalu',
    author: 'Staf Penjualan',
    href: '/pesanan',
  },
  {
    id: 'e2',
    title: 'Rekap Piutang Toko Kelontong',
    type: 'XLSX',
    timestamp: '18 mnt lalu',
    author: 'Staf Keuangan',
    href: '/kredit',
  },
  {
    id: 'e3',
    title: 'Surat Jalan Muatan Truk 1',
    type: 'PDF',
    timestamp: '1 jam lalu',
    author: 'Staf Gudang',
    href: '/pesanan',
  },
  {
    id: 'e4',
    title: 'Rekap Pembelian PO Bahan Pokok',
    type: 'PDF',
    timestamp: '3 jam lalu',
    author: 'Staf Pengadaan',
    href: '/pembelian',
  },
  {
    id: 'e5',
    title: 'Berita Acara Stock Opname',
    type: 'CSV',
    timestamp: '5 jam lalu',
    author: 'Kepala Gudang',
    href: '/stok/opname',
  },
];

const DONUT_DATA = [
  { name: 'Lunas / Tunai', value: 60, color: '#0c1b3a' },
  { name: 'Tempo Berjalan', value: 25, color: '#2563eb' },
  { name: 'Lewat Jatuh Tempo', value: 15, color: '#38bdf8' },
];

export interface DashboardAnalyticsRowProps {
  peran: Peran;
}

export function DashboardAnalyticsRow({ peran }: DashboardAnalyticsRowProps) {
  const isManajer = peran === 'manajer';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* 1. BAGIAN KIRI: HEATMAP MATRIX TRANSAKSI (5 Kolom Desktop) */}
      <div className="lg:col-span-5 rounded-2xl p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
                Aktivitas Komoditas Bulanan
              </h3>
              <p className="text-[11px] text-slate-500">
                Pola intensitas pergerakan barang wholesale sepanjang tahun
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              Tahun 2026
            </span>
          </div>

          {/* Matrix Grid */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[340px]">
              {/* Header Months */}
              <div className="grid grid-cols-13 gap-1 mb-1.5 text-center">
                <div className="text-[10px] text-slate-400 text-left font-mono">Kat</div>
                {MONTHS.map((m) => (
                  <div key={m} className="text-[10px] text-slate-400 font-mono">
                    {m}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {COMMODITY_MATRIX.map((row) => (
                  <div key={row.category} className="grid grid-cols-13 gap-1 items-center">
                    <div
                      className="text-[10px] text-slate-600 font-medium truncate pr-1"
                      title={row.category}
                    >
                      {row.category.split(' ')[0]}
                    </div>
                    {row.values.map((val, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'h-6 rounded-md transition-all hover:scale-110 cursor-pointer shadow-2xs',
                          INTENSITY_COLORS[val]
                        )}
                        title={`${row.category} - ${MONTHS[idx]}: Intensitas level ${val}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Skala Frekuensi:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Rendah</span>
            {[0, 1, 2, 3, 4].map((lvl) => (
              <span
                key={lvl}
                className={cn('w-3 h-3 rounded shadow-2xs', INTENSITY_COLORS[lvl])}
              />
            ))}
            <span className="text-[10px] text-slate-700 font-bold">Padat</span>
          </div>
        </div>
      </div>

      {/* 2. BAGIAN TENGAH: RIWAYAT EKSPOR & DOKUMEN CETAK (4 Kolom Desktop) */}
      <div className="lg:col-span-4 rounded-2xl p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
                Dokumen &amp; Ekspor Terkini
              </h3>
              <p className="text-[11px] text-slate-500">Berkas transaksi terbitan terakhir</p>
            </div>
            <Printer className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-2">
            {RECENT_EXPORTS.map((doc) => (
              <div
                key={doc.id}
                className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0',
                      doc.type === 'PDF' && 'bg-red-50 text-red-700 border border-red-200',
                      doc.type === 'XLSX' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                      doc.type === 'CSV' && 'bg-blue-50 text-blue-700 border border-blue-200'
                    )}
                  >
                    {doc.type}
                  </span>

                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-800 truncate" title={doc.title}>
                      {doc.title}
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {doc.timestamp} &bull; {doc.author}
                    </p>
                  </div>
                </div>

                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0"
                >
                  <Link href={doc.href} title="Unduh / Cetak">
                    <Download className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <Link href="/audit" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            Buka Riwayat Audit &amp; Dokumen &rarr;
          </Link>
        </div>
      </div>

      {/* 3. BAGIAN KANAN: DONUT CHART DISTRIBUSI TRANSAKSI (3 Kolom Desktop) */}
      <div className="lg:col-span-3 rounded-2xl p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
                Status Pembayaran
              </h3>
              <p className="text-[11px] text-slate-500">Rasio kelunasan faktur</p>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Faktur
            </span>
          </div>

          {/* Donut Chart with Centered Total */}
          <div className="relative h-40 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={DONUT_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {DONUT_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Persentase']}
                  contentStyle={{
                    backgroundColor: 'rgba(12, 27, 58, 0.95)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                    border: 'none',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total Count in Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-[#0c1a30] tracking-tight leading-none">
                128
              </span>
              <span className="text-[9px] text-slate-400 uppercase font-mono mt-0.5">
                Total Faktur
              </span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="space-y-1.5 pt-1 text-[11px]">
            {DONUT_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}</span>
                </div>
                <span className="font-bold text-slate-800 tabular-nums">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <Link href="/laporan/piutang" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            Laporan Aging Piutang &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
