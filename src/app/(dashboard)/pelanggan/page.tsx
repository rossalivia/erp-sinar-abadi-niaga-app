import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Search, AlertCircle } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { Pagination } from '@/components/shared/pagination';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database';

type PelangganRow = Database['public']['Views']['v_pelanggan_piutang']['Row'];

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 15;

export default async function PelangganPage({ searchParams }: PageProps) {
  const profile = await getProfil();
  if (!profile || !['penjualan', 'manajer'].includes(profile.peran)) {
    redirect('/tidak-berwenang');
  }

  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.trim() || '';
  const statusFilter = resolvedParams.status || 'semua';
  const currentPage = Math.max(1, Number(resolvedParams.page) || 1);

  const supabase = await createServerClient();
  let query = supabase
    .from('v_pelanggan_piutang')
    .select('*', { count: 'exact' });

  if (q) {
    query = query.or(`nama_toko.ilike.%${q}%,kode.ilike.%${q}%`);
  }

  if (statusFilter === 'aktif') {
    query = query.eq('aktif', true);
  } else if (statusFilter === 'nonaktif') {
    query = query.eq('aktif', false);
  }

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await query
    .order('kode', { ascending: true })
    .range(from, to);

  const pelangganList = data || [];
  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const columns: Column<PelangganRow>[] = [
    {
      header: 'Kode',
      accessorKey: 'kode',
      className: 'w-24 font-mono font-medium text-slate-700',
    },
    {
      header: 'Nama Toko',
      accessorKey: 'nama_toko',
      className: 'font-medium text-slate-900',
    },
    {
      header: 'Telepon',
      accessorKey: 'telepon',
      cell: (row) => row.telepon || '-',
      className: 'w-32 text-slate-500',
    },
    {
      header: 'Batas Kredit',
      accessorKey: 'batas_kredit',
      cell: (row) => formatRupiah(row.batas_kredit),
      align: 'right',
      isNumeric: true,
      className: 'w-32',
    },
    {
      header: 'Piutang Berjalan',
      accessorKey: 'piutang_berjalan',
      cell: (row) => formatRupiah(row.piutang_berjalan),
      align: 'right',
      isNumeric: true,
      className: 'w-32',
    },
    {
      header: 'Termin',
      accessorKey: 'termin_hari',
      cell: (row) => `${row.termin_hari ?? 0} hr`,
      align: 'center',
      className: 'w-20',
    },
    {
      header: 'Tagihan Lewat',
      cell: (row) =>
        row.ada_lewat_jatuh_tempo || row.punya_pesanan_lewat_tempo ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
            <AlertCircle className="h-3 w-3 shrink-0" />
            Lewat Tempo
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        ),
      align: 'center',
      className: 'w-28',
    },
    {
      header: 'Status',
      accessorKey: 'aktif',
      cell: (row) => (
        <BadgeStatus status={row.aktif ? 'aktif' : 'nonaktif'} />
      ),
      align: 'center',
      className: 'w-20',
    },
    {
      header: 'Aksi',
      cell: (row) => (
        <Link
          href={`/pelanggan/${row.id}`}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'h-6 px-2 text-[11px]'
          )}
        >
          Detail
        </Link>
      ),
      align: 'right',
      className: 'w-20',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Pelanggan"
        description="Kelola data toko rekanan, batas kredit, dan ketentuan termin pembayaran"
        action={
          <Link
            href="/pelanggan/baru"
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'flex items-center gap-1.5'
            )}
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Pelanggan</span>
          </Link>
        }
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-md border border-slate-200">
        <form method="GET" className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari kode atau nama toko..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          {statusFilter !== 'semua' && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
          <button
            type="submit"
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'sm' }),
              'h-8 text-xs'
            )}
          >
            Cari
          </button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <div className="flex items-center gap-1">
            <Link
              href={`/pelanggan?status=semua${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                buttonVariants({
                  variant: statusFilter === 'semua' ? 'default' : 'outline',
                  size: 'sm',
                }),
                'h-7 px-2.5 text-xs'
              )}
            >
              Semua
            </Link>
            <Link
              href={`/pelanggan?status=aktif${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                buttonVariants({
                  variant: statusFilter === 'aktif' ? 'default' : 'outline',
                  size: 'sm',
                }),
                'h-7 px-2.5 text-xs'
              )}
            >
              Aktif
            </Link>
            <Link
              href={`/pelanggan?status=nonaktif${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                buttonVariants({
                  variant: statusFilter === 'nonaktif' ? 'default' : 'outline',
                  size: 'sm',
                }),
                'h-7 px-2.5 text-xs'
              )}
            >
              Nonaktif
            </Link>
          </div>
        </div>
      </div>

      {/* Tabel Data Pelanggan */}
      <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
        <DataTable
          columns={columns}
          data={pelangganList}
          keyExtractor={(item) => item.id || item.kode || Math.random()}
          emptyTitle="Belum ada data pelanggan"
          emptyDescription={
            q
              ? `Tidak ditemukan pelanggan dengan kata kunci "${q}".`
              : 'Silakan klik tombol "Tambah Pelanggan" untuk mendaftarkan toko baru.'
          }
          zebra
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          basePath="/pelanggan"
          searchParams={{ q, status: statusFilter !== 'semua' ? statusFilter : undefined }}
        />
      </div>
    </div>
  );
}
