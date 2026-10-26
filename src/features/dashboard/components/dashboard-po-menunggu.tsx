import * as React from 'react';
import Link from 'next/link';
import { ShoppingCart, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { formatTanggal } from '@/lib/format';

export interface PoMenungguItem {
  id: string;
  nomor: string;
  diajukan_pada: string;
  jumlah_dipesan: number;
  pemasok: {
    id?: string;
    kode?: string;
    nama?: string;
  } | null;
  barang: {
    id?: string;
    kode?: string;
    nama?: string;
    satuan?: string;
  } | null;
}

interface DashboardPoMenungguProps {
  items: PoMenungguItem[];
  totalMenunggu?: number;
}

export function DashboardPoMenunggu({ items, totalMenunggu = items.length }: DashboardPoMenungguProps) {
  return (
    <section className="surface-raised rounded-2xl p-5 border border-[#e2ebf6] shadow-sm space-y-4" aria-label="Pengajuan Pembelian Menunggu">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0c1a30]">
              Pengajuan Pembelian Menunggu Persetujuan
            </h2>
            <p className="text-xs text-slate-500">
              Daftar pengadaan barang yang diajukan staf gudang memerlukan keputusan dan harga beli Manajer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full tabular-nums">
            {totalMenunggu} PO Menunggu
          </span>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-[#2563eb] hover:text-[#1d4ed8] gap-1"
          >
            <Link href="/pembelian?status=diajukan">
              Lihat Semua
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <span className="font-medium text-slate-700">Semua Pengajuan Telah Ditinjau</span>
          <span>Tidak ada pengajuan pembelian yang sedang menunggu persetujuan Manajer saat ini.</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow className="border-b border-slate-200 text-xs">
                <TableHead className="w-32 font-semibold text-slate-700">Nomor PO</TableHead>
                <TableHead className="w-32 font-semibold text-slate-700">Tanggal Diajukan</TableHead>
                <TableHead className="font-semibold text-slate-700">Pemasok</TableHead>
                <TableHead className="font-semibold text-slate-700">Barang</TableHead>
                <TableHead className="text-right w-28 font-semibold text-slate-700">Jumlah</TableHead>
                <TableHead className="text-center w-28 font-semibold text-slate-700">Status</TableHead>
                <TableHead className="text-right w-28 font-semibold text-slate-700">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                  <TableCell className="font-mono font-medium text-slate-800">
                    <Link href={`/pembelian/${item.id}`} className="hover:underline text-blue-600">
                      {item.nomor}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {formatTanggal(item.diajukan_pada)}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {item.pemasok?.nama || '-'}
                    {item.pemasok?.kode && (
                      <span className="block text-[11px] text-slate-400 font-mono">
                        {item.pemasok.kode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-800">
                    {item.barang?.nama || '-'}
                    {item.barang?.kode && (
                      <span className="block text-[11px] text-slate-400 font-mono">
                        {item.barang.kode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-slate-900">
                    {item.jumlah_dipesan.toLocaleString('id-ID')} {item.barang?.satuan || 'pcs'}
                  </TableCell>
                  <TableCell className="text-center">
                    <BadgeStatus status="diajukan" label="Menunggu" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5 border-amber-300 bg-amber-50/50 hover:bg-amber-100 text-amber-900 gap-1"
                    >
                      <Link href={`/pembelian/${item.id}`}>
                        <Clock className="w-3 h-3 text-amber-600" />
                        Tinjau
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
