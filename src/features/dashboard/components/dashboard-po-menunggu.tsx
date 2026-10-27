'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ShoppingCart,
  ArrowRight,
  Clock,
  CheckCircle2,
  X,
  AlertTriangle,
  Building2,
  Package,
  Check,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { formatTanggal, formatRupiah } from '@/lib/format';
import { setujuiPembelianAction, tolakPembelianAction } from '@/features/pembelian/actions';

export interface PoMenungguItem {
  id: string;
  nomor: string;
  diajukan_pada: string;
  jumlah_dipesan: number;
  pemasok: {
    id?: string;
    kode?: string;
    nama?: string;
  } | null;
  barang: {
    id?: string;
    kode?: string;
    nama?: string;
    satuan?: string;
  } | null;
}

interface DashboardPoMenungguProps {
  items: PoMenungguItem[];
  totalMenunggu?: number;
}

export function DashboardPoMenunggu({ items, totalMenunggu = items.length }: DashboardPoMenungguProps) {
  const router = useRouter();

  // State Modal Detail PO & Persetujuan
  const [selectedPo, setSelectedPo] = React.useState<PoMenungguItem | null>(null);
  const [hargaBeli, setHargaBeli] = React.useState<number | ''>('');
  const [hargaBeliError, setHargaBeliError] = React.useState<string | null>(null);

  // State Sub-mode Penolakan
  const [isRejectMode, setIsRejectMode] = React.useState(false);
  const [alasanTolak, setAlasanTolak] = React.useState('');
  const [alasanError, setAlasanError] = React.useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOpenTinjau = (item: PoMenungguItem) => {
    setSelectedPo(item);
    setHargaBeli('');
    setHargaBeliError(null);
    setIsRejectMode(false);
    setAlasanTolak('');
    setAlasanError(null);
  };

  const handleClose = () => {
    setSelectedPo(null);
    setIsRejectMode(false);
    setHargaBeli('');
    setHargaBeliError(null);
    setAlasanTolak('');
    setAlasanError(null);
  };

  // Handler Persetujuan PO oleh Manajer (BR-09: Wajib input harga_beli_satuan > 0)
  const handleSetujui = async () => {
    if (!selectedPo) return;

    const nominal = typeof hargaBeli === 'number' ? hargaBeli : Number(hargaBeli);
    if (!nominal || nominal <= 0) {
      setHargaBeliError('Harga beli satuan wajib diisi dan harus lebih dari 0 (BR-09)');
      return;
    }

    setIsSubmitting(true);
    setHargaBeliError(null);

    try {
      const res = await setujuiPembelianAction({
        pembelian_id: selectedPo.id,
        harga_beli_satuan: nominal,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal menyetujui pengajuan pembelian');
        return;
      }

      toast.success(`PO ${selectedPo.nomor} berhasil disetujui dengan harga ${formatRupiah(nominal)}/satuan`);
      handleClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Penolakan PO oleh Manajer (BR-09: Alasan minimal 10 karakter)
  const handleTolak = async () => {
    if (!selectedPo) return;

    const clean = alasanTolak.trim();
    if (clean.length < 10) {
      setAlasanError('Alasan penolakan minimal 10 karakter (BR-09)');
      return;
    }

    setIsSubmitting(true);
    setAlasanError(null);

    try {
      const res = await tolakPembelianAction({
        pembelian_id: selectedPo.id,
        alasan: clean,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal menolak pengajuan pembelian');
        return;
      }

      toast.success(`PO ${selectedPo.nomor} berhasil ditolak`);
      handleClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedTotal =
    selectedPo && typeof hargaBeli === 'number' && hargaBeli > 0
      ? selectedPo.jumlah_dipesan * hargaBeli
      : 0;

  return (
    <section
      className="surface-raised rounded-2xl p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 transition-colors duration-150"
      aria-label="Pengajuan Pembelian Menunggu"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0c1a30] dark:text-slate-100">
              Pengajuan Pembelian Menunggu Persetujuan
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daftar pengadaan barang yang diajukan staf gudang memerlukan keputusan dan harga beli Manajer (BR-09)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full tabular-nums border border-amber-200 dark:border-amber-900">
            {totalMenunggu} PO Menunggu
          </span>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-[#2563eb] dark:text-blue-400 hover:text-[#1d4ed8] gap-1"
          >
            <Link href="/pembelian?status=diajukan">
              Lihat Semua
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-1.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <span className="font-medium text-slate-700 dark:text-slate-300">Semua Pengajuan Telah Ditinjau</span>
          <span>Tidak ada pengajuan pembelian yang sedang menunggu persetujuan Manajer saat ini.</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Table>
            <TableHeader className="bg-slate-50/75 dark:bg-slate-800">
              <TableRow className="border-b border-slate-200 dark:border-slate-700 text-xs">
                <TableHead className="w-32 font-semibold text-slate-700 dark:text-slate-200">Nomor PO</TableHead>
                <TableHead className="w-32 font-semibold text-slate-700 dark:text-slate-200">Tanggal Diajukan</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Pemasok</TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200">Barang</TableHead>
                <TableHead className="text-right w-28 font-semibold text-slate-700 dark:text-slate-200">Jumlah</TableHead>
                <TableHead className="text-center w-28 font-semibold text-slate-700 dark:text-slate-200">Status</TableHead>
                <TableHead className="text-right w-28 font-semibold text-slate-700 dark:text-slate-200">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 text-xs"
                >
                  <TableCell className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    <Link href={`/pembelian/${item.id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                      {item.nomor}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400">
                    {formatTanggal(item.diajukan_pada)}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                    {item.pemasok?.nama || '-'}
                    {item.pemasok?.kode && (
                      <span className="block text-[11px] text-slate-400 font-mono">
                        {item.pemasok.kode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-800 dark:text-slate-200">
                    {item.barang?.nama || '-'}
                    {item.barang?.kode && (
                      <span className="block text-[11px] text-slate-400 font-mono">
                        {item.barang.kode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {item.jumlah_dipesan.toLocaleString('id-ID')} {item.barang?.satuan || 'pcs'}
                  </TableCell>
                  <TableCell className="text-center">
                    <BadgeStatus status="diajukan" label="Menunggu" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenTinjau(item)}
                      className="h-7 text-xs px-2.5 border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 gap-1 font-semibold cursor-pointer shadow-none"
                    >
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Tinjau
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* MODAL DIALOG PERSETUJUAN PO OLEH MANAJER (BR-09) */}
      <DialogPrimitive.Root open={Boolean(selectedPo)} onOpenChange={(open) => !open && handleClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150 p-6 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isRejectMode ? 'Tolak Pengajuan Pembelian' : 'Persetujuan Pengajuan PO'}
                  </h3>
                  <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedPo?.nomor} &bull; {selectedPo?.diajukan_pada && formatTanggal(selectedPo.diajukan_pada)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ringkasan Barang & Pemasok */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 font-mono">
                    <Package className="w-3 h-3 text-slate-400" />
                    Barang yang Dipesan
                  </span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedPo?.barang?.nama}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {selectedPo?.barang?.kode}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 font-mono">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    Pemasok Terpilih
                  </span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedPo?.pemasok?.nama}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {selectedPo?.pemasok?.kode}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Kuantitas Permintaan:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {selectedPo?.jumlah_dipesan.toLocaleString('id-ID')} {selectedPo?.barang?.satuan || 'pcs'}
                </span>
              </div>
            </div>

            {/* MODE 1: FORM PERSETUJUAN DENGAN HARGA BELI SATUAN (BR-09) */}
            {!isRejectMode ? (
              <div className="space-y-3.5 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="input-harga-beli" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Harga Beli Satuan (Rp) <span className="text-red-500">*</span>
                    </Label>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-900">
                      Wajib Diisi Manajer (BR-09)
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <Input
                      id="input-harga-beli"
                      type="number"
                      min={1}
                      step={1}
                      autoFocus
                      placeholder="Masukkan harga beli satuan dari pemasok..."
                      value={hargaBeli}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setHargaBeli(val);
                        if (hargaBeliError) setHargaBeliError(null);
                      }}
                      className="pl-9 font-mono text-xs font-semibold h-8.5"
                    />
                  </div>
                  {hargaBeliError && (
                    <p className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {hargaBeliError}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500">
                    Sesuai BR-09, harga beli satuan rahasia hanya ditentukan oleh Manajer saat persetujuan dan menjadi acuan mutasi stok.
                  </p>
                </div>

                {/* Kalkulasi Total Anggaran */}
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/80 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                      Estimasi Total Anggaran PO:
                    </span>
                    <p className="text-base font-black text-emerald-950 dark:text-emerald-100 font-mono tabular-nums">
                      {formatRupiah(calculatedTotal)}
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                    {selectedPo?.jumlah_dipesan} &times; {typeof hargaBeli === 'number' && hargaBeli > 0 ? formatRupiah(hargaBeli) : 'Rp0'}
                  </span>
                </div>

                {/* Tombol Aksi */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRejectMode(true)}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Tolak Pengajuan PO
                  </button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="text-xs h-8"
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSetujui}
                      disabled={isSubmitting || typeof hargaBeli !== 'number' || hargaBeli <= 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-4 font-semibold gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Memproses...' : 'Setujui PO (BR-09)'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* MODE 2: FORM PENOLAKAN PO */
              <div className="space-y-3.5 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="alasan-tolak" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Alasan Penolakan <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="alasan-tolak"
                    autoFocus
                    rows={3}
                    placeholder="Tuliskan alasan penolakan PO (minimal 10 karakter, mis: Stok di gudang masih mencukupi)..."
                    value={alasanTolak}
                    onChange={(e) => {
                      setAlasanTolak(e.target.value);
                      if (alasanError) setAlasanError(null);
                    }}
                    className="text-xs"
                  />
                  {alasanError && (
                    <p className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {alasanError}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500">
                    Karakter: {alasanTolak.trim().length}/10 minimum.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRejectMode(false)}
                    disabled={isSubmitting}
                    className="text-xs h-8"
                  >
                    &larr; Kembali ke Form Setujui
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="text-xs h-8"
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleTolak}
                      disabled={isSubmitting || alasanTolak.trim().length < 10}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 px-4 font-semibold gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Memproses...' : 'Konfirmasi Tolak PO'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Pintasan Halaman PO */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Ingin meninjau riwayat lengkap pembelian?</span>
              <Link
                href={`/pembelian/${selectedPo?.id}`}
                target="_blank"
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
              >
                Halaman Detail PO
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  );
}
