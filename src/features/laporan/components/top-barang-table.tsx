import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRupiah } from '@/lib/format';
import type { TopBarangItem } from '../types';

interface TopBarangTableProps {
  items: TopBarangItem[];
}

export function TopBarangTable({ items }: TopBarangTableProps) {
  return (
    <Card className="border-slate-200 shadow-none bg-white">
      <CardHeader className="py-3 px-5 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">
          Top 10 Barang berdasarkan Margin
        </CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">
          Produk yang menyumbang keuntungan kotor tertinggi dalam periode ini
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Belum ada penjualan barang pada periode ini
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/75">
                <TableRow className="border-b border-slate-200">
                  <TableHead className="w-10 text-center text-xs font-semibold text-slate-700">#</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Barang</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Terjual</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Omzet</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">HPP</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Margin</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b, idx) => (
                  <TableRow key={b.barang_id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <TableCell className="text-center text-xs text-slate-500 font-mono">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link
                        href={`/stok/${b.barang_id}`}
                        className="font-medium text-slate-900 hover:underline block"
                      >
                        {b.nama}
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono">{b.kode}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-slate-700">
                      {b.jumlah_terjual} <span className="text-[11px] text-slate-400">{b.satuan}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-slate-900 font-medium">
                      {formatRupiah(b.total_omzet)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-slate-600">
                      {formatRupiah(b.total_hpp)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-emerald-700 font-semibold">
                      {formatRupiah(b.total_margin)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-slate-700">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                        {b.margin_persen}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
