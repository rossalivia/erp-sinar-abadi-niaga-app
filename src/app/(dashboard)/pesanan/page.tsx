import * as React from 'react';
import Link from 'next/link';
import { Plus, Search, Truck, Filter, RotateCcw, ClipboardList } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { BadgeStatus } from '@/components/shared/badge-status';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatRupiah, formatTanggal } from '@/lib/format';
import type { StatusPesanan } from '@/features/pesanan/types';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    pelanggan_id?: string;
    dari?: string;
    sampai?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 15;

export default async function DaftarPesananPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const profil = await getProfil();
  const peran = profil?.peran || 'penjualan';

  const q = (params.q || '').trim();
  const statusFilter = (params.status || '') as StatusPesanan | '';
  const pelangganFilter = params.pelanggan_id || '';
  const dariFilter = params.dari || '';
  const sampaiFilter = params.sampai || '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  const supabase = await createServerClient();

  // Ambil daftar pelanggan untuk opsi filter
  const { data: pelangganOptions } = await supabase
    .from('pelanggan')
    .select('id, nama_toko, kode')
    .order('nama_toko', { ascending: true });

  // Query pesanan dengan relasi pelanggan
  let query = supabase
    .from('pesanan_jual')
    .select(
      'id, nomor, status, total, dibuat_pada, jatuh_tempo, dibuat_oleh, pelanggan:pelanggan_id (id, nama_toko, kode)',
      { count: 'exact' }
    );

  if (q) {
    query = query.ilike('nomor', `%${q}%`);
  }

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  if (pelangganFilter) {
    query = query.eq('pelanggan_id', pelangganFilter);
  }

  if (dariFilter) {
    query = query.gte('dibuat_pada', `${dariFilter}T00:00:00+07:00`);
  }

  if (sampaiFilter) {
    query = query.lte('dibuat_pada', `${sampaiFilter}T23:59:59+07:00`);
  }

  // Paginasi
  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data: pesananList, count } = await query
    .order('dibuat_pada', { ascending: false })
    .range(from, to);

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const canCreate = peran === 'penjualan' || peran === 'manajer';
  const dapatPicking = peran === 'gudang' || peran === 'manajer';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pesanan Jual"
        description="Kelola seluruh pesanan pelanggan mulai dari draf, konfirmasi, pengiriman, hingga pelunasan."
        action={
          canCreate ? (
            <Button asChild size="sm" className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800 shadow-none text-xs h-9">
              <Link href="/pesanan/baru">
                <Plus className="w-4 h-4" />
                Buat Pesanan Baru
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Baris Pintasan Gudang */}
      {dapatPicking && (
        <div className="flex flex-col gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-700 shrink-0" />
            <span className="font-medium">Pintasan Gudang:</span>
            <span>Lihat daftar pesanan yang sudah dikonfirmasi dan siap untuk dikirim.</span>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              asChild
              size="sm"
              variant={statusFilter === 'dikonfirmasi' ? 'default' : 'outline'}
              className="text-xs h-7 gap-1"
            >
              <Link href="/pesanan?status=dikonfirmasi">
                Siap Kirim
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
            >
              <Link href="/gudang/picking">
                <ClipboardList className="w-3 h-3" />
                Daftar Ambil Barang
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Filter & Pencarian Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-3">
        <form method="get" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Cari nomor */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari nomor pesanan..."
              className="text-xs pl-8 h-9 rounded-md border-slate-300"
            />
          </div>

          {/* Filter Status */}
          <div>
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">Semua Status</option>
              {peran !== 'gudang' && <option value="draf">Draf</option>}
              <option value="dikonfirmasi">Dikonfirmasi</option>
              <option value="dikirim">Dikirim</option>
              <option value="lunas">Lunas</option>
              <option value="dibatalkan">Dibatalkan</option>
            </select>
          </div>

          {/* Filter Pelanggan */}
          <div>
            <select
              name="pelanggan_id"
              defaultValue={pelangganFilter}
              className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 truncate"
            >
              <option value="">Semua Pelanggan</option>
              {pelangganOptions?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_toko}
                </option>
              ))}
            </select>
          </div>

          {/* Rentang Tanggal */}
          <div className="flex items-center gap-1">
            <Input
              type="date"
              name="dari"
              defaultValue={dariFilter}
              className="text-xs h-9 rounded-md border-slate-300 px-2"
              title="Dari tanggal"
            />
          </div>

          <div className="flex items-center gap-1">
            <Input
              type="date"
              name="sampai"
              defaultValue={sampaiFilter}
              className="text-xs h-9 rounded-md border-slate-300 px-2"
              title="Sampai tanggal"
            />
          </div>

          {/* Tombol Terapkan & Reset */}
          <div className="lg:col-span-6 flex items-center justify-end gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              className="text-xs h-8 gap-1 bg-slate-900 text-white hover:bg-slate-800"
            >
              <Filter className="w-3.5 h-3.5" />
              Terapkan Filter
            </Button>
            <Button asChild type="button" variant="outline" size="sm" className="text-xs h-8 gap-1">
              <Link href="/pesanan">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Link>
            </Button>
          </div>
        </form>
      </div>

      {/* Tabel Data Pesanan */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        {(!pesananList || pesananList.length === 0) ? (
          <EmptyState
            title="Tidak ada pesanan jual ditemukan"
            description={
              q || statusFilter || pelangganFilter
                ? 'Coba sesuaikan kata kunci pencarian atau filter status yang dipilih.'
                : 'Belum ada data pesanan jual. Klik tombol Buat Pesanan Baru untuk memulai.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-36">Nomor</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Pelanggan</th>
                  <th className="py-2.5 px-3 w-28">Tanggal</th>
                  <th className="py-2.5 px-3 w-28 text-center">Status</th>
                  <th className="py-2.5 px-3 w-32 text-right">Total Nilai</th>
                  <th className="py-2.5 px-3 w-28">Jatuh Tempo</th>
                  <th className="py-2.5 px-3 w-24 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {pesananList.map((item, idx) => {
                  const pel = Array.isArray(item.pelanggan)
                    ? item.pelanggan[0]
                    : item.pelanggan;

                  return (
                    <tr
                      key={item.id}
                      className={idx % 2 === 1 ? 'bg-slate-50/50 hover:bg-slate-50' : 'hover:bg-slate-50/50'}
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                        <Link
                          href={`/pesanan/${item.id}`}
                          className="hover:underline text-blue-900 hover:text-blue-800"
                        >
                          {item.nomor}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        <div className="font-medium text-slate-900">{pel?.nama_toko || '-'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{pel?.kode || ''}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {formatTanggal(item.dibuat_pada)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <BadgeStatus status={item.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatRupiah(item.total)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {item.jatuh_tempo ? formatTanggal(item.jatuh_tempo) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2 border-slate-300"
                        >
                          <Link href={`/pesanan/${item.id}`}>
                            Detail
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginasi */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={ITEMS_PER_PAGE}
              basePath="/pesanan"
              searchParams={{
                q,
                status: statusFilter,
                pelanggan_id: pelangganFilter,
                dari: dariFilter,
                sampai: sampaiFilter,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
