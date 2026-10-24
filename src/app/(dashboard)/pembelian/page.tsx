import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Search, Filter, RotateCcw } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { BadgeStatus } from '@/components/shared/badge-status';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatRupiah, formatTanggal } from '@/lib/format';
import type { PembelianListItem, StatusPembelian } from '@/features/pembelian/types';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    pemasok_id?: string;
    dari?: string;
    sampai?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 15;

export default async function DaftarPembelianPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const profil = await getProfil();
  const peran = profil?.peran || 'gudang';

  // Staf Penjualan dilarang mengakses modul Pembelian
  if (peran === 'penjualan') {
    redirect('/tidak-berwenang');
  }

  const isManajer = peran === 'manajer';
  const q = (params.q || '').trim();
  const statusFilter = (params.status || '') as StatusPembelian | '';
  const pemasokFilter = params.pemasok_id || '';
  const dariFilter = params.dari || '';
  const sampaiFilter = params.sampai || '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const supabase = await createServerClient();

  // Ambil opsi pemasok untuk filter
  const { data: pemasokOptions } = await supabase
    .from('pemasok')
    .select('id, nama, kode')
    .order('nama', { ascending: true });

  let rawList: Record<string, unknown>[] = [];
  let count: number | null = 0;

  if (isManajer) {
    let query = supabase
      .from('v_pembelian_manajer')
      .select('id, nomor, status, jumlah_dipesan, jumlah_diterima, diajukan_pada, harga_beli_satuan, total_estimasi_beli, pemasok:pemasok_id (id, nama, kode), barang:barang_id (id, nama, kode, satuan)', { count: 'exact' });

    if (q) query = query.ilike('nomor', `%${q}%`);
    if (statusFilter) query = query.eq('status', statusFilter);
    if (pemasokFilter) query = query.eq('pemasok_id', pemasokFilter);
    if (dariFilter) query = query.gte('diajukan_pada', `${dariFilter}T00:00:00+07:00`);
    if (sampaiFilter) query = query.lte('diajukan_pada', `${sampaiFilter}T23:59:59+07:00`);

    const res = await query.order('diajukan_pada', { ascending: false }).range(from, to);
    rawList = (res.data || []) as Record<string, unknown>[];
    count = res.count;
  } else {
    let query = supabase
      .from('v_pembelian')
      .select('id, nomor, status, jumlah_dipesan, jumlah_diterima, diajukan_pada, pemasok:pemasok_id (id, nama, kode), barang:barang_id (id, nama, kode, satuan)', { count: 'exact' });

    if (q) query = query.ilike('nomor', `%${q}%`);
    if (statusFilter) query = query.eq('status', statusFilter);
    if (pemasokFilter) query = query.eq('pemasok_id', pemasokFilter);
    if (dariFilter) query = query.gte('diajukan_pada', `${dariFilter}T00:00:00+07:00`);
    if (sampaiFilter) query = query.lte('diajukan_pada', `${sampaiFilter}T23:59:59+07:00`);

    const res = await query.order('diajukan_pada', { ascending: false }).range(from, to);
    rawList = (res.data || []) as Record<string, unknown>[];
    count = res.count;
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const poList: PembelianListItem[] = rawList.map((row: Record<string, unknown>) => {
    const pemasok = (Array.isArray(row.pemasok) ? row.pemasok[0] : row.pemasok) as unknown as {
      id: string;
      kode: string;
      nama: string;
    } | null;

    const barang = (Array.isArray(row.barang) ? row.barang[0] : row.barang) as unknown as {
      id: string;
      kode: string;
      nama: string;
      satuan: string;
    } | null;

    return {
      id: String(row.id || ''),
      nomor: String(row.nomor || ''),
      status: row.status as StatusPembelian,
      jumlah_dipesan: Number(row.jumlah_dipesan) || 0,
      jumlah_diterima: Number(row.jumlah_diterima) || 0,
      diajukan_pada: String(row.diajukan_pada || ''),
      pemasok,
      barang,
      harga_beli_satuan: isManajer && row.harga_beli_satuan !== undefined && row.harga_beli_satuan !== null ? Number(row.harga_beli_satuan) : null,
      total_estimasi_beli: isManajer && row.total_estimasi_beli !== undefined && row.total_estimasi_beli !== null ? Number(row.total_estimasi_beli) : null,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pembelian (PO)"
        description="Kelola proses pengadaan barang mulai dari pengajuan, persetujuan Manajer, hingga penerimaan fisik di gudang."
        action={
          <Button asChild size="sm" className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800 shadow-none text-xs h-9">
            <Link href="/pembelian/baru">
              <Plus className="w-4 h-4" />
              Ajukan Pembelian
            </Link>
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-4 shadow-neu-sm space-y-3">
        <form method="get" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari nomor PO..."
              className="text-xs pl-8 h-9 rounded-md border-slate-300"
            />
          </div>

          <div>
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">Semua Status</option>
              <option value="diajukan">Diajukan</option>
              <option value="disetujui">Disetujui</option>
              <option value="ditolak">Ditolak</option>
              <option value="diterima">Diterima</option>
              <option value="dibatalkan">Dibatalkan</option>
            </select>
          </div>

          <div>
            <select
              name="pemasok_id"
              defaultValue={pemasokFilter}
              className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 truncate"
            >
              <option value="">Semua Pemasok</option>
              {pemasokOptions?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Input
              type="date"
              name="dari"
              defaultValue={dariFilter}
              className="text-xs h-9 rounded-md border-slate-300 px-2"
              title="Dari tanggal"
            />
          </div>

          <div>
            <Input
              type="date"
              name="sampai"
              defaultValue={sampaiFilter}
              className="text-xs h-9 rounded-md border-slate-300 px-2"
              title="Sampai tanggal"
            />
          </div>

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
              <Link href="/pembelian">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Link>
            </Button>
          </div>
        </form>
      </div>

      {/* Tabel PO */}
      <div className="bg-white rounded-2xl border border-white/80 shadow-neu-sm overflow-hidden">
        {poList.length === 0 ? (
          <EmptyState
            title="Tidak ada pesanan pembelian ditemukan"
            description={
              q || statusFilter || pemasokFilter
                ? 'Coba sesuaikan kata kunci pencarian atau filter status yang dipilih.'
                : 'Belum ada pengajuan PO. Klik tombol Ajukan Pembelian untuk memulai.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-36">Nomor PO</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Pemasok</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Barang</th>
                  <th className="py-2.5 px-3 w-28 text-right">Dipesan</th>
                  <th className="py-2.5 px-3 w-28 text-right">Diterima</th>
                  <th className="py-2.5 px-3 w-28 text-center">Status</th>
                  <th className="py-2.5 px-3 w-28">Tanggal</th>
                  {isManajer && (
                    <>
                      <th className="py-2.5 px-3 w-28 text-right bg-slate-200/50">Harga Beli</th>
                      <th className="py-2.5 px-3 w-32 text-right bg-slate-200/50">Total Beli</th>
                    </>
                  )}
                  <th className="py-2.5 px-3 w-20 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {poList.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={idx % 2 === 1 ? 'bg-slate-50/50 hover:bg-slate-50' : 'hover:bg-slate-50/50'}
                  >
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                      <Link
                        href={`/pembelian/${item.id}`}
                        className="hover:underline text-blue-900 hover:text-blue-800"
                      >
                        {item.nomor}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">
                      <div className="font-medium text-slate-900">{item.pemasok?.nama || '-'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.pemasok?.kode || ''}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">
                      <div className="font-medium text-slate-900">{item.barang?.nama || '-'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.barang?.kode} ({item.barang?.satuan})
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {item.jumlah_dipesan}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {item.status === 'diterima' ? (
                        <span className="text-emerald-700 font-semibold">{item.jumlah_diterima}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <BadgeStatus status={item.status} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {formatTanggal(item.diajukan_pada)}
                    </td>
                    {isManajer && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 bg-slate-50/30">
                          {item.harga_beli_satuan ? formatRupiah(item.harga_beli_satuan) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 bg-slate-50/30">
                          {item.total_estimasi_beli ? formatRupiah(item.total_estimasi_beli) : '-'}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2 border-slate-300"
                      >
                        <Link href={`/pembelian/${item.id}`}>
                          Detail
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={ITEMS_PER_PAGE}
              basePath="/pembelian"
              searchParams={{
                q,
                status: statusFilter,
                pemasok_id: pemasokFilter,
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
