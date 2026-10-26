'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  CreditCard,
  Copy,
  ExternalLink,
  RefreshCw,
  XCircle,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Share2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BadgeStatus } from '@/components/shared/badge-status';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { MayarCreateDialog } from './MayarCreateDialog';
import { periksaStatusMayarAction, tutupTagihanMayarAction } from '../actions';
import { formatRupiah, formatTanggalWaktu } from '@/lib/format';
import { normalisasiNomorTelepon, buatUrlWhatsApp } from '@/features/penagihan/utils';
import type { TagihanMayarRow } from '../types';

interface MayarPaymentPanelProps {
  pesananId: string;
  nomorPesanan: string;
  totalPesanan: number;
  statusPesanan: string;
  namaToko: string;
  teleponToko?: string | null;
  tagihanList: TagihanMayarRow[];
  isMayarActive?: boolean;
}

export function MayarPaymentPanel({
  pesananId,
  nomorPesanan,
  totalPesanan,
  statusPesanan,
  namaToko,
  teleponToko,
  tagihanList,
  isMayarActive = true,
}: MayarPaymentPanelProps) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Cari tagihan aktif atau tagihan terakhir
  const tagihanAktif = tagihanList.find(
    (t) => t.status === 'dibuat' || t.status_efektif === 'dibuat'
  );
  const latestTagihan = tagihanAktif || tagihanList[0];

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Tautan pembayaran berhasil disalin ke clipboard');
  };

  const handleCheckStatus = (tagihanId: string) => {
    startTransition(async () => {
      const res = await periksaStatusMayarAction(tagihanId, pesananId);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleCloseInvoice = (tagihanId: string) => {
    startTransition(async () => {
      const res = await tutupTagihanMayarAction(tagihanId, 'Dibatalkan oleh Manajer', pesananId);
      if (res.success) {
        toast.success(res.message);
        setIsCloseConfirmOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  // URL WhatsApp resmi CV Sinar Abadi Niaga (M11)
  const getWhatsAppLink = (tautan: string, berlakuSampai: string) => {
    const telpNorm = normalisasiNomorTelepon(teleponToko);
    if (!telpNorm.valid) return null;

    const pesan =
      `Halo *${namaToko}*,\n\n` +
      `Kami dari *CV Sinar Abadi Niaga* ingin menginformasikan tautan pembayaran online resmi untuk pesanan *${nomorPesanan}* sebesar *${formatRupiah(totalPesanan)}*:\n` +
      `${tautan}\n\n` +
      `Tautan berlaku hingga: *${formatTanggalWaktu(berlakuSampai)}*.\n` +
      `Mohon kesediaannya untuk menyelesaikan pembayaran sebelum batas waktu. Terima kasih.`;

    return buatUrlWhatsApp(telpNorm.nomor, pesan);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5 text-slate-800 font-semibold uppercase tracking-wider text-[11px]">
          <CreditCard className="w-3.5 h-3.5 text-slate-500" />
          Pembayaran Digital Mayar
        </div>
        {latestTagihan && (
          <BadgeStatus status={latestTagihan.status_efektif || latestTagihan.status} />
        )}
      </div>

      {/* KONDISI 1: Belum ada tagihan sama sekali atau tagihan lama sudah tidak aktif */}
      {(!latestTagihan || latestTagihan.status === 'ditutup' || latestTagihan.status_efektif === 'kedaluwarsa') &&
        statusPesanan === 'dikirim' && (
          <div className="space-y-3 py-1">
            <p className="text-slate-500 text-xs">
              Belum ada tautan bayar online aktif untuk pesanan ini. Anda dapat menerbitkan tautan pembayaran Mayar sandbox untuk dibagikan ke toko pelanggan.
            </p>
            {isMayarActive ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs bg-slate-900 text-white hover:bg-slate-800 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Tagihan Mayar
              </Button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Mayar belum dikonfigurasi
              </div>
            )}
          </div>
        )}

      {/* KONDISI 2: Ada Tagihan Aktif ('dibuat') */}
      {latestTagihan && (latestTagihan.status === 'dibuat' || latestTagihan.status_efektif === 'dibuat') && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 block">Tautan Pembayaran:</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={latestTagihan.tautan}
                className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono text-slate-700 select-all"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopyLink(latestTagihan.tautan)}
                className="text-xs h-8 px-2.5 gap-1 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin
              </Button>
              <a
                href={latestTagihan.tautan}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center border border-slate-200 rounded px-2.5 h-8 text-xs text-slate-700 hover:bg-slate-50 shrink-0"
                title="Buka Tautan Pembayaran"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Berlaku Hingga:</span>
            <span className="font-medium text-slate-700">
              {formatTanggalWaktu(latestTagihan.berlaku_sampai)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
            {/* Tombol Kirim WhatsApp */}
            {(() => {
              const waUrl = getWhatsAppLink(latestTagihan.tautan, latestTagihan.berlaku_sampai);
              if (!waUrl) return null;
              return (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Kirim via WhatsApp
                </a>
              );
            })()}

            {/* Tombol Periksa Status */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleCheckStatus(latestTagihan.id)}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              Periksa Status
            </Button>

            {/* Tombol Tutup Tagihan */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setIsCloseConfirmOpen(true)}
              className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              Tutup Tagihan
            </Button>
          </div>
        </div>
      )}

      {/* KONDISI 3: Tagihan Sudah Dibayar ('dibayar') */}
      {latestTagihan && latestTagihan.status === 'dibayar' && (
        <div className="space-y-2 py-1">
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold block">Pembayaran Diterima via Mayar</span>
              <span className="text-[11px] text-emerald-600">
                Dilunasi pada {latestTagihan.dibayar_pada ? formatTanggalWaktu(latestTagihan.dibayar_pada) : '-'} (Ref: {latestTagihan.mayar_transaction_id || '-'})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KONDISI 4: Tagihan Memerlukan Peninjauan ('perlu_tinjau') */}
      {latestTagihan && latestTagihan.status === 'perlu_tinjau' && (
        <div className="space-y-2 py-1">
          <div className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold block">Perlu Tinjauan Manajer</span>
              <p className="text-[11px] text-amber-700">
                {latestTagihan.catatan_tinjau || 'Terdeteksi anomali pada pembayaran gateway Mayar'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Pembuatan Tagihan */}
      <MayarCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        pesananId={pesananId}
        nomorPesanan={nomorPesanan}
        totalPesanan={totalPesanan}
        namaToko={namaToko}
        teleponToko={teleponToko}
      />

      {/* Dialog Konfirmasi Penutupan Tagihan */}
      <ConfirmDialog
        open={isCloseConfirmOpen}
        onOpenChange={setIsCloseConfirmOpen}
        onConfirm={() => latestTagihan && handleCloseInvoice(latestTagihan.id)}
        title="Tutup Tagihan Mayar"
        description={`Apakah Anda yakin ingin membatalkan tagihan pembayaran Mayar untuk pesanan ${nomorPesanan}? Tautan pembayaran tidak akan dapat digunakan lagi oleh pelanggan.`}
        confirmLabel="Ya, Tutup Tagihan"
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}
