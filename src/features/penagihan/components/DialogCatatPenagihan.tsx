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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { simpanCatatanPenagihanAction } from '../actions';
import { JenisCatatanPenagihan } from '../types';

interface DialogCatatPenagihanProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pelangganId: string;
  namaToko: string;
  pesananJualId?: string | null;
  nomorPesanan?: string | null;
  onSuccess?: () => void;
}

export function DialogCatatPenagihan({
  open,
  onOpenChange,
  pelangganId,
  namaToko,
  pesananJualId,
  nomorPesanan,
  onSuccess,
}: DialogCatatPenagihanProps) {
  const [jenis, setJenis] = useState<JenisCatatanPenagihan>('telepon');
  const [isi, setIsi] = useState('');
  const [janjiBayarTanggal, setJanjiBayarTanggal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tanggal minimal untuk janji bayar (hari ini)
  const todayStr = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isi.trim().length < 3) {
      setErrorMessage('Catatan penagihan minimal 3 karakter');
      return;
    }

    if (isi.trim().length > 500) {
      setErrorMessage('Catatan penagihan maksimal 500 karakter');
      return;
    }

    if (jenis === 'janji_bayar' && !janjiBayarTanggal) {
      setErrorMessage('Tanggal janji bayar wajib diisi untuk jenis janji bayar');
      return;
    }

    setLoading(true);
    try {
      const res = await simpanCatatanPenagihanAction({
        pelangganId,
        pesananJualId: pesananJualId || undefined,
        jenis,
        isi: isi.trim(),
        janjiBayarTanggal: jenis === 'janji_bayar' ? janjiBayarTanggal : undefined,
      });

      if (!res.success) {
        setErrorMessage(res.message || 'Gagal menyimpan catatan penagihan');
        return;
      }

      // Reset form & tutup dialog
      setIsi('');
      setJanjiBayarTanggal('');
      setJenis('telepon');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch {
      setErrorMessage('Terjadi kesalahan saat menyimpan catatan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900">
            Catat Interaksi Penagihan
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {nomorPesanan ? (
              <>
                Mencatat interaksi untuk faktur <strong>{nomorPesanan}</strong> ({namaToko})
              </>
            ) : (
              <>
                Mencatat interaksi umum untuk pelanggan <strong>{namaToko}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
              {errorMessage}
            </div>
          )}

          {/* Pilihan Jenis Interaksi */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700">Jenis Interaksi</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: 'telepon', label: 'Telepon' },
                { id: 'kunjungan', label: 'Kunjungan' },
                { id: 'janji_bayar', label: 'Janji Bayar' },
                { id: 'catatan', label: 'Catatan' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setJenis(opt.id as JenisCatatanPenagihan)}
                  className={`rounded-md border py-1.5 px-2 text-xs font-medium transition-colors text-center ${
                    jenis === opt.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tanggal Janji Bayar (Kondisional) */}
          {jenis === 'janji_bayar' && (
            <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/50 p-3">
              <Label htmlFor="janji_bayar_date" className="text-xs font-medium text-amber-900">
                Tanggal Janji Bayar <span className="text-red-500">*</span>
              </Label>
              <Input
                id="janji_bayar_date"
                type="date"
                min={todayStr}
                value={janjiBayarTanggal}
                onChange={(e) => setJanjiBayarTanggal(e.target.value)}
                required
                className="h-8 text-xs bg-white border-amber-300"
              />
              <p className="text-[11px] text-amber-700">
                Tanggal harus hari ini atau di masa mendatang. Faktur akan ditandai jika terlewat.
              </p>
            </div>
          )}

          {/* Isi Catatan */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="isi_catatan" className="text-xs font-medium text-slate-700">
                Hasil / Rincian Percakapan <span className="text-red-500">*</span>
              </Label>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {isi.trim().length}/500
              </span>
            </div>
            <Textarea
              id="isi_catatan"
              rows={3}
              value={isi}
              onChange={(e) => setIsi(e.target.value)}
              placeholder="Contoh: Pemilik toko berjanji transfer via BCA hari Jumat sore..."
              className="text-xs resize-none"
              required
            />
            <p className="text-[11px] text-slate-400">
              Catatan bersifat permanen (append-only) dan tidak dapat dihapus atau diubah setelah disimpan.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || isi.trim().length < 3}
              className="bg-slate-900 text-white hover:bg-slate-800 text-xs"
            >
              {loading ? 'Menyimpan...' : 'Simpan Catatan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
