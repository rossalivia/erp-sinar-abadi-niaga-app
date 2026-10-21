import * as React from 'react';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { PembelianForm } from '@/features/pembelian/components/pembelian-form';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import type { BarangOption, PemasokOption } from '@/features/pembelian/types';

interface PageProps {
  searchParams: Promise<{ barang?: string }>;
}

export default async function AjukanPembelianPage({ searchParams }: PageProps) {
  const { barang: defaultBarangId } = await searchParams;
  const profil = await getProfil();
  const peran = profil?.peran || 'gudang';

  if (peran === 'penjualan') {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();

  // Ambil pemasok aktif
  const { data: pemasokData } = await supabase
    .from('pemasok')
    .select('id, kode, nama')
    .eq('aktif', true)
    .order('nama', { ascending: true });

  // Ambil barang aktif dari view v_barang
  const { data: barangData } = await supabase
    .from('v_barang')
    .select('id, kode, nama, satuan, stok, stok_minimum')
    .eq('aktif', true)
    .order('nama', { ascending: true });

  const pemasokList: PemasokOption[] = (pemasokData || []).map((p) => ({
    id: p.id,
    kode: p.kode,
    nama: p.nama,
  }));

  const barangList: BarangOption[] = (barangData || [])
    .filter((b) => Boolean(b.id))
    .map((b) => ({
      id: b.id || '',
      kode: b.kode || '',
      nama: b.nama || '',
      satuan: b.satuan || '',
      stok: Number(b.stok) || 0,
      stok_minimum: Number(b.stok_minimum) || 0,
    }));

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <PageHeader
        title="Ajukan Pembelian Barang (PO)"
        description="Pilih pemasok dan barang yang perlu dibeli kembali. PO yang diajukan akan ditinjau dan ditentukan harga belinya oleh Manajer."
      />

      <PembelianForm
        pemasokList={pemasokList}
        barangList={barangList}
        defaultBarangId={defaultBarangId}
      />
    </div>
  );
}
