import * as React from 'react';
import { redirect } from 'next/navigation';
import { Mail, Clock, ShieldCheck, Info, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { getProfil } from '@/lib/profil';
import { createServerClient } from '@/lib/supabase/server';
import { formatTanggalWaktu, formatTanggal } from '@/lib/format';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  const emailSandboxTo = process.env.EMAIL_SANDBOX_TO || '';
  const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const columns: Column<NotifikasiEmailLog>[] = [
    {
      header: 'Waktu Eksekusi',
      accessorKey: 'dibuat_pada',
      cell: (row) => (
        <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
          {formatTanggalWaktu(row.dibuat_pada)}
        </span>
      ),
      className: 'w-44 text-slate-600 dark:text-slate-400',
    },
    {
      header: 'Tanggal Bisnis',
      accessorKey: 'tanggal_bisnis',
      cell: (row) => (
        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
          {formatTanggal(row.tanggal_bisnis)}
        </span>
      ),
      className: 'w-32',
    },
    {
      header: 'Jenis',
      accessorKey: 'jenis',
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.jenis === 'stok_menipis'
              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900 text-xs font-normal'
              : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900 text-xs font-normal'
          }
        >
          {row.jenis === 'stok_menipis' ? 'Harian (07.00 WIB)' : 'Uji Coba Manual'}
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
      cell: (row) => (
        <div className="text-right tabular-nums text-xs">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.jumlah_barang}</span>{' '}
          <span className="text-slate-400 dark:text-slate-500">item</span>
        </div>
      ),
      className: 'w-28 text-right',
    },
    {
      header: 'Jml Penerima',
      accessorKey: 'jumlah_penerima',
      cell: (row) => (
        <div className="text-right tabular-nums text-xs">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.jumlah_penerima}</span>{' '}
          <span className="text-slate-400 dark:text-slate-500">akun</span>
        </div>
      ),
      className: 'w-28 text-right',
    },
    {
      header: 'Catatan / Pesan',
      accessorKey: 'galat_singkat',
      cell: (row) => {
        if (!row.galat_singkat) {
          return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
        }

        const isGagal = row.status === 'gagal';
        return (
          <div
            className={`text-xs p-1.5 rounded border max-w-sm ${
              isGagal
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60'
                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
            }`}
            title={row.galat_singkat}
          >
            <div className="flex items-start gap-1.5">
              {isGagal && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />}
              <span className="break-words line-clamp-2">{row.galat_singkat}</span>
            </div>
          </div>
        );
      },
      className: 'min-w-[220px]',
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
        {/* Card 1: Mode Pengiriman Resend */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-4 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mode Pengiriman Resend</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={
                    emailMode === 'live'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs uppercase font-semibold'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 text-xs uppercase font-semibold'
                  }
                >
                  {emailMode}
                </Badge>
                {emailMode === 'live' ? (
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate" title={emailFrom}>
                    Pengirim: {emailFrom}
                  </span>
                ) : emailSandboxTo ? (
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate" title={emailSandboxTo}>
                    Ke: {emailSandboxTo}
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    EMAIL_SANDBOX_TO belum diatur
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                {emailMode === 'live'
                  ? 'Kirim ke seluruh penerima aktif'
                  : 'Dialihkan ke email pengembang/penguji'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Jadwal Otomatis */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-4 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Jadwal Pengiriman Otomatis</p>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
                Setiap Hari 07.00 WIB
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Netlify Cron: <code className="font-mono text-slate-600 dark:text-slate-400">0 0 * * *</code> (00:00 UTC)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Penerima Notifikasi */}
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-4 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Penerima Sasaran</p>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
                Manajer & Staf Gudang
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Hanya akun berstatus aktif (Penjualan dieksklusi)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Banner Informasi Kebijakan Anti-Spam & Rate Limit */}
      <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-0.5 leading-relaxed">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Ketentuan Pengujian Manual & Kebijakan Anti-Spam:
          </span>{' '}
          Tombol <span className="font-medium text-slate-900 dark:text-slate-200">"Kirim Email Uji Coba"</span> dibatasi secara ketat maksimal <strong>1 kali per menit</strong> pada basis data Postgres untuk mencegah pengiriman ganda (flooding) dan menjaga kuota API Resend. Jika pengujian baru saja dilakukan, tombol akan otomatis masuk mode hitung mundur (cooldown).
        </div>
      </div>

      {/* Tabel Riwayat Log */}
      <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Riwayat Pengiriman Notifikasi
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Menampilkan hingga 50 aktivitas pengiriman terakhir (otomatis & manual).
              </CardDescription>
            </div>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
            Total {logs.length} catatan
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable<NotifikasiEmailLog>
            data={logs}
            columns={columns}
            keyExtractor={(item) => item.id}
            emptyTitle="Belum ada riwayat pengiriman"
            emptyDescription="Log notifikasi email harian atau uji coba manual akan otomatis tercatat di sini."
          />
        </CardContent>
      </Card>
    </div>
  );
}
