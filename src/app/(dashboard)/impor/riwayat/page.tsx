import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Upload } from 'lucide-react';
import { getProfil } from '@/lib/profil';
import { formatTanggalWaktu } from '@/lib/format';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { Pagination } from '@/components/shared/pagination';
import { ambilRiwayatImporAction } from '@/features/impor/actions';
import { ImporDataRow } from '@/features/impor/types';

interface PageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

const PAGE_SIZE = 15;

export default async function RiwayatImporPage({ searchParams }: PageProps) {
  const profile = await getProfil();
  if (!profile) {
    redirect('/login');
  }

  if (profile.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const resolvedParams = await searchParams;
  const currentPage = Math.max(1, Number(resolvedParams.page) || 1);

  const { rows, totalCount, error } = await ambilRiwayatImporAction(currentPage, PAGE_SIZE);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const columns: Column<ImporDataRow>[] = [
    {
      header: 'No. Dokumen',
      accessorKey: 'nomor',
      className: 'w-36 font-mono font-medium text-slate-900',
    },
    {
      header: 'Tanggal & Waktu',
      accessorKey: 'dibuat_pada',
      cell: (row) => formatTanggalWaktu(row.dibuat_pada),
      className: 'w-44 text-slate-600',
    },
    {
      header: 'Jenis Data',
      accessorKey: 'jenis',
      cell: (row) => (
        <span className="capitalize font-medium text-slate-800">
          {row.jenis === 'barang' ? 'Barang & Stok' : 'Pelanggan'}
        </span>
      ),
      className: 'w-32',
    },
    {
      header: 'Nama Berkas',
      accessorKey: 'nama_berkas',
      className: 'font-mono text-slate-700 text-xs',
    },
    {
      header: 'Jumlah Baris',
      accessorKey: 'jumlah_baris',
      cell: (row) => row.jumlah_baris,
      align: 'right',
      isNumeric: true,
      className: 'w-24 tabular-nums',
    },
    {
      header: 'Berhasil Dibuat',
      accessorKey: 'jumlah_dibuat',
      cell: (row) => (
        <span className="font-semibold text-emerald-800">{row.jumlah_dibuat}</span>
      ),
      align: 'right',
      isNumeric: true,
      className: 'w-28 tabular-nums',
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <BadgeStatus status={row.status} />,
      align: 'center',
      className: 'w-24',
    },
    {
      header: 'Pelaksana',
      accessorKey: 'pelaksana_nama',
      cell: (row) => row.pelaksana_nama || 'Manajer',
      className: 'w-36 text-slate-600',
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Riwayat Impor Data"
        description="Rekam jejak seluruh transaksi pengunggahan dan impor data massal CSV."
        action={
          <Link
            href="/impor"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span>Impor Data Baru</span>
          </Link>
        }
      />

      <div className="flex items-center gap-2">
        <Link
          href="/impor"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Halaman Impor</span>
        </Link>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium">
          {error}
        </div>
      ) : (
        <div className="space-y-3">
          <DataTable<ImporDataRow>
            data={rows}
            columns={columns}
            keyExtractor={(row) => row.id}
            emptyTitle="Belum ada riwayat"
            emptyDescription="Belum ada riwayat transaksi impor."
          />

          {totalPages > 1 && (
            <div className="flex justify-end pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={PAGE_SIZE}
                basePath="/impor/riwayat"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
