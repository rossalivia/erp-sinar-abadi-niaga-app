import * as React from 'react';
import { formatRupiah } from '@/lib/format';
import { BadgeStatus } from '@/components/shared/badge-status';
import { BarangImportRow } from '../types';

interface TabelPratinjauBarangProps {
  data: BarangImportRow[];
}

export function TabelPratinjauBarang({ data }: TabelPratinjauBarangProps) {
  const previewRows = data.slice(0, 5);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700">
          Pratinjau Data Valid (Menampilkan {previewRows.length} dari {data.length} baris)
        </h4>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-medium">
            <tr>
              <th className="py-2 px-2.5">Kode</th>
              <th className="py-2 px-2.5">Nama Barang</th>
              <th className="py-2 px-2.5">Satuan</th>
              <th className="py-2 px-2.5 text-right">Harga Jual</th>
              <th className="py-2 px-2.5 text-right">Harga Pokok</th>
              <th className="py-2 px-2.5 text-right">Stok Min</th>
              <th className="py-2 px-2.5 text-right">Stok Awal</th>
              <th className="py-2 px-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {previewRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-1.5 px-2.5 font-mono font-medium text-slate-900">{row.kode}</td>
                <td className="py-1.5 px-2.5 font-medium">{row.nama}</td>
                <td className="py-1.5 px-2.5 text-slate-500">{row.satuan}</td>
                <td className="py-1.5 px-2.5 text-right font-medium tabular-nums">
                  {formatRupiah(row.harga_jual)}
                </td>
                <td className="py-1.5 px-2.5 text-right text-slate-600 tabular-nums">
                  {row.harga_pokok ? formatRupiah(row.harga_pokok) : <span className="text-slate-400">-</span>}
                </td>
                <td className="py-1.5 px-2.5 text-right tabular-nums">{row.stok_minimum}</td>
                <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums text-slate-900">
                  {row.stok_awal}
                </td>
                <td className="py-1.5 px-2.5 text-center">
                  <BadgeStatus status={row.aktif ? 'aktif' : 'nonaktif'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
