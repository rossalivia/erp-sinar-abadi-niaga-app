'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTanggal, formatTanggalWaktu } from '@/lib/format';
import { ambilRiwayatPenagihanAction } from '../actions';
import { CatatanPenagihanItem } from '../types';

interface DialogRiwayatPenagihanProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pelangganId: string;
  namaToko: string;
  pesananJualId?: string | null;
  nomorPesanan?: string | null;
}

function RiwayatContent({
  pelangganId,
  pesananJualId,
}: {
  pelangganId: string;
  pesananJualId?: string | null;
}) {
  const [riwayat, setRiwayat] = useState<CatatanPenagihanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    ambilRiwayatPenagihanAction(pelangganId, pesananJualId)
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setRiwayat(res.data);
        } else {
          setErrorMessage(res.message || 'Gagal memuat riwayat penagihan');
        }
      })
      .catch(() => {
        if (active) setErrorMessage('Terjadi kesalahan sistem saat memuat riwayat');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pelangganId, pesananJualId]);

  const labelJenis = (jenis: string) => {
    switch (jenis) {
      case 'pengingat_wa':
        return { label: 'WhatsApp', variant: 'success' as const };
      case 'telepon':
        return { label: 'Telepon', variant: 'info' as const };
      case 'kunjungan':
        return { label: 'Kunjungan', variant: 'neutral' as const };
      case 'janji_bayar':
        return { label: 'Janji Bayar', variant: 'warning' as const };
      default:
        return { label: 'Catatan', variant: 'neutral' as const };
    }
  };

  return (
    <div className="max-h-[360px] overflow-y-auto space-y-3 py-2 pr-1">
      {loading && (
        <div className="py-8 text-center text-xs text-slate-400">
          Memuat riwayat interaksi...
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
          {errorMessage}
        </div>
      )}

      {!loading && riwayat.length === 0 && !errorMessage && (
        <div className="py-8 text-center text-xs text-slate-400">
          Belum ada riwayat penagihan yang tercatat.
        </div>
      )}

      {!loading &&
        riwayat.map((item) => {
          const meta = labelJenis(item.jenis);
          return (
            <div
              key={item.id}
              className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-none space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={meta.variant} className="text-[10px] py-0 px-1.5 font-normal">
                    {meta.label}
                  </Badge>
                  {item.nomor_pesanan && (
                    <span className="font-mono text-[11px] text-slate-500">
                      {item.nomor_pesanan}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {formatTanggalWaktu(item.dibuat_pada)}
                </span>
              </div>

              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                {item.isi}
              </p>

              {item.janji_bayar_tanggal && (
                <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                  <span className="text-slate-500">Janji Bayar:</span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {formatTanggal(item.janji_bayar_tanggal)}
                  </span>
                  {item.status_janji === 'terlewat' ? (
                    <span className="rounded bg-red-100 text-red-800 px-1.5 py-0.2 text-[10px] font-semibold">
                      Janji Terlewat
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px] font-semibold">
                      Aktif
                    </span>
                  )}
                </div>
              )}

              <div className="pt-1 text-[11px] text-slate-400 border-t border-slate-100">
                Oleh: <span className="text-slate-600 font-medium">{item.nama_pembuat}</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}

export function DialogRiwayatPenagihan({
  open,
  onOpenChange,
  pelangganId,
  namaToko,
  pesananJualId,
  nomorPesanan,
}: DialogRiwayatPenagihanProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900">
            Riwayat Interaksi Penagihan
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {nomorPesanan ? (
              <>
                Faktur <strong>{nomorPesanan}</strong> &bull; {namaToko}
              </>
            ) : (
              <>Pelanggan <strong>{namaToko}</strong></>
            )}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <RiwayatContent
            key={`${pelangganId}-${pesananJualId || 'all'}`}
            pelangganId={pelangganId}
            pesananJualId={pesananJualId}
          />
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
