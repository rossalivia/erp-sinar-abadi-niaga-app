'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Send,
  Edit,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BadgeStatus } from '@/components/shared/badge-status';
import { formatTanggalWaktu, formatRupiah } from '@/lib/format';
import {
  ajukanOpnameAction,
  setujuiOpnameAction,
  batalkanOpnameAction,
} from '../actions';
import type { OpnameStokHeader, ItemOpnameStok } from '../types';
import type { Peran } from '@/types/auth';

interface OpnameDetailViewProps {
  header: OpnameStokHeader;
  items: ItemOpnameStok[];
  peran: Peran;
  currentUserId: string;
}

export function OpnameDetailView({
  header,
  items,
  peran,
  currentUserId,
}: OpnameDetailViewProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelReasonError, setCancelReasonError] = React.useState<string | null>(null);

  const canEditDraf =
    header.status === 'draf' &&
    (peran === 'manajer' || (peran === 'gudang' && header.dibuat_oleh === currentUserId));

  const canApprove = header.status === 'diajukan' && peran === 'manajer';
  const canCancel =
    (header.status === 'draf' && canEditDraf) ||
    (header.status === 'diajukan' && peran === 'manajer');

  // Handle Ajukan Draf
  const handleAjukan = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await ajukanOpnameAction(header.id);
      if (!res.success) {
        setErrorMessage(res.message || 'Gagal mengajukan sesi opname.');
        setIsLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage('Terjadi kesalahan jaringan.');
      setIsLoading(false);
    }
  };

  // Handle Setujui Manajer
  const handleSetujui = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await setujuiOpnameAction(header.id);
      if (!res.success) {
        setErrorMessage(res.message || 'Gagal menyetujui sesi opname.');
        setIsLoading(false);
        setShowConfirmModal(false);
        return;
      }
      setShowConfirmModal(false);
      router.refresh();
    } catch {
      setErrorMessage('Terjadi kesalahan jaringan.');
      setIsLoading(false);
      setShowConfirmModal(false);
    }
  };

  // Handle Batalkan / Tolak Sesi
  const handleBatalkan = async () => {
    if (cancelReason.trim().length < 10) {
      setCancelReasonError('Alasan pembatalan minimal 10 karakter.');
      return;
    }

    setIsLoading(true);
    setCancelReasonError(null);
    try {
      const res = await batalkanOpnameAction({
        id: header.id,
        alasan: cancelReason.trim(),
      });
      if (!res.success) {
        setCancelReasonError(res.message || 'Gagal membatalkan sesi.');
        setIsLoading(false);
        return;
      }
      setShowCancelModal(false);
      router.refresh();
    } catch {
      setCancelReasonError('Terjadi kesalahan jaringan.');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title={`Sesi Stock Opname ${header.nomor}`}
        description="Hasil inventarisasi fisik rak gudang dan status evaluasi persetujuan."
      >
        <div className="flex items-center gap-2">
          <Link
            href="/stok/opname"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Kembali ke Daftar</span>
          </Link>

          {canEditDraf && (
            <Link
              href={`/stok/opname/${header.id}/ubah`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors shadow-none"
            >
              <Edit className="h-3.5 w-3.5 text-slate-600" />
              <span>Ubah Hitungan</span>
            </Link>
          )}

          {canEditDraf && (
            <button
              type="button"
              onClick={handleAjukan}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-none"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Ajukan ke Manajer</span>
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => {
                setCancelReason('');
                setCancelReasonError(null);
                setShowCancelModal(true);
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors shadow-none"
            >
              <XCircle className="h-3.5 w-3.5 text-red-600" />
              <span>Batalkan Sesi</span>
            </button>
          )}
        </div>
      </PageHeader>

      {/* Error Alert Global */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Banner Khusus Manajer: Review Approval */}
      {canApprove && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-800 border border-amber-200">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Menunggu Persetujuan Manajer
              </h4>
              <p className="text-xs text-amber-900 mt-0.5">
                Staf Gudang telah memvalidasi hitungan fisik riil. Menyetujui sesi ini akan langsung mengoreksi stok master barang dan mencatat mutasi penyesuaian di kartu stok.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setCancelReason('');
                setCancelReasonError(null);
                setShowCancelModal(true);
              }}
              disabled={isLoading}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
            >
              Tolak Sesi
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 shadow-none transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Setujui & Perbarui Stok</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Info Card */}
      <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-5 shadow-neu-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Nomor Dokumen:</span>
            <span className="font-mono font-semibold text-slate-900 text-sm">
              {header.nomor}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block">Status Sesi:</span>
            <div className="mt-0.5">
              <BadgeStatus status={header.status} />
            </div>
          </div>

          <div>
            <span className="text-slate-500 block">Dibuat Oleh & Waktu:</span>
            <span className="font-medium text-slate-800 block">
              {header.pembuat_nama || '-'}
            </span>
            <span className="text-[11px] text-slate-500">
              {formatTanggalWaktu(header.dibuat_pada)}
            </span>
          </div>

          <div>
            {header.status === 'disetujui' && (
              <>
                <span className="text-slate-500 block">Disetujui Oleh:</span>
                <span className="font-medium text-emerald-800 block">
                  {header.penyetuju_nama || '-'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {formatTanggalWaktu(header.disetujui_pada)}
                </span>
              </>
            )}
            {header.status === 'dibatalkan' && (
              <>
                <span className="text-slate-500 block">Dibatalkan Oleh:</span>
                <span className="font-medium text-red-800 block">
                  {header.pembatal_nama || '-'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {formatTanggalWaktu(header.dibatalkan_pada)}
                </span>
              </>
            )}
            {header.status === 'diajukan' && (
              <>
                <span className="text-slate-500 block">Waktu Pengajuan:</span>
                <span className="font-medium text-slate-800 block">
                  {formatTanggalWaktu(header.diajukan_pada)}
                </span>
              </>
            )}
            {header.status === 'draf' && (
              <>
                <span className="text-slate-500 block">Keterangan Status:</span>
                <span className="font-medium text-slate-600 block">
                  Masih dalam pengerjaan hitung fisik
                </span>
              </>
            )}
          </div>
        </div>

        {/* Catatan Dokumen */}
        {header.catatan && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Catatan / Area Audit: </span>
            <span className="text-slate-800">{header.catatan}</span>
          </div>
        )}

        {/* Alasan Pembatalan jika ada */}
        {header.alasan_batal && (
          <div className="mt-3 pt-3 border-t border-red-100 bg-red-50/50 p-2.5 rounded text-xs text-red-800">
            <span className="font-semibold block">Alasan Pembatalan / Penolakan:</span>
            <span>{header.alasan_batal}</span>
          </div>
        )}
      </div>

      {/* Tabel Detail Item Opname */}
      <div className="rounded-2xl border border-white/80 bg-white shadow-neu-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Rincian Barang & Perbandingan Stok ({items.length} Barang)
          </h3>
          {peran === 'manajer' && typeof header.estimasi_nilai_selisih === 'number' && (
            <span className="text-xs font-semibold text-slate-800">
              Total Estimasi Selisih Finansial:{' '}
              <span
                className={
                  header.estimasi_nilai_selisih < 0
                    ? 'text-red-700'
                    : header.estimasi_nilai_selisih > 0
                    ? 'text-blue-700'
                    : 'text-slate-700'
                }
              >
                {formatRupiah(header.estimasi_nilai_selisih)}
              </span>
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-left w-12">No</th>
                <th className="py-2 px-3 text-left w-28">Kode</th>
                <th className="py-2 px-3 text-left">Nama Barang & Satuan</th>
                <th className="py-2 px-3 text-right w-28">Stok Sistem</th>
                <th className="py-2 px-3 text-right w-28">Stok Fisik</th>
                <th className="py-2 px-3 text-center w-32">Selisih Unit</th>
                {peran === 'manajer' && (
                  <th className="py-2 px-3 text-right w-32">HPP Modal</th>
                )}
                {peran === 'manajer' && (
                  <th className="py-2 px-3 text-right w-36">Estimasi Nilai</th>
                )}
                <th className="py-2 px-3 text-left">Keterangan / Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const selisih = item.selisih;
                let selisihClass = 'bg-slate-100 text-slate-600 border-slate-200';
                let selisihLabel = 'Cocok (0)';
                if (selisih < 0) {
                  selisihClass = 'bg-red-50 text-red-700 border-red-200 font-semibold';
                  selisihLabel = `${selisih} ${item.satuan || ''}`;
                } else if (selisih > 0) {
                  selisihClass = 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
                  selisihLabel = `+${selisih} ${item.satuan || ''}`;
                }

                const nilaiSelisih =
                  item.harga_pokok && selisih ? selisih * item.harga_pokok : 0;

                return (
                  <tr
                    key={item.id || item.barang_id}
                    className={`hover:bg-slate-50/75 transition-colors ${
                      selisih !== 0 ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-800">
                      {item.kode_barang}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {item.nama_barang}{' '}
                      <span className="text-[11px] font-normal text-slate-500">
                        ({item.satuan})
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                      {item.stok_sistem} {item.satuan}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-900">
                      {item.stok_fisik} {item.satuan}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border font-mono ${selisihClass}`}
                      >
                        {selisihLabel}
                      </span>
                    </td>
                    {peran === 'manajer' && (
                      <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                        {formatRupiah(item.harga_pokok)}
                      </td>
                    )}
                    {peran === 'manajer' && (
                      <td
                        className={`py-2 px-3 text-right tabular-nums font-medium ${
                          nilaiSelisih < 0
                            ? 'text-red-700'
                            : nilaiSelisih > 0
                            ? 'text-blue-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {formatRupiah(nilaiSelisih)}
                      </td>
                    )}
                    <td className="py-2 px-3 text-slate-600">
                      {item.keterangan || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Ringkasan Total */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-500">Total Diperiksa: </span>
              <span className="font-semibold text-slate-900">
                {header.total_item} barang
              </span>
            </div>
            <div>
              <span className="text-slate-500">Akumulasi Net Selisih: </span>
              <span
                className={`font-semibold font-mono ${
                  header.total_selisih_unit < 0
                    ? 'text-red-700'
                    : header.total_selisih_unit > 0
                    ? 'text-blue-700'
                    : 'text-slate-800'
                }`}
              >
                {header.total_selisih_unit > 0
                  ? `+${header.total_selisih_unit}`
                  : header.total_selisih_unit}{' '}
                unit
              </span>
            </div>
          </div>

          {header.status === 'disetujui' && (
            <div className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Stok master barang telah disinkronkan ke nilai fisik</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog Persetujuan Manajer */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Konfirmasi Persetujuan Stock Opname
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Apakah Anda yakin menyetujui sesi stock opname <strong>{header.nomor}</strong>?
                </p>
                <div className="rounded bg-slate-50 border border-slate-200 p-2.5 mt-2.5 text-[11px] text-slate-600 space-y-1">
                  <div>- Stok barang di sistem akan diselaraskan dengan hasil hitung fisik.</div>
                  <div>- Kartu stok berjenis <code>penyesuaian</code> akan otomatis diterbitkan.</div>
                  <div>- Tindakan ini bersifat permanen dan dicatat pada audit log.</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isLoading}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSetujui}
                disabled={isLoading}
                className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-none"
              >
                {isLoading ? 'Menyetujui...' : 'Ya, Setujui & Koreksi Stok'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Pembatalan / Penolakan */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-700">
                <XCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Batalkan Sesi Stock Opname
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Mohon isi alasan pembatalan sesi <strong>{header.nomor}</strong>.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="alasan" className="block text-xs font-medium text-slate-700">
                Alasan Pembatalan (minimal 10 karakter):
              </label>
              <textarea
                id="alasan"
                rows={3}
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  setCancelReasonError(null);
                }}
                placeholder="Contoh: Kesalahan teknis perhitungan di rak B, perlu hitung ulang."
                className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
              />
              {cancelReasonError && (
                <span className="text-[11px] text-red-600 font-medium block">
                  {cancelReasonError}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isLoading}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleBatalkan}
                disabled={isLoading}
                className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-none"
              >
                {isLoading ? 'Memproses...' : 'Konfirmasi Pembatalan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
