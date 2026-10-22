import Link from 'next/link';
import { getProfil } from '@/lib/profil';
import { createServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTanggal, formatRupiah } from '@/lib/format';
import {
  AlertTriangle,
  Clock,
  Shield,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  ReceiptText,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { LaporanRingkasan, LaporanAgingPiutang } from '@/features/laporan/types';

interface BarangMenipis {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  stok_menipis: boolean;
}

export default async function DashboardPage() {
  const user = await getProfil();
  const supabase = await createServerClient();

  const isManajer = user?.peran === 'manajer';

  // Ambil data stok menipis (untuk semua peran)
  const { data: barangMenipisData, error: stokError } = await supabase
    .from('v_barang')
    .select('id, kode, nama, satuan, stok, stok_minimum, stok_menipis')
    .eq('stok_menipis', true)
    .order('stok', { ascending: true });

  const barangMenipis: BarangMenipis[] = (barangMenipisData || []).map((item) => ({
    id: item.id || '',
    kode: item.kode || '-',
    nama: item.nama || '-',
    satuan: item.satuan || 'pcs',
    stok: item.stok ?? 0,
    stok_minimum: item.stok_minimum ?? 0,
    stok_menipis: item.stok_menipis ?? true,
  }));

  // Jika Manajer, ambil KPI ringkas minggu berjalan & piutang tempo
  let kpiMinggu: LaporanRingkasan | null = null;
  let agingPiutang: LaporanAgingPiutang | null = null;
  let jumlahPersetujuanMenunggu = 0;

  if (isManajer) {
    const now = new Date();
    // Hitung awal minggu ini (Senin)
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const mondayStr = monday.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    const [ringkasanRes, agingRes, persetujuanRes] = await Promise.all([
      supabase.rpc('rpc_laporan_ringkasan', { p_dari: mondayStr, p_sampai: todayStr }),
      supabase.rpc('rpc_laporan_aging_piutang'),
      supabase.from('v_persetujuan_harga').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
    ]);
    jumlahPersetujuanMenunggu = persetujuanRes.count ?? 0;

    const ringkasanRaw = Array.isArray(ringkasanRes.data) ? ringkasanRes.data[0] : ringkasanRes.data;
    if (ringkasanRaw) {
      kpiMinggu = {
        total_omzet: Number(ringkasanRaw.total_omzet) || 0,
        total_hpp: Number(ringkasanRaw.total_hpp) || 0,
        total_margin: Number(ringkasanRaw.total_margin) || 0,
        margin_persen: Number(ringkasanRaw.margin_persen) || 0,
        jumlah_pesanan: Number(ringkasanRaw.jumlah_pesanan) || 0,
        pesanan_dikirim: Number(ringkasanRaw.pesanan_dikirim) || 0,
        pesanan_lunas: Number(ringkasanRaw.pesanan_lunas) || 0,
      };
    }

    const agingRaw = Array.isArray(agingRes.data) ? agingRes.data[0] : agingRes.data;
    if (agingRaw) {
      agingPiutang = {
        total_piutang_dikirim: Number(agingRaw.total_piutang_dikirim) || 0,
        belum_jatuh_tempo: Number(agingRaw.belum_jatuh_tempo) || 0,
        lewat_1_7_hari: Number(agingRaw.lewat_1_7_hari) || 0,
        lewat_8_30_hari: Number(agingRaw.lewat_8_30_hari) || 0,
        lewat_gt_30_hari: Number(agingRaw.lewat_gt_30_hari) || 0,
        jumlah_pesanan_lewat_tempo: Number(agingRaw.jumlah_pesanan_lewat_tempo) || 0,
        total_pesanan_dikirim: Number(agingRaw.total_pesanan_dikirim) || 0,
      };
    }
  }

  // Ringkasan Tagihan & Overdue untuk Penjualan & Manajer
  let tagihanHariIni = 0;
  let tagihanOverdueCount = 0;
  let tagihanOverdueTotal = 0;

  if (user?.peran === 'manajer' || user?.peran === 'penjualan') {
    const { data: tagihanData } = await supabase
      .from('v_tagihan')
      .select('total, klasifikasi');

    if (tagihanData) {
      for (const t of tagihanData) {
        if (t.klasifikasi === 'hari_ini') {
          tagihanHariIni += 1;
        } else if (t.klasifikasi?.startsWith('overdue')) {
          tagihanOverdueCount += 1;
          tagihanOverdueTotal += Number(t.total) || 0;
        }
      }
    }
  }

  const columns: Column<BarangMenipis>[] = [
    {
      header: 'Kode Barang',
      accessorKey: 'kode',
      className: 'w-32 font-mono text-slate-700 font-medium',
    },
    {
      header: 'Nama Barang',
      accessorKey: 'nama',
      className: 'font-medium text-slate-900',
    },
    {
      header: 'Satuan',
      accessorKey: 'satuan',
      className: 'w-24 text-slate-500',
    },
    {
      header: 'Stok Saat Ini',
      isNumeric: true,
      className: 'w-32 text-red-600 font-semibold',
      cell: (row) => `${row.stok.toLocaleString('id-ID')} ${row.satuan}`,
    },
    {
      header: 'Batas Minimum',
      isNumeric: true,
      className: 'w-32 text-slate-600',
      cell: (row) => `${row.stok_minimum.toLocaleString('id-ID')} ${row.satuan}`,
    },
    {
      header: 'Status',
      align: 'center',
      className: 'w-28',
      cell: () => (
        <Badge variant="danger" className="text-[10px]">
          Menipis
        </Badge>
      ),
    },
    {
      header: 'Aksi',
      align: 'right',
      className: 'w-28 text-right',
      cell: (row) => {
        if (user?.peran === 'gudang' || user?.peran === 'manajer') {
          return (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-6 text-[11px] px-2 border-slate-300 gap-1"
            >
              <Link href={`/pembelian/baru?barang=${row.id}`}>
                <ShoppingCart className="w-3 h-3" />
                Ajukan PO
              </Link>
            </Button>
          );
        }
        return null;
      },
    },
  ];

  const nowJakarta = new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard Utama"
        description="Ringkasan status operasional sistem CV Sinar Abadi Niaga"
      />

      {/* Kartu Sambutan */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900">
                Selamat datang kembali, {user?.nama_lengkap}!
              </h2>
              <p className="text-xs text-slate-500">
                Anda masuk dengan hak otorisasi peran{' '}
                <span className="font-semibold text-slate-700 capitalize">
                  {user?.peran}
                </span>
                . Semua aktivitas transaksi terekam dalam log audit.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-5">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>{formatTanggal(nowJakarta)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Sesi Terenkripsi</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Widget Monitoring Penagihan (Manajer & Penjualan) */}
      {(user?.peran === 'manajer' || user?.peran === 'penjualan') && (tagihanHariIni > 0 || tagihanOverdueCount > 0) && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <ReceiptText className="h-4 w-4 text-amber-800 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-amber-950">
                Monitoring Penagihan Piutang
              </p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                {tagihanHariIni > 0 && (
                  <span className="font-medium mr-2">
                    &bull; {tagihanHariIni} faktur jatuh tempo hari ini
                  </span>
                )}
                {tagihanOverdueCount > 0 && (
                  <span className="font-medium">
                    &bull; {tagihanOverdueCount} faktur menunggak ({formatRupiah(tagihanOverdueTotal)})
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/penagihan"
            className="inline-flex items-center gap-1 font-semibold text-amber-900 hover:text-amber-950 underline self-start sm:self-auto text-xs shrink-0"
          >
            Buka Penagihan &rarr;
          </Link>
        </div>
      )}

      {/* Panel Khusus Manajer: KPI Ringkas Minggu Berjalan & Piutang Jatuh Tempo */}
      {isManajer && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ringkasan Keuangan Manajer (Minggu Berjalan)
            </h3>
            <Link
              href="/laporan"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 hover:underline"
            >
              Lihat Laporan Lengkap
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Omzet Minggu Ini */}
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Omzet Minggu Ini</span>
                  <DollarSign className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900 tabular-nums">
                  {formatRupiah(kpiMinggu?.total_omzet || 0)}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {kpiMinggu?.jumlah_pesanan || 0} pesanan terealisasi
                </p>
              </CardContent>
            </Card>

            {/* Margin Kotor Minggu Ini */}
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Margin Kotor</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-lg font-bold text-emerald-700 tabular-nums">
                  {formatRupiah(kpiMinggu?.total_margin || 0)}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Margin: {kpiMinggu?.margin_persen || 0}%
                </p>
              </CardContent>
            </Card>

            {/* Total Piutang Aktif */}
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Total Piutang Berjalan</span>
                  <ReceiptText className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900 tabular-nums">
                  {formatRupiah(agingPiutang?.total_piutang_dikirim || 0)}
                </div>
                <Link
                  href="/laporan/piutang"
                  className="mt-1 text-[11px] text-slate-600 hover:text-slate-900 hover:underline block"
                >
                  {agingPiutang?.total_pesanan_dikirim || 0} tagihan belum lunas
                </Link>
              </CardContent>
            </Card>

            {/* Pesanan Lewat Jatuh Tempo */}
            <Card className={`border-slate-200 ${
              (agingPiutang?.jumlah_pesanan_lewat_tempo || 0) > 0 ? 'bg-red-50/40 border-red-200' : 'bg-white'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Tagihan Lewat Tempo</span>
                  <AlertTriangle className={`h-4 w-4 ${
                    (agingPiutang?.jumlah_pesanan_lewat_tempo || 0) > 0 ? 'text-red-600' : 'text-slate-400'
                  }`} />
                </div>
                <div className={`mt-2 text-lg font-bold tabular-nums ${
                  (agingPiutang?.jumlah_pesanan_lewat_tempo || 0) > 0 ? 'text-red-700' : 'text-slate-700'
                }`}>
                  {agingPiutang?.jumlah_pesanan_lewat_tempo || 0} <span className="text-xs font-normal text-slate-500">pesanan</span>
                </div>
                <Link
                  href="/laporan/piutang"
                  className="mt-1 text-[11px] text-red-700 font-medium hover:underline block"
                >
                  Periksa penagihan piutang &rarr;
                </Link>
              </CardContent>
            </Card>

            {/* Persetujuan Harga Menunggu */}
            <Card className={`border-slate-200 ${
              jumlahPersetujuanMenunggu > 0 ? 'bg-amber-50/50 border-amber-300' : 'bg-white'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Persetujuan Menunggu</span>
                  <ShieldAlert className={`h-4 w-4 ${
                    jumlahPersetujuanMenunggu > 0 ? 'text-amber-600' : 'text-slate-400'
                  }`} />
                </div>
                <div className={`mt-2 text-lg font-bold tabular-nums ${
                  jumlahPersetujuanMenunggu > 0 ? 'text-amber-800' : 'text-slate-700'
                }`}>
                  {jumlahPersetujuanMenunggu} <span className="text-xs font-normal text-slate-500">pengajuan</span>
                </div>
                <Link
                  href="/persetujuan"
                  className="mt-1 text-[11px] text-amber-800 font-medium hover:underline block"
                >
                  Buka antrean persetujuan &rarr;
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Daftar Stok Menipis */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
              <div>
                <CardTitle className="text-xs font-semibold text-slate-900">
                  Peringatan Stok Menipis
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Daftar barang dengan jumlah stok kurang dari atau sama dengan batas minimum
                </CardDescription>
              </div>
            </div>
            <Badge variant="warning" className="text-[11px]">
              {barangMenipis.length} Barang
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {stokError ? (
            <div className="p-4 text-xs text-red-600 bg-red-50 rounded border border-red-200">
              Gagal memuat data stok barang: {stokError.message}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={barangMenipis}
              keyExtractor={(item) => item.id}
              zebra
              emptyTitle="Stok Seluruh Barang Aman"
              emptyDescription="Tidak ada barang yang berada pada atau di bawah batas stok minimum."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
