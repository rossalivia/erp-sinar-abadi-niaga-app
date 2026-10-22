import { NextRequest, NextResponse } from 'next/server';
import { getProfil } from '@/lib/profil';
import { generateTemplateCsv } from '@/features/impor/utils';

export async function GET(request: NextRequest) {
  const profile = await getProfil();
  if (!profile || profile.peran !== 'manajer') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const jenis = searchParams.get('jenis');

  if (jenis !== 'barang' && jenis !== 'pelanggan') {
    return NextResponse.json(
      { error: 'Parameter jenis tidak valid (pilih barang atau pelanggan)' },
      { status: 400 }
    );
  }

  const csvContent = generateTemplateCsv(jenis);
  const filename = `templat_impor_${jenis}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, private',
    },
  });
}
