import * as React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, ExternalLink, ShieldCheck, Clock } from 'lucide-react';
import { getProfil } from '@/lib/profil';
import { ambilRiwayatTagihanMayarService } from '@/features/pembayaran/service';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRupiah, formatTanggalWaktu } from '@/lib/format';
import type { TagihanMayarRow } from '@/features/pembayaran/types';

export const dynamic = 'force-dynamic';

export default async function PembayaranMayarPage() {
  const profile = await getProfil();
  if (!profile) {
    redirect('/login');
  }

  // 1. Otorisasi Lapisan Server Component: Khusus Manajer (M1)
  if (profile.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const tagihanList = await ambilRiwayatTagihanMayarService();
  const hasRealKey = Boolean(
    process.env.MAYAR_API_KEY &&
    process.env.MAYAR_API_KEY.trim() !== '' &&
    !process.env.MAYAR_API_KEY.includes('placeholder')
  );

  const columns: Column<TagihanMayarRow>[] = [
    {
      header: 'Waktu Terbit',
      accessorKey: 'dibuat_pada',
      cell: (row) => (
        <span className="font-mono text-[11px] text-slate-600">
          {formatTanggalWaktu(row.dibuat_pada)}
        </span>
      ),
      className: 'w-36',
    },
    {
      header: 'No. Pesanan',
      accessorKey: 'nomor_pesanan',
      cell: (row) => (
        <Link
          href={`/pesanan/${row.pesanan_jual_id}`}
          className="font-mono font-medium text-slate-900 hover:text-blue-600 hover:underline"
        >
          {row.nomor_pesanan}
        </Link>
      ),
      className: 'w-36',
    },
    {
      header: 'Pelanggan / Toko',
      accessorKey: 'nama_toko',
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.nama_toko || 'Pelanggan'}</p>
          <p className="font-mono text-[10px] text-slate-400">{row.email_penerima}</p>
        </div>
      ),
    },
    {
      header: 'Nominal',
      accessorKey: 'jumlah',
      cell: (row) => formatRupiah(row.jumlah),
      className: 'w-32 text-right tabular-nums font-medium',
    },
    {
      header: 'Berlaku Hingga',
      accessorKey: 'berlaku_sampai',
      cell: (row) => (
        <span className="text-[11px] text-slate-600">
          {formatTanggalWaktu(row.berlaku_sampai)}
        </span>
      ),
      className: 'w-36',
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <BadgeStatus status={row.status_efektif || row.status} />,
      className: 'w-36',
    },
    {
      header: 'Tautan / Bukti',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.tautan ? (
            <a
              href={row.tautan}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 font-medium text-[11px]"
              title="Buka Tautan Pembayaran"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Tautan
            </a>
          ) : (
            <span className="text-slate-400">-</span>
          )}
          {row.catatan_tinjau && (
            <span
              className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-[120px]"
              title={row.catatan_tinjau}
            >
              {row.catatan_tinjau}
            </span>
          )}
        </div>
      ),
      className: 'w-32',
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Monitoring Pembayaran Digital Mayar"
        description="Riwayat penerbitan tautan bayar online Mayar sandbox, status pelunasan otomatis, dan rekonsiliasi transaksi."
      />

      {/* Kartu Status Konfigurasi Gateway */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="p-2 rounded bg-slate-100 text-slate-700">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Gateway Provider</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-semibold text-slate-800">Mayar Sandbox</span>
                <Badge variant={hasRealKey ? 'success' : 'neutral'} className="text-[10px] px-1.5 py-0 h-4">
                  {hasRealKey ? 'API Aktif' : 'Simulasi Mock'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="p-2 rounded bg-slate-100 text-slate-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Verifikasi Webhook</p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">Two-Way Handshake</p>
              <p className="text-[11px] text-slate-400">Pemeriksaan ulang aktif ke server</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="p-2 rounded bg-slate-100 text-slate-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Masa Berlaku Default</p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">7 Hari (168 Jam)</p>
              <p className="text-[11px] text-slate-400">Dapat disesuaikan 1–30 hari</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Data Tagihan Mayar */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-0">
          <DataTable<TagihanMayarRow>
            data={tagihanList}
            columns={columns}
            keyExtractor={(item) => item.id}
            emptyTitle="Belum ada riwayat tagihan"
            emptyDescription="Tautan pembayaran online yang Anda buat pada pesanan berstatus dikirim akan dicatat di sini."
          />
        </CardContent>
      </Card>
    </div>
  );
}
