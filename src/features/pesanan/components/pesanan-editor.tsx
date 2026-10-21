'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hitungSubtotal, hitungTotalPesanan } from '../utils';
import { simpanDrafPesananAction } from '../actions';
import type { BarangOption, PelangganOption } from '../types';
import type { Peran } from '@/types/auth';
import { formatRupiah } from '@/lib/format';

interface ItemFormRow {
  key: string;
  barang_id: string;
  jumlah: number;
  diskon_persen: number;
}

interface PesananEditorProps {
  peran: Peran;
  pelangganList: PelangganOption[];
  barangList: BarangOption[];
  initialData?: {
    id?: string;
    nomor?: string;
    pelanggan_id: string;
    items: Array<{
      barang_id: string;
      jumlah: number;
      diskon_persen: number;
    }>;
  };
}

export function PesananEditor({
  peran,
  pelangganList,
  barangList,
  initialData,
}: PesananEditorProps) {
  const router = useRouter();
  const maxDiskon = peran === 'manajer' ? 25 : 10;
  const isEditing = Boolean(initialData?.id);

  const [pelangganId, setPelangganId] = React.useState<string>(
    initialData?.pelanggan_id || (pelangganList[0]?.id ?? '')
  );

  const [items, setItems] = React.useState<ItemFormRow[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((it, idx) => ({
        key: `init-${idx}-${it.barang_id}`,
        barang_id: it.barang_id,
        jumlah: it.jumlah,
        diskon_persen: it.diskon_persen,
      }));
    }
    return [
      {
        key: `item-0`,
        barang_id: barangList[0]?.id || '',
        jumlah: 1,
        diskon_persen: 0,
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Map barang untuk lookup cepat info harga jual dan stok
  const barangMap = React.useMemo(() => {
    const map = new Map<string, BarangOption>();
    barangList.forEach((b) => map.set(b.id, b));
    return map;
  }, [barangList]);

  // Map pelanggan untuk lookup info termin & limit kredit
  const selectedPelanggan = React.useMemo(() => {
    return pelangganList.find((p) => p.id === pelangganId);
  }, [pelangganList, pelangganId]);

  // Cek duplikasi barang
  const duplikatBarangIds = React.useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((it) => {
      if (it.barang_id) {
        counts.set(it.barang_id, (counts.get(it.barang_id) || 0) + 1);
      }
    });
    const dupes = new Set<string>();
    counts.forEach((count, id) => {
      if (count > 1) dupes.add(id);
    });
    return dupes;
  }, [items]);

  // Hitung total live
  const totalPesanan = React.useMemo(() => {
    const calcItems = items.map((it) => {
      const b = barangMap.get(it.barang_id);
      const harga = b?.harga_jual ?? 0;
      return {
        jumlah: it.jumlah,
        harga_satuan: harga,
        diskon_persen: it.diskon_persen,
      };
    });
    return hitungTotalPesanan(calcItems);
  }, [items, barangMap]);

  function handleAddItem() {
    if (items.length >= 20) {
      toast.error('Pesanan maksimal 20 baris barang');
      return;
    }

    // Pilih barang pertama yang belum ada di daftar
    const usedIds = new Set(items.map((i) => i.barang_id));
    const nextBarang = barangList.find((b) => !usedIds.has(b.id)) || barangList[0];

    setItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${Math.random()}`,
        barang_id: nextBarang ? nextBarang.id : '',
        jumlah: 1,
        diskon_persen: 0,
      },
    ]);
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) {
      toast.error('Pesanan minimal harus memiliki 1 baris');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdateItem(index: number, field: keyof ItemFormRow, value: unknown) {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index] };

      if (field === 'jumlah') {
        const val = Number(value);
        target.jumlah = isNaN(val) || val < 1 ? 1 : Math.floor(val);
      } else if (field === 'diskon_persen') {
        const val = Number(value);
        if (isNaN(val) || val < 0) {
          target.diskon_persen = 0;
        } else if (val > maxDiskon) {
          target.diskon_persen = maxDiskon;
          toast.warning(`Diskon untuk peran Anda dibatasi maksimal ${maxDiskon}%`);
        } else {
          target.diskon_persen = Number(val.toFixed(2));
        }
      } else if (field === 'barang_id') {
        target.barang_id = String(value);
      }

      next[index] = target;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!pelangganId) {
      setErrorMessage('Pelanggan wajib dipilih');
      return;
    }

    if (items.length < 1 || items.length > 20) {
      setErrorMessage('Pesanan harus berisi 1 sampai 20 baris');
      return;
    }

    if (duplikatBarangIds.size > 0) {
      setErrorMessage('Terdapat barang duplikat. Setiap barang hanya boleh satu baris');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.barang_id) {
        setErrorMessage(`Baris #${i + 1}: Silakan pilih barang`);
        return;
      }
      if (it.jumlah < 1) {
        setErrorMessage(`Baris #${i + 1}: Jumlah minimal 1`);
        return;
      }
      if (it.diskon_persen < 0 || it.diskon_persen > maxDiskon) {
        setErrorMessage(`Baris #${i + 1}: Diskon maksimal ${maxDiskon}%`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        pelanggan_id: pelangganId,
        pesanan_id: initialData?.id || null,
        items: items.map((it) => ({
          barang_id: it.barang_id,
          jumlah: it.jumlah,
          diskon_persen: it.diskon_persen,
        })),
      };

      const res = await simpanDrafPesananAction(payload);
      if (!res.success) {
        setErrorMessage(res.message || 'Gagal menyimpan pesanan');
        toast.error(res.message || 'Gagal menyimpan pesanan');
        return;
      }

      toast.success(
        isEditing
          ? 'Perubahan draf pesanan berhasil disimpan'
          : `Draf pesanan ${res.data?.nomor || ''} berhasil dibuat`
      );
      router.push(`/pesanan/${res.data?.id}`);
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

      {/* Bagian Informasi Pelanggan */}
      <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2.5">
          Informasi Pelanggan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pelanggan_id" className="text-xs font-medium text-slate-700">
              Pelanggan <span className="text-red-500">*</span>
            </Label>
            <select
              id="pelanggan_id"
              value={pelangganId}
              onChange={(e) => setPelangganId(e.target.value)}
              disabled={isSubmitting}
              className="w-full text-sm h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-900 shadow-none focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 disabled:opacity-50"
            >
              <option value="" disabled>
                -- Pilih Pelanggan --
              </option>
              {pelangganList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_toko} ({p.kode})
                </option>
              ))}
            </select>
          </div>

          {selectedPelanggan && (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1 text-slate-700">
              <p className="font-medium text-slate-900">{selectedPelanggan.nama_toko}</p>
              <p className="text-slate-500 truncate">{selectedPelanggan.alamat || '-'}</p>
              <div className="flex gap-4 pt-1">
                <span>
                  Termin: <strong>{selectedPelanggan.termin_hari} hari</strong>
                </span>
                <span>
                  Batas Kredit: <strong>{formatRupiah(selectedPelanggan.batas_kredit)}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bagian Baris Barang */}
      <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Daftar Barang ({items.length} / 20 baris)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Batas diskon peran {peran}: maksimum {maxDiskon}%. Harga diambil dari master barang.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            disabled={items.length >= 20 || isSubmitting}
            className="text-xs h-8 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Baris
          </Button>
        </div>

        <div className="border border-slate-200 rounded-md overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2 px-3 w-10 text-center">No</th>
                <th className="py-2 px-3 min-w-[240px]">Barang</th>
                <th className="py-2 px-3 w-28 text-right">Harga Jual</th>
                <th className="py-2 px-3 w-20 text-center">Stok</th>
                <th className="py-2 px-3 w-24 text-right">Jumlah</th>
                <th className="py-2 px-3 w-24 text-right">Diskon (%)</th>
                <th className="py-2 px-3 w-32 text-right">Subtotal (Rp)</th>
                <th className="py-2 px-2 w-12 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((row, idx) => {
                const b = barangMap.get(row.barang_id);
                const harga = b?.harga_jual ?? 0;
                const stok = b?.stok ?? 0;
                const subtotal = hitungSubtotal(row.jumlah, harga, row.diskon_persen);
                const isDupe = duplikatBarangIds.has(row.barang_id);

                return (
                  <tr
                    key={row.key}
                    className={isDupe ? 'bg-red-50/60' : idx % 2 === 1 ? 'bg-slate-50/50' : ''}
                  >
                    <td className="py-2 px-3 text-center text-slate-500 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={row.barang_id}
                        onChange={(e) => handleUpdateItem(idx, 'barang_id', e.target.value)}
                        disabled={isSubmitting}
                        className={`w-full text-xs h-8 rounded border px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 ${
                          isDupe
                            ? 'border-red-400 text-red-900'
                            : 'border-slate-300 text-slate-900'
                        }`}
                      >
                        {barangList.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.kode} - {item.nama} ({item.satuan})
                          </option>
                        ))}
                      </select>
                      {isDupe && (
                        <p className="text-[10px] text-red-600 mt-0.5">Barang duplikat</p>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {formatRupiah(harga)}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          stok < row.jumlah
                            ? 'bg-amber-100 text-amber-900 font-medium'
                            : 'text-slate-600'
                        }`}
                        title={stok < row.jumlah ? 'Stok master kurang dari jumlah' : undefined}
                      >
                        {stok}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Input
                        type="number"
                        min="1"
                        value={row.jumlah}
                        onChange={(e) => handleUpdateItem(idx, 'jumlah', e.target.value)}
                        disabled={isSubmitting}
                        className="h-8 text-xs text-right font-mono tabular-nums w-full"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max={maxDiskon}
                        value={row.diskon_persen}
                        onChange={(e) =>
                          handleUpdateItem(idx, 'diskon_persen', e.target.value)
                        }
                        disabled={isSubmitting}
                        className="h-8 text-xs text-right font-mono tabular-nums w-full"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatRupiah(subtotal)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1 || isSubmitting}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={6} className="py-3 px-4 text-right font-semibold text-slate-800 text-xs uppercase tracking-wider">
                  Total Estimasi Pesanan:
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-sm font-bold text-slate-900">
                  {formatRupiah(totalPesanan)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Baris Tombol Aksi */}
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

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || duplikatBarangIds.size > 0}
            className="gap-1.5 text-xs h-9 bg-slate-900 hover:bg-slate-800 text-white shadow-none"
          >
            <Save className="w-3.5 h-3.5" />
            {isSubmitting
              ? 'Menyimpan Draf...'
              : isEditing
              ? 'Perbarui Draf'
              : 'Simpan Draf Pesanan'}
          </Button>
        </div>
      </div>
    </form>
  );
}
