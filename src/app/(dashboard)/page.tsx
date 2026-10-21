import { getProfil } from '@/lib/profil';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { formatTanggal } from '@/lib/format';
import { AlertTriangle, Clock, Shield } from 'lucide-react';

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
  const supabase = await createClient();

  const { data: barangMenipisData, error } = await supabase
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
          {error ? (
            <div className="p-4 text-xs text-red-600 bg-red-50 rounded border border-red-200">
              Gagal memuat data stok barang: {error.message}
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
