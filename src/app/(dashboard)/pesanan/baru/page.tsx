import * as React from 'react';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { PesananEditor } from '@/features/pesanan/components/pesanan-editor';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import type { BarangOption, PelangganOption } from '@/features/pesanan/types';

export default async function BuatPesananPage() {
  const profil = await getProfil();
  const peran = profil?.peran || 'penjualan';

  // Staf Gudang dilarang membuat draf pesanan
  if (peran === 'gudang') {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();

  // Ambil pelanggan aktif
  const { data: pelangganData } = await supabase
    .from('pelanggan')
    .select('id, kode, nama_toko, alamat, termin_hari, batas_kredit')
    .eq('aktif', true)
    .order('nama_toko', { ascending: true });

  // Ambil barang aktif dari view v_barang
  const { data: barangData } = await supabase
    .from('v_barang')
    .select('id, kode, nama, satuan, harga_jual, stok')
    .eq('aktif', true)
    .order('nama', { ascending: true });

  const pelangganList: PelangganOption[] = (pelangganData || []).map((p) => ({
    id: p.id,
    kode: p.kode,
    nama_toko: p.nama_toko,
    alamat: p.alamat || '',
    termin_hari: p.termin_hari ?? 0,
    batas_kredit: Number(p.batas_kredit) || 0,
  }));

  const barangList: BarangOption[] = (barangData || [])
    .filter((b) => Boolean(b.id))
    .map((b) => ({
      id: b.id || '',
      kode: b.kode || '',
      nama: b.nama || '',
      satuan: b.satuan || '',
      harga_jual: Number(b.harga_jual) || 0,
      stok: Number(b.stok) || 0,
    }));

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title="Buat Draf Pesanan Baru"
        description="Pilih pelanggan aktif dan tambahkan barang yang dipesan. Angka subtotal dihitung otomatis sesuai rumus pembulatan sistem."
      />

      <PesananEditor
        peran={peran}
        pelangganList={pelangganList}
        barangList={barangList}
      />
    </div>
  );
}
