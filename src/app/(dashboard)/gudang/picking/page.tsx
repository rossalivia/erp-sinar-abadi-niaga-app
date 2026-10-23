import * as React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { PickingWorkspace } from '@/features/pusat-tugas/components/picking-workspace';
import type { PesananTerkonfirmasi } from '@/features/pusat-tugas/types';
import { hitungUmurHariWib } from '@/features/pusat-tugas/utils';
import { getProfil } from '@/lib/profil';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Daftar Ambil Barang (Picking List) — CV Sinar Abadi Niaga',
  robots: { index: false, follow: false },
};

export default async function PickingListPage() {
  const profil = await getProfil();
  if (!profil) {
    redirect('/login');
  }

  // Hak akses: hanya Gudang dan Manajer (Penjualan diblokir ke /tidak-berwenang)
  if (profil.peran !== 'gudang' && profil.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();

  // Ambil seluruh pesanan berstatus dikonfirmasi
  // PENTING: Zero-leakage: TIDAK mengambil kolom total, harga, atau data finansial apa pun
  const { data: pesananRaw } = await supabase
    .from('pesanan_jual')
    .select(`
      id,
      nomor,
      dikonfirmasi_pada,
      pelanggan:pelanggan_id (id, nama_toko, kode),
      items:item_pesanan_jual (id)
    `)
    .eq('status', 'dikonfirmasi')
    .order('dikonfirmasi_pada', { ascending: true });

  const daftarPesanan: PesananTerkonfirmasi[] = (pesananRaw || []).map((p) => {
    const pelangganObj = Array.isArray(p.pelanggan)
      ? p.pelanggan[0]
      : p.pelanggan;
    const items = Array.isArray(p.items) ? p.items : [];

    return {
      id: p.id,
      nomor: p.nomor,
      pelanggan_kode: pelangganObj?.kode || '-',
      pelanggan_nama: pelangganObj?.nama_toko || 'Tanpa Pelanggan',
      dikonfirmasi_pada: p.dikonfirmasi_pada || null,
      umur_hari: hitungUmurHariWib(p.dikonfirmasi_pada),
      total_item: items.length,
    };
  });

  return (
    <div className="space-y-4">
      <div className="no-print">
        <PageHeader
          title="Daftar Ambil Barang (Picking List)"
          description="Konsolidasi pengambilan barang dari rak gudang untuk pesanan siap kirim."
        />
      </div>

      <PickingWorkspace pesanan={daftarPesanan} />
    </div>
  );
}
