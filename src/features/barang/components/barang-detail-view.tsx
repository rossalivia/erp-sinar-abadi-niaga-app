'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Package,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { BadgeStatus } from '@/components/shared/badge-status';
import { formatRupiah, formatTanggalWaktu } from '@/lib/format';
import {
  ubahBarangAction,
  ubahHargaJualAction,
  ubahHargaPokokAction,
} from '../actions';
import type { Peran } from '@/types/auth';

interface BarangData {
  id?: string | null;
  kode?: string | null;
  nama?: string | null;
  satuan?: string | null;
  harga_jual: number | null;
  stok: number | null;
  stok_minimum: number | null;
  aktif: boolean | null;
  diperbarui_pada: string | null;
  stok_menipis?: boolean | null;
  // Field khusus Manajer (optional / undefined untuk non-manajer)
  harga_pokok?: number | null;
  harga_pokok_belum_diisi?: boolean | null;
}

interface BarangDetailViewProps {
  barang: BarangData;
  peran: Peran;
}

export function BarangDetailView({ barang, peran }: BarangDetailViewProps) {
  const router = useRouter();
  const [isPendingData, startTransitionData] = React.useTransition();
  const [isPendingHargaJual, startTransitionHargaJual] = React.useTransition();
  const [isPendingHargaPokok, startTransitionHargaPokok] = React.useTransition();

  const isManajer = peran === 'manajer';
  const isGudang = peran === 'gudang';
  const canEditData = isManajer || isGudang;

  const stok = Number(barang.stok ?? 0);
  const stokMin = Number(barang.stok_minimum ?? 0);
  const stokMenipis = barang.stok_menipis || stok <= stokMin;
  const hargaJual = Number(barang.harga_jual ?? 0);
  const hargaPokok = barang.harga_pokok !== undefined && barang.harga_pokok !== null ? Number(barang.harga_pokok) : null;
  const marginKotor = hargaPokok !== null ? hargaJual - hargaPokok : null;
  const marginPersen = hargaPokok !== null && hargaJual > 0 ? (marginKotor! / hargaJual) * 100 : null;

  const handleUpdateData = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!barang.id) return;
    const formData = new FormData(e.currentTarget);

    startTransitionData(async () => {
      const res = await ubahBarangAction(barang.id!, null, formData);
      if (!res.success) {
        toast.error(res.message || 'Gagal memperbarui data barang');
      } else {
        toast.success(res.message || 'Data barang berhasil diperbarui');
        router.refresh();
      }
    });
  };

  const handleUpdateHargaJual = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!barang.id) return;
    const formData = new FormData(e.currentTarget);

    startTransitionHargaJual(async () => {
      const res = await ubahHargaJualAction(barang.id!, null, formData);
      if (!res.success) {
        toast.error(res.message || 'Gagal mengubah harga jual');
      } else {
        toast.success(res.message || 'Harga jual berhasil diperbarui');
        router.refresh();
      }
    });
  };

  const handleUpdateHargaPokok = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!barang.id) return;
    const formData = new FormData(e.currentTarget);

    startTransitionHargaPokok(async () => {
      const res = await ubahHargaPokokAction(barang.id!, null, formData);
      if (!res.success) {
        toast.error(res.message || 'Gagal mengubah harga pokok');
      } else {
        toast.success(res.message || 'Harga pokok berhasil diperbarui');
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Stok & Peringatan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100">
            <CardTitle className="text-xs font-medium text-slate-500">
              Stok Fisik Saat Ini
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-semibold text-slate-900 tabular-nums">
              {stok} <span className="text-xs font-normal text-slate-500">{barang.satuan}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Stok Minimum: {stokMin} {barang.satuan}
            </p>
          </CardContent>
        </Card>

        <Card
          className={`border shadow-none ${
            stokMenipis ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'
          }`}
        >
          <CardHeader className="py-2.5 px-4 border-b border-slate-100">
            <CardTitle className="text-xs font-medium text-slate-500">
              Status Persediaan
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            {stokMenipis ? (
              <div className="flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="text-xs font-semibold">Stok Menipis / Kritis!</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-xs font-semibold">Persediaan Aman</span>
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-0.5">
              {stokMenipis
                ? 'Stok berada pada atau di bawah batas minimum'
                : 'Kuantitas mencukupi batas aman operasional'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-none">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100">
            <CardTitle className="text-xs font-medium text-slate-500">
              Harga Jual Resmi
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            <div className="text-lg font-semibold text-slate-900 tabular-nums">
              {formatRupiah(hargaJual)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Per {barang.satuan}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-none">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100">
            <CardTitle className="text-xs font-medium text-slate-500">
              Terakhir Diperbarui
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            <div className="text-xs font-medium text-slate-800">
              {formatTanggalWaktu(barang.diperbarui_pada)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Status: <span className="capitalize">{barang.aktif ? 'Aktif' : 'Nonaktif'}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Peringatan Khusus Manajer bila Harga Pokok Kosong */}
      {isManajer && (barang.harga_pokok_belum_diisi || hargaPokok === null) && (
        <div className="flex items-start gap-3 p-3.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <div className="font-semibold">Harga Pokok Belum Diisi (HPP Kosong)</div>
            <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Barang ini belum memiliki nilai harga pokok. Segera tetapkan harga pokok awal melalui formulir keuangan di samping atau melalui penerimaan pesanan pembelian (PO) agar laporan margin dapat dihitung secara akurat.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Informasi Barang & Form Gudang/Manajer */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Informasi Master Barang
                </CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kode: <span className="font-mono font-medium text-slate-700">{barang.kode}</span>
                </p>
              </div>
              <BadgeStatus status={barang.aktif ? 'aktif' : 'nonaktif'} />
            </CardHeader>
            <CardContent className="p-5">
              {canEditData ? (
                <form onSubmit={handleUpdateData} className="space-y-4">
                  <FormField id="nama" label="Nama Barang" required>
                    <Input
                      id="nama"
                      name="nama"
                      defaultValue={barang.nama || ''}
                      required
                      disabled={isPendingData}
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField id="satuan" label="Satuan" required hint="Contoh: Pcs, Dus">
                      <Input
                        id="satuan"
                        name="satuan"
                        defaultValue={barang.satuan || ''}
                        required
                        disabled={isPendingData}
                      />
                    </FormField>

                    <FormField
                      id="stok_minimum"
                      label="Batas Stok Minimum"
                      required
                      hint="Peringatan bila stok di bawah ini"
                    >
                      <Input
                        id="stok_minimum"
                        name="stok_minimum"
                        type="number"
                        min="0"
                        defaultValue={stokMin}
                        required
                        disabled={isPendingData}
                      />
                    </FormField>
                  </div>

                  <FormField id="aktif" label="Status Aktif Barang">
                    <select
                      id="aktif"
                      name="aktif"
                      defaultValue={barang.aktif ? 'true' : 'false'}
                      disabled={isPendingData}
                      className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </FormField>

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <Button type="submit" size="sm" disabled={isPendingData}>
                      {isPendingData ? 'Menyimpan...' : 'Perbarui Data Barang'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Nama Barang</span>
                    <span className="font-semibold text-slate-900">{barang.nama}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Satuan</span>
                    <span className="text-slate-800">{barang.satuan}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Stok Minimum</span>
                    <span className="text-slate-800 tabular-nums">{stokMin}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Harga Jual</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatRupiah(hargaJual)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 italic pt-1">
                    Staf Penjualan memiliki hak akses lihat (read-only) untuk data barang.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Kartu Manajemen Stok (Non-editable langsung) */}
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="py-3 px-5 border-b border-slate-100">
              <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-4 w-4 text-slate-500" />
                Manajemen Kuantitas Fisik Stok
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <Lock className="h-4 w-4 shrink-0 mt-0.5 text-slate-500" />
                <div className="leading-relaxed">
                  Kolom stok <strong>TIDAK BISA diedit secara manual</strong> pada formulir untuk menjaga integritas pembukuan barang. Setiap penambahan atau pengurangan fisik kuantitas barang wajib tercatat dalam kartu mutasi transaksi.
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md border border-slate-100 bg-slate-50/50">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-slate-800">
                    Penyesuaian Stok Opname
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Koreksi perbedaan stok fisik hasil stock opname berkala (audit log wajib).
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled
                  title="Halaman penyesuaian stok akan diaktifkan pada Tahap 7"
                >
                  Penyesuaian Stok (Tahap 7)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Panel Keuangan / Hak Khusus Manajer */}
        <div className="space-y-6">
          {isManajer ? (
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="py-3 px-5 border-b border-slate-100 flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-slate-600" />
                  Keuangan & Nilai Pokok
                </CardTitle>
                <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                  Khusus Manajer
                </span>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* Form Ubah Harga Jual */}
                <form onSubmit={handleUpdateHargaJual} className="space-y-3 pb-4 border-b border-slate-100">
                  <FormField
                    id="harga_jual"
                    label="Harga Jual Resmi (Rp)"
                    required
                    hint="Diaudit di sistem"
                  >
                    <Input
                      id="harga_jual"
                      name="harga_jual"
                      type="number"
                      min="1"
                      step="500"
                      defaultValue={hargaJual}
                      disabled={isPendingHargaJual}
                    />
                  </FormField>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      disabled={isPendingHargaJual}
                    >
                      {isPendingHargaJual ? 'Menyimpan...' : 'Perbarui Harga Jual'}
                    </Button>
                  </div>
                </form>

                {/* Form Ubah Harga Pokok Manual */}
                <form onSubmit={handleUpdateHargaPokok} className="space-y-3 pb-4 border-b border-slate-100">
                  <FormField
                    id="harga_pokok"
                    label="Harga Pokok / HPP Satuan (Rp)"
                    required
                    hint="Koreksi HPP manual (B31, diaudit)"
                  >
                    <Input
                      id="harga_pokok"
                      name="harga_pokok"
                      type="number"
                      min="0"
                      step="500"
                      defaultValue={hargaPokok ?? 0}
                      disabled={isPendingHargaPokok}
                    />
                  </FormField>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      disabled={isPendingHargaPokok}
                    >
                      {isPendingHargaPokok ? 'Menyimpan...' : 'Perbarui Harga Pokok'}
                    </Button>
                  </div>
                </form>

                {/* Ringkasan Margin */}
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200/60 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Margin Unit (Kotor):</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {marginKotor !== null ? formatRupiah(marginKotor) : 'Belum dihitung'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Margin Persentase:</span>
                    <span className="font-semibold text-emerald-700 tabular-nums">
                      {marginPersen !== null ? `${marginPersen.toFixed(1)}%` : '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="py-3 px-5 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Harga & Ketentuan Penjualan
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Harga Jual Resmi</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatRupiah(hargaJual)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Satuan Jual</span>
                    <span className="text-slate-800">{barang.satuan}</span>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                  Perubahan harga jual hanya berwenang dilakukan oleh Manajer. Data harga pokok bersifat rahasia dan tidak ditampilkan kepada peran non-Manajer.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
