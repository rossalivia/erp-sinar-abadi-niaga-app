'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatTanggal } from '@/lib/format';
import {
  normalisasiNomorTelepon,
  buatPesanWhatsApp,
  buatUrlWhatsApp,
} from '../utils';
import { rekamPengingatWhatsAppAction } from '../actions';
import { TagihanItem } from '../types';

interface DialogWhatsAppProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagihan: TagihanItem | null;
  onSuccess?: () => void;
}

function WhatsAppForm({
  tagihan,
  onClose,
  onSuccess,
}: {
  tagihan: TagihanItem;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const norm = normalisasiNomorTelepon(tagihan.telepon);

  const hitungJenisDefault = (): 'menjelang' | 'hari_ini' | 'terlambat' => {
    if (tagihan.klasifikasi.startsWith('overdue')) return 'terlambat';
    if (tagihan.klasifikasi === 'segera' || tagihan.klasifikasi === 'belum_jatuh_tempo') {
      return 'menjelang';
    }
    return 'hari_ini';
  };

  const [jenisTemplat, setJenisTemplat] = useState<'menjelang' | 'hari_ini' | 'terlambat'>(hitungJenisDefault);
  const [pesan, setPesan] = useState(() =>
    buatPesanWhatsApp(hitungJenisDefault(), {
      namaToko: tagihan.nama_toko,
      fakturList: [
        {
          nomor: tagihan.nomor_pesanan,
          total: tagihan.total,
          jatuhTempo: formatTanggal(tagihan.jatuh_tempo),
        },
      ],
      totalTertagih: tagihan.total,
    })
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGantiTemplat = (jenisBaru: 'menjelang' | 'hari_ini' | 'terlambat') => {
    setJenisTemplat(jenisBaru);
    const draf = buatPesanWhatsApp(jenisBaru, {
      namaToko: tagihan.nama_toko,
      fakturList: [
        {
          nomor: tagihan.nomor_pesanan,
          total: tagihan.total,
          jatuhTempo: formatTanggal(tagihan.jatuh_tempo),
        },
      ],
      totalTertagih: tagihan.total,
    });
    setPesan(draf);
  };

  const handleBukaWhatsApp = async () => {
    if (!norm.valid) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await rekamPengingatWhatsAppAction(
        tagihan.pelanggan_id,
        tagihan.pesanan_id,
        `Pengingat WhatsApp [${jenisTemplat}]: ${pesan.slice(0, 150)}...`
      );

      if (!res.success) {
        setErrorMessage(res.message || 'Gagal merekam riwayat pengiriman WhatsApp');
        setLoading(false);
        return;
      }

      const url = buatUrlWhatsApp(norm.nomor, pesan);
      window.open(url, '_blank', 'noopener,noreferrer');

      onClose();
      if (onSuccess) onSuccess();
    } catch {
      setErrorMessage('Terjadi kendala saat membuka WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4 py-2">
        {errorMessage && (
          <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
            {errorMessage}
          </div>
        )}

        {/* Validasi Nomor WhatsApp */}
        <div className="rounded-md border p-3 text-xs bg-slate-50 border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Nomor Telepon Toko:</span>
            <span className="font-mono font-medium text-slate-800">
              {tagihan.telepon || '(Kosong)'}
            </span>
          </div>
          {norm.valid ? (
            <div className="mt-1 flex items-center justify-between text-emerald-700 font-medium">
              <span>Tujuan WhatsApp:</span>
              <span className="font-mono">+{norm.nomor}</span>
            </div>
          ) : (
            <div className="mt-2 rounded bg-amber-50 p-2 text-amber-800 border border-amber-200">
              <p className="font-medium">Tombol WhatsApp Dinonaktifkan</p>
              <p className="text-[11px] mt-0.5">{norm.pesanError}</p>
            </div>
          )}
        </div>

        {/* Pemilihan Templat */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Pilih Format Pesan</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'menjelang', label: 'Menjelang Tempo' },
              { id: 'hari_ini', label: 'Hari Ini' },
              { id: 'terlambat', label: 'Terlambat' },
            ].map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => handleGantiTemplat(opt.id as 'menjelang' | 'hari_ini' | 'terlambat')}
                className={`rounded-md border py-1.5 px-2 text-xs font-medium transition-colors text-center ${
                  jenisTemplat === opt.id
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900 font-semibold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea Pratinjau Pesan yang dapat disesuaikan */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label htmlFor="pesan_wa" className="text-xs font-medium text-slate-700">
              Pratinjau Pesan (Bisa Disesuaikan)
            </Label>
            <span className="text-[10px] text-slate-400">
              {pesan.length} karakter
            </span>
          </div>
          <Textarea
            id="pesan_wa"
            rows={6}
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            className="text-xs font-sans leading-relaxed resize-none"
          />
          <p className="text-[11px] text-slate-400">
            Pengiriman membuka aplikasi resmi WhatsApp Web/Mobile. Sistem otomatis mencatat log pengiriman ke riwayat penagihan.
          </p>
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={loading}
          className="text-xs"
        >
          Tutup
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleBukaWhatsApp}
          disabled={loading || !norm.valid || !pesan.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
        >
          {loading ? 'Membuka...' : 'Buka WhatsApp & Catat'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function DialogWhatsApp({
  open,
  onOpenChange,
  tagihan,
  onSuccess,
}: DialogWhatsAppProps) {
  if (!tagihan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Kirim Pengingat WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Faktur <strong>{tagihan.nomor_pesanan}</strong> &bull; {tagihan.nama_toko}
          </DialogDescription>
        </DialogHeader>

        <WhatsAppForm
          key={tagihan.pesanan_id}
          tagihan={tagihan}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
