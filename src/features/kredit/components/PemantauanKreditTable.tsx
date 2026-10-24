'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { formatRupiah } from '@/lib/format';
import type { ItemPemantauanKredit } from '../types';
import { 
  Search, 
  ExternalLink,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface PemantauanKreditTableProps {
  initialItems: ItemPemantauanKredit[];
}

export function PemantauanKreditTable({ initialItems }: PemantauanKreditTableProps) {
  const [search, setSearch] = useState('');
  const [selectedKelas, setSelectedKelas] = useState<string>('semua');
  const [filterUtilisasi80, setFilterUtilisasi80] = useState(false);
  const [filterPerluTinjau, setFilterPerluTinjau] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState(false);

  const getBadgeKelasStyle = (kelas: string) => {
    switch (kelas) {
      case 'A':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'B':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'C':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'D':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredItems = useMemo(() => {
    return initialItems.filter((item) => {
      // Search
      const matchSearch =
        search.trim() === '' ||
        item.nama_toko.toLowerCase().includes(search.toLowerCase()) ||
        item.kode.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      // Filter Kelas
      if (selectedKelas !== 'semua') {
        if (selectedKelas === 'belum_cukup') {
          if (item.kelas !== 'Data belum cukup') return false;
        } else if (item.kelas !== selectedKelas) {
          return false;
        }
      }

      // Filter Utilisasi > 80%
      if (filterUtilisasi80 && item.pemakaian_limit_persen < 80) {
        return false;
      }

      // Filter Perlu Tinjau
      if (filterPerluTinjau && item.status_tinjau === 'normal') {
        return false;
      }

      // Filter Overdue
      if (filterOverdue && item.hari_overdue_terlama <= 0) {
        return false;
      }

      return true;
    });
  }, [initialItems, search, selectedKelas, filterUtilisasi80, filterPerluTinjau, filterOverdue]);

  return (
    <div className="space-y-3">
      {/* Baris Filter & Kontrol */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-3 rounded-md border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Filter Kelas */}
          <div className="flex items-center rounded-md border border-slate-200 p-0.5 bg-slate-50 text-xs">
            {[
              { id: 'semua', label: 'Semua' },
              { id: 'A', label: 'Kelas A' },
              { id: 'B', label: 'Kelas B' },
              { id: 'C', label: 'Kelas C' },
              { id: 'D', label: 'Kelas D' },
              { id: 'belum_cukup', label: 'Belum Cukup' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedKelas(tab.id)}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  selectedKelas === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Checkbox Filter Cepat */}
          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer ml-1 select-none">
            <input
              type="checkbox"
              checked={filterUtilisasi80}
              onChange={(e) => setFilterUtilisasi80(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-400 h-3.5 w-3.5"
            />
            <span>Utilisasi &gt; 80%</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterPerluTinjau}
              onChange={(e) => setFilterPerluTinjau(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-400 h-3.5 w-3.5"
            />
            <span>Perlu Tinjau</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterOverdue}
              onChange={(e) => setFilterOverdue(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-400 h-3.5 w-3.5"
            />
            <span>Ada Overdue</span>
          </label>
        </div>

        {/* Pencarian Nama Toko */}
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode atau nama toko..."
            className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* Tabel Data Enterprise Padat */}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-100 text-slate-700 font-medium sticky top-0 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Pelanggan</th>
              <th className="py-2.5 px-3 text-right">Batas Kredit</th>
              <th className="py-2.5 px-3 text-right">Utilisasi</th>
              <th className="py-2.5 px-3 text-right">Piutang Berjalan</th>
              <th className="py-2.5 px-3 text-center">Overdue</th>
              <th className="py-2.5 px-3 text-center">Kelas &amp; Skor</th>
              <th className="py-2.5 px-3 text-right">Saran Limit</th>
              <th className="py-2.5 px-3 text-center">Status Tinjau</th>
              <th className="py-2.5 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                  Tidak ada pelanggan yang memenuhi kriteria filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.pelanggan_id} className="hover:bg-slate-50/75 transition-colors">
                  <td className="py-2 px-3">
                    <Link
                      href={`/pelanggan/${item.pelanggan_id}`}
                      className="font-medium text-slate-900 hover:text-blue-600 block"
                    >
                      {item.nama_toko}
                    </Link>
                    <span className="text-[11px] text-slate-400 font-mono">{item.kode}</span>
                  </td>

                  <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-800">
                    {formatRupiah(item.batas_kredit)}
                  </td>

                  <td className="py-2 px-3 text-right tabular-nums">
                    <span
                      className={`font-semibold ${
                        item.pemakaian_limit_persen > 100
                          ? 'text-red-700'
                          : item.pemakaian_limit_persen >= 80
                          ? 'text-amber-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {item.pemakaian_limit_persen}%
                    </span>
                  </td>

                  <td className="py-2 px-3 text-right tabular-nums text-slate-800">
                    {formatRupiah(item.piutang_berjalan)}
                  </td>

                  <td className="py-2 px-3 text-center">
                    {item.hari_overdue_terlama > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        {item.hari_overdue_terlama} hr ({item.faktur_overdue_sekarang} fktr)
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 font-medium">
                        Lancar
                      </span>
                    )}
                  </td>

                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${getBadgeKelasStyle(
                          item.kelas
                        )}`}
                      >
                        {item.kelas === 'Data belum cukup' ? 'Data Kurang' : `Kelas ${item.kelas}`}
                      </span>
                      {item.skor_total !== null && (
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          ({item.skor_total})
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2 px-3 text-right tabular-nums">
                    {item.rekomendasi_limit !== null ? (
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {formatRupiah(item.rekomendasi_limit)}
                        </span>
                        {item.status_rekomendasi === 'Naikkan' && (
                          <span className="text-[10px] text-emerald-700 font-medium">
                            + {formatRupiah(item.selisih_limit)}
                          </span>
                        )}
                        {item.status_rekomendasi === 'Tinjau penurunan' && (
                          <span className="text-[10px] text-red-700 font-medium">
                            Tinjau Turun
                          </span>
                        )}
                        {item.status_rekomendasi === 'Pertahankan' && (
                          <span className="text-[10px] text-slate-400">Pertahankan</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="py-2 px-3 text-center">
                    {item.status_tinjau === 'terlambat' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        <Clock className="h-3 w-3" />
                        Terlambat ({item.hari_sejak_tinjau_limit} hr)
                      </span>
                    ) : item.status_tinjau === 'perlu_tinjau' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        <Clock className="h-3 w-3" />
                        Perlu ({item.hari_sejak_tinjau_limit} hr)
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {item.hari_sejak_tinjau_limit} hr
                      </span>
                    )}
                  </td>

                  <td className="py-2 px-3 text-right">
                    <Link
                      href={`/pelanggan/${item.pelanggan_id}`}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium text-xs px-2 py-1 rounded hover:bg-slate-100"
                    >
                      <span>Evaluasi</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
        <span>Menampilkan {filteredItems.length} dari {initialItems.length} pelanggan</span>
        <span>Perhitungan bersumber dari fungsi database tunggal.</span>
      </div>
    </div>
  );
}
