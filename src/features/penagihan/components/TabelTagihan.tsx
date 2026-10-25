'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRupiah, formatTanggal } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { catatPelunasanAction } from '@/features/pesanan/actions';
import { TagihanItem, KlasifikasiTagihan } from '../types';
import { DialogCatatPenagihan } from './DialogCatatPenagihan';
import { DialogWhatsApp } from './DialogWhatsApp';
import { DialogRiwayatPenagihan } from './DialogRiwayatPenagihan';
import { normalisasiNomorTelepon } from '../utils';

interface TabelTagihanProps {
  initialItems: TagihanItem[];
  peran: string;
}

type TabFilter = 'semua' | 'overdue' | 'hari_ini' | 'segera' | 'belum_tempo';

export function TabelTagihan({ initialItems, peran }: TabelTagihanProps) {
  const router = useRouter();
  const [items, setItems] = useState<TagihanItem[]>(initialItems);
  const [tabAktif, setTabAktif] = useState<TabFilter>('semua');
  const [search, setSearch] = useState('');
  const [pelangganFilter, setPelangganFilter] = useState('');

  // State untuk Dialog Modal
  const [selectedTagihanWa, setSelectedTagihanWa] = useState<TagihanItem | null>(null);
  const [dialogWaOpen, setDialogWaOpen] = useState(false);

  const [selectedTagihanCatat, setSelectedTagihanCatat] = useState<TagihanItem | null>(null);
  const [dialogCatatOpen, setDialogCatatOpen] = useState(false);

  const [selectedTagihanRiwayat, setSelectedTagihanRiwayat] = useState<TagihanItem | null>(null);
  const [dialogRiwayatOpen, setDialogRiwayatOpen] = useState(false);

  // State Konfirmasi Pelunasan
  const [pelunasanTarget, setPelunasanTarget] = useState<TagihanItem | null>(null);
  const [loadingPelunasan, setLoadingPelunasan] = useState(false);

  // Daftar unik pelanggan untuk filter dropdown
  const opsiPelanggan = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      map.set(item.pelanggan_id, item.nama_toko);
    });
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Filter Tab Klasifikasi
      if (tabAktif === 'overdue' && !item.klasifikasi.startsWith('overdue')) return false;
      if (tabAktif === 'hari_ini' && item.klasifikasi !== 'hari_ini') return false;
      if (tabAktif === 'segera' && item.klasifikasi !== 'segera') return false;
      if (tabAktif === 'belum_tempo' && item.klasifikasi !== 'belum_jatuh_tempo') return false;

      // 2. Filter Pelanggan
      if (pelangganFilter && item.pelanggan_id !== pelangganFilter) return false;

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNomor = item.nomor_pesanan.toLowerCase().includes(q);
        const matchToko = item.nama_toko.toLowerCase().includes(q);
        const matchSales = item.nama_sales.toLowerCase().includes(q);
        if (!matchNomor && !matchToko && !matchSales) return false;
      }

      return true;
    });
  }, [items, tabAktif, pelangganFilter, search]);

  const handlePelunasanConfirm = async () => {
    if (!pelunasanTarget) return;
    setLoadingPelunasan(true);
    try {
      const res = await catatPelunasanAction(pelunasanTarget.pesanan_id);
      if (res.success) {
        // Hapus dari state lokal dan refresh router
        setItems((prev) => prev.filter((i) => i.pesanan_id !== pelunasanTarget.pesanan_id));
        setPelunasanTarget(null);
        router.refresh();
      } else {
        alert(res.message || 'Gagal mencatat pelunasan faktur');
      }
    } catch {
      alert('Terjadi kesalahan saat memproses pelunasan');
    } finally {
      setLoadingPelunasan(false);
    }
  };

  const renderBadgeKlasifikasi = (klasifikasi: KlasifikasiTagihan, terlambat: number, menuju: number) => {
    switch (klasifikasi) {
      case 'hari_ini':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            Jatuh Tempo Hari Ini
          </span>
        );
      case 'segera':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Segera ({menuju} hari lagi)
          </span>
        );
      case 'overdue_1_7':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            Terlambat {terlambat} hari
          </span>
        );
      case 'overdue_8_30':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
            Terlambat {terlambat} hari
          </span>
        );
      case 'overdue_lebih_30':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white">
            Kritis (&gt;30 hari)
          </span>
        );
      case 'belum_jatuh_tempo':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-normal bg-slate-100 text-slate-700">
            {menuju} hari lagi
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Filter Klasifikasi */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        {[
          { id: 'semua', label: 'Semua Tagihan' },
          { id: 'overdue', label: 'Menunggak (Overdue)' },
          { id: 'hari_ini', label: 'Jatuh Tempo Hari Ini' },
          { id: 'segera', label: 'Segera (1–3 Hari)' },
          { id: 'belum_tempo', label: 'Belum Tempo (>3 Hari)' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTabAktif(tab.id as TabFilter)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tabAktif === tab.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bar Pencarian & Filter Pelanggan */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-lg">
          <Input
            placeholder="Cari nomor pesanan, nama toko, atau sales..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs bg-white"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearch('')}
              className="h-8 text-xs text-slate-500"
            >
              Reset
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={pelangganFilter}
            onChange={(e) => setPelangganFilter(e.target.value)}
            className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">Semua Pelanggan</option>
            {opsiPelanggan.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabel Data Padat */}
      <div className="rounded-2xl border border-[#e2ebf6] bg-white overflow-hidden shadow-sm">
        <div className="overflow-auto max-h-[calc(100vh-230px)] min-h-[300px] scrollbar-thin">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead className="bg-[#f0f5fa] sticky top-0 z-20">
              <tr>
                <th className="py-2.5 px-3 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Nomor SO</th>
                <th className="py-2.5 px-3 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Pelanggan</th>
                <th className="py-2.5 px-3 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Sales</th>
                <th className="py-2.5 px-3 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Tgl Kirim</th>
                <th className="py-2.5 px-3 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Jatuh Tempo</th>
                <th className="py-2.5 px-3 text-right sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Total Nilai</th>
                <th className="py-2.5 px-3 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Klasifikasi Umur</th>
                <th className="py-2.5 px-3 sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Janji Bayar</th>
                <th className="py-2.5 px-3 text-right sticky top-0 z-20 bg-[#f0f5fa] text-[#0c1a30] font-bold border-b border-[#e2ebf6] shadow-[0_1px_0_0_#e2ebf6]">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white text-slate-800 [&_td]:border-b [&_td]:border-[#eef4fb]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Tidak ada tagihan yang sesuai dengan filter atau kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const norm = normalisasiNomorTelepon(item.telepon);
                  return (
                    <tr key={item.pesanan_id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Nomor SO */}
                      <td className="py-2 px-3 font-medium">
                        <Link
                          href={`/pesanan/${item.pesanan_id}`}
                          className="text-slate-900 hover:underline font-mono"
                        >
                          {item.nomor_pesanan}
                        </Link>
                      </td>

                      {/* Pelanggan */}
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-900">{item.nama_toko}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.kode_pelanggan} &bull; Termin {item.termin_hari} hr
                        </div>
                      </td>

                      {/* Sales */}
                      <td className="py-2 px-3 text-slate-600">
                        {item.nama_sales}
                      </td>

                      {/* Tgl Kirim */}
                      <td className="py-2 px-3 text-slate-500 tabular-nums">
                        {formatTanggal(item.dikirim_pada)}
                      </td>

                      {/* Jatuh Tempo */}
                      <td className="py-2 px-3 font-medium tabular-nums text-slate-900">
                        {formatTanggal(item.jatuh_tempo)}
                      </td>

                      {/* Total Nilai */}
                      <td className="py-2 px-3 text-right font-semibold tabular-nums text-slate-900">
                        {formatRupiah(item.total)}
                      </td>

                      {/* Klasifikasi Umur */}
                      <td className="py-2 px-3">
                        {renderBadgeKlasifikasi(item.klasifikasi, item.hari_terlambat, item.hari_menuju)}
                      </td>

                      {/* Janji Bayar */}
                      <td className="py-2 px-3 text-[11px]">
                        {item.janji_bayar_tanggal ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-medium tabular-nums">
                              <span>{formatTanggal(item.janji_bayar_tanggal)}</span>
                              {item.status_janji === 'terlewat' ? (
                                <span className="rounded bg-red-100 text-red-800 px-1 text-[10px] font-bold">
                                  Terlewat
                                </span>
                              ) : (
                                <span className="rounded bg-emerald-100 text-emerald-800 px-1 text-[10px] font-semibold">
                                  Aktif
                                </span>
                              )}
                            </div>
                            {item.janji_catatan && (
                              <p className="text-slate-500 line-clamp-1 max-w-[140px]" title={item.janji_catatan}>
                                {item.janji_catatan}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* WhatsApp Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!norm.valid}
                            title={norm.valid ? 'Kirim Pengingat WhatsApp' : norm.pesanError}
                            onClick={() => {
                              setSelectedTagihanWa(item);
                              setDialogWaOpen(true);
                            }}
                            className={`h-7 px-2 text-[11px] ${
                              norm.valid
                                ? 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200'
                                : 'text-slate-300 border-slate-200'
                            }`}
                          >
                            WA
                          </Button>

                          {/* Catat Penagihan Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            title="Catat Percakapan / Janji Bayar"
                            onClick={() => {
                              setSelectedTagihanCatat(item);
                              setDialogCatatOpen(true);
                            }}
                            className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-100"
                          >
                            Catat
                          </Button>

                          {/* Riwayat Penagihan Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Lihat Riwayat Interaksi"
                            onClick={() => {
                              setSelectedTagihanRiwayat(item);
                              setDialogRiwayatOpen(true);
                            }}
                            className="h-7 px-1.5 text-[11px] text-slate-500"
                          >
                            Riwayat
                          </Button>

                          {/* Kartu Piutang Link */}
                          <Link
                            href={`/pelanggan/${item.pelanggan_id}/piutang`}
                            className="inline-flex items-center h-7 px-2 text-[11px] font-medium border border-slate-200 rounded text-slate-700 hover:bg-slate-50"
                            title="Buka Kartu Piutang Siap Cetak"
                          >
                            Kartu
                          </Link>

                          {/* Tombol Catat Pelunasan (Khusus Manajer) */}
                          {peran === 'manajer' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPelunasanTarget(item)}
                              className="h-7 px-2 text-[11px] text-blue-700 border-blue-200 hover:bg-blue-50 font-medium"
                            >
                              Lunas
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog WhatsApp */}
      <DialogWhatsApp
        open={dialogWaOpen}
        onOpenChange={setDialogWaOpen}
        tagihan={selectedTagihanWa}
        onSuccess={() => router.refresh()}
      />

      {/* Modal Dialog Catat Penagihan */}
      {selectedTagihanCatat && (
        <DialogCatatPenagihan
          open={dialogCatatOpen}
          onOpenChange={setDialogCatatOpen}
          pelangganId={selectedTagihanCatat.pelanggan_id}
          namaToko={selectedTagihanCatat.nama_toko}
          pesananJualId={selectedTagihanCatat.pesanan_id}
          nomorPesanan={selectedTagihanCatat.nomor_pesanan}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Modal Dialog Riwayat Penagihan */}
      {selectedTagihanRiwayat && (
        <DialogRiwayatPenagihan
          open={dialogRiwayatOpen}
          onOpenChange={setDialogRiwayatOpen}
          pelangganId={selectedTagihanRiwayat.pelanggan_id}
          namaToko={selectedTagihanRiwayat.nama_toko}
          pesananJualId={selectedTagihanRiwayat.pesanan_id}
          nomorPesanan={selectedTagihanRiwayat.nomor_pesanan}
        />
      )}

      {/* Dialog Konfirmasi Catat Pelunasan Manajer */}
      {pelunasanTarget && (
        <ConfirmDialog
          open={!!pelunasanTarget}
          onOpenChange={(open) => !open && setPelunasanTarget(null)}
          title="Konfirmasi Pelunasan Faktur"
          description={`Anda akan mencatat pelunasan PENUH untuk faktur ${pelunasanTarget.nomor_pesanan} senilai ${formatRupiah(pelunasanTarget.total)} (${pelunasanTarget.nama_toko}). Faktur akan otomatis dikeluarkan dari daftar penagihan piutang.`}
          confirmLabel={loadingPelunasan ? 'Memproses...' : 'Ya, Catat Lunas'}
          cancelLabel="Batal"
          onConfirm={handlePelunasanConfirm}
          variant="default"
        />
      )}
    </div>
  );
}
