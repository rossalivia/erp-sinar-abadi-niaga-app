'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, AlertCircle, Package } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ajukanPembelianAction } from '../actions';
import type { BarangOption, PemasokOption } from '../types';

interface PembelianFormProps {
  pemasokList: PemasokOption[];
  barangList: BarangOption[];
  defaultBarangId?: string;
}

export function PembelianForm({
  pemasokList,
  barangList,
  defaultBarangId,
}: PembelianFormProps) {
  const router = useRouter();

  const [pemasokId, setPemasokId] = React.useState<string>(
    pemasokList[0]?.id || ''
  );
  const [barangId, setBarangId] = React.useState<string>(() => {
    if (defaultBarangId && barangList.some((b) => b.id === defaultBarangId)) {
      return defaultBarangId;
    }
    return barangList[0]?.id || '';
  });
  const [jumlah, setJumlah] = React.useState<number>(100);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const selectedBarang = React.useMemo(() => {
    return barangList.find((b) => b.id === barangId);
  }, [barangList, barangId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!pemasokId) {
      setErrorMessage('Pemasok wajib dipilih');
      return;
    }
    if (!barangId) {
      setErrorMessage('Barang wajib dipilih');
      return;
    }
    if (jumlah < 1 || jumlah > 10000) {
      setErrorMessage('Jumlah pembelian harus 1 sampai 10.000 unit');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ajukanPembelianAction({
        pemasok_id: pemasokId,
        barang_id: barangId,
        jumlah,
      });

      if (!res.success) {
        setErrorMessage(res.message || 'Gagal mengajukan pembelian');
        toast.error(res.message || 'Gagal mengajukan pembelian');
        return;
      }

      toast.success(res.message || 'PO berhasil diajukan');
      router.push(`/pembelian/${res.data?.id}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2.5 flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-600" />
          Formulir Pengajuan Pesanan Pembelian (PO)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pemasok */}
          <div className="space-y-1.5">
            <Label htmlFor="pemasok_id" className="text-xs font-medium text-slate-700">
              Pemasok <span className="text-red-500">*</span>
            </Label>
            <select
              id="pemasok_id"
              value={pemasokId}
              onChange={(e) => setPemasokId(e.target.value)}
              disabled={isSubmitting}
              className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-900 shadow-none focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="" disabled>
                -- Pilih Pemasok --
              </option>
              {pemasokList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.kode})
                </option>
              ))}
            </select>
          </div>

          {/* Barang */}
          <div className="space-y-1.5">
            <Label htmlFor="barang_id" className="text-xs font-medium text-slate-700">
              Barang yang Dipesan <span className="text-red-500">*</span>
            </Label>
            <select
              id="barang_id"
              value={barangId}
              onChange={(e) => setBarangId(e.target.value)}
              disabled={isSubmitting}
              className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-900 shadow-none focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="" disabled>
                -- Pilih Barang --
              </option>
              {barangList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.kode} - {b.nama} (Stok: {b.stok} {b.satuan})
                </option>
              ))}
            </select>
          </div>

          {/* Info Status Barang Terpilih */}
          {selectedBarang && (
            <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-md p-3 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500">Stok Saat Ini: </span>
                <span className="font-semibold text-slate-800 font-mono">
                  {selectedBarang.stok} {selectedBarang.satuan}
                </span>
                <span className="text-slate-400 mx-2">|</span>
                <span className="text-slate-500">Stok Minimum: </span>
                <span className="font-semibold text-slate-800 font-mono">
                  {selectedBarang.stok_minimum} {selectedBarang.satuan}
                </span>
              </div>
              {selectedBarang.stok <= selectedBarang.stok_minimum && (
                <span className="text-amber-800 bg-amber-100 font-medium px-2 py-0.5 rounded text-[11px]">
                  Stok Menipis
                </span>
              )}
            </div>
          )}

          {/* Jumlah Dipesan */}
          <div className="space-y-1.5">
            <Label htmlFor="jumlah" className="text-xs font-medium text-slate-700">
              Jumlah Dipesan <span className="text-red-500">* (1 s.d. 10.000)</span>
            </Label>
            <Input
              id="jumlah"
              type="number"
              min="1"
              max="10000"
              value={jumlah}
              onChange={(e) => setJumlah(parseInt(e.target.value, 10) || 0)}
              disabled={isSubmitting}
              className="h-9 text-xs font-mono tabular-nums text-slate-900"
              placeholder="Contoh: 100"
            />
            <p className="text-[11px] text-slate-400">
              Satuan barang: {selectedBarang?.satuan || 'unit'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="gap-1.5 text-xs h-9"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Batal & Kembali
        </Button>

        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="gap-1.5 text-xs h-9 bg-slate-900 hover:bg-slate-800 text-white shadow-none"
        >
          <Send className="w-3.5 h-3.5" />
          {isSubmitting ? 'Mengajukan...' : 'Ajukan Pembelian'}
        </Button>
      </div>
    </form>
  );
}
