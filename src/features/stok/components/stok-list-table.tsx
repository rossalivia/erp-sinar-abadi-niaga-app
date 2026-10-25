'use client';

import * as React from 'react';
import Link from 'next/link';
import { History, SlidersHorizontal, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PenyesuaianDialog } from './penyesuaian-dialog';
import type { BarangStokItem } from '../types';
import type { Peran } from '@/types/auth';
import { formatTanggal } from '@/lib/format';

interface StokListTableProps {
  items: BarangStokItem[];
  peran: Peran;
}

export function StokListTable({ items, peran }: StokListTableProps) {
  const [selectedBarang, setSelectedBarang] = React.useState<BarangStokItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const canAdjust = peran === 'gudang' || peran === 'manajer';
  const canPO = peran === 'gudang' || peran === 'manajer';

  function handleOpenAdjust(barang: BarangStokItem) {
    setSelectedBarang(barang);
    setIsDialogOpen(true);
  }

  return (
    <>
      <div className="overflow-auto max-h-[calc(100vh-230px)] min-h-[300px] scrollbar-thin rounded-2xl border border-[#e2ebf6]">
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <thead className="bg-[#f0f5fa] sticky top-0 z-20">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">No</th>
              <th className="py-2.5 px-3 w-28 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Kode</th>
              <th className="py-2.5 px-3 min-w-[200px] sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Nama Barang</th>
              <th className="py-2.5 px-3 w-16 text-center sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Satuan</th>
              <th className="py-2.5 px-3 w-28 text-right sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Stok Fisik</th>
              <th className="py-2.5 px-3 w-28 text-right sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Stok Minimum</th>
              <th className="py-2.5 px-3 w-28 text-center sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Status</th>
              <th className="py-2.5 px-3 w-28 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Pembaruan</th>
              <th className="py-2.5 px-3 w-48 text-right sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white [&_td]:border-b [&_td]:border-[#eef4fb]">
            {items.map((b, idx) => (
              <tr
                key={b.id}
                className={idx % 2 === 1 ? 'bg-slate-50/50 hover:bg-slate-50' : 'hover:bg-slate-50/50'}
              >
                <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                <td className="py-2 px-3 font-mono font-medium text-slate-900">
                  <Link
                    href={`/stok/${b.id}`}
                    className="hover:underline text-blue-900 hover:text-blue-800"
                  >
                    {b.kode}
                  </Link>
                </td>
                <td className="py-2 px-3 font-medium text-slate-900">{b.nama}</td>
                <td className="py-2 px-3 text-center text-slate-600">{b.satuan}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                  {b.stok}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                  {b.stok_minimum}
                </td>
                <td className="py-2 px-3 text-center">
                  {b.stok_menipis ? (
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-900">
                      Menipis
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                      Aman
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                  {formatTanggal(b.diperbarui_pada)}
                </td>
                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Kartu Stok */}
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2 border-slate-300 gap-1"
                      title="Lihat riwayat mutasi kartu stok"
                    >
                      <Link href={`/stok/${b.id}`}>
                        <History className="w-3.5 h-3.5" />
                        Kartu Stok
                      </Link>
                    </Button>

                    {/* Penyesuaian Stok (Gudang/Manajer) */}
                    {canAdjust && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAdjust(b)}
                        className="text-xs h-7 px-2 border-slate-300 gap-1"
                        title="Sesuaikan stok fisik (Opname)"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Opname
                      </Button>
                    )}

                    {/* Ajukan PO bila stok menipis */}
                    {canPO && b.stok_menipis && (
                      <Button
                        asChild
                        size="sm"
                        className="text-xs h-7 px-2 bg-blue-700 hover:bg-blue-800 text-white gap-1 shadow-none"
                        title="Ajukan PO untuk barang ini"
                      >
                        <Link href={`/pembelian/baru?barang=${b.id}`}>
                          <ShoppingCart className="w-3 h-3" />
                          Beli
                        </Link>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedBarang && (
        <PenyesuaianDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          barangId={selectedBarang.id}
          kodeBarang={selectedBarang.kode}
          namaBarang={selectedBarang.nama}
          stokSaatIni={selectedBarang.stok}
          satuan={selectedBarang.satuan}
        />
      )}
    </>
  );
}
