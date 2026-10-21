import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Layers,
  CheckCircle2,
  Filter,
  RotateCcw,
} from 'lucide-react';

import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KartuStokTable } from '@/features/stok/components/kartu-stok-table';
import { KartuStokActions } from '@/features/stok/components/kartu-stok-actions';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import type { JenisMutasiStok, MutasiStokItem } from '@/features/stok/types';

interface PageProps {
  params: Promise<{ barangId: string }>;
  searchParams: Promise<{
    jenis?: string;
    dari?: string;
    sampai?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

export default async function KartuStokPage({ params, searchParams }: PageProps) {
  const { barangId } = await params;
  const filterParams = await searchParams;
  const profil = await getProfil();
  const peran = profil?.peran || 'gudang';

  // Sesuai matriks akses default: Gudang dan Manajer mengelola kartu stok
  if (peran === 'penjualan') {
    redirect('/tidak-berwenang');
  }

  const jenisFilter = (filterParams.jenis || '') as JenisMutasiStok | '';
  const dariFilter = filterParams.dari || '';
  const sampaiFilter = filterParams.sampai || '';
  const currentPage = Math.max(1, parseInt(filterParams.page || '1', 10));

  const supabase = await createServerClient();

  // 1. Ambil info master barang dari v_barang
  const { data: barangRaw, error: barangError } = await supabase
    .from('v_barang')
    .select('id, kode, nama, satuan, stok, stok_minimum, stok_menipis')
    .eq('id', barangId)
    .single();

  if (barangError || !barangRaw) {
    notFound();
  }

  const barang = {
    id: barangRaw.id || '',
    kode: barangRaw.kode || '',
    nama: barangRaw.nama || '',
    satuan: barangRaw.satuan || '',
    stok: Number(barangRaw.stok) || 0,
    stok_minimum: Number(barangRaw.stok_minimum) || 0,
    stok_menipis: Boolean(barangRaw.stok_menipis),
  };

  // 2. Query riwayat kartu mutasi stok
  let query = supabase
    .from('mutasi_stok')
    .select(
      `
      id, barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada,
      pelaku:dibuat_oleh (nama_lengkap)
    `,
      { count: 'exact' }
    )
    .eq('barang_id', barangId);

  if (jenisFilter) {
    query = query.eq('jenis', jenisFilter);
  }
  if (dariFilter) {
    query = query.gte('dibuat_pada', `${dariFilter}T00:00:00+07:00`);
  }
  if (sampaiFilter) {
    query = query.lte('dibuat_pada', `${sampaiFilter}T23:59:59+07:00`);
  }

  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data: rawMutasi, count } = await query
    .order('id', { ascending: false })
    .range(from, to);

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const mutasiList: MutasiStokItem[] = (rawMutasi || []).map((row) => {
    const pelaku = (Array.isArray(row.pelaku) ? row.pelaku[0] : row.pelaku) as unknown as {
      nama_lengkap: string;
    } | null;

    return {
      id: Number(row.id),
      barang_id: row.barang_id,
      jenis: row.jenis as JenisMutasiStok,
      jumlah: Number(row.jumlah),
      stok_sesudah: Number(row.stok_sesudah),
      nomor_dokumen: row.nomor_dokumen,
      alasan: row.alasan,
      dibuat_oleh: row.dibuat_oleh,
      dibuat_pada: row.dibuat_pada,
      pelaku,
    };
  });

  // Baris mutasi terbaru untuk rekonsiliasi
  const mutasiTerakhir = mutasiList[0];
  const isKonsisten =
    mutasiTerakhir === undefined || mutasiTerakhir.stok_sesudah === barang.stok;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-slate-300"
            title="Kembali ke Daftar Stok"
          >
            <Link href="/stok">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Kartu Stok: {barang.nama}
              </h1>
              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                {barang.kode}
              </span>
              {barang.stok_menipis && (
                <span className="text-amber-800 bg-amber-100 font-medium px-2 py-0.5 rounded text-[11px]">
                  Stok Menipis
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Buku besar pencatatan seluruh pergerakan mutasi fisik barang (append-only ledger).
            </p>
          </div>
        </div>

        <KartuStokActions
          barangId={barang.id}
          kode={barang.kode}
          nama={barang.nama}
          satuan={barang.satuan}
          stokSaatIni={barang.stok}
          stokMenipis={barang.stok_menipis}
          peran={peran}
        />
      </div>

      {/* Kartu Ringkasan Stok & Integritas Buku Besar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-md p-4 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
            <Package className="w-3.5 h-3.5" />
            Stok Fisik Master
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums pt-1">
            {barang.stok} <span className="text-sm font-normal text-slate-500">{barang.satuan}</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Ambang batas minimum: {barang.stok_minimum} {barang.satuan}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-4 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
            <Layers className="w-3.5 h-3.5" />
            Total Entri Mutasi
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums pt-1">
            {totalCount} <span className="text-sm font-normal text-slate-500">transaksi</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Tercatat sejak saldo awal sistem
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-4 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Integritas Rekonsiliasi
          </div>
          <div className="text-sm font-bold pt-1">
            {isKonsisten ? (
              <span className="text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Saldo Stok Konsisten (100%)
              </span>
            ) : (
              <span className="text-red-600">
                Terdapat Selisih dengan Baris Terakhir
              </span>
            )}
          </div>
          <p className="text-slate-400 text-[11px]">
            Stok sesudah transaksi mutasi terakhir = {mutasiTerakhir ? mutasiTerakhir.stok_sesudah : barang.stok}
          </p>
        </div>
      </div>

      {/* Filter Mutasi */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-3">
        <form method="get" className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div>
            <select
              name="jenis"
              defaultValue={jenisFilter}
              className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">Semua Jenis Mutasi</option>
              <option value="masuk">Masuk (Penerimaan PO)</option>
              <option value="keluar">Keluar (Pesanan Jual)</option>
              <option value="batal">Batal (Pengembalian Pesanan)</option>
              <option value="penyesuaian">Penyesuaian (Opname)</option>
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

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              className="text-xs h-9 gap-1 bg-slate-900 text-white hover:bg-slate-800 flex-1"
            >
              <Filter className="w-3.5 h-3.5" />
              Terapkan
            </Button>
            <Button asChild type="button" variant="outline" size="sm" className="text-xs h-9 gap-1">
              <Link href={`/stok/${barangId}`}>
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Link>
            </Button>
          </div>
        </form>
      </div>

      {/* Tabel Kartu Mutasi Stok */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        {mutasiList.length === 0 ? (
          <EmptyState
            title="Belum ada riwayat mutasi stok"
            description="Belum ada catatan mutasi fisik untuk filter yang dipilih."
          />
        ) : (
          <KartuStokTable items={mutasiList} satuan={barang.satuan} />
        )}

        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={ITEMS_PER_PAGE}
              basePath={`/stok/${barangId}`}
              searchParams={{
                jenis: jenisFilter,
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
