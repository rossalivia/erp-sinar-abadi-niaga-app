import * as React from 'react';
import Link from 'next/link';
import { Search, Filter, RotateCcw, AlertTriangle } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StokListTable } from '@/features/stok/components/stok-list-table';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import type { BarangStokItem } from '@/features/stok/types';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    menipis?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

export default async function DaftarStokPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const profil = await getProfil();
  const peran = profil?.peran || 'penjualan';

  const q = (params.q || '').trim();
  const menipisFilter = params.menipis === '1';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  const supabase = await createServerClient();

  // Query view publik v_barang (bebas kolom rahasia harga pokok)
  let query = supabase
    .from('v_barang')
    .select('id, kode, nama, satuan, stok, stok_minimum, stok_menipis, diperbarui_pada', {
      count: 'exact',
    });

  if (q) {
    query = query.or(`kode.ilike.%${q}%,nama.ilike.%${q}%`);
  }

  if (menipisFilter) {
    query = query.eq('stok_menipis', true);
  }

  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data: rawList, count } = await query
    .order('nama', { ascending: true })
    .range(from, to);

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const items: BarangStokItem[] = (rawList || []).map((b) => ({
    id: b.id || '',
    kode: b.kode || '',
    nama: b.nama || '',
    satuan: b.satuan || '',
    stok: Number(b.stok) || 0,
    stok_minimum: Number(b.stok_minimum) || 0,
    stok_menipis: Boolean(b.stok_menipis),
    diperbarui_pada: b.diperbarui_pada || '',
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventori & Stok Fisik"
        description="Pantau kuantitas fisik barang gudang, peringatan stok menipis, riwayat kartu mutasi, dan penyesuaian opname."
      />

      {/* Filter & Pencarian Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-3">
        <form method="get" className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari kode atau nama barang..."
              className="text-xs pl-8 h-9 rounded-md border-slate-300 w-full"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              asChild
              type="button"
              variant={menipisFilter ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-9 gap-1.5 whitespace-nowrap"
            >
              <Link href={menipisFilter ? '/stok' : '/stok?menipis=1'}>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                {menipisFilter ? 'Tampilkan Semua Stok' : 'Hanya Stok Menipis'}
              </Link>
            </Button>

            <Button
              type="submit"
              size="sm"
              className="text-xs h-9 gap-1 bg-slate-900 text-white hover:bg-slate-800"
            >
              <Filter className="w-3.5 h-3.5" />
              Cari
            </Button>

            <Button asChild type="button" variant="outline" size="sm" className="text-xs h-9 gap-1">
              <Link href="/stok">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Link>
            </Button>
          </div>
        </form>
      </div>

      {/* Tabel Inventori Barang */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title="Tidak ada data barang ditemukan"
            description={
              q || menipisFilter
                ? 'Coba sesuaikan kata kunci pencarian atau matikan filter stok menipis.'
                : 'Belum ada data barang dalam master inventori.'
            }
          />
        ) : (
          <StokListTable items={items} peran={peran} />
        )}

        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={ITEMS_PER_PAGE}
              basePath="/stok"
              searchParams={{
                q,
                menipis: menipisFilter ? '1' : undefined,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
