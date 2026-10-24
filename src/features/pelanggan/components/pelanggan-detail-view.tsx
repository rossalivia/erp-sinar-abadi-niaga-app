'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { BadgeStatus } from '@/components/shared/badge-status';
import { formatRupiah, formatTanggal } from '@/lib/format';
import {
  ubahPelangganAction,
  ubahBatasKreditAction,
  ubahTerminAction,
  type FakturOverdueRow,
} from '../actions';
import { catatPelunasanAction } from '@/features/pesanan/actions';
import type { Database } from '@/types/database';

type PelangganPiutangRow = Database['public']['Views']['v_pelanggan_piutang']['Row'];

type PelangganDetailData = PelangganPiutangRow & {
  piutang_terkonfirmasi?: number | null;
  piutang_terkirim?: number | null;
  sisa_kredit?: number | null;
  jumlah_faktur_overdue?: number | null;
  hari_terlambat_terlama?: number | null;
  punya_overdue?: boolean | null;
  boleh_transaksi?: boolean | null;
};

interface PelangganDetailViewProps {
  pelanggan: PelangganDetailData;
  isManajer: boolean;
  fakturOverdue?: FakturOverdueRow[];
}

export function PelangganDetailView({
  pelanggan,
  isManajer,
  fakturOverdue = [],
}: PelangganDetailViewProps) {
  const router = useRouter();
  const [isPendingData, startTransitionData] = React.useTransition();
  const [isPendingKredit, startTransitionKredit] = React.useTransition();
  const [isPendingTermin, startTransitionTermin] = React.useTransition();
  const [isPendingPelunasan, startTransitionPelunasan] = React.useTransition();
  const [pelunasanId, setPelunasanId] = React.useState<string | null>(null);

  const batasKredit = Number(pelanggan.batas_kredit ?? 0);
  const piutangBerjalan = Number(pelanggan.piutang_berjalan ?? 0);
  const piutangTerkonfirmasi = Number(pelanggan.piutang_terkonfirmasi ?? 0);
  const piutangTerkirim = Number(pelanggan.piutang_terkirim ?? 0);
  const sisaKredit = batasKredit - piutangBerjalan;
  const adaLewatJatuhTempo =
    Boolean(pelanggan.ada_lewat_jatuh_tempo || pelanggan.punya_pesanan_lewat_tempo || pelanggan.punya_overdue) ||
    fakturOverdue.length > 0;

  const handlePelunasan = (pesananId: string) => {
    if (!confirm('Catat pelunasan untuk faktur ini? Piutang akan berkurang dan blokir overdue dibuka jika tidak ada tunggakan lain.')) {
      return;
    }
    setPelunasanId(pesananId);
    startTransitionPelunasan(async () => {
      const res = await catatPelunasanAction(pesananId);
      if (!res.success) {
        toast.error(res.message || 'Gagal mencatat pelunasan');
      } else {
        toast.success(res.message || 'Pelunasan faktur berhasil dicatat');
        router.refresh();
      }
      setPelunasanId(null);
    });
  };

  const handleUpdateData = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pelanggan.id) return;
    const formData = new FormData(e.currentTarget);

    startTransitionData(async () => {
      const res = await ubahPelangganAction(pelanggan.id!, null, formData);
      if (!res.success) {
        toast.error(res.message || 'Gagal memperbarui data pelanggan');
      } else {
        toast.success(res.message || 'Data pelanggan berhasil diperbarui');
        router.refresh();
      }
    });
  };

  const handleUpdateKredit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pelanggan.id) return;
    const formData = new FormData(e.currentTarget);

    startTransitionKredit(async () => {
      const res = await ubahBatasKreditAction(pelanggan.id!, null, formData);
      if (!res.success) {
        toast.error(res.message || 'Gagal mengubah batas kredit');
      } else {
        toast.success(res.message || 'Batas kredit berhasil diperbarui');
        router.refresh();
      }
    });
  };

  const handleUpdateTermin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pelanggan.id) return;
    const formData = new FormData(e.currentTarget);

    startTransitionTermin(async () => {
      const res = await ubahTerminAction(pelanggan.id!, null, formData);
      if (!res.success) {
        toast.error(res.message || 'Gagal mengubah termin bayar');
      } else {
        toast.success(res.message || 'Termin bayar berhasil diperbarui');
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Status Kredit & Piutang */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-2.5 px-4 border-b border-slate-100">
            <CardTitle className="text-xs font-medium text-slate-500">
              Batas Kredit (Plafon)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            <div className="text-lg font-semibold text-slate-900 tabular-nums">
              {formatRupiah(batasKredit)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Termin: {pelanggan.termin_hari ?? 0} Hari
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2.5 px-4 border-b border-slate-100">
            <CardTitle className="text-xs font-medium text-slate-500">
              Piutang Berjalan
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            <div className="text-lg font-semibold text-slate-900 tabular-nums">
              {formatRupiah(piutangBerjalan)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              Terkonfirmasi: {formatRupiah(piutangTerkonfirmasi)} | Terkirim: {formatRupiah(piutangTerkirim)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2.5 px-4 border-b border-slate-100">
            <CardTitle className="text-xs font-medium text-slate-500">
              Sisa Kredit
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            <div
              className={`text-lg font-semibold tabular-nums ${
                sisaKredit < 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {formatRupiah(sisaKredit)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {sisaKredit < 0 ? 'Batas kredit terlampaui' : 'Tersedia untuk pesanan baru'}
            </p>
          </CardContent>
        </Card>

        <Card
          className={`border shadow-none ${
            adaLewatJatuhTempo
              ? 'border-red-200 bg-red-50/40'
              : 'border-slate-200 bg-white'
          }`}
        >
          <CardHeader className="py-2.5 px-4 border-b border-slate-100">
            <CardTitle className="text-xs font-medium text-slate-500">
              Status Jatuh Tempo
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4">
            {adaLewatJatuhTempo ? (
              <div className="flex items-center gap-1.5 text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span className="text-xs font-semibold">Ada Tagihan Lewat Tempo!</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-xs font-semibold">Pembayaran Lancar</span>
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-0.5">
              {adaLewatJatuhTempo
                ? `${fakturOverdue.length || pelanggan.jumlah_faktur_overdue || 1} faktur lewat tempo (transaksi diblokir)`
                : 'Tidak ada pesanan lewat jatuh tempo'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Faktur Overdue (Credit & Overdue Control) */}
      {fakturOverdue.length > 0 && (
        <Card className="border-red-200 shadow-none bg-red-50/10">
          <CardHeader className="py-3 px-4 border-b border-red-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <div>
                <CardTitle className="text-xs font-bold text-red-900 uppercase tracking-wider">
                  Faktur Lewat Jatuh Tempo ({fakturOverdue.length} Faktur Menunggak)
                </CardTitle>
                <p className="text-[11px] text-red-700 mt-0.5">
                  Pelanggan ini sedang diblokir otomatis dari konfirmasi pesanan baru hingga seluruh tunggakan dilunasi.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-red-50/60 text-slate-700 font-medium border-b border-red-100">
                <tr>
                  <th className="py-2 px-3">Nomor SO</th>
                  <th className="py-2 px-3">Tanggal Kirim</th>
                  <th className="py-2 px-3">Jatuh Tempo</th>
                  <th className="py-2 px-3 text-center">Keterlambatan</th>
                  <th className="py-2 px-3 text-right">Total Tagihan</th>
                  <th className="py-2 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {fakturOverdue.map((f) => (
                  <tr key={f.id} className="hover:bg-red-50/30">
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">
                      <Link
                        href={`/pesanan/${f.id}`}
                        className="text-blue-600 hover:underline"
                        title="Lihat Detail Pesanan"
                      >
                        {f.nomor}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {f.dikirim_pada ? formatTanggal(f.dikirim_pada) : '-'}
                    </td>
                    <td className="py-2 px-3 font-medium text-red-700">
                      {formatTanggal(f.jatuh_tempo)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800">
                        {f.hari_terlambat} hari
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {formatRupiah(f.total)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {isManajer ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePelunasan(f.id)}
                          disabled={isPendingPelunasan && pelunasanId === f.id}
                          className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          {isPendingPelunasan && pelunasanId === f.id ? 'Memproses...' : 'Catat Lunas'}
                        </Button>
                      ) : (
                        <Link
                          href={`/pesanan/${f.id}`}
                          className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline"
                        >
                          Detail &rarr;
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Form Ubah Data Pokok Toko */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Informasi Toko & Kontak
                </CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kode: <span className="font-mono font-medium text-slate-700">{pelanggan.kode}</span>
                </p>
              </div>
              <BadgeStatus status={pelanggan.aktif ? 'aktif' : 'nonaktif'} />
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleUpdateData} className="space-y-4">
                <FormField id="nama_toko" label="Nama Toko" required>
                  <Input
                    id="nama_toko"
                    name="nama_toko"
                    defaultValue={pelanggan.nama_toko || ''}
                    required
                    disabled={isPendingData}
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="telepon" label="Nomor Telepon">
                    <Input
                      id="telepon"
                      name="telepon"
                      type="tel"
                      defaultValue={pelanggan.telepon || ''}
                      disabled={isPendingData}
                    />
                  </FormField>

                  <FormField id="aktif" label="Status Pelanggan">
                    <select
                      id="aktif"
                      name="aktif"
                      defaultValue={pelanggan.aktif ? 'true' : 'false'}
                      disabled={isPendingData}
                      className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </FormField>
                </div>

                <FormField id="alamat" label="Alamat Toko">
                  <Input
                    id="alamat"
                    name="alamat"
                    defaultValue={pelanggan.alamat || ''}
                    disabled={isPendingData}
                  />
                </FormField>

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <Button type="submit" size="sm" disabled={isPendingData}>
                    {isPendingData ? 'Menyimpan...' : 'Perbarui Data Toko'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Pengaturan Kredit & Termin (Hak Khusus Manajer) */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="py-3 px-5 border-b border-slate-100">
              <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Ketentuan Kredit & Termin
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {isManajer ? (
                <>
                  {/* Form Batas Kredit (Manajer) */}
                  <form onSubmit={handleUpdateKredit} className="space-y-3 pb-4 border-b border-slate-100">
                    <FormField
                      id="batas_kredit"
                      label="Batas Kredit (Rp)"
                      required
                      hint="Diaudit di sistem"
                    >
                      <Input
                        id="batas_kredit"
                        name="batas_kredit"
                        type="number"
                        min="0"
                        step="100000"
                        defaultValue={batasKredit}
                        disabled={isPendingKredit}
                      />
                    </FormField>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        disabled={isPendingKredit}
                      >
                        {isPendingKredit ? 'Menyimpan...' : 'Perbarui Limit Kredit'}
                      </Button>
                    </div>
                  </form>

                  {/* Form Termin Bayar (Manajer) */}
                  <form onSubmit={handleUpdateTermin} className="space-y-3">
                    <FormField
                      id="termin_hari"
                      label="Termin Bayar"
                      required
                      hint="Diaudit di sistem"
                    >
                      <select
                        id="termin_hari"
                        name="termin_hari"
                        defaultValue={String(pelanggan.termin_hari ?? 0)}
                        disabled={isPendingTermin}
                        className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      >
                        <option value="0">0 Hari (Tunai / CBD)</option>
                        <option value="7">7 Hari (1 Minggu)</option>
                        <option value="14">14 Hari (2 Minggu)</option>
                        <option value="30">30 Hari (1 Bulan)</option>
                      </select>
                    </FormField>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        disabled={isPendingTermin}
                      >
                        {isPendingTermin ? 'Menyimpan...' : 'Perbarui Termin'}
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-50 border border-amber-200/60 text-amber-800">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div className="text-[11px] leading-relaxed">
                      Batas kredit dan termin bayar bersifat <strong>read-only</strong> untuk Staf Penjualan. Hubungi Manajer untuk pengajuan penyesuaian limit kredit atau termin.
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Batas Kredit</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(batasKredit)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Termin Pembayaran</span>
                      <span className="font-semibold text-slate-900">
                        {pelanggan.termin_hari ?? 0} Hari
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
