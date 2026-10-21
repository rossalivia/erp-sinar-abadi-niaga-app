import * as React from 'react';
import { formatRupiah } from '@/lib/format';
import type { ItemPesananJualRow } from '../types';

interface PesananItemsTableProps {
  items: ItemPesananJualRow[];
  totalPesanan: number;
  isManajer?: boolean;
}

export function PesananItemsTable({
  items,
  totalPesanan,
  isManajer = false,
}: PesananItemsTableProps) {
  const totalMargin = React.useMemo(() => {
    if (!isManajer) return 0;
    return items.reduce((acc, it) => acc + (it.margin ?? 0), 0);
  }, [items, isManajer]);

  return (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Rincian Barang ({items.length} Baris)
        </h3>
        {isManajer && (
          <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
            Tampilan Khusus Manajer (HPP & Margin)
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200 sticky top-0">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">No</th>
              <th className="py-2.5 px-3 w-28">Kode</th>
              <th className="py-2.5 px-3 min-w-[200px]">Nama Barang</th>
              <th className="py-2.5 px-3 w-16 text-center">Satuan</th>
              <th className="py-2.5 px-3 w-20 text-right">Jumlah</th>
              <th className="py-2.5 px-3 w-28 text-right">Harga Jual</th>
              <th className="py-2.5 px-3 w-20 text-right">Diskon</th>
              <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
              {isManajer && (
                <>
                  <th className="py-2.5 px-3 w-28 text-right bg-slate-200/50 text-slate-800">
                    HPP Satuan
                  </th>
                  <th className="py-2.5 px-3 w-32 text-right bg-slate-200/50 text-slate-800">
                    Margin
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((row, idx) => (
              <tr
                key={row.id}
                className={idx % 2 === 1 ? 'bg-slate-50/50 hover:bg-slate-50' : 'hover:bg-slate-50/50'}
              >
                <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                <td className="py-2 px-3 font-mono font-medium text-slate-800">
                  {row.barang?.kode || '-'}
                </td>
                <td className="py-2 px-3 text-slate-900 font-medium">
                  {row.barang?.nama || '-'}
                </td>
                <td className="py-2 px-3 text-center text-slate-500">
                  {row.barang?.satuan || '-'}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 font-medium">
                  {row.jumlah}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                  {formatRupiah(row.harga_satuan)}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                  {row.diskon_persen > 0 ? `${row.diskon_persen}%` : '-'}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                  {formatRupiah(row.subtotal)}
                </td>
                {isManajer && (
                  <>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 bg-slate-50/30">
                      {row.hpp_satuan !== null && row.hpp_satuan !== undefined
                        ? formatRupiah(row.hpp_satuan)
                        : '-'}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono tabular-nums font-medium bg-slate-50/30 ${
                        (row.margin ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatRupiah(row.margin ?? 0)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-semibold text-slate-900">
            <tr>
              <td
                colSpan={7}
                className="py-3 px-4 text-right uppercase tracking-wider text-xs text-slate-700"
              >
                Total Nilai Pesanan:
              </td>
              <td className="py-3 px-3 text-right font-mono tabular-nums text-sm font-bold text-slate-900">
                {formatRupiah(totalPesanan)}
              </td>
              {isManajer && (
                <>
                  <td className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-slate-600 bg-slate-100">
                    Total Margin:
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums text-sm font-bold bg-slate-100 ${
                      totalMargin < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatRupiah(totalMargin)}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
