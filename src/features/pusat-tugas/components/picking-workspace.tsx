'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Loader2,
  Printer,
  RotateCcw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatTanggalWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ambilDaftarPickingAction } from '../actions';
import { formatWaktuCetak, gabungNomorPesanan } from '../utils';
import type {
  PickingListResult,
  PickingRingkasanBarang,
  PesananTerkonfirmasi,
} from '../types';

interface PickingWorkspaceProps {
  pesanan: PesananTerkonfirmasi[];
}

const KELAS_TH =
  'sticky top-0 bg-slate-100 px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-700 border-b border-slate-200 whitespace-nowrap';
const KELAS_TD = 'px-2.5 py-1.5 border-b border-slate-100 align-middle';

const kolomAgregat: Column<PickingRingkasanBarang>[] = [
  {
    header: 'Cek',
    align: 'center',
    className: 'w-10',
    cell: () => (
      <span
        className="inline-block h-3.5 w-3.5 border border-slate-800 bg-white"
        aria-hidden="true"
      />
    ),
  },
  {
    header: 'Kode Barang',
    accessorKey: 'kode_barang',
    className: 'w-28 font-mono text-[11px] font-medium text-slate-700',
  },
  {
    header: 'Nama Barang',
    accessorKey: 'nama_barang',
    className: 'font-medium text-slate-900',
  },
  {
    header: 'Satuan',
    accessorKey: 'satuan',
    className: 'w-20 text-slate-500',
  },
  {
    header: 'Total Diambil',
    align: 'right',
    isNumeric: true,
    className: 'w-28 font-semibold text-slate-900',
    cell: (row) => row.total_diambil.toLocaleString('id-ID'),
  },
  {
    header: 'Stok Tersedia',
    align: 'right',
    isNumeric: true,
    className: 'w-28 text-slate-600',
    cell: (row) => row.stok_saat_ini.toLocaleString('id-ID'),
  },
  {
    header: 'Status',
    align: 'center',
    className: 'w-24',
    cell: (row) => (
      <Badge variant={row.stok_cukup ? 'success' : 'danger'} className="text-[10px]">
        {row.stok_cukup ? 'Cukup' : 'Kurang'}
      </Badge>
    ),
  },
];

export function PickingWorkspace({ pesanan }: PickingWorkspaceProps) {
  const [terpilih, setTerpilih] = React.useState<Set<string>>(
    () => new Set<string>()
  );
  const [hasil, setHasil] = React.useState<PickingListResult | null>(null);
  const [galat, setGalat] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const semuaTerpilih = pesanan.length > 0 && terpilih.size === pesanan.length;

  const toggleSatu = (id: string) => {
    setTerpilih((sebelumnya) => {
      const berikutnya = new Set(sebelumnya);
      if (berikutnya.has(id)) {
        berikutnya.delete(id);
      } else {
        berikutnya.add(id);
      }
      return berikutnya;
    });
  };

  const toggleSemua = () => {
    if (semuaTerpilih) {
      setTerpilih(new Set());
      return;
    }
    setTerpilih(new Set(pesanan.map((item) => item.id)));
  };

  const buatPickingList = () => {
    if (terpilih.size === 0) {
      setGalat('Pilih minimal satu pesanan untuk membuat daftar ambil barang.');
      return;
    }

    startTransition(async () => {
      setGalat(null);
      const hasilAksi = await ambilDaftarPickingAction(Array.from(terpilih));

      if (!hasilAksi.success || !hasilAksi.data) {
        setGalat(
          hasilAksi.message ??
            'Daftar ambil barang tidak dapat dibuat. Silakan coba lagi.'
        );
        return;
      }

      setHasil(hasilAksi.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  if (hasil) {
    const { metadata, ringkasan_barang, rincian_pesanan } = hasil;
    const daftarNomor = gabungNomorPesanan(rincian_pesanan);

    return (
      <div className="space-y-4 picking-print">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between no-print">
          <div className="flex items-center gap-2">
            <Badge variant="success" className="text-[10px]">
              Picking List Siap
            </Badge>
            <span className="text-[11px] text-slate-500">
              {metadata.total_pesanan} pesanan,{' '}
              {metadata.total_kuantitas.toLocaleString('id-ID')} unit
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setHasil(null);
                setGalat(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Pilih Ulang Pesanan
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 bg-slate-900 text-xs text-white shadow-none hover:bg-slate-800"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak Picking List
            </Button>
          </div>
        </div>

        {/* Kop dokumen (tampil di layar & cetak) */}
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="border-b border-slate-300 pb-3 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
              CV Sinar Abadi Niaga
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              Daftar Ambil Barang (Picking List)
            </p>
          </div>
          <div className="grid gap-x-6 gap-y-1 pt-3 text-[11px] sm:grid-cols-2">
            <p>
              <span className="text-slate-500">Waktu Cetak</span> :{' '}
              <span className="font-medium text-slate-800">
                {formatWaktuCetak(metadata.dibuat_pada)}
              </span>
            </p>
            <p>
              <span className="text-slate-500">Petugas</span> :{' '}
              <span className="font-medium text-slate-800">
                {metadata.dibuat_oleh_nama} (
                {metadata.dibuat_oleh_peran === 'gudang'
                  ? 'Staf Gudang'
                  : 'Manajer'}
                )
              </span>
            </p>
            <p className="sm:col-span-2">
              <span className="text-slate-500">Pesanan</span> :{' '}
              <span className="font-medium text-slate-800">
                {metadata.total_pesanan} Dokumen ({daftarNomor})
              </span>
            </p>
          </div>
        </div>

        {/* Tabel 1: agregat barang */}
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <h2 className="text-xs font-semibold text-slate-900">
              Daftar Agregat Barang
            </h2>
            <span className="text-[10px] text-slate-500">
              {metadata.total_item_barang} jenis barang
            </span>
          </div>
          <DataTable
            columns={kolomAgregat}
            data={ringkasan_barang}
            keyExtractor={(item) => item.barang_id}
            emptyTitle="Tidak ada barang pada pesanan terpilih"
            emptyDescription="Pesanan terpilih tidak memiliki baris barang."
            zebra
            className="rounded-none border-0"
          />
        </div>

        {/* Tabel 2: rincian per pesanan */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900">
              Rincian per Pesanan
            </h2>
            <span className="text-[10px] text-slate-500">
              {metadata.total_pesanan} dokumen
            </span>
          </div>

          {rincian_pesanan.map((rincian) => (
            <div
              key={rincian.pesanan_id}
              className="picking-list-row rounded-md border border-slate-200 bg-white"
            >
              <div className="flex flex-col gap-1 border-b border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {rincian.nomor}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {rincian.pelanggan_nama} ({rincian.pelanggan_kode})
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-slate-500">
                    Dikonfirmasi:{' '}
                    <span className="font-medium text-slate-700">
                      {formatTanggalWaktu(rincian.dikonfirmasi_pada)}
                    </span>
                  </span>
                  <Link
                    href={`/pesanan/${rincian.pesanan_id}`}
                    className="no-print inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                  >
                    Buka Pesanan
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className={cn(KELAS_TH, 'w-10 text-center')} scope="col">
                      Cek
                    </th>
                    <th className={KELAS_TH} scope="col">
                      Kode Barang
                    </th>
                    <th className={KELAS_TH} scope="col">
                      Nama Barang
                    </th>
                    <th className={KELAS_TH} scope="col">
                      Satuan
                    </th>
                    <th
                      className={cn(KELAS_TH, 'w-24 text-right')}
                      scope="col"
                    >
                      Jumlah
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rincian.items.map((item) => (
                    <tr key={`${rincian.pesanan_id}-${item.barang_id}`}>
                      <td className={cn(KELAS_TD, 'text-center')}>
                        <span
                          className="inline-block h-3.5 w-3.5 border border-slate-800 bg-white"
                          aria-hidden="true"
                        />
                      </td>
                      <td
                        className={cn(
                          KELAS_TD,
                          'w-28 font-mono text-[11px] font-medium text-slate-700'
                        )}
                      >
                        {item.kode_barang}
                      </td>
                      <td className={cn(KELAS_TD, 'font-medium text-slate-900')}>
                        {item.nama_barang}
                      </td>
                      <td className={cn(KELAS_TD, 'w-20 text-slate-500')}>
                        {item.satuan}
                      </td>
                      <td
                        className={cn(
                          KELAS_TD,
                          'w-24 text-right font-semibold tabular-nums text-slate-900'
                        )}
                      >
                        {item.jumlah.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 no-print">
          Picking list ini hanya alat bantu pengambilan barang. Pengiriman
          resmi tetap dilakukan per pesanan melalui halaman detail pesanan
          (RPC kirim pesanan).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={semuaTerpilih}
            onChange={toggleSemua}
            className="h-3.5 w-3.5 accent-slate-900"
          />
          Pilih Semua
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-800 tabular-nums">
              {terpilih.size}
            </span>{' '}
            pesanan terpilih
          </span>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-slate-900 text-xs text-white shadow-none hover:bg-slate-800"
            onClick={buatPickingList}
            disabled={terpilih.size === 0 || pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ClipboardList className="h-3.5 w-3.5" />
            )}
            {pending ? 'Menyiapkan...' : 'Buat Daftar Ambil Barang'}
          </Button>
        </div>
      </div>

      {galat && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{galat}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className={cn(KELAS_TH, 'w-10 text-center')} scope="col">
                  <span className="sr-only">Pilih</span>
                </th>
                <th className={KELAS_TH} scope="col">
                  Nomor Pesanan
                </th>
                <th className={KELAS_TH} scope="col">
                  Pelanggan
                </th>
                <th className={KELAS_TH} scope="col">
                  Tanggal Konfirmasi
                </th>
                <th className={cn(KELAS_TH, 'text-right')} scope="col">
                  Umur Pesanan
                </th>
                <th className={cn(KELAS_TH, 'text-right')} scope="col">
                  Total Item
                </th>
              </tr>
            </thead>
            <tbody>
              {pesanan.map((item) => {
                const dipilih = terpilih.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-slate-50',
                      dipilih && 'bg-slate-50/80'
                    )}
                    onClick={() => toggleSatu(item.id)}
                  >
                    <td
                      className={cn(KELAS_TD, 'text-center')}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={dipilih}
                        onChange={() => toggleSatu(item.id)}
                        aria-label={`Pilih pesanan ${item.nomor}`}
                        className="h-3.5 w-3.5 accent-slate-900"
                      />
                    </td>
                    <td
                      className={cn(
                        KELAS_TD,
                        'font-mono text-[11px] font-medium text-slate-800'
                      )}
                    >
                      {item.nomor}
                    </td>
                    <td className={cn(KELAS_TD, 'text-slate-700')}>
                      <span className="font-medium text-slate-900">
                        {item.pelanggan_nama}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400">
                        {item.pelanggan_kode}
                      </span>
                    </td>
                    <td className={cn(KELAS_TD, 'text-slate-600')}>
                      {formatTanggalWaktu(item.dikonfirmasi_pada)}
                    </td>
                    <td
                      className={cn(
                        KELAS_TD,
                        'text-right tabular-nums',
                        item.umur_hari >= 2
                          ? 'font-semibold text-red-700'
                          : item.umur_hari === 1
                            ? 'font-medium text-amber-700'
                            : 'text-slate-500'
                      )}
                    >
                      {item.umur_hari} hari
                    </td>
                    <td
                      className={cn(
                        KELAS_TD,
                        'text-right tabular-nums text-slate-700'
                      )}
                    >
                      {item.total_item.toLocaleString('id-ID')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="no-print text-[11px] text-slate-500">
        Pilih satu atau beberapa pesanan terkonfirmasi. Picking list tidak
        mengubah status pesanan maupun stok; pengiriman tetap dilakukan per
        pesanan.
      </p>
    </div>
  );
}
