'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, PackageCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  setujuiPembelianAction,
  tolakPembelianAction,
  terimaPembelianAction,
} from '../actions';
import type { StatusPembelian } from '../types';
import type { Peran } from '@/types/auth';

interface PembelianActionsProps {
  pembelianId: string;
  nomor: string;
  status: StatusPembelian;
  jumlahDipesan: number;
  peran: Peran;
}

export function PembelianActions({
  pembelianId,
  nomor,
  status,
  jumlahDipesan,
  peran,
}: PembelianActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  const isManajer = peran === 'manajer';
  const isGudang = peran === 'gudang';

  // State Dialog
  const [isApproveOpen, setIsApproveOpen] = React.useState(false);
  const [isRejectOpen, setIsRejectOpen] = React.useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = React.useState(false);

  // Form Inputs
  const [hargaBeli, setHargaBeli] = React.useState<number>(0);
  const [hargaBeliError, setHargaBeliError] = React.useState<string | null>(null);

  const [alasanTolak, setAlasanTolak] = React.useState('');
  const [alasanError, setAlasanError] = React.useState<string | null>(null);

  const [jumlahDiterima, setJumlahDiterima] = React.useState<number>(jumlahDipesan);
  const [terimaError, setTerimaError] = React.useState<string | null>(null);

  // 1. Setujui PO (Manajer only)
  async function handleSetujui() {
    if (hargaBeli <= 0) {
      setHargaBeliError('Harga beli harus lebih dari 0');
      return;
    }

    setLoadingAction('setujui');
    try {
      const res = await setujuiPembelianAction({
        pembelian_id: pembelianId,
        harga_beli_satuan: hargaBeli,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal menyetujui PO');
        return;
      }

      toast.success('PO berhasil disetujui');
      setIsApproveOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoadingAction(null);
    }
  }

  // 2. Tolak PO (Manajer only, alasan >= 10 char)
  async function handleTolak() {
    const clean = alasanTolak.trim();
    if (clean.length < 10) {
      setAlasanError('Alasan penolakan minimal 10 karakter');
      return;
    }

    setLoadingAction('tolak');
    try {
      const res = await tolakPembelianAction({
        pembelian_id: pembelianId,
        alasan: clean,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal menolak PO');
        return;
      }

      toast.success('PO berhasil ditolak');
      setIsRejectOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoadingAction(null);
    }
  }

  // 3. Terima Barang (Gudang/Manajer)
  async function handleTerima() {
    if (jumlahDiterima < 1 || jumlahDiterima > jumlahDipesan) {
      setTerimaError(`Jumlah diterima harus 1 sampai ${jumlahDipesan}`);
      return;
    }

    setLoadingAction('terima');
    try {
      const res = await terimaPembelianAction({
        pembelian_id: pembelianId,
        jumlah_diterima: jumlahDiterima,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal mencatat penerimaan barang');
        return;
      }

      toast.success(res.message || 'Barang berhasil diterima');
      setIsReceiveOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Aksi Manajer saat status diajukan */}
      {status === 'diajukan' && isManajer && (
        <>
          <Button
            size="sm"
            onClick={() => {
              setHargaBeli(0);
              setHargaBeliError(null);
              setIsApproveOpen(true);
            }}
            disabled={Boolean(loadingAction)}
            className="text-xs h-8 gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white shadow-none"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Setujui PO
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAlasanTolak('');
              setAlasanError(null);
              setIsRejectOpen(true);
            }}
            disabled={Boolean(loadingAction)}
            className="text-xs h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <XCircle className="w-3.5 h-3.5" />
            Tolak PO
          </Button>
        </>
      )}

      {/* Aksi Gudang/Manajer saat status disetujui */}
      {status === 'disetujui' && (isGudang || isManajer) && (
        <Button
          size="sm"
          onClick={() => {
            setJumlahDiterima(jumlahDipesan);
            setTerimaError(null);
            setIsReceiveOpen(true);
          }}
          disabled={Boolean(loadingAction)}
          className="text-xs h-8 gap-1.5 bg-blue-700 hover:bg-blue-800 text-white shadow-none"
        >
          <PackageCheck className="w-3.5 h-3.5" />
          Terima Barang
        </Button>
      )}

      {/* Modal Dialog Setujui PO */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-slate-200 shadow-md max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-emerald-100 text-emerald-800 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Setujui Pesanan Pembelian {nomor}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sebagai Manajer, tentukan harga beli satuan yang telah disepakati dengan pemasok.
                  Nilai ini bersifat rahasia dan tidak akan diperlihatkan kepada Staf Gudang.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="harga_beli" className="text-xs font-medium text-slate-700">
                Harga Beli Satuan (Rp) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="harga_beli"
                type="number"
                min="1"
                value={hargaBeli || ''}
                onChange={(e) => {
                  setHargaBeli(parseFloat(e.target.value) || 0);
                  if (hargaBeliError) setHargaBeliError(null);
                }}
                placeholder="Contoh: 8500"
                className="text-xs font-mono tabular-nums h-9"
              />
              {hargaBeliError && (
                <p className="text-[11px] text-red-600 font-medium">{hargaBeliError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsApproveOpen(false)}
                disabled={loadingAction === 'setujui'}
                className="text-xs h-8"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSetujui}
                disabled={loadingAction === 'setujui' || hargaBeli <= 0}
                className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white shadow-none"
              >
                {loadingAction === 'setujui' ? 'Memproses...' : 'Setujui Pembelian'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Tolak PO */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-slate-200 shadow-md max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-red-100 text-red-700 shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Tolak Pesanan Pembelian {nomor}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Masukkan alasan penolakan yang jelas untuk catatan arsip pengadaan barang.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alasan_tolak" className="text-xs font-medium text-slate-700">
                Alasan Penolakan <span className="text-red-500">* (minimal 10 karakter)</span>
              </Label>
              <Textarea
                id="alasan_tolak"
                rows={3}
                value={alasanTolak}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setAlasanTolak(e.target.value);
                  if (alasanError) setAlasanError(null);
                }}
                placeholder="Contoh: Harga dari pemasok terlalu mahal dibanding distributor lain..."
                className="text-xs"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{alasanTolak.trim().length} / 10 karakter minimum</span>
                {alasanError && <span className="text-red-600 font-medium">{alasanError}</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRejectOpen(false)}
                disabled={loadingAction === 'tolak'}
                className="text-xs h-8"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleTolak}
                disabled={loadingAction === 'tolak' || alasanTolak.trim().length < 10}
                className="text-xs h-8 shadow-none"
              >
                {loadingAction === 'tolak' ? 'Menolak...' : 'Konfirmasi Tolak'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Terima Barang */}
      {isReceiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-slate-200 shadow-md max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-blue-100 text-blue-800 shrink-0">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Penerimaan Barang Fisik PO {nomor}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Konfirmasi kedatangan fisik barang dari pemasok ke gudang.
                </p>
              </div>
            </div>

            {/* Peringatan Kritis Sekali Penerimaan */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">PENTING: Hanya 1 Kali Penerimaan</span>
                <span>
                  Penerimaan barang hanya dapat dilakukan <strong>SEKALI</strong> untuk nomor PO ini.
                  Tindakan ini akan langsung menambah stok master barang dan memperbarui harga pokok (HPP).
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jumlah_diterima" className="text-xs font-medium text-slate-700">
                Jumlah Fisik Diterima <span className="text-red-500">* (maks: {jumlahDipesan} unit)</span>
              </Label>
              <Input
                id="jumlah_diterima"
                type="number"
                min="1"
                max={jumlahDipesan}
                value={jumlahDiterima}
                onChange={(e) => {
                  setJumlahDiterima(parseInt(e.target.value, 10) || 0);
                  if (terimaError) setTerimaError(null);
                }}
                className="text-xs font-mono tabular-nums h-9"
              />
              {terimaError && (
                <p className="text-[11px] text-red-600 font-medium">{terimaError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReceiveOpen(false)}
                disabled={loadingAction === 'terima'}
                className="text-xs h-8"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleTerima}
                disabled={
                  loadingAction === 'terima' ||
                  jumlahDiterima < 1 ||
                  jumlahDiterima > jumlahDipesan
                }
                className="text-xs h-8 bg-blue-700 hover:bg-blue-800 text-white shadow-none"
              >
                {loadingAction === 'terima' ? 'Memproses...' : 'Konfirmasi Terima Barang'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
