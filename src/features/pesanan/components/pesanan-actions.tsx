'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  Truck,
  CreditCard,
  XCircle,
  Edit,
  Printer,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  konfirmasiPesananAction,
  batalkanDrafAction,
  kirimPesananAction,
  catatPelunasanAction,
  batalkanPesananTerkonfirmasiAction,
} from '../actions';
import type { StatusPesanan } from '../types';
import type { Peran } from '@/types/auth';

interface PesananActionsProps {
  pesananId: string;
  nomor: string;
  status: StatusPesanan;
  peran: Peran;
  userId: string;
  dibuatOleh: string;
}

export function PesananActions({
  pesananId,
  nomor,
  status,
  peran,
  userId,
  dibuatOleh,
}: PesananActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  // Dialog State
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isCancelDraftOpen, setIsCancelDraftOpen] = React.useState(false);
  const [isShipOpen, setIsShipOpen] = React.useState(false);
  const [isPaidOpen, setIsPaidOpen] = React.useState(false);
  const [isCancelConfirmedOpen, setIsCancelConfirmedOpen] = React.useState(false);
  const [alasanBatal, setAlasanBatal] = React.useState('');
  const [alasanError, setAlasanError] = React.useState<string | null>(null);

  const isOwner = userId === dibuatOleh;
  const isManajer = peran === 'manajer';
  const isGudang = peran === 'gudang';

  // Penjualan pemilik draf / Manajer boleh mengubah & konfirmasi draf
  const canEditDraft = status === 'draf' && (isOwner || isManajer);
  const canConfirm = status === 'draf' && (isOwner || isManajer);
  const canCancelDraft = status === 'draf' && (isOwner || isManajer);

  // Gudang / Manajer boleh mengirim pesanan terkonfirmasi
  const canShip = status === 'dikonfirmasi' && (isGudang || isManajer);

  // Manajer boleh membatalkan pesanan terkonfirmasi
  const canCancelConfirmed = status === 'dikonfirmasi' && isManajer;

  // Manajer boleh melunasi pesanan berstatus dikirim
  const canMarkPaid = status === 'dikirim' && isManajer;

  // Cetak Dokumen:
  // - Surat Jalan HANYA pada status 'dikirim' untuk Gudang, Manajer, & Sales pemilik (S1)
  const canPrintSuratJalan = status === 'dikirim' && (isGudang || isManajer || (isOwner && peran === 'penjualan'));
  // - Faktur untuk Penjualan & Manajer pada pesanan non-draf non-batal
  const canPrintFaktur = (isManajer || (isOwner && peran === 'penjualan')) && status !== 'draf' && status !== 'dibatalkan';

  // 1. Konfirmasi Pesanan
  async function handleKonfirmasi() {
    setLoadingAction('konfirmasi');
    try {
      const res = await konfirmasiPesananAction(pesananId);
      if (!res.success) {
        toast.error(res.message || 'Gagal mengonfirmasi pesanan');
        return;
      }
      toast.success(res.message || 'Pesanan berhasil dikonfirmasi');
      setIsConfirmOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoadingAction(null);
    }
  }

  // 2. Batalkan Draf
  async function handleBatalkanDraf() {
    setLoadingAction('batal_draf');
    try {
      const res = await batalkanDrafAction(pesananId);
      if (!res.success) {
        toast.error(res.message || 'Gagal membatalkan draf');
        return;
      }
      toast.success('Draf pesanan berhasil dibatalkan');
      setIsCancelDraftOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoadingAction(null);
    }
  }

  // 3. Kirim Pesanan
  async function handleKirim() {
    setLoadingAction('kirim');
    try {
      const res = await kirimPesananAction(pesananId);
      if (!res.success) {
        toast.error(res.message || 'Gagal mengirim pesanan');
        return;
      }
      toast.success('Pesanan berhasil ditandai sebagai dikirim');
      setIsShipOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoadingAction(null);
    }
  }

  // 4. Catat Pelunasan
  async function handlePelunasan() {
    setLoadingAction('lunas');
    try {
      const res = await catatPelunasanAction(pesananId);
      if (!res.success) {
        toast.error(res.message || 'Gagal mencatat pelunasan');
        return;
      }
      toast.success('Pesanan berhasil dilunasi');
      setIsPaidOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoadingAction(null);
    }
  }

  // 5. Batalkan Pesanan Terkonfirmasi (Manajer)
  async function handleBatalkanTerkonfirmasi() {
    const trimmed = alasanBatal.trim();
    if (trimmed.length < 10) {
      setAlasanError('Alasan pembatalan minimal 10 karakter');
      return;
    }

    setLoadingAction('batal_terkonfirmasi');
    try {
      const res = await batalkanPesananTerkonfirmasiAction(pesananId, trimmed);
      if (!res.success) {
        toast.error(res.message || 'Gagal membatalkan pesanan terkonfirmasi');
        return;
      }
      toast.success(res.message || 'Pesanan berhasil dibatalkan dan stok dikembalikan');
      setIsCancelConfirmedOpen(false);
      setAlasanBatal('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Cetak Surat Jalan (Khusus status dikirim) */}
      {canPrintSuratJalan && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="text-xs h-8 gap-1.5 border-slate-300 text-slate-800 hover:text-slate-900"
        >
          <Link href={`/pesanan/${pesananId}/surat-jalan`}>
            <Printer className="w-3.5 h-3.5" />
            Cetak Surat Jalan
          </Link>
        </Button>
      )}

      {/* Cetak Faktur (Penjualan & Manajer) */}
      {canPrintFaktur && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="text-xs h-8 gap-1.5 border-slate-300"
        >
          <Link href={`/pesanan/${pesananId}/cetak`}>
            <Printer className="w-3.5 h-3.5" />
            Cetak Faktur
          </Link>
        </Button>
      )}

      {/* Ubah Draf */}
      {canEditDraft && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="text-xs h-8 gap-1.5 border-slate-300"
        >
          <Link href={`/pesanan/${pesananId}/ubah`}>
            <Edit className="w-3.5 h-3.5" />
            Ubah Draf
          </Link>
        </Button>
      )}

      {/* Batalkan Draf */}
      {canCancelDraft && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCancelDraftOpen(true)}
          disabled={Boolean(loadingAction)}
          className="text-xs h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
        >
          <XCircle className="w-3.5 h-3.5" />
          Batalkan Draf
        </Button>
      )}

      {/* Konfirmasi Pesanan */}
      {canConfirm && (
        <Button
          size="sm"
          onClick={() => setIsConfirmOpen(true)}
          disabled={Boolean(loadingAction)}
          className="text-xs h-8 gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white shadow-none"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Konfirmasi Pesanan
        </Button>
      )}

      {/* Kirim Pesanan (Gudang/Manajer) */}
      {canShip && (
        <Button
          size="sm"
          onClick={() => setIsShipOpen(true)}
          disabled={Boolean(loadingAction)}
          className="text-xs h-8 gap-1.5 bg-blue-700 hover:bg-blue-800 text-white shadow-none"
        >
          <Truck className="w-3.5 h-3.5" />
          Kirim Pesanan
        </Button>
      )}

      {/* Batalkan Pesanan Terkonfirmasi (Manajer) */}
      {canCancelConfirmed && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAlasanBatal('');
            setAlasanError(null);
            setIsCancelConfirmedOpen(true);
          }}
          disabled={Boolean(loadingAction)}
          className="text-xs h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Batalkan Pesanan
        </Button>
      )}

      {/* Catat Pelunasan (Manajer) */}
      {canMarkPaid && (
        <Button
          size="sm"
          onClick={() => setIsPaidOpen(true)}
          disabled={Boolean(loadingAction)}
          className="text-xs h-8 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-none"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Catat Pelunasan
        </Button>
      )}

      {/* Dialog Konfirmasi Pesanan */}
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={`Konfirmasi Pesanan ${nomor}`}
        description="Konfirmasi akan memvalidasi stok, batas kredit, dan tagihan jatuh tempo pelanggan. Stok barang akan langsung dikurangi dan kartu stok akan dicatat."
        confirmLabel="Ya, Konfirmasi"
        cancelLabel="Batal"
        isLoading={loadingAction === 'konfirmasi'}
        onConfirm={handleKonfirmasi}
      />

      {/* Dialog Batalkan Draf */}
      <ConfirmDialog
        open={isCancelDraftOpen}
        onOpenChange={setIsCancelDraftOpen}
        title={`Batalkan Draf ${nomor}`}
        description="Apakah Anda yakin ingin membatalkan draf pesanan ini? Status akan berubah menjadi dibatalkan secara permanen."
        confirmLabel="Ya, Batalkan Draf"
        cancelLabel="Kembali"
        variant="destructive"
        isLoading={loadingAction === 'batal_draf'}
        onConfirm={handleBatalkanDraf}
      />

      {/* Dialog Kirim Pesanan */}
      <ConfirmDialog
        open={isShipOpen}
        onOpenChange={setIsShipOpen}
        title={`Kirim Pesanan ${nomor}`}
        description="Pesanan akan ditandai telah dikirim oleh Gudang. Tanggal pengiriman dan tanggal jatuh tempo pembayaran pelanggan akan otomatis dihitung."
        confirmLabel="Ya, Kirim Pesanan"
        cancelLabel="Batal"
        isLoading={loadingAction === 'kirim'}
        onConfirm={handleKirim}
      />

      {/* Dialog Catat Pelunasan */}
      <ConfirmDialog
        open={isPaidOpen}
        onOpenChange={setIsPaidOpen}
        title={`Catat Pelunasan ${nomor}`}
        description="Tandai bahwa pembayaran atas pesanan ini telah diterima secara penuh. Status akan diperbarui menjadi Lunas."
        confirmLabel="Ya, Catat Lunas"
        cancelLabel="Batal"
        isLoading={loadingAction === 'lunas'}
        onConfirm={handlePelunasan}
      />

      {/* Dialog Batalkan Pesanan Terkonfirmasi (Alasan >= 10 karakter) */}
      {isCancelConfirmedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in-0">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/80 shadow-neu-lg max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-100 shadow-neu-sm shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Batalkan Pesanan Terkonfirmasi {nomor}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pembatalan ini akan <strong>mengembalikan seluruh stok barang</strong> ke master
                  dan mencatat mutasi kartu stok jenis batal.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alasan" className="text-xs font-medium text-slate-700">
                Alasan Pembatalan <span className="text-red-500">* (minimal 10 karakter)</span>
              </Label>
              <Textarea
                id="alasan"
                rows={3}
                value={alasanBatal}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setAlasanBatal(e.target.value);
                  if (alasanError) setAlasanError(null);
                }}
                placeholder="Contoh: Pelanggan meminta pembatalan karena kesalahan pesanan internal..."
                className="text-xs rounded-md border-slate-300 focus:ring-slate-500"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{alasanBatal.trim().length} / 10 karakter minimum</span>
                {alasanError && <span className="text-red-600 font-medium">{alasanError}</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCancelConfirmedOpen(false)}
                disabled={loadingAction === 'batal_terkonfirmasi'}
                className="text-xs h-8"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleBatalkanTerkonfirmasi}
                disabled={
                  loadingAction === 'batal_terkonfirmasi' || alasanBatal.trim().length < 10
                }
                className="text-xs h-8 gap-1.5 shadow-none"
              >
                {loadingAction === 'batal_terkonfirmasi'
                  ? 'Membatalkan...'
                  : 'Konfirmasi Pembatalan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
