import * as React from 'react';
import Link from 'next/link';
import { BadgeStatus } from '@/components/shared/badge-status';
import { formatTanggalWaktu } from '@/lib/format';
import type { MutasiStokItem } from '../types';

interface KartuStokTableProps {
  items: MutasiStokItem[];
  satuan: string;
}

export function KartuStokTable({ items, satuan }: KartuStokTableProps) {
  function renderDokumenLink(noDokumen: string | null) {
    if (!noDokumen) return '-';

    if (noDokumen.startsWith('SO-')) {
      return (
        <Link
          href={`/pesanan?q=${encodeURIComponent(noDokumen)}`}
          className="text-blue-900 hover:text-blue-800 hover:underline font-mono font-medium"
          title="Cari pesanan ini"
        >
          {noDokumen}
        </Link>
      );
    }

    if (noDokumen.startsWith('PO-')) {
      return (
        <Link
          href={`/pembelian?q=${encodeURIComponent(noDokumen)}`}
          className="text-blue-900 hover:text-blue-800 hover:underline font-mono font-medium"
          title="Cari PO ini"
        >
          {noDokumen}
        </Link>
      );
    }

    return <span className="font-mono text-slate-700">{noDokumen}</span>;
  }

  return (
    <div className="overflow-auto max-h-[calc(100vh-230px)] min-h-[300px] scrollbar-thin rounded-2xl border border-[#e2ebf6]">
      <table className="w-full text-left text-xs border-separate border-spacing-0">
        <thead className="bg-[#f0f5fa] sticky top-0 z-20">
          <tr>
            <th className="py-2.5 px-3 w-10 text-center sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">No</th>
            <th className="py-2.5 px-3 w-36 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Waktu Mutasi</th>
            <th className="py-2.5 px-3 w-28 text-center sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Jenis</th>
            <th className="py-2.5 px-3 w-28 text-right sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Perubahan</th>
            <th className="py-2.5 px-3 w-28 text-right sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Stok Sesudah</th>
            <th className="py-2.5 px-3 w-36 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">No. Dokumen</th>
            <th className="py-2.5 px-3 min-w-[200px] sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Alasan / Keterangan</th>
            <th className="py-2.5 px-3 w-32 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Pelaku</th>
          </tr>
        </thead>
        <tbody className="bg-white [&_td]:border-b [&_td]:border-[#eef4fb]">
          {items.map((it, idx) => {
            const isPositif = it.jumlah > 0;
            const isNol = it.jumlah === 0;

            return (
              <tr
                key={it.id}
                className={idx % 2 === 1 ? 'bg-slate-50/50 hover:bg-slate-50' : 'hover:bg-slate-50/50'}
              >
                <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                <td className="py-2 px-3 text-slate-600 font-mono">
                  {formatTanggalWaktu(it.dibuat_pada)}
                </td>
                <td className="py-2 px-3 text-center">
                  <BadgeStatus status={it.jenis} />
                </td>
                <td
                  className={`py-2 px-3 text-right font-mono tabular-nums font-semibold ${
                    isNol
                      ? 'text-slate-500'
                      : isPositif
                      ? 'text-emerald-700'
                      : 'text-red-600'
                  }`}
                >
                  {isPositif ? `+${it.jumlah}` : it.jumlah} {satuan}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                  {it.stok_sesudah} {satuan}
                </td>
                <td className="py-2 px-3 font-mono">{renderDokumenLink(it.nomor_dokumen)}</td>
                <td className="py-2 px-3 text-slate-700">{it.alasan || '-'}</td>
                <td className="py-2 px-3 text-slate-600">{it.pelaku?.nama_lengkap || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
