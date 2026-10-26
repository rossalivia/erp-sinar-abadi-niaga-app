'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatRupiah, formatTanggal } from '@/lib/format';
import { catatPelunasanAction } from '@/features/pesanan/actions';
import type { LaporanPiutangPesananItem } from '../types';

interface PiutangPesananTableProps {
  items: LaporanPiutangPesananItem[];
}

export function PiutangPesananTable({ items }: PiutangPesananTableProps) {
  const router = useRouter();
  const [selectedPesanan, setSelectedPesanan] = React.useState<LaporanPiutangPesananItem | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleKonfirmasiLunas = () => {
    if (!selectedPesanan) return;

    startTransition(async () => {
      const res = await catatPelunasanAction(selectedPesanan.pesanan_id);
      if (!res.success) {
        toast.error(res.message || 'Gagal mencatat pelunasan');
      } else {
        toast.success(`Pesanan ${selectedPesanan.nomor} berhasil dilunasi`);
        setSelectedPesanan(null);
        router.refresh();
      }
    });
  };

  const getAgingBadge = (kategori: string, hariLewat: number) => {
    switch (kategori) {
      case 'belum_jatuh_tempo':
        return (
          <Badge variant="outline" className="text-[11px] font-normal bg-emerald-50 text-emerald-800 border-emerald-200">
            Belum tempo
          </Badge>
        );
      case '1-30_hari':
      case '1-7_hari':
      case '8-30_hari':
        return (
          <Badge variant="warning" className="text-[11px] font-medium bg-amber-50 text-amber-800 border-amber-200">
            Lewat {hariLewat} hr
          </Badge>
        );
      case '>30_hari':
        return (
          <Badge variant="destructive" className="text-[11px] font-semibold bg-red-100 text-red-800 border-red-200">
            Lewat {hariLewat} hr (&gt;30)
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">
              Daftar Pesanan Belum Lunas (Piutang Berjalan)
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Tagihan aktif pelanggan (pesanan dikonfirmasi &amp; dikirim) yang siap diproses pelunasan
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            {items.length} pesanan
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Tidak ada pesanan aktif yang menunggu pelunasan (semua pesanan lunas)
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="text-xs font-semibold text-slate-700">Nomor Pesanan</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700">Pelanggan</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700">Dikirim Pada</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700">Jatuh Tempo</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-slate-700">Aging</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-700">Nilai Tagihan</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-700">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.pesanan_id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="text-xs font-mono font-medium">
                        <Link
                          href={`/pesanan/${p.pesanan_id}`}
                          className="text-slate-900 hover:underline flex items-center gap-1"
                        >
                          {p.nomor}
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Link
                          href={`/pelanggan/${p.pelanggan_id}`}
                          className="font-medium text-slate-900 hover:underline block"
                        >
                          {p.nama_toko}
                        </Link>
                        {p.telepon && (
                          <span className="text-[11px] text-slate-400 font-mono">{p.telepon}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {p.dikirim_pada ? formatTanggal(p.dikirim_pada) : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800">
                        {p.jatuh_tempo ? formatTanggal(p.jatuh_tempo) : '-'}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {getAgingBadge(p.kategori_aging, p.hari_lewat)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-900 font-bold">
                        {formatRupiah(p.total)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs px-2.5 bg-slate-900 text-white hover:bg-slate-800 font-normal"
                            onClick={() => setSelectedPesanan(p)}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Catat Lunas
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Konfirmasi Catat Pelunasan */}
      {selectedPesanan && (
        <Dialog open={!!selectedPesanan} onOpenChange={(open) => !open && setSelectedPesanan(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Konfirmasi Pelunasan Pesanan
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Tindakan ini akan mencatat pembayaran lunas penuh dan memperbarui status pesanan menjadi <strong className="text-slate-800">Lunas</strong>. Piutang berjalan pelanggan akan otomatis berkurang.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 text-xs space-y-2 my-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Pesanan:</span>
                <span className="font-mono font-medium text-slate-900">{selectedPesanan.nomor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggan:</span>
                <span className="font-medium text-slate-900">{selectedPesanan.nama_toko}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jatuh Tempo:</span>
                <span className="text-slate-700">{formatTanggal(selectedPesanan.jatuh_tempo)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-700 font-semibold">Total Tagihan:</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {formatRupiah(selectedPesanan.total)}
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedPesanan(null)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={handleKonfirmasiLunas}
                disabled={isPending}
              >
                {isPending ? 'Menyimpan...' : 'Konfirmasi Lunas'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
