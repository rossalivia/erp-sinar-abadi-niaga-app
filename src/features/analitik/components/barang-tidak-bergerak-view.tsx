'use client';

import * as React from 'react';
import Link from 'next/link';
import { PackageX, DollarSign, Clock, Layers } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { formatTanggalWib } from '../utils';
import type { BarangTidakBergerakItem } from '../types';

interface BarangTidakBergerakViewProps {
  data: BarangTidakBergerakItem[];
  ambang: number;
}

export function BarangTidakBergerakView({ data, ambang }: BarangTidakBergerakViewProps) {
  const totalSku = data.length;
  const totalUnit = data.reduce((acc, curr) => acc + Number(curr.stok_saat_ini || 0), 0);
  const totalModalTertahan = data.reduce(
    (acc, curr) => acc + Number(curr.nilai_stok_mengendap || 0),
    0
  );
  const rataHariMengendap =
    totalSku > 0
      ? Math.round(data.reduce((acc, curr) => acc + Number(curr.hari_mengendap || 0), 0) / totalSku)
      : 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>SKU Tidak Bergerak</span>
            <PackageX className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-lg font-semibold text-red-700 tabular-nums">
            {totalSku} Barang
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Tidak ada penjualan ≥ {ambang} hari
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Modal Tertahan</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-semibold text-amber-700 tabular-nums">
            {formatRupiah(totalModalTertahan)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Nilai kas beku di rak gudang (HPP)
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Unit Fisik Mengendap</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {totalUnit} Unit
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Kuantitas persediaan diam di rak
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Rata-rata Waktu Mengendap</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {rataHariMengendap} Hari
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Sejak penjualan terakhir / barang masuk
          </div>
        </div>
      </div>

      {/* Tabel Data Padat */}
      <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 px-3 font-medium">Barang</th>
                <th className="py-2 px-3 font-medium text-right">Stok Fisik</th>
                <th className="py-2 px-3 font-medium text-right">Stok Min</th>
                <th className="py-2 px-3 font-medium text-right">Harga Pokok (HPP)</th>
                <th className="py-2 px-3 font-medium text-right">Modal Tertahan</th>
                <th className="py-2 px-3 font-medium text-right">Harga Jual</th>
                <th className="py-2 px-3 font-medium">Penjualan Terakhir</th>
                <th className="py-2 px-3 font-medium text-right">Hari Mengendap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    Bagus! Seluruh persediaan bergerak aktif dalam {ambang} hari terakhir.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.barang_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-900">
                      <Link
                        href={`/barang/${row.barang_id}`}
                        className="hover:underline text-blue-700 font-semibold"
                      >
                        {row.nama}
                      </Link>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {row.kode} • {row.satuan}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                      {row.stok_saat_ini} {row.satuan}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 tabular-nums">
                      {row.stok_minimum}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                      {formatRupiah(row.harga_pokok)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-amber-700 tabular-nums">
                      {formatRupiah(row.nilai_stok_mengendap)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                      {formatRupiah(row.harga_jual)}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {row.penjualan_terakhir_pada ? (
                        <div>
                          <div>{formatTanggalWib(row.penjualan_terakhir_pada)}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {row.nomor_pesanan_terakhir}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-700 italic font-normal">
                          Belum pernah terjual
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          row.hari_mengendap >= 90
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : row.hari_mengendap >= 60
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {row.hari_mengendap} hari
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
