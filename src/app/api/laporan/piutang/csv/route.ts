import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';

export async function GET() {
  // Lapis Otorisasi Server
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return new NextResponse('Tidak berwenang: Hanya Manajer yang dapat mengekspor laporan piutang', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_laporan_piutang');

  if (error) {
    return new NextResponse(`Gagal mengambil data piutang: ${error.message}`, { status: 500 });
  }

  const rows = (data || []) as {
    pelanggan_id: string;
    kode: string;
    nama_toko: string;
    batas_kredit: number;
    termin_hari: number;
    total_piutang: number;
    piutang_belum_jatuh_tempo: number;
    piutang_lewat_jatuh_tempo: number;
    ada_lewat_jatuh_tempo: boolean;
  }[];

  const csvHeaders = [
    'Kode',
    'Nama Toko',
    'Termin (Hari)',
    'Piutang Berjalan (Rp)',
    'Batas Kredit (Rp)',
    'Sisa Kredit (Rp)',
    'Belum Jatuh Tempo (Rp)',
    'Lewat Jatuh Tempo (Rp)',
    'Status Keterlambatan',
  ];

  const csvLines = [csvHeaders.join(',')];

  for (const r of rows) {
    const sisaKredit = (r.batas_kredit ?? 0) - (r.total_piutang ?? 0);
    const status = r.ada_lewat_jatuh_tempo ? 'Ada Lewat Tempo' : 'Lancar';

    csvLines.push([
      `"${r.kode}"`,
      `"${r.nama_toko.replace(/"/g, '""')}"`,
      r.termin_hari ?? 0,
      r.total_piutang ?? 0,
      r.batas_kredit ?? 0,
      sisaKredit,
      r.piutang_belum_jatuh_tempo ?? 0,
      r.piutang_lewat_jatuh_tempo ?? 0,
      `"${status}"`,
    ].join(','));
  }

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const today = new Date().toISOString().split('T')[0];
  const filename = `laporan-piutang-pelanggan-${today}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
