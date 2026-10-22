import * as React from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { OpnameEditor } from '@/features/stock-opname/components/opname-editor';
import type { BarangKatalogOpname } from '@/features/stock-opname/types';

export const metadata = {
  title: 'Mulai Sesi Stock Opname | CV Sinar Abadi Niaga',
  robots: { index: false, follow: false },
};

export default async function BaruStockOpnamePage() {
  const profil = await getProfil();
  if (!profil || (profil.peran !== 'gudang' && profil.peran !== 'manajer')) {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();

  // Ambil daftar barang aktif dari v_barang
  const { data: rawBarang } = await supabase
    .from('v_barang')
    .select('id, kode, nama, satuan, stok, stok_minimum')
    .order('nama', { ascending: true });

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

  return <OpnameEditor katalogBarang={katalogBarang} />;
}
