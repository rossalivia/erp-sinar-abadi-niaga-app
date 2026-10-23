import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { buildSafeCsv, formatTanggalWib } from '@/features/analitik/utils';
import type {
  BarangTidakBergerakItem,
  PelangganTidakAktifItem,
  PerformaSalesItem,
  TopPelangganItem,
} from '@/features/analitik/types';

export async function GET(request: NextRequest) {
  // Lapis Otorisasi Server
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return new NextResponse('Tidak berwenang: Hanya Manajer yang dapat mengakses data analitik', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const { searchParams } = new URL(request.url);
  const tipe = searchParams.get('tipe') || 'sales';
  const dari = searchParams.get('dari') || undefined;
  const sampai = searchParams.get('sampai') || undefined;
  const ambang = parseInt(searchParams.get('ambang') || '30', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const supabase = await createServerClient();

  if (tipe === 'sales') {
    const { data, error } = await supabase.rpc('rpc_analitik_performa_sales', {
      p_dari: dari,
      p_sampai: sampai,
    });

    if (error) {
      return new NextResponse(`Gagal mengambil data analitik sales: ${error.message}`, { status: 500 });
    }

    const rows = (data || []) as PerformaSalesItem[];
    const headers = [
      'Nama Staf',
      'Email',
      'Status Akun',
      'Jumlah Pesanan',
      'Pesanan Dikirim',
      'Pesanan Lunas',
      'Total Omzet (Rp)',
      'Total HPP (Rp)',
      'Margin Kotor (Rp)',
      'Margin (%)',
      'Piutang Berjalan (Rp)',
      'Draf Aktif',
    ];

    const dataRows = rows.map((r) => [
      r.nama_sales,
      r.email,
      r.aktif ? 'Aktif' : 'Nonaktif',
      r.jumlah_pesanan,
      r.pesanan_dikirim,
      r.pesanan_lunas,
      r.total_omzet,
      r.total_hpp,
      r.total_margin,
      r.margin_persen,
      r.piutang_berjalan,
      r.jumlah_draf,
    ]);

    const csvContent = buildSafeCsv(headers, dataRows);
    const filename = `analitik-performa-sales-${dari || 'semua'}-sd-${sampai || 'semua'}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  if (tipe === 'pelanggan') {
    const { data, error } = await supabase.rpc('rpc_analitik_top_pelanggan', {
      p_dari: dari,
      p_sampai: sampai,
      p_limit: limit,
    });

    if (error) {
      return new NextResponse(`Gagal mengambil data analitik top pelanggan: ${error.message}`, { status: 500 });
    }

    const rows = (data || []) as TopPelangganItem[];
    const headers = [
      'Kode Pelanggan',
      'Nama Toko',
      'Telepon',
      'Jumlah Pesanan',
      'Total Omzet (Rp)',
      'Total HPP (Rp)',
      'Margin Kotor (Rp)',
      'Margin (%)',
      'Kontribusi Omzet (%)',
      'Batas Kredit (Rp)',
      'Sisa Plafon Kredit (Rp)',
      'Status Kelayakan Kredit',
    ];

    const dataRows = rows.map((r) => [
      r.kode,
      r.nama_toko,
      r.telepon,
      r.jumlah_pesanan,
      r.total_omzet,
      r.total_hpp,
      r.total_margin,
      r.margin_persen,
      r.kontribusi_omzet_persen,
      r.batas_kredit,
      r.sisa_kredit,
      r.status_kredit,
    ]);

    const csvContent = buildSafeCsv(headers, dataRows);
    const filename = `analitik-top-pelanggan-${dari || 'semua'}-sd-${sampai || 'semua'}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  if (tipe === 'dormant') {
    const { data, error } = await supabase.rpc('rpc_analitik_pelanggan_tidak_aktif', {
      p_ambang_hari: ambang,
    });

    if (error) {
      return new NextResponse(`Gagal mengambil data pelanggan pasif: ${error.message}`, { status: 500 });
    }

    const rows = (data || []) as PelangganTidakAktifItem[];
    const headers = [
      'Kode Pelanggan',
      'Nama Toko',
      'Telepon',
      'Alamat',
      'Terdaftar Sejak',
      'Pesanan Terakhir',
      'Nomor Dokumen Terakhir',
      'Hari Tidak Aktif',
      'Total Pesanan Historis',
      'Total Omzet Historis (Rp)',
      'Piutang Berjalan (Rp)',
    ];

    const dataRows = rows.map((r) => [
      r.kode,
      r.nama_toko,
      r.telepon,
      r.alamat,
      formatTanggalWib(r.terdaftar_pada),
      formatTanggalWib(r.pesanan_terakhir_pada),
      r.nomor_pesanan_terakhir || '-',
      r.hari_tidak_aktif,
      r.total_pesanan_historis,
      r.total_omzet_historis,
      r.piutang_berjalan,
    ]);

    const csvContent = buildSafeCsv(headers, dataRows);
    const filename = `analitik-pelanggan-tidak-aktif-${ambang}-hari.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  if (tipe === 'deadstock') {
    const { data, error } = await supabase.rpc('rpc_analitik_barang_tidak_bergerak', {
      p_ambang_hari: ambang,
    });

    if (error) {
      return new NextResponse(`Gagal mengambil data barang tidak bergerak: ${error.message}`, { status: 500 });
    }

    const rows = (data || []) as BarangTidakBergerakItem[];
    const headers = [
      'Kode Barang',
      'Nama Barang',
      'Satuan',
      'Stok Fisik',
      'Stok Minimum',
      'Harga Pokok (Rp)',
      'Harga Jual (Rp)',
      'Modal Tertahan (Rp)',
      'Penjualan Terakhir',
      'Nomor Pesanan Terakhir',
      'Hari Mengendap',
    ];

    const dataRows = rows.map((r) => [
      r.kode,
      r.nama,
      r.satuan,
      r.stok_saat_ini,
      r.stok_minimum,
      r.harga_pokok,
      r.harga_jual,
      r.nilai_stok_mengendap,
      formatTanggalWib(r.penjualan_terakhir_pada),
      r.nomor_pesanan_terakhir || '-',
      r.hari_mengendap,
    ]);

    const csvContent = buildSafeCsv(headers, dataRows);
    const filename = `analitik-barang-tidak-bergerak-${ambang}-hari.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  return new NextResponse('Tipe analitik tidak dikenali', { status: 400 });
}
