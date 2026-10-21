import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRupiah } from '@/lib/format';
import type { TopPelangganItem } from '../types';

interface TopPelangganTableProps {
  items: TopPelangganItem[];
}

export function TopPelangganTable({ items }: TopPelangganTableProps) {
  return (
    <Card className="border-slate-200 shadow-none bg-white">
      <CardHeader className="py-3 px-5 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">
          Top 10 Pelanggan berdasarkan Omzet
        </CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">
          Pelanggan dengan nilai pembelian terealisasi terbesar pada periode ini
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Belum ada transaksi pelanggan pada periode ini
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/75">
                <TableRow className="border-b border-slate-200">
                  <TableHead className="w-10 text-center text-xs font-semibold text-slate-700">#</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Pelanggan</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Pesanan</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Total Omzet</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Estimasi Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p, idx) => (
                  <TableRow key={p.pelanggan_id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <TableCell className="text-center text-xs text-slate-500 font-mono">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link
                        href={`/pelanggan/${p.pelanggan_id}`}
                        className="font-medium text-slate-900 hover:underline block"
                      >
                        {p.nama_toko}
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono">{p.kode}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-slate-700">
                      {p.jumlah_pesanan} <span className="text-[11px] text-slate-400">pesanan</span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-slate-900 font-semibold">
                      {formatRupiah(p.total_omzet)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-emerald-700 font-medium">
                      {formatRupiah(p.total_margin)}
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
