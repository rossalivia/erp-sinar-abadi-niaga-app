import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { OpnameDetailView } from '@/features/stock-opname/components/opname-detail-view';
import type { OpnameStokHeader, ItemOpnameStok } from '@/features/stock-opname/types';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface CustomDetailClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string
      ) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        order: (
          col: string,
          opts?: { ascending?: boolean }
        ) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
      };
    };
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();
  const client = supabase as unknown as CustomDetailClient;
  const { data } = await client
    .from('opname_stok')
    .select('nomor')
    .eq('id', id)
    .single();

  return {
    title: data ? `Stock Opname ${data.nomor} | CV Sinar Abadi Niaga` : 'Detail Stock Opname',
    robots: { index: false, follow: false },
  };
}

export default async function DetailStockOpnamePage({ params }: PageProps) {
  const { id } = await params;
  const profil = await getProfil();
  if (!profil || (profil.peran !== 'gudang' && profil.peran !== 'manajer')) {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();
  const client = supabase as unknown as CustomDetailClient;

  // 1. Fetch Header
  const { data: rawHeader, error: headerErr } = await client
    .from('opname_stok')
    .select(`
      id, nomor, status, catatan, total_item, total_selisih_unit,
      dibuat_oleh, dibuat_pada, diajukan_pada,
      disetujui_oleh, disetujui_pada,
      dibatalkan_oleh, dibatalkan_pada, alasan_batal
    `)
    .eq('id', id)
    .single();

  if (headerErr || !rawHeader) {
    notFound();
  }

  // 2. Petakan Nama Profil Terkait
  const userIds = [
    rawHeader.dibuat_oleh as string,
    rawHeader.disetujui_oleh as string,
    rawHeader.dibatalkan_oleh as string,
  ].filter((uid): uid is string => Boolean(uid));

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

  // 3. Fetch Items
  const { data: rawItems } = await client
    .from('item_opname_stok')
    .select(`
      id, opname_stok_id, barang_id, stok_sistem, stok_fisik, selisih, keterangan
    `)
    .eq('opname_stok_id', id)
    .order('dibuat_pada', { ascending: true });

  const itemList = rawItems || [];

  // Ambil data barang (kode, nama, satuan, dan HPP jika manajer)
  const barangIds = itemList
    .map((i) => i.barang_id as string)
    .filter((bid): bid is string => Boolean(bid));

  const barangMap = new Map<
    string,
    { kode: string; nama: string; satuan: string; harga_pokok?: number | null }
  >();

  if (barangIds.length > 0) {
    if (profil.peran === 'manajer') {
      const { data: bList } = await supabase
        .from('barang')
        .select('id, kode, nama, satuan, harga_pokok')
        .in('id', barangIds);

      if (bList) {
        bList.forEach((b) =>
          barangMap.set(b.id, {
            kode: b.kode,
            nama: b.nama,
            satuan: b.satuan,
            harga_pokok: b.harga_pokok,
          })
        );
      }
    } else {
      const { data: bList } = await supabase
        .from('v_barang')
        .select('id, kode, nama, satuan')
        .in('id', barangIds);

      if (bList) {
        bList.forEach((b) => {
          if (b.id) {
            barangMap.set(b.id, {
              kode: b.kode || '',
              nama: b.nama || '',
              satuan: b.satuan || 'unit',
            });
          }
        });
      }
    }
  }

  // 4. Hitung Estimasi Nilai Selisih jika Manajer secara deklaratif (immutability)
  const totalEstimasiSelisih =
    profil.peran === 'manajer'
      ? itemList.reduce((acc, i) => {
          const b = barangMap.get(i.barang_id as string);
          const hpp = b?.harga_pokok ?? null;
          const sel = Number(i.selisih);
          if (hpp !== null && !isNaN(sel)) {
            return acc + sel * hpp;
          }
          return acc;
        }, 0)
      : null;

  const items: ItemOpnameStok[] = itemList.map((i) => {
    const b = barangMap.get(i.barang_id as string);
    const hpp = b?.harga_pokok ?? null;

    return {
      id: i.id as string,
      opname_stok_id: i.opname_stok_id as string,
      barang_id: i.barang_id as string,
      kode_barang: b?.kode || '-',
      nama_barang: b?.nama || 'Barang',
      satuan: b?.satuan || 'unit',
      stok_sistem: Number(i.stok_sistem) || 0,
      stok_fisik: Number(i.stok_fisik) || 0,
      selisih: Number(i.selisih) || 0,
      keterangan: (i.keterangan as string) || null,
      harga_pokok: hpp,
    };
  });

  const header: OpnameStokHeader = {
    id: rawHeader.id as string,
    nomor: rawHeader.nomor as string,
    status: rawHeader.status as OpnameStokHeader['status'],
    catatan: (rawHeader.catatan as string) || null,
    total_item: Number(rawHeader.total_item) || 0,
    total_selisih_unit: Number(rawHeader.total_selisih_unit) || 0,
    dibuat_oleh: rawHeader.dibuat_oleh as string,
    pembuat_nama: profileMap.get(rawHeader.dibuat_oleh as string) || null,
    dibuat_pada: rawHeader.dibuat_pada as string,
    diajukan_pada: (rawHeader.diajukan_pada as string) || null,
    disetujui_oleh: (rawHeader.disetujui_oleh as string) || null,
    penyetuju_nama: rawHeader.disetujui_oleh
      ? profileMap.get(rawHeader.disetujui_oleh as string) || null
      : null,
    disetujui_pada: (rawHeader.disetujui_pada as string) || null,
    dibatalkan_oleh: (rawHeader.dibatalkan_oleh as string) || null,
    pembatal_nama: rawHeader.dibatalkan_oleh
      ? profileMap.get(rawHeader.dibatalkan_oleh as string) || null
      : null,
    dibatalkan_pada: (rawHeader.dibatalkan_pada as string) || null,
    alasan_batal: (rawHeader.alasan_batal as string) || null,
    estimasi_nilai_selisih: totalEstimasiSelisih,
  };

  return (
    <OpnameDetailView
      header={header}
      items={items}
      peran={profil.peran}
      currentUserId={profil.id}
    />
  );
}
