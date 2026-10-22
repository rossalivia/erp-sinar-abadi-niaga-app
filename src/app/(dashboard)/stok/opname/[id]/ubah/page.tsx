import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { OpnameEditor } from '@/features/stock-opname/components/opname-editor';
import type { BarangKatalogOpname, ItemOpnameStok } from '@/features/stock-opname/types';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface CustomUbahClient {
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

export const metadata = {
  title: 'Ubah Draf Stock Opname | CV Sinar Abadi Niaga',
  robots: { index: false, follow: false },
};

export default async function UbahStockOpnamePage({ params }: PageProps) {
  const { id } = await params;
  const profil = await getProfil();
  if (!profil || (profil.peran !== 'gudang' && profil.peran !== 'manajer')) {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();
  const client = supabase as unknown as CustomUbahClient;

  // 1. Fetch Header
  const { data: header, error: headerErr } = await client
    .from('opname_stok')
    .select('id, nomor, status, catatan, dibuat_oleh')
    .eq('id', id)
    .single();

  if (headerErr || !header) {
    notFound();
  }

  // Hanya boleh ubah jika status draf
  if (header.status !== 'draf') {
    redirect(`/stok/opname/${id}`);
  }

  // Gudang hanya boleh ubah draf buatannya
  if (profil.peran === 'gudang' && header.dibuat_oleh !== profil.id) {
    redirect('/tidak-berwenang');
  }

  // 2. Fetch Items
  const { data: rawItems } = await client
    .from('item_opname_stok')
    .select('id, opname_stok_id, barang_id, stok_sistem, stok_fisik, selisih, keterangan')
    .eq('opname_stok_id', id)
    .order('dibuat_pada', { ascending: true });

  const itemList = rawItems || [];

  // 3. Fetch Katalog Barang
  const { data: rawBarang } = await supabase
    .from('v_barang')
    .select('id, kode, nama, satuan, stok, stok_minimum')
    .order('nama', { ascending: true });

  const barangMap = new Map((rawBarang || []).map((b) => [b.id, b]));

  const items: ItemOpnameStok[] = itemList.map((i) => {
    const b = barangMap.get(i.barang_id as string);
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
    };
  });

  const katalogBarang: BarangKatalogOpname[] = (rawBarang || [])
    .filter((b) => Boolean(b.id))
    .map((b) => ({
      id: b.id as string,
      kode: b.kode || '',
      nama: b.nama || '',
      satuan: b.satuan || 'unit',
      stok: Number(b.stok) || 0,
      stok_minimum: Number(b.stok_minimum) || 0,
    }));

  return (
    <OpnameEditor
      katalogBarang={katalogBarang}
      initialData={{
        id: header.id as string,
        catatan: (header.catatan as string) || null,
        items,
      }}
    />
  );
}
