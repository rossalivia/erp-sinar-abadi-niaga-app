'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { penyesuaianStokAction } from '../actions';

interface PenyesuaianDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barangId: string;
  kodeBarang: string;
  namaBarang: string;
  stokSaatIni: number;
  satuan: string;
}

export function PenyesuaianDialog(props: PenyesuaianDialogProps) {
  if (!props.open) return null;

  return (
    <PenyesuaianModalInner
      key={`${props.barangId}-${props.stokSaatIni}`}
      {...props}
    />
  );
}

function PenyesuaianModalInner({
  onOpenChange,
  barangId,
  kodeBarang,
  namaBarang,
  stokSaatIni,
  satuan,
}: PenyesuaianDialogProps) {
  const router = useRouter();

  const [stokBaru, setStokBaru] = React.useState<number>(stokSaatIni);
  const [alasan, setAlasan] = React.useState('');
  const [alasanError, setAlasanError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const delta = stokBaru - stokSaatIni;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (stokBaru < 0) {
      setErrorMessage('Stok baru tidak boleh negatif');
      return;
    }

    const cleanAlasan = alasan.trim();
    if (cleanAlasan.length < 10) {
      setAlasanError('Alasan penyesuaian minimal 10 karakter');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await penyesuaianStokAction({
        barang_id: barangId,
        stok_baru: stokBaru,
        alasan: cleanAlasan,
      });

      if (!res.success) {
        setErrorMessage(res.message || 'Gagal menyesuaikan stok');
        toast.error(res.message || 'Gagal menyesuaikan stok');
        return;
      }

      toast.success(res.message || 'Penyesuaian stok berhasil disimpan');
      onOpenChange(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in-0">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/80 shadow-neu-lg max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 shadow-neu-sm shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Penyesuaian Stok (Opname)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {kodeBarang} - {namaBarang}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <div>
              <span className="text-slate-500 block">Stok Sistem Saat Ini:</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {stokSaatIni} {satuan}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Perubahan (Delta):</span>
              <span
                className={`text-sm font-bold font-mono ${
                  delta > 0
                    ? 'text-emerald-700'
                    : delta < 0
                    ? 'text-red-600'
                    : 'text-slate-700'
                }`}
              >
                {delta > 0 ? `+${delta}` : delta} {satuan}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stok_baru" className="text-xs font-medium text-slate-700">
              Stok Fisik Baru (Hasil Hitung Opname) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="stok_baru"
              type="number"
              min="0"
              value={stokBaru}
              onChange={(e) => setStokBaru(parseInt(e.target.value, 10) || 0)}
              disabled={isSubmitting}
              className="text-xs font-mono tabular-nums h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alasan" className="text-xs font-medium text-slate-700">
              Alasan Penyesuaian <span className="text-red-500">* (minimal 10 karakter)</span>
            </Label>
            <Textarea
              id="alasan"
              rows={3}
              value={alasan}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setAlasan(e.target.value);
                if (alasanError) setAlasanError(null);
              }}
              disabled={isSubmitting}
              placeholder="Contoh: Hasil stok opname fisik akhir bulan gudang..."
              className="text-xs"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{alasan.trim().length} / 10 karakter minimum</span>
              {alasanError && <span className="text-red-600 font-medium">{alasanError}</span>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs h-8"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || alasan.trim().length < 10 || stokBaru < 0}
              className="text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white shadow-none"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
