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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200 sticky top-0">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">No</th>
              <th className="py-2.5 px-3 w-28">Kode</th>
              <th className="py-2.5 px-3 min-w-[200px]">Nama Barang</th>
              <th className="py-2.5 px-3 w-16 text-center">Satuan</th>
              <th className="py-2.5 px-3 w-28 text-right">Stok Fisik</th>
              <th className="py-2.5 px-3 w-28 text-right">Stok Minimum</th>
              <th className="py-2.5 px-3 w-28 text-center">Status</th>
              <th className="py-2.5 px-3 w-28">Pembaruan</th>
              <th className="py-2.5 px-3 w-48 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
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
