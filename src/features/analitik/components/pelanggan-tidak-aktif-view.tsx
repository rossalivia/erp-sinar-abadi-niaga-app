'use client';

import * as React from 'react';
import Link from 'next/link';
import { UserX, AlertTriangle, MessageSquare, History } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { formatTanggalWib } from '../utils';
import type { PelangganTidakAktifItem } from '../types';

interface PelangganTidakAktifViewProps {
  data: PelangganTidakAktifItem[];
  ambang: number;
}

export function PelangganTidakAktifView({ data, ambang }: PelangganTidakAktifViewProps) {
  const totalPasif = data.length;
  const totalOmzetTerancam = data.reduce((acc, curr) => acc + Number(curr.total_omzet_historis || 0), 0);
  const totalPiutangGantung = data.reduce((acc, curr) => acc + Number(curr.piutang_berjalan || 0), 0);
  const rataHariPasif =
    totalPasif > 0
      ? Math.round(data.reduce((acc, curr) => acc + Number(curr.hari_tidak_aktif || 0), 0) / totalPasif)
      : 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Pelanggan Tidak Aktif</span>
            <UserX className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-lg font-semibold text-red-700 tabular-nums">
            {totalPasif} Akun
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Tidak ada transaksi ≥ {ambang} hari
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Riwayat Omzet Terancam</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {formatRupiah(totalOmzetTerancam)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Total historis belanja akun pasif
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Piutang Belum Tertagih</span>
            <History className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-semibold text-amber-700 tabular-nums">
            {formatRupiah(totalPiutangGantung)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Faktur berjalan pada akun pasif
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Rata-rata Inaktivitas</span>
            <UserX className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-semibold text-slate-900 tabular-nums">
            {rataHariPasif} Hari
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Sejak pesanan terakhir / registrasi
          </div>
        </div>
      </div>

      {/* Tabel Data Padat */}
      <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 px-3 font-medium">Pelanggan</th>
                <th className="py-2 px-3 font-medium">Terdaftar Sejak</th>
                <th className="py-2 px-3 font-medium">Pesanan Terakhir</th>
                <th className="py-2 px-3 font-medium text-right">Hari Tidak Aktif</th>
                <th className="py-2 px-3 font-medium text-right">Total Transaksi</th>
                <th className="py-2 px-3 font-medium text-right">Total Omzet Historis</th>
                <th className="py-2 px-3 font-medium text-right">Sisa Piutang</th>
                <th className="py-2 px-3 font-medium text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    Bagus! Tidak ditemukan pelanggan pasif dengan ambang batas ≥ {ambang} hari.
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const rawHp = (row.telepon || '').replace(/\D/g, '');
                  const waNumber = rawHp.startsWith('0') ? `62${rawHp.slice(1)}` : rawHp;

                  return (
                    <tr key={row.pelanggan_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-900">
                        <Link
                          href={`/pelanggan/${row.pelanggan_id}`}
                          className="hover:underline text-blue-700 font-semibold"
                        >
                          {row.nama_toko}
                        </Link>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {row.kode} • {row.telepon || '-'}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {formatTanggalWib(row.terdaftar_pada)}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {row.pesanan_terakhir_pada ? (
                          <div>
                            <div>{formatTanggalWib(row.pesanan_terakhir_pada)}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {row.nomor_pesanan_terakhir}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-700 italic font-normal">
                            Belum pernah pesan
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            row.hari_tidak_aktif >= 90
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : row.hari_tidak_aktif >= 60
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {row.hari_tidak_aktif} hari
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                        {row.total_pesanan_historis} SO
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                        {formatRupiah(row.total_omzet_historis)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-700 font-medium">
                        {row.piutang_berjalan > 0 ? formatRupiah(row.piutang_berjalan) : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {waNumber ? (
                          <a
                            href={`https://wa.me/${waNumber}?text=Halo%20${encodeURIComponent(
                              row.nama_toko
                            )},%20kami%20dari%20CV%20Sinar%20Abadi%20Niaga.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                          >
                            <MessageSquare className="w-3 h-3" />
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
