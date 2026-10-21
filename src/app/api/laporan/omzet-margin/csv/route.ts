import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';

export async function GET(request: NextRequest) {
  // Lapis Otorisasi Server
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return new NextResponse('Tidak berwenang: Hanya Manajer yang dapat mengekspor laporan keuangan', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const { searchParams } = new URL(request.url);
  const dari = searchParams.get('dari') || undefined;
  const sampai = searchParams.get('sampai') || undefined;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_laporan_margin_mingguan', {
    p_dari: dari,
    p_sampai: sampai,
  });

  if (error) {
    return new NextResponse(`Gagal mengambil data laporan: ${error.message}`, { status: 500 });
  }

  const rows = (data || []) as {
    minggu: string;
    omzet: number;
    hpp: number;
    margin: number;
    margin_persen: number;
  }[];

  // Header CSV
  const csvHeaders = ['Minggu (Mulai)', 'Omzet (Rp)', 'HPP (Rp)', 'Margin Kotor (Rp)', 'Margin (%)'];
  const csvLines = [csvHeaders.join(',')];

  for (const r of rows) {
    csvLines.push([
      `"${r.minggu}"`,
      r.omzet ?? 0,
      r.hpp ?? 0,
      r.margin ?? 0,
      r.margin_persen ?? 0,
    ].join(','));
  }

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const filename = `laporan-omzet-margin-${dari || 'default'}-sd-${sampai || 'default'}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
