import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Eye, Clock } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { BadgeStatus } from '@/components/shared/badge-status';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatRupiah, formatTanggalWaktu } from '@/lib/format';
import type { StatusPersetujuan } from '@/features/pesanan/types';

interface PageProps {
  searchParams: Promise<{
    tab?: string;
  }>;
}

interface PersetujuanListItem {
  id: string;
  pesanan_jual_id: string;
  nomor_pesanan: string;
  status: StatusPersetujuan;
  diajukan_pada: string;
  catatan_pengaju: string | null;
  nama_pengaju: string | null;
  keputusan_pada: string | null;
  nama_pemutus: string | null;
  alasan_tolak: string | null;
  berlaku_sampai: string | null;
  total_pesanan: number;
  nama_pelanggan: string | null;
}

export default async function PersetujuanPage({ searchParams }: PageProps) {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const params = await searchParams;
  const activeTab = params.tab === 'semua' ? 'semua' : 'menunggu';

  const supabase = await createServerClient();

  // 1. Ambil jumlah pengajuan menunggu untuk badge tab
  const { count: countMenunggu } = await supabase
    .from('v_persetujuan_harga')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'menunggu');

  // 2. Query persetujuan dari view v_persetujuan_harga
  let query = supabase
    .from('v_persetujuan_harga')
    .select(`
      id, pesanan_jual_id, nomor_pesanan, status, diajukan_pada,
      catatan_pengaju, nama_pengaju, keputusan_pada, nama_pemutus,
      alasan_tolak, berlaku_sampai, total_pesanan, nama_pelanggan
    `)
    .order('diajukan_pada', { ascending: false });

  if (activeTab === 'menunggu') {
    query = query.eq('status', 'menunggu');
  }

  const { data: rawList } = await query;

  const items: PersetujuanListItem[] = (rawList || []).map((row) => ({
    id: row.id || '',
    pesanan_jual_id: row.pesanan_jual_id || '',
    nomor_pesanan: row.nomor_pesanan || '',
    status: (row.status || 'menunggu') as StatusPersetujuan,
    diajukan_pada: row.diajukan_pada || '',
    catatan_pengaju: row.catatan_pengaju,
    nama_pengaju: row.nama_pengaju,
    keputusan_pada: row.keputusan_pada,
    nama_pemutus: row.nama_pemutus,
    alasan_tolak: row.alasan_tolak,
    berlaku_sampai: row.berlaku_sampai,
    total_pesanan: Number(row.total_pesanan) || 0,
    nama_pelanggan: row.nama_pelanggan,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Antrean Persetujuan Harga"
        description="Kelola dan evaluasi pengajuan dispensasi harga penjualan di bawah HPP yang diajukan oleh Staf Penjualan."
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <Link
          href="/persetujuan?tab=menunggu"
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'menunggu'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Menunggu Keputusan
          {(countMenunggu ?? 0) > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {countMenunggu}
            </span>
          )}
        </Link>
        <Link
          href="/persetujuan?tab=semua"
          className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'semua'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Semua Riwayat
        </Link>
      </div>

      {/* Konten Tabel */}
      {items.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'menunggu'
              ? 'Tidak ada pengajuan persetujuan yang menunggu keputusan.'
              : 'Belum ada riwayat pengajuan persetujuan.'
          }
          description={
            activeTab === 'menunggu'
              ? 'Seluruh permohonan dispensasi harga dari staf penjualan telah diproses atau belum ada pengajuan baru.'
              : 'Pengajuan harga khusus di bawah HPP akan tercatat di sini setelah Staf Penjualan mengirimkannya.'
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Nomor SO</th>
                  <th className="py-2.5 px-3">Pelanggan</th>
                  <th className="py-2.5 px-3">Diajukan Oleh</th>
                  <th className="py-2.5 px-3">Waktu Pengajuan</th>
                  <th className="py-2.5 px-3 text-right">Total Pesanan</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                      <Link
                        href={`/pesanan/${row.pesanan_jual_id}`}
                        className="hover:underline text-slate-900 hover:text-blue-600"
                      >
                        {row.nomor_pesanan}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">
                      <div>
                        <span className="font-medium">
                          {row.nama_pelanggan || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <div>
                        <span>{row.nama_pengaju || 'Staf Penjualan'}</span>
                        {row.catatan_pengaju && (
                          <span className="text-[11px] text-slate-400 block italic truncate max-w-xs" title={row.catatan_pengaju}>
                            &ldquo;{row.catatan_pengaju}&rdquo;
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {formatTanggalWaktu(row.diajukan_pada)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatRupiah(row.total_pesanan)}
                    </td>
                    <td className="py-2.5 px-3">
                      <BadgeStatus status={row.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-slate-300"
                      >
                        <Link href={`/pesanan/${row.pesanan_jual_id}`}>
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Tinjau
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
