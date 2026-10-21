import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Search, AlertTriangle, AlertCircle } from 'lucide-react';
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

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    stok?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 15;

export default async function BarangPage({ searchParams }: PageProps) {
  const profile = await getProfil();
  if (!profile) {
    redirect('/login');
  }

  const isManajer = profile.peran === 'manajer';
  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.trim() || '';
  const statusFilter = resolvedParams.status || 'semua';
  const stokFilter = resolvedParams.stok || 'semua';
  const currentPage = Math.max(1, Number(resolvedParams.page) || 1);

  const supabase = await createServerClient();
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Non-Manajer TIDAK BOLEH memanggil v_barang_manajer
  let barangList: any[] = [];
  let totalCount = 0;

  if (isManajer) {
    let query = supabase
      .from('v_barang_manajer')
      .select('*', { count: 'exact' });

    if (q) {
      query = query.or(`nama.ilike.%${q}%,kode.ilike.%${q}%`);
    }
    if (statusFilter === 'aktif') {
      query = query.eq('aktif', true);
    } else if (statusFilter === 'nonaktif') {
      query = query.eq('aktif', false);
    }
    if (stokFilter === 'menipis') {
      query = query.eq('stok_menipis', true);
    }

    const { data, count } = await query
      .order('kode', { ascending: true })
      .range(from, to);

    barangList = data || [];
    totalCount = count || 0;
  } else {
    // Jalur non-Manajer: hanya membaca v_barang, tanpa kolom rahasia sama sekali
    let query = supabase
      .from('v_barang')
      .select('id, kode, nama, satuan, harga_jual, stok, stok_minimum, aktif, diperbarui_pada, stok_menipis', {
        count: 'exact',
      });

    if (q) {
      query = query.or(`nama.ilike.%${q}%,kode.ilike.%${q}%`);
    }
    if (statusFilter === 'aktif') {
      query = query.eq('aktif', true);
    } else if (statusFilter === 'nonaktif') {
      query = query.eq('aktif', false);
    }
    if (stokFilter === 'menipis') {
      query = query.eq('stok_menipis', true);
    }

    const { data, count } = await query
      .order('kode', { ascending: true })
      .range(from, to);

    barangList = data || [];
    totalCount = count || 0;
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const baseColumns: Column<any>[] = [
    {
      header: 'Kode',
      accessorKey: 'kode',
      className: 'w-24 font-mono font-medium text-slate-700',
    },
    {
      header: 'Nama Barang',
      accessorKey: 'nama',
      className: 'font-medium text-slate-900',
    },
    {
      header: 'Satuan',
      accessorKey: 'satuan',
      cell: (row) => row.satuan,
      className: 'w-20 text-slate-500',
    },
    {
      header: 'Harga Jual',
      accessorKey: 'harga_jual',
      cell: (row) => formatRupiah(row.harga_jual),
      align: 'right',
      isNumeric: true,
      className: 'w-28',
    },
  ];

  // Tambahkan kolom keuangan khusus Manajer
  if (isManajer) {
    baseColumns.push(
      {
        header: 'Harga Pokok',
        accessorKey: 'harga_pokok',
        cell: (row) => {
          if (row.harga_pokok === null || row.harga_pokok === undefined) {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-medium">
                <AlertCircle className="h-3 w-3" />
                Belum diisi
              </span>
            );
          }
          return formatRupiah(row.harga_pokok);
        },
        align: 'right',
        isNumeric: true,
        className: 'w-28',
      },
      {
        header: 'Margin %',
        cell: (row) => {
          if (row.harga_pokok === null || row.harga_pokok === undefined || !row.harga_jual) {
            return <span className="text-slate-400">-</span>;
          }
          const margin = ((row.harga_jual - row.harga_pokok) / row.harga_jual) * 100;
          return (
            <span
              className={cn(
                'tabular-nums font-medium',
                margin >= 15 ? 'text-emerald-700' : margin >= 0 ? 'text-amber-700' : 'text-red-600'
              )}
            >
              {margin.toFixed(1)}%
            </span>
          );
        },
        align: 'right',
        isNumeric: true,
        className: 'w-20',
      }
    );
  }

  // Kolom stok, status, dan aksi
  baseColumns.push(
    {
      header: 'Stok Fisik',
      accessorKey: 'stok',
      cell: (row) => (
        <span
          className={cn(
            'tabular-nums font-semibold',
            row.stok_menipis || (row.stok <= row.stok_minimum) ? 'text-amber-700' : 'text-slate-900'
          )}
        >
          {row.stok ?? 0}
        </span>
      ),
      align: 'right',
      isNumeric: true,
      className: 'w-20',
    },
    {
      header: 'Stok Min',
      accessorKey: 'stok_minimum',
      cell: (row) => row.stok_minimum ?? 0,
      align: 'right',
      isNumeric: true,
      className: 'w-20 text-slate-500',
    },
    {
      header: 'Peringatan',
      cell: (row) =>
        row.stok_menipis || (row.stok <= row.stok_minimum) ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Stok Menipis
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
          href={`/barang/${row.id}`}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'h-6 px-2 text-[11px]'
          )}
        >
          Detail
        </Link>
      ),
      align: 'right',
      className: 'w-16',
    }
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Barang & Stok"
        description="Katalog barang dagang, harga jual, dan status ketersediaan stok fisik"
        action={
          isManajer ? (
            <Link
              href="/barang/baru"
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'flex items-center gap-1.5'
              )}
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Barang</span>
            </Link>
          ) : undefined
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
              placeholder="Cari kode atau nama barang..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          {statusFilter !== 'semua' && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
          {stokFilter !== 'semua' && (
            <input type="hidden" name="stok" value={stokFilter} />
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Status Aktif */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 mr-1">Status:</span>
            <Link
              href={`/barang?status=semua${stokFilter !== 'semua' ? `&stok=${stokFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                buttonVariants({
                  variant: statusFilter === 'semua' ? 'default' : 'outline',
                  size: 'sm',
                }),
                'h-7 px-2 text-xs'
              )}
            >
              Semua
            </Link>
            <Link
              href={`/barang?status=aktif${stokFilter !== 'semua' ? `&stok=${stokFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                buttonVariants({
                  variant: statusFilter === 'aktif' ? 'default' : 'outline',
                  size: 'sm',
                }),
                'h-7 px-2 text-xs'
              )}
            >
              Aktif
            </Link>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Filter Stok Menipis */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 mr-1">Stok:</span>
            <Link
              href={`/barang?stok=semua${statusFilter !== 'semua' ? `&status=${statusFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                buttonVariants({
                  variant: stokFilter === 'semua' ? 'default' : 'outline',
                  size: 'sm',
                }),
                'h-7 px-2 text-xs'
              )}
            >
              Semua
            </Link>
            <Link
              href={`/barang?stok=menipis${statusFilter !== 'semua' ? `&status=${statusFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={cn(
                buttonVariants({
                  variant: stokFilter === 'menipis' ? 'default' : 'outline',
                  size: 'sm',
                }),
                'h-7 px-2 text-xs text-amber-700'
              )}
            >
              Menipis
            </Link>
          </div>
        </div>
      </div>

      {/* Tabel Data Barang */}
      <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
        <DataTable
          columns={baseColumns}
          data={barangList}
          keyExtractor={(item) => item.id || item.kode || Math.random()}
          emptyTitle="Belum ada data barang"
          emptyDescription={
            q
              ? `Tidak ditemukan barang dengan kata kunci "${q}".`
              : 'Belum ada barang dalam katalog persediaan.'
          }
          zebra
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          basePath="/barang"
          searchParams={{
            q,
            status: statusFilter !== 'semua' ? statusFilter : undefined,
            stok: stokFilter !== 'semua' ? stokFilter : undefined,
          }}
        />
      </div>
    </div>
  );
}
