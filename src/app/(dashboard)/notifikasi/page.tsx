import * as React from 'react';
import { redirect } from 'next/navigation';
import { Mail, Clock, ShieldCheck } from 'lucide-react';
import { getProfil } from '@/lib/profil';
import { createServerClient } from '@/lib/supabase/server';
import { formatTanggalWaktu, formatTanggal } from '@/lib/format';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TombolKirimUji } from '@/features/notifikasi/components/TombolKirimUji';
import type { NotifikasiEmailLog } from '@/features/notifikasi/types';

export const dynamic = 'force-dynamic';

interface RiwayatLogDbRow {
  id: string;
  jenis: 'stok_menipis' | 'uji';
  tanggal_bisnis: string;
  status: 'diklaim' | 'terkirim' | 'dilewati' | 'gagal';
  jumlah_barang: number;
  jumlah_penerima: number;
  galat_singkat: string | null;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export default async function NotifikasiPage() {
  const profile = await getProfil();
  if (!profile) {
    redirect('/login');
  }

  // Hanya Manajer yang berwenang mengakses halaman ini (E10)
  if (profile.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();
  const caller = supabase as unknown as {
    rpc: (fn: string) => Promise<{ data: RiwayatLogDbRow[] | null; error: Error | null }>;
  };
  const { data: logsRaw } = await caller.rpc('rpc_riwayat_notifikasi_manajer');

  const logs: NotifikasiEmailLog[] = (logsRaw || []).map((l: RiwayatLogDbRow) => ({
    id: l.id,
    jenis: l.jenis,
    tanggal_bisnis: l.tanggal_bisnis,
    status: l.status,
    jumlah_barang: Number(l.jumlah_barang) || 0,
    jumlah_penerima: Number(l.jumlah_penerima) || 0,
    galat_singkat: l.galat_singkat,
    dibuat_pada: l.dibuat_pada,
    diperbarui_pada: l.diperbarui_pada,
  }));

  const emailMode = process.env.EMAIL_MODE?.toLowerCase() || 'sandbox';
  const emailSandboxTo = process.env.EMAIL_SANDBOX_TO || '-';
  const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const columns: Column<NotifikasiEmailLog>[] = [
    {
      header: 'Waktu Eksekusi',
      accessorKey: 'dibuat_pada',
      cell: (row) => formatTanggalWaktu(row.dibuat_pada),
      className: 'w-44 text-slate-600',
    },
    {
      header: 'Tanggal Bisnis',
      accessorKey: 'tanggal_bisnis',
      cell: (row) => formatTanggal(row.tanggal_bisnis),
      className: 'w-32 font-medium text-slate-800',
    },
    {
      header: 'Jenis',
      accessorKey: 'jenis',
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.jenis === 'stok_menipis'
              ? 'bg-blue-50 text-blue-700 border-blue-200 text-xs font-normal'
              : 'bg-purple-50 text-purple-700 border-purple-200 text-xs font-normal'
          }
        >
          {row.jenis === 'stok_menipis' ? 'Harian (07.00 WIB)' : 'Uji Coba'}
        </Badge>
      ),
      className: 'w-40',
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <BadgeStatus status={row.status} />,
      className: 'w-28',
    },
    {
      header: 'Jml Barang',
      accessorKey: 'jumlah_barang',
      cell: (row) => `${row.jumlah_barang} barang`,
      className: 'w-28 text-right tabular-nums',
    },
    {
      header: 'Jml Penerima',
      accessorKey: 'jumlah_penerima',
      cell: (row) => `${row.jumlah_penerima} akun`,
      className: 'w-28 text-right tabular-nums',
    },
    {
      header: 'Catatan / Pesan',
      accessorKey: 'galat_singkat',
      cell: (row) => (
        <span className="text-xs text-slate-500 truncate block max-w-xs" title={row.galat_singkat || '-'}>
          {row.galat_singkat || '-'}
        </span>
      ),
      className: 'min-w-[180px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log Notifikasi Email"
        description="Riwayat pengiriman otomatis peringatan stok barang menipis via Resend dan Netlify Scheduled Functions."
        action={<TombolKirimUji />}
      />

      {/* Info Status Konfigurasi & Jadwal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Mode Pengiriman</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={
                    emailMode === 'live'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs uppercase'
                      : 'bg-amber-50 text-amber-700 border-amber-200 text-xs uppercase'
                  }
                >
                  {emailMode}
                </Badge>
                <span className="text-xs text-slate-500">
                  {emailMode === 'live' ? emailFrom : `Ke: ${emailSandboxTo}`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Jadwal Otomatis</p>
              <p className="text-xs font-semibold text-slate-900 mt-0.5">
                Setiap Hari 07.00 WIB
              </p>
              <p className="text-[11px] text-slate-400">Netlify Cron: 0 0 * * * (UTC)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Penerima Notifikasi</p>
              <p className="text-xs font-semibold text-slate-900 mt-0.5">
                Manajer & Staf Gudang Aktif
              </p>
              <p className="text-[11px] text-slate-400">Penjualan & nonaktif dieksklusi</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Riwayat Log */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-0">
          <DataTable<NotifikasiEmailLog>
            data={logs}
            columns={columns}
            keyExtractor={(item) => item.id}
            emptyTitle="Belum ada riwayat"
            emptyDescription="Belum ada riwayat pengiriman notifikasi email."
          />
        </CardContent>
      </Card>
    </div>
  );
}
