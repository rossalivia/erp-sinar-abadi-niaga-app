import * as React from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { OpnameListView } from '@/features/stock-opname/components/opname-list-view';
import type { OpnameStokHeader } from '@/features/stock-opname/types';

export const metadata = {
  title: 'Stock Opname | CV Sinar Abadi Niaga',
  robots: { index: false, follow: false },
};

interface CustomQueryClient {
  from: (table: string) => {
    select: (cols: string) => {
      order: (
        col: string,
        opts?: { ascending?: boolean }
      ) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
    };
  };
}

export default async function StockOpnamePage() {
  const profil = await getProfil();
  if (!profil || (profil.peran !== 'gudang' && profil.peran !== 'manajer')) {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();
  const client = supabase as unknown as CustomQueryClient;

  // Query header opname_stok
  const { data: rawList, error } = await client
    .from('opname_stok')
    .select(`
      id, nomor, status, catatan, total_item, total_selisih_unit,
      dibuat_oleh, dibuat_pada, diajukan_pada,
      disetujui_oleh, disetujui_pada,
      dibatalkan_oleh, dibatalkan_pada, alasan_batal
    `)
    .order('dibuat_pada', { ascending: false });

  if (error || !rawList) {
    return <OpnameListView data={[]} peran={profil.peran} />;
  }

  // Kumpulkan semua ID profil pengguna yang terlibat untuk memetakan nama
  const userIds = Array.from(
    new Set(
      rawList
        .flatMap((d) => [
          d.dibuat_oleh as string,
          d.disetujui_oleh as string,
          d.dibatalkan_oleh as string,
        ])
        .filter((id): id is string => Boolean(id))
    )
  );

  const profileMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, nama_lengkap')
      .in('id', userIds);

    if (profs) {
      profs.forEach((p) => profileMap.set(p.id, p.nama_lengkap));
    }
  }

  // Ambil estimasi selisih finansial khusus peran Manajer dari view
  const estimasiMap = new Map<string, number>();
  if (profil.peran === 'manajer') {
    const { data: manajerList } = await client
      .from('v_opname_stok_manajer')
      .select('id, estimasi_nilai_selisih')
      .order('id');

    if (manajerList) {
      manajerList.forEach((m) =>
        estimasiMap.set(
          m.id as string,
          Number(m.estimasi_nilai_selisih) || 0
        )
      );
    }
  }

  const data: OpnameStokHeader[] = rawList.map((d) => ({
    id: d.id as string,
    nomor: d.nomor as string,
    status: d.status as OpnameStokHeader['status'],
    catatan: (d.catatan as string) || null,
    total_item: Number(d.total_item) || 0,
    total_selisih_unit: Number(d.total_selisih_unit) || 0,
    dibuat_oleh: d.dibuat_oleh as string,
    pembuat_nama: profileMap.get(d.dibuat_oleh as string) || null,
    dibuat_pada: d.dibuat_pada as string,
    diajukan_pada: (d.diajukan_pada as string) || null,
    disetujui_oleh: (d.disetujui_oleh as string) || null,
    penyetuju_nama: d.disetujui_oleh
      ? profileMap.get(d.disetujui_oleh as string) || null
      : null,
    disetujui_pada: (d.disetujui_pada as string) || null,
    dibatalkan_oleh: (d.dibatalkan_oleh as string) || null,
    pembatal_nama: d.dibatalkan_oleh
      ? profileMap.get(d.dibatalkan_oleh as string) || null
      : null,
    dibatalkan_pada: (d.dibatalkan_pada as string) || null,
    alasan_batal: (d.alasan_batal as string) || null,
    estimasi_nilai_selisih: estimasiMap.get(d.id as string) || null,
  }));

  return <OpnameListView data={data} peran={profil.peran} />;
}
